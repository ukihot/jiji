<script lang="ts">
	import { AlertTriangle, ArrowLeft, Calendar, Plus, Users } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<p>
	<a href="/" class="flex w-fit items-center gap-1 text-sm text-primary no-underline hover:underline">
		<ArrowLeft size={14} aria-hidden="true" />
		作品一覧
	</a>
</p>
<h1 class="mt-2 text-2xl font-bold text-foreground">{data.title.name}</h1>

{#if data.canManage}
	<p class="mt-2">
		<a
			href="/{data.title.id}/members"
			class="flex w-fit items-center gap-1.5 text-sm text-primary no-underline hover:underline"
		>
			<Users size={16} aria-hidden="true" />
			メンバー管理
		</a>
	</p>
{/if}

<section class="mt-8">
	<h2 class="mb-3 text-lg font-semibold text-foreground">話数一覧</h2>
	{#if data.timelines.length === 0}
		<p class="text-sm text-muted">まだ話数がありません。</p>
	{:else}
		<ul class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
			{#each data.timelines as timeline (timeline.id)}
				<li>
					<a
						href="/{data.title.id}/{timeline.id}"
						class="flex items-center gap-2 px-4 py-3 text-foreground no-underline hover:bg-background"
					>
						<Calendar size={16} class="text-muted" aria-hidden="true" />
						{timeline.season} 第{timeline.episode}話
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.canManage}
	<section class="mt-8">
		<h2 class="mb-3 text-lg font-semibold text-foreground">話数を追加</h2>
		{#if form?.message}
			<p class="mb-3 flex items-center gap-1.5 text-sm text-danger">
				<AlertTriangle size={16} aria-hidden="true" />
				{form.message}
			</p>
		{/if}
		<form method="POST" action="?/createTimeline" class="flex flex-wrap items-end gap-2">
			<label class="flex flex-col gap-1 text-sm text-muted">
				期
				<input
					type="text"
					name="season"
					placeholder="1期"
					required
					class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm text-muted">
				話数
				<input
					type="number"
					name="episode"
					min="1"
					required
					class="w-24 rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
				/>
			</label>
			<button
				type="submit"
				class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
			>
				<Plus size={16} aria-hidden="true" />
				追加
			</button>
		</form>
	</section>
{/if}
