<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import Eye from '@lucide/svelte/icons/eye';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Shield from '@lucide/svelte/icons/shield';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Users from '@lucide/svelte/icons/users';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import BackLink from '$lib/components/BackLink.svelte';
	import Button from '$lib/components/Button.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import FormSelect from '$lib/components/FormSelect.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import type { PageProps } from './$types';
	import type { PermissionLevel } from '$lib/core/membership';

	let { data, form }: PageProps = $props();

	const PERMISSION_LEVELS = ['viewer', 'contributor', 'reviewer', 'admin'] as const;
	const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

	const PERMISSION_ICON: Record<PermissionLevel, typeof Shield> = {
		viewer: Eye,
		contributor: Pencil,
		reviewer: MessageSquare,
		admin: Shield,
	};

	function scopeLabel(scopeType: string, scopeId: string): string {
		if (scopeType === 'title') return m.scope_whole_title();
		const timeline = data.timelines.find((t) => t.id === scopeId);
		return timeline
			? m.episode_label({ season: timeline.season, episode: timeline.episode })
			: scopeId;
	}

	function isExpiringSoon(expiresAt: Date | null): boolean {
		return expiresAt !== null && expiresAt.getTime() - Date.now() < FOURTEEN_DAYS_MS;
	}

	function formatDate(date: Date | null): string {
		return date ? date.toLocaleDateString(getLocale()) : m.label_no_expiry();
	}
</script>

<p>
	<BackLink href="/{data.title.id}">{data.title.name}</BackLink>
</p>
<h1 class="text-foreground mt-2 flex items-center gap-2 text-2xl font-bold">
	<Users size={22} class="text-primary" aria-hidden="true" />
	{data.title.name}
	{m.members_heading_suffix()}
</h1>
<p class="text-muted mt-1 text-sm">
	{m.members_hint()}
</p>

{#if form?.message}
	<ErrorNotice message={form.message} class="mt-4" />
{/if}

<div class="border-border bg-surface mt-6 overflow-x-auto rounded-lg border">
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-border text-muted border-b text-left">
				<th class="px-4 py-2 font-medium">{m.label_name()}</th>
				<th class="px-4 py-2 font-medium">{m.label_permission()}</th>
				<th class="px-4 py-2 font-medium">{m.label_scope()}</th>
				<th class="px-4 py-2 font-medium">{m.label_expiry()}</th>
				<th class="px-4 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each data.members as member (member.membershipId)}
				{@const Icon = PERMISSION_ICON[member.permissionLevel]}
				<tr
					class="border-border border-b last:border-0"
					class:opacity-50={!member.isActive}
					class:bg-warning-surface={member.isActive && isExpiringSoon(member.expiresAt)}
				>
					<td class="text-foreground px-4 py-2.5">{member.personName}</td>
					<td class="px-4 py-2.5">
						{#if member.isActive}
							<form method="POST" action="?/updatePermission" class="flex items-center gap-1.5">
								<input type="hidden" name="membershipId" value={member.membershipId} />
								<FormSelect name="permissionLevel" compact>
									{#each PERMISSION_LEVELS as level (level)}
										<option value={level} selected={level === member.permissionLevel}
											>{level}</option
										>
									{/each}
								</FormSelect>
								<Button type="submit" variant="outline">
									{m.action_update()}
								</Button>
							</form>
						{:else}
							<span class="text-muted flex items-center gap-1">
								<Icon size={14} aria-hidden="true" />
								{member.permissionLevel}
							</span>
						{/if}
					</td>
					<td class="text-foreground px-4 py-2.5">{scopeLabel(member.scopeType, member.scopeId)}</td
					>
					<td class="text-foreground px-4 py-2.5">{formatDate(member.expiresAt)}</td>
					<td class="px-4 py-2.5 text-right">
						{#if member.isActive}
							<form method="POST" action="?/revoke">
								<input type="hidden" name="membershipId" value={member.membershipId} />
								<Button type="submit" variant="danger-outline">
									<Ban size={12} aria-hidden="true" />
									{m.action_deactivate_membership()}
								</Button>
							</form>
						{:else}
							<span class="text-muted text-xs">{m.status_deactivated()}</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<section class="mt-8">
	<h2 class="text-foreground mb-3 flex items-center gap-1.5 text-lg font-semibold">
		<UserPlus size={18} aria-hidden="true" />
		{m.invite_heading()}
	</h2>
	<Panel tag="form" method="POST" action="?/invite" class="space-y-4">
		<fieldset class="space-y-2">
			<legend class="text-foreground text-sm font-medium">{m.invite_who_legend()}</legend>
			<FormField label={m.invite_existing_label()}>
				<FormSelect name="existingPersonId">
					<option value="">{m.invite_new_option()}</option>
					{#each data.persons as person (person.id)}
						<option value={person.id}
							>{person.name}{person.email ? `（${person.email}）` : ''}</option
						>
					{/each}
				</FormSelect>
			</FormField>
			<p class="text-muted text-xs">{m.invite_new_hint()}</p>
			<div class="flex flex-wrap gap-2">
				<FormField label={m.label_name()}>
					<FormInput type="text" name="newName" />
				</FormField>
				<FormField label={m.label_email_internal_required()}>
					<FormInput type="email" name="newEmail" />
				</FormField>
				<FormField label={m.label_account_type()}>
					<FormSelect name="newAccountType">
						<option value="internal">{m.account_type_internal_option()}</option>
						<option value="external">{m.account_type_external_option()}</option>
					</FormSelect>
				</FormField>
			</div>
		</fieldset>

		<fieldset class="space-y-2">
			<legend class="text-foreground text-sm font-medium">{m.invite_scope_legend()}</legend>
			<div class="flex flex-wrap gap-2">
				<FormField label={m.label_scope()}>
					<FormSelect name="scopeType">
						<option value="title">{m.scope_whole_title()}</option>
						<option value="timeline">{m.scope_timeline_only_option()}</option>
					</FormSelect>
				</FormField>
				{#if data.timelines.length > 0}
					<FormField label={m.label_scope_timeline_select()}>
						<FormSelect name="scopeTimelineId">
							{#each data.timelines as timeline (timeline.id)}
								<option value={timeline.id}
									>{m.episode_label({ season: timeline.season, episode: timeline.episode })}</option
								>
							{/each}
						</FormSelect>
					</FormField>
				{/if}
				<FormField label={m.label_permission_level()}>
					<FormSelect name="permissionLevel">
						<option value="viewer">{m.permission_viewer_option()}</option>
						<option value="contributor">{m.permission_contributor_option()}</option>
						<option value="reviewer">{m.permission_reviewer_option()}</option>
						<option value="admin">{m.permission_admin_option()}</option>
					</FormSelect>
				</FormField>
				<FormField label={m.label_process_scope()}>
					<FormInput type="text" name="processScope" placeholder="作画, 動画" />
				</FormField>
				<FormField label={m.label_expiry_required_hint()}>
					<FormInput type="date" name="expiresAt" />
				</FormField>
			</div>
		</fieldset>

		<Button type="submit">
			<UserPlus size={16} aria-hidden="true" />
			{m.invite_heading()}
		</Button>
	</Panel>
</section>
