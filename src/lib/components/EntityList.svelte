<script lang="ts">
	import type { Snippet } from 'svelte';

	let { class: extraClass = '', children }: { class?: string; children: Snippet } = $props();
</script>

<ul
	class="divide-border border-border bg-surface divide-y overflow-hidden rounded-lg border {extraClass}"
>
	{@render children()}
</ul>
