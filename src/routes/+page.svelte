<script lang="ts">
	import { AlertTriangle, Film, Plus } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="space-y-1">
	<h1 class="text-2xl font-bold text-foreground">Jiji</h1>
	<p class="text-sm text-muted">絵コンテから完パケまで、1本のタイムラインが更新され続ける作品管理ツール。</p>
</div>

<section class="mt-8">
	<h2 class="mb-3 text-lg font-semibold text-foreground">作品一覧</h2>
	{#if data.titles.length === 0}
		<p class="flex items-center gap-2 text-sm text-muted">
			<Film size={16} aria-hidden="true" />
			まだ作品がありません。
		</p>
	{:else}
		<ul class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
			{#each data.titles as title (title.id)}
				<li>
					<a href="/{title.id}" class="block px-4 py-3 text-foreground no-underline hover:bg-background">
						{title.name}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.currentPerson}
	<section class="mt-8">
		<h2 class="mb-3 text-lg font-semibold text-foreground">新しい作品を作る</h2>
		{#if form?.message}
			<p class="mb-3 flex items-center gap-1.5 text-sm text-danger">
				<AlertTriangle size={16} aria-hidden="true" />
				{form.message}
			</p>
		{/if}
		<form method="POST" action="?/createTitle" class="flex items-end gap-2">
			<label class="flex flex-col gap-1 text-sm text-muted">
				作品名
				<input
					type="text"
					name="name"
					required
					class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
				/>
			</label>
			<button
				type="submit"
				class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
			>
				<Plus size={16} aria-hidden="true" />
				作成
			</button>
		</form>
	</section>
{/if}
