<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import Film from '@lucide/svelte/icons/film';
	import Link2 from '@lucide/svelte/icons/link-2';
	import ShieldOff from '@lucide/svelte/icons/shield-off';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import Button from '$lib/components/Button.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import PermissionBadge from '$lib/components/PermissionBadge.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let needsName = $derived(
		data.resolved?.isActive &&
			data.resolved.link.permissionLevel === 'contributor' &&
			!data.resolved.claimedPersonName,
	);
</script>

<h1 class="text-foreground flex items-center gap-2 text-2xl font-bold">
	<Film size={22} class="text-primary" aria-hidden="true" />
	Jiji {m.sharelink_page_title()}
</h1>

{#if !data.resolved}
	<ErrorNotice message={m.error_link_invalid()} class="mt-4" />
{:else if !data.resolved.isActive}
	<ErrorNotice message={m.error_link_inactive()} icon={ShieldOff} class="mt-4" />
{:else if needsName}
	<h2 class="text-foreground mt-6 flex items-center gap-1.5 text-lg font-semibold">
		<Sparkles size={18} class="text-primary" aria-hidden="true" />
		{m.claim_heading()}
	</h2>
	<p class="text-muted mt-1 text-sm">
		{m.claim_hint()}
	</p>
	{#if form?.message}
		<ErrorNotice message={form.message} class="mt-3" />
	{/if}
	<form method="POST" action="?/claim" class="mt-4 flex items-end gap-2">
		<FormField label={m.label_display_name()}>
			<FormInput type="text" name="name" required />
		</FormField>
		<Button type="submit">
			{m.action_continue()}
		</Button>
	</form>
{:else}
	<p class="text-foreground mt-6">
		{data.resolved.claimedPersonName
			? m.claim_welcome_named({ name: data.resolved.claimedPersonName })
			: m.claim_welcome_anonymous()}
	</p>
	<dl class="text-muted mt-3 space-y-1.5 text-sm">
		<div class="flex items-center gap-1.5">
			<dt class="sr-only">{m.label_permission()}</dt>
			<PermissionBadge tag="dd" level={data.resolved.link.permissionLevel} />
		</div>
		<div class="flex items-center gap-1.5">
			<Clock size={14} aria-hidden="true" />
			<dt class="sr-only">{m.label_expiry()}</dt>
			<dd>{m.label_expiry()}: {data.resolved.link.expiresAt.toLocaleString(getLocale())}</dd>
		</div>
	</dl>

	<h2 class="text-foreground mt-5 flex items-center gap-1.5 text-base font-semibold">
		<Link2 size={16} aria-hidden="true" />
		{m.label_target_cuts()}
	</h2>
	{#if data.resolved.targetCuts.length === 0}
		<p class="text-muted mt-1 text-sm">{m.sharelink_target_cuts_unavailable()}</p>
	{:else}
		<ul class="mt-2 space-y-1">
			{#each data.resolved.targetCuts as cut (cut.cutId)}
				<li>
					<a
						href="/{cut.titleId}/{cut.timelineId}/cuts/{cut.cutId}"
						class="text-primary text-sm no-underline hover:underline"
					>
						{cut.number}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
