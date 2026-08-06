<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	/**
	 * 「見出し＋（あれば）補足＋右寄せの操作/統計」の並びを全ページで揃えるための共通ヘッダー。
	 * これまでは「設定リンクが本文中にぽつんと浮く」「統計が本文の文章に埋もれる」など
	 * ページごとに置き場所がバラバラだった（＝コンポーネント配置の一貫性のなさ）のを解消する。
	 */
	let {
		title,
		subtitle,
		icon,
		actions,
	}: {
		title: string;
		subtitle?: string;
		icon?: Component<{ size?: number; class?: string; 'aria-hidden'?: string }>;
		actions?: Snippet;
	} = $props();
</script>

<div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
	<div class="min-w-0">
		<h1
			class="text-foreground flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl"
		>
			{#if icon}
				{@const Icon = icon}
				<Icon size={20} class="text-primary shrink-0" aria-hidden="true" />
			{/if}
			<span class="truncate">{title}</span>
		</h1>
		{#if subtitle}
			<p class="text-muted mt-0.5 text-sm">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
