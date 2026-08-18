<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tag = 'div',
		class: extraClass = '',
		children,
		...rest
	}: {
		tag?: 'div' | 'section' | 'form';
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<svelte:element
	this={tag}
	class="border-border bg-surface/94 rounded-2xl border p-5 shadow-[0_12px_30px_color-mix(in_oklch,var(--color-foreground)_5%,transparent)] sm:p-6 {extraClass}"
	{...rest}
>
	{@render children()}
</svelte:element>
