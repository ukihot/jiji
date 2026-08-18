<script lang="ts">
	import Languages from '@lucide/svelte/icons/languages';
	import Palette from '@lucide/svelte/icons/palette';
	import Settings from '@lucide/svelte/icons/settings';
	import User from '@lucide/svelte/icons/user';
	import * as m from '$lib/paraglide/messages';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import BurndownStyleToggle from '$lib/components/BurndownStyleToggle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="max-w-2xl">
	<PageHeader title={m.user_settings_link()} icon={Settings} />

	<Panel tag="section" class="mt-6">
		<h2 class="text-foreground mb-3 flex items-center gap-1.5 text-lg font-semibold">
			<User size={18} aria-hidden="true" />
			{m.settings_profile_heading()}
		</h2>
		{#if data.currentPerson}
			<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
				<dt class="text-muted">{m.label_name()}</dt>
				<dd class="text-foreground">{data.currentPerson.name}</dd>
				<dt class="text-muted">{m.label_email()}</dt>
				<dd class="text-foreground">{data.currentPerson.email ?? '—'}</dd>
				<dt class="text-muted">{m.label_account_type()}</dt>
				<dd class="text-foreground">
					{data.currentPerson.accountType === 'internal'
						? m.account_type_internal_option()
						: m.account_type_external_option()}
				</dd>
			</dl>
		{:else}
			<p class="text-muted text-sm">{m.settings_not_logged_in_hint()}</p>
		{/if}
	</Panel>

	<Panel tag="section" class="mt-4">
		<h2 class="text-foreground mb-3 flex items-center gap-1.5 text-lg font-semibold">
			<Languages size={18} aria-hidden="true" />
			{m.settings_language_heading()}
		</h2>
		<LanguageSwitcher />
	</Panel>

	<Panel tag="section" class="mt-4">
		<h2 class="text-foreground mb-3 flex items-center gap-1.5 text-lg font-semibold">
			<Palette size={18} aria-hidden="true" />
			{m.settings_theme_heading()}
		</h2>
		<ThemePicker theme={data.theme} />
	</Panel>

	<Panel tag="section" class="mt-4">
		<h2 class="text-foreground mb-3 text-lg font-semibold">
			{m.settings_burndown_style_heading()}
		</h2>
		<BurndownStyleToggle style={data.burndownStyle} />
	</Panel>
</div>
