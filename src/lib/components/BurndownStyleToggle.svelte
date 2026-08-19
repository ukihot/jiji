<script lang="ts">
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import { invalidateAll } from '$app/navigation';
	import * as m from '$lib/paraglide/messages';
	import type { BurndownStyle } from '$lib/theme';

	let { style }: { style: BurndownStyle } = $props();
	// svelte-ignore state_referenced_locally
	let rough = $state(style === 'rough');

	async function update(): Promise<void> {
		await fetch('/api/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ burndownStyle: rough ? 'rough' : 'standard' }),
		});
		// +layout.server.ts の load は params / url / fetch / parent() を参照しないため、
		// SvelteKit の既定の再検証条件ではクライアントナビゲーション時に再実行されない。
		// Cookie 保存後に invalidateAll しないと、次回 /settings を開いた際にも
		// 古い style が渡され、常に OFF に見えてしまう。
		await invalidateAll();
	}
</script>

<label
	class="group border-border/80 bg-background hover:border-primary/30 hover:bg-surface/60
	flex cursor-pointer items-center justify-between gap-4 rounded-2xl border px-4 py-3.5
	transition-colors"
>
	<span class="flex min-w-0 items-center gap-3">
		<span
			class="bg-primary/8 text-primary group-hover:bg-primary/12
			grid size-10 shrink-0 place-items-center rounded-xl transition-colors"
		>
			<PencilLine size={18} strokeWidth={1.8} aria-hidden="true" />
		</span>

		<span class="min-w-0">
			<span class="text-foreground block text-sm font-semibold"
				>{m.burndown_rough_toggle_label()}</span
			>
			<span class="text-muted mt-0.5 block text-xs leading-relaxed">
				{m.burndown_rough_toggle_hint()}
			</span>
		</span>
	</span>

	<input type="checkbox" bind:checked={rough} onchange={update} class="peer sr-only" />

	<span
		class="bg-border/80 peer-checked:bg-primary
		peer-focus-visible:ring-primary/30 relative h-6 w-11 shrink-0 rounded-full
		transition-all duration-200
		peer-focus-visible:ring-4
		after:absolute after:top-0.5 after:left-0.5 after:size-5
		after:rounded-full after:bg-white after:shadow-sm
		after:transition-transform after:duration-200
		peer-checked:after:translate-x-5"
	></span>
</label>
