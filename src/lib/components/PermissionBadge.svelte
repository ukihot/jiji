<script lang="ts">
	let { tag = 'span', level }: { tag?: 'span' | 'dd'; level: string } = $props();
</script>

<svelte:element
	this={tag}
	class="border-border text-foreground rounded-full border px-2 py-0.5 text-xs"
>
	{level}
</svelte:element>
