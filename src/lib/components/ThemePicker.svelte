<script lang="ts">
	import Palette from '@lucide/svelte/icons/palette';
	import * as m from '$lib/paraglide/messages';
	import { THEMES, type ThemeId } from '$lib/theme';
	import IconSelect from './IconSelect.svelte';

	let { theme }: { theme: ThemeId } = $props();

	// svelte-ignore state_referenced_locally
	let currentTheme = $state(theme);

	function onChange(event: Event & { currentTarget: HTMLSelectElement }) {
		currentTheme = event.currentTarget.value as ThemeId;
		document.documentElement.dataset.theme = currentTheme;
		void fetch('/api/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ theme: currentTheme }),
		});
	}
</script>

<IconSelect icon={Palette} srLabel={m.theme_label_sr()} value={currentTheme} onchange={onChange}>
	{#each THEMES as t (t.id)}
		<option value={t.id}>{t.name}</option>
	{/each}
</IconSelect>
