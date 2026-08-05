<script lang="ts">
	import { AlertTriangle, Film, Plus } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="space-y-1">
	<h1 class="text-foreground text-2xl font-bold">Jiji</h1>
	<p class="text-muted text-sm">
		絵コンテから完パケまで、1本のタイムラインが更新され続ける作品管理ツール。
	</p>
</div>

<section class="mt-8">
	<h2 class="text-foreground mb-3 text-lg font-semibold">作品一覧</h2>
	{#if data.titles.length === 0}
		<p class="text-muted flex items-center gap-2 text-sm">
			<Film size={16} aria-hidden="true" />
			まだ作品がありません。
		</p>
	{:else}
		<ul class="divide-border border-border bg-surface divide-y overflow-hidden rounded-lg border">
			{#each data.titles as title (title.id)}
				<li>
					<a
						href="/{title.id}"
						class="text-foreground hover:bg-background block px-4 py-3 no-underline"
					>
						{title.name}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.currentPerson}
	<section class="mt-8">
		<h2 class="text-foreground mb-3 text-lg font-semibold">新しい作品を作る</h2>
		{#if form?.message}
			<p class="text-danger mb-3 flex items-center gap-1.5 text-sm">
				<AlertTriangle size={16} aria-hidden="true" />
				{form.message}
			</p>
		{/if}
		<form method="POST" action="?/createTitle" class="flex items-end gap-2">
			<label class="text-muted flex flex-col gap-1 text-sm">
				作品名
				<input
					type="text"
					name="name"
					required
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
				/>
			</label>
			<button
				type="submit"
				class="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
			>
				<Plus size={16} aria-hidden="true" />
				作成
			</button>
		</form>
	</section>
{/if}
