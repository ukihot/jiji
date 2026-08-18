<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { Snippet } from 'svelte';

	let { href, children }: { href: string; children: Snippet } = $props();
</script>

<a {href} class="text-primary flex w-fit items-center gap-1 text-sm no-underline hover:underline">
	<ArrowLeft size={14} aria-hidden="true" />
	{@render children()}
</a>
