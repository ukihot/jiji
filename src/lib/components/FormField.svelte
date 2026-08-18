<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		class: extraClass = '',
		children,
	}: { label: string; class?: string; children: Snippet } = $props();
</script>

<label class="text-muted flex flex-col gap-1 text-sm {extraClass}">
	{label}
	{@render children()}
</label>
