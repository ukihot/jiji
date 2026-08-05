<script lang="ts">
	import { AlertTriangle, ArrowLeft, Calendar, Plus, Users } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<p>
	<a
		href="/"
		class="text-primary flex w-fit items-center gap-1 text-sm no-underline hover:underline"
	>
		<ArrowLeft size={14} aria-hidden="true" />
		作品一覧
	</a>
</p>
<h1 class="text-foreground mt-2 text-2xl font-bold">{data.title.name}</h1>

{#if data.canManage}
	<p class="mt-2">
		<a
			href="/{data.title.id}/members"
			class="text-primary flex w-fit items-center gap-1.5 text-sm no-underline hover:underline"
		>
			<Users size={16} aria-hidden="true" />
			メンバー管理
		</a>
	</p>
{/if}

<section class="mt-8">
	<h2 class="text-foreground mb-3 text-lg font-semibold">話数一覧</h2>
	{#if data.timelines.length === 0}
		<p class="text-muted text-sm">まだ話数がありません。</p>
	{:else}
		<ul class="divide-border border-border bg-surface divide-y overflow-hidden rounded-lg border">
			{#each data.timelines as timeline (timeline.id)}
				<li>
					<a
						href="/{data.title.id}/{timeline.id}"
						class="text-foreground hover:bg-background flex items-center gap-2 px-4 py-3 no-underline"
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
		<h2 class="text-foreground mb-3 text-lg font-semibold">話数を追加</h2>
		{#if form?.message}
			<p class="text-danger mb-3 flex items-center gap-1.5 text-sm">
				<AlertTriangle size={16} aria-hidden="true" />
				{form.message}
			</p>
		{/if}
		<form method="POST" action="?/createTimeline" class="flex flex-wrap items-end gap-2">
			<label class="text-muted flex flex-col gap-1 text-sm">
				期
				<input
					type="text"
					name="season"
					placeholder="1期"
					required
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
				/>
			</label>
			<label class="text-muted flex flex-col gap-1 text-sm">
				話数
				<input
					type="number"
					name="episode"
					min="1"
					required
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary w-24 rounded-md px-2 py-1.5 text-sm"
				/>
			</label>
			<button
				type="submit"
				class="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
			>
				<Plus size={16} aria-hidden="true" />
				追加
			</button>
		</form>
	</section>
{/if}
