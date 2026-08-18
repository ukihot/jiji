<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	let {
		compact = false,
		class: extraClass = '',
		children,
		...rest
	}: HTMLSelectAttributes & { compact?: boolean; children: Snippet } = $props();

	const sizeClass = $derived(compact ? 'py-1 pr-6 pl-2 text-xs' : 'px-2 py-1.5 text-sm');
</script>

<select
	class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md {sizeClass} {extraClass}"
	{...rest}
>
	{@render children()}
</select>
