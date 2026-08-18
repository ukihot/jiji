<script lang="ts">
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import BackLink from '$lib/components/BackLink.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function formatPayload(payload: unknown): string {
		return JSON.stringify(payload, null, 2);
	}
</script>

<PageHeader title={m.audit_log_heading()} subtitle={m.audit_log_hint()} icon={ScrollText} />

{#if data.events.length === 0}
	<p class="text-muted mt-6 text-sm">{m.audit_log_empty()}</p>
{:else}
	<div class="border-border bg-surface mt-6 overflow-x-auto rounded-lg border">
		<table class="w-full min-w-250 border-collapse text-sm">
			<thead>
				<tr class="border-border text-muted border-b text-left">
					<th class="px-4 py-2 font-medium">{m.audit_time()}</th>
					<th class="px-4 py-2 font-medium">{m.audit_event()}</th>
					<th class="px-4 py-2 font-medium">{m.audit_target()}</th>
					<th class="px-4 py-2 font-medium">{m.audit_details()}</th>
					<th class="px-4 py-2 font-medium">{m.audit_hash()}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.events as event (event.id)}
					<tr class="border-border border-b align-top last:border-0">
						<td class="text-foreground px-4 py-3 text-xs whitespace-nowrap"
							>{event.createdAt.toLocaleString(getLocale())}</td
						>
						<td class="text-foreground px-4 py-3 font-mono text-xs">{event.type}</td>
						<td class="text-muted px-4 py-3 font-mono text-xs"
							>{event.targetType}/{event.targetId}</td
						>
						<td class="px-4 py-3"
							><pre
								class="text-muted max-w-130 overflow-x-auto text-xs whitespace-pre-wrap">{formatPayload(
									event.payload,
								)}</pre></td
						>
						<td class="text-muted px-4 py-3 font-mono text-xs" title={event.hash}
							>{event.hash.slice(0, 12)}…<br />{event.prevHash
								? m.audit_hash_linked()
								: m.audit_hash_root()}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<p class="mt-6"><BackLink href="/">{m.nav_back_home()}</BackLink></p>
