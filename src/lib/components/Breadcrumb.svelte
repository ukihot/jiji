<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	/**
	 * Title→Timeline→Cut の階層をどのページでも同じ場所・同じ見た目で示すためのパンくず。
	 * 各ページがバラバラに <p><BackLink></p> を置いていた状態（1階層しか戻れず、
	 * 今どこにいるかが常に見えるわけではない）をやめ、全階層を常時クリック可能にする。
	 * 最後の要素はリンクにせず「現在地」として太字表示する。
	 */
	let { items }: { items: { label: string; href?: string }[] } = $props();
</script>

<nav aria-label="breadcrumb" class="mb-3 flex flex-wrap items-center gap-1 text-sm">
	{#each items as item, i (item.label + i)}
		{#if i > 0}
			<ChevronRight size={14} class="text-muted shrink-0 opacity-60" aria-hidden="true" />
		{/if}
		{#if item.href}
			<a
				href={item.href}
				class="text-muted hover:text-foreground max-w-[16rem] truncate no-underline hover:underline"
				>{item.label}</a
			>
		{:else}
			<span class="text-foreground max-w-[20rem] truncate font-medium" aria-current="page"
				>{item.label}</span
			>
		{/if}
	{/each}
</nav>
