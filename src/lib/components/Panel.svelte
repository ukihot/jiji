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
	class="border-border bg-surface rounded-lg border p-4 {extraClass}"
	{...rest}
>
	{@render children()}
</svelte:element>
