<script lang="ts">
	import { onMount } from 'svelte';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import Radio from '@lucide/svelte/icons/radio';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import * as m from '$lib/paraglide/messages';
	import Button from '$lib/components/Button.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import {
		checkWritable,
		getStoredRelayRecord,
		postJson,
		readHandle,
		registerRelayConnection,
		relayConnection,
		saveHandle,
	} from '$lib/client/relay-connection.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// svelte-ignore state_referenced_locally
	let selectedConnectionId = $state(
		relayConnection.storageConnectionId ?? data.storageConnections[0]?.id ?? '',
	);
	let displayName = $state(relayConnection.displayName);
	let registrationState = $state<'not_started' | 'registering' | 'registered' | 'failed'>(
		relayConnection.relayId ? 'registered' : 'not_started',
	);
	let registrationDetail = $state(
		relayConnection.relayId ? m.relay_registration_success_detail() : '',
	);
	let working = $state(false);
	let workingLabel = $state(m.relay_working_generic());
	let setupStage = $state<
		'idle' | 'selecting_directory' | 'saving_handle' | 'checking_shared_folder' | 'registering'
	>('idle');
	let directoryPickerActive = false;
	let fetchingNow = $state(false);
	let fetchMessage = $state<string>('');

	const RELAY_FETCH_API_TIMEOUT_MS = 60_000;

	interface RelayTransferJobFromApi {
		jobId: string;
		leaseToken: string;
		targetRelativePath: string;
		expectedSize: number;
		downloadUrl: string;
	}

	function activeConnection() {
		return (
			data.storageConnections.find((connection) => connection.id === selectedConnectionId) ?? null
		);
	}

	async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
		const digest = await crypto.subtle.digest('SHA-256', buffer);
		return Array.from(new Uint8Array(digest))
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	}

	/** targetRelativePathのサブフォルダを辿り（無ければ作り）、最終セグメントへ書き込む。 */
	async function writeToHandle(
		root: JijiRelayDirectoryHandle,
		relativePath: string,
		data: ArrayBuffer,
	): Promise<void> {
		const segments = relativePath.split('/');
		const fileName = segments.pop();
		if (!fileName) throw new Error(m.relay_fetch_error());
		let dir = root;
		for (const segment of segments) {
			dir = await dir.getDirectoryHandle(segment, { create: true });
		}
		const fileHandle = await dir.getFileHandle(fileName, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(data);
		await writable.close();
	}

	async function setupRelay() {
		if (working || directoryPickerActive) {
			relayConnection.message = m.relay_picker_already_open();
			return;
		}
		if (!window.showDirectoryPicker) {
			relayConnection.message = m.relay_browser_unsupported();
			return;
		}
		const connection = activeConnection();
		if (!connection) {
			relayConnection.message = m.relay_storage_unconfigured();
			return;
		}
		working = true;
		directoryPickerActive = true;
		try {
			setupStage = 'selecting_directory';
			workingLabel = m.relay_selecting_folder_label();
			relayConnection.message = m.relay_selecting_folder_message();
			const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
			setupStage = 'saving_handle';
			relayConnection.folderName = handle.name;
			workingLabel = m.relay_saving_handle_label();
			relayConnection.message = m.relay_saving_handle_message();
			await saveHandle(connection.id, handle);

			setupStage = 'checking_shared_folder';
			workingLabel = m.relay_checking_folder_label();
			registrationState = 'registering';
			registrationDetail = m.relay_checking_folder_message();
			setupStage = 'registering';
			workingLabel = m.relay_registering_label();
			const resolvedDisplayName =
				displayName.trim() || m.relay_default_display_name({ name: data.currentPerson.name });
			await registerRelayConnection({
				handle,
				titleId: connection.titleId,
				storageConnectionId: connection.id,
				displayName: resolvedDisplayName,
				folderName: handle.name,
			});
			registrationState = 'registered';
			registrationDetail = m.relay_registration_success_detail();
		} catch (error) {
			if (
				error instanceof DOMException &&
				error.name === 'AbortError' &&
				setupStage === 'selecting_directory'
			) {
				relayConnection.message = m.relay_selection_cancelled();
			} else {
				const failureMessage =
					error instanceof DOMException && error.name === 'InvalidStateError'
						? m.relay_picker_other_open()
						: error instanceof Error
							? error.message
							: m.relay_start_failed();
				relayConnection.status = 'offline';
				relayConnection.message = failureMessage;
				registrationState = 'failed';
				registrationDetail = failureMessage;
			}
		} finally {
			directoryPickerActive = false;
			setupStage = 'idle';
			working = false;
		}
	}

	async function resumeRelay() {
		const connection = activeConnection();
		if (!connection) return;
		working = true;
		workingLabel = m.relay_resuming_label();
		registrationState = 'registering';
		registrationDetail = m.relay_resuming_message();
		try {
			const record = getStoredRelayRecord(connection.id);
			if (record?.displayName) displayName = record.displayName;
			const handle = await readHandle(connection.id);
			if (!handle) throw new Error(m.relay_registered_folder_missing());
			const resolvedDisplayName =
				displayName.trim() || m.relay_default_display_name({ name: data.currentPerson.name });
			await registerRelayConnection({
				handle,
				titleId: connection.titleId,
				storageConnectionId: connection.id,
				displayName: resolvedDisplayName,
				folderName: handle.name,
			});
			registrationState = 'registered';
			registrationDetail = m.relay_registration_success_detail();
		} catch (error) {
			const failureMessage = error instanceof Error ? error.message : m.relay_resume_failed();
			relayConnection.status = 'offline';
			relayConnection.message = failureMessage;
			registrationState = 'failed';
			registrationDetail = failureMessage;
		} finally {
			setupStage = 'idle';
			working = false;
		}
	}

	/**
	 * 「今すぐ取得」。design.md 9.6.5の3〜10相当を、このRelayが1件ずつ処理する。
	 * 出稿元が無いため、サーバー側がbucket/prefixをlist scanしてjob化した結果を受け取るだけでよい。
	 */
	async function fetchNow() {
		if (fetchingNow) return;
		const connection = activeConnection();
		const relayId = relayConnection.relayId;
		if (!relayId || !connection) {
			fetchMessage = m.relay_fetch_not_ready();
			return;
		}
		fetchingNow = true;
		fetchMessage = m.relay_fetch_scanning_message();
		try {
			const handle = await readHandle(connection.id);
			if (!handle) throw new Error(m.relay_registered_folder_missing());
			await checkWritable(handle);

			const { jobs } = await postJson<{ jobs: RelayTransferJobFromApi[] }>(
				'/api/relay/jobs',
				{ relayId },
				RELAY_FETCH_API_TIMEOUT_MS,
			);
			if (jobs.length === 0) {
				fetchMessage = m.relay_fetch_none_found();
				return;
			}

			let succeeded = 0;
			let failed = 0;
			for (const [index, job] of jobs.entries()) {
				fetchMessage = m.relay_fetch_progress({
					done: String(index + 1),
					total: String(jobs.length),
					fileName: job.targetRelativePath,
				});
				try {
					const fileResponse = await fetch(job.downloadUrl);
					if (!fileResponse.ok) throw new Error(`HTTP ${fileResponse.status}`);
					const buffer = await fileResponse.arrayBuffer();
					await writeToHandle(handle, job.targetRelativePath, buffer);
					const actualSha256 = await sha256Hex(buffer);
					await postJson(
						'/api/relay/deliver',
						{
							jobId: job.jobId,
							relayId,
							leaseToken: job.leaseToken,
							actualSize: buffer.byteLength,
							actualSha256,
						},
						RELAY_FETCH_API_TIMEOUT_MS,
					);
					succeeded += 1;
				} catch (error) {
					failed += 1;
					fetchMessage = m.relay_fetch_file_failed({
						fileName: job.targetRelativePath,
						reason: error instanceof Error ? error.message : String(error),
					});
				}
			}
			fetchMessage =
				failed === 0
					? m.relay_fetch_completed({ count: String(succeeded) })
					: m.relay_fetch_completed_with_failures({
							success: String(succeeded),
							failed: String(failed),
						});
		} catch (error) {
			fetchMessage = error instanceof Error ? error.message : m.relay_fetch_error();
		} finally {
			fetchingNow = false;
		}
	}

	onMount(() => {
		const connection = activeConnection();
		if (!connection || relayConnection.folderName) return;
		const record = getStoredRelayRecord(connection.id);
		if (record?.folderName) relayConnection.folderName = record.folderName;
	});
</script>

<PageHeader title={m.relay_page_title()} subtitle={m.relay_page_subtitle()} icon={Radio} />

<div class="mt-6 grid max-w-4xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
	<Panel class="space-y-4">
		<div class="flex items-start gap-3">
			<span
				class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl"
			>
				<HardDrive size={19} aria-hidden="true" />
			</span>
			<div>
				<p class="text-foreground text-sm font-semibold">{m.relay_setup_heading()}</p>
				<p class="text-muted mt-1 text-xs">{m.relay_setup_hint()}</p>
			</div>
		</div>
		<div class="border-border bg-background/45 space-y-2 rounded-lg border p-3" aria-live="polite">
			<p class="text-muted text-xs font-semibold tracking-[0.12em]">
				{m.relay_selected_folder_heading()}
			</p>
			<p class="text-foreground text-sm font-semibold break-all">
				{relayConnection.folderName ?? m.relay_selected_folder_none()}
			</p>
			<p class="text-muted text-xs">{m.relay_selected_folder_path_limited()}</p>
		</div>
		<div
			class="border-border bg-background/45 rounded-lg border p-3 text-xs leading-5"
			aria-live="polite"
		>
			<p class="text-muted font-semibold tracking-[0.12em]">{m.relay_registration_heading()}</p>
			<p
				class:text-success={registrationState === 'registered'}
				class:text-warning={registrationState === 'registering'}
				class:text-danger={registrationState === 'failed'}
				class="text-foreground mt-1 text-sm font-semibold"
			>
				{registrationState === 'registered'
					? m.relay_registration_succeeded()
					: registrationState === 'registering'
						? m.relay_registration_registering()
						: registrationState === 'failed'
							? m.relay_registration_failed()
							: m.relay_registration_not_started()}
			</p>
			{#if registrationDetail}
				<p class="text-muted mt-1">{registrationDetail}</p>
			{/if}
		</div>

		{#if data.storageConnections.length === 0}
			<p class="border-warning/40 bg-warning-surface text-foreground rounded-lg border p-3 text-sm">
				{m.relay_storage_unconfigured()}
			</p>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2">
				<FormField label={m.relay_destination_label()}>
					<select
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
						value={selectedConnectionId}
						onchange={(event) => (selectedConnectionId = event.currentTarget.value)}
					>
						{#each data.storageConnections as connection (connection.id)}
							<option value={connection.id}
								>{connection.titleName} · {connection.bucketOrContainer}/{connection.prefix}</option
							>
						{/each}
					</select>
				</FormField>
				<FormField label={m.relay_display_name_label()}>
					<input
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
						value={displayName}
						placeholder={`${data.currentPerson.name}-PC`}
						oninput={(event) => (displayName = event.currentTarget.value)}
					/>
				</FormField>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button onclick={setupRelay} disabled={working}>
					<HardDrive size={16} aria-hidden="true" />
					{working ? workingLabel : m.relay_start_action()}
				</Button>
				<Button onclick={resumeRelay} disabled={working} variant="outline"
					>{m.relay_resume_action()}</Button
				>
			</div>
		{/if}
	</Panel>

	<Panel class="space-y-4">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-muted text-xs font-semibold tracking-[0.14em]">
					{m.relay_connection_eyebrow()}
				</p>
				<h2 class="text-foreground mt-1 text-sm font-semibold">{m.relay_status_heading()}</h2>
			</div>
			<span
				class:status-online={relayConnection.status === 'online'}
				class:status-checking={relayConnection.status === 'checking' ||
					relayConnection.status === 'connecting'}
				class:status-offline={relayConnection.status === 'offline' ||
					relayConnection.status === 'idle'}
				class="relay-status"
			>
				{relayConnection.status === 'online'
					? m.relay_status_online()
					: relayConnection.status === 'checking' || relayConnection.status === 'connecting'
						? m.relay_status_checking()
						: m.relay_status_offline()}
			</span>
		</div>
		<p class="text-muted text-sm leading-6">{relayConnection.message}</p>

		{#if relayConnection.relayId}
			<div class="border-border bg-background/45 space-y-2 rounded-lg border p-3">
				<div class="flex items-center justify-between gap-2">
					<p class="text-muted text-xs font-semibold tracking-[0.12em]">
						{m.relay_transfer_eyebrow()}
					</p>
					<Button onclick={fetchNow} disabled={fetchingNow} variant="outline">
						{fetchingNow ? m.relay_fetch_now_action_progress() : m.relay_fetch_now_action()}
					</Button>
				</div>
				{#if fetchMessage}
					<p class="text-muted text-xs leading-5" aria-live="polite">{fetchMessage}</p>
				{/if}
			</div>
		{/if}

		<div class="border-border bg-background/45 rounded-lg border p-3 text-xs leading-5">
			<div class="text-foreground flex gap-2">
				<ShieldCheck size={15} class="text-success mt-0.5 shrink-0" />
				<span>{m.relay_privacy_notice()}</span>
			</div>
		</div>
		<p class="text-muted text-xs">
			{m.relay_offline_hint()}
		</p>
	</Panel>
</div>

<style>
	.relay-status {
		border-radius: 999px;
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 650;
	}

	.status-online {
		background: color-mix(in oklch, var(--color-success) 14%, transparent);
		color: var(--color-success);
	}

	.status-checking {
		background: color-mix(in oklch, var(--color-warning) 16%, transparent);
		color: var(--color-warning);
	}

	.status-offline {
		background: color-mix(in oklch, var(--color-muted) 12%, transparent);
		color: var(--color-muted);
	}
</style>
