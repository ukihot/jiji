<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import * as m from '$lib/paraglide/messages';
	import type { ThemeMode } from '$lib/theme';

	let { mode }: { mode: ThemeMode } = $props();

	// svelte-ignore state_referenced_locally
	let currentMode = $state(mode);

	function toggle() {
		currentMode = currentMode === 'light' ? 'dark' : 'light';
		document.documentElement.dataset.mode = currentMode;
		// Cookieへの保存は failしても致命的ではないのでawaitしない（UIは即座に反映済み）
		void fetch('/api/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ mode: currentMode }),
		});
	}
</script>

<button
	type="button"
	onclick={toggle}
	class="border-border text-foreground hover:bg-surface rounded-md border p-1.5 transition-colors"
	aria-label={currentMode === 'light' ? m.theme_switch_to_dark() : m.theme_switch_to_light()}
	title={currentMode === 'light' ? m.theme_switch_to_dark() : m.theme_switch_to_light()}
>
	{#if currentMode === 'light'}
		<Sun size={16} />
	{:else}
		<Moon size={16} />
	{/if}
</button>
