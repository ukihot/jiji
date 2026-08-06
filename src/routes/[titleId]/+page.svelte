<script lang="ts">
	import Calendar from '@lucide/svelte/icons/calendar';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings';
	import * as m from '$lib/paraglide/messages';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import Button from '$lib/components/Button.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const addTimelineOpen = $derived(data.timelines.length === 0 || !!form?.message);
</script>

<Breadcrumb items={[{ label: m.nav_back_to_titles(), href: '/' }, { label: data.title.name }]} />

<PageHeader title={data.title.name}>
	{#snippet actions()}
		{#if data.canManage}
			<a
				href="/{data.title.id}/settings"
				class="border-border text-foreground hover:bg-surface flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm no-underline"
			>
				<Settings size={16} aria-hidden="true" />
				{m.project_settings_link()}
			</a>
		{/if}
	{/snippet}
</PageHeader>

{#if form?.message}
	<ErrorNotice message={form.message} class="mt-4" />
{/if}

<section class="mt-6" aria-label={m.timelines_heading()}>
	{#if data.timelines.length === 0}
		<p class="text-muted text-sm">{m.timelines_empty()}</p>
	{:else}
		<!--
			話数が増えるほど「1話数=1行の縦リスト」は目的の話数を探すのに何度もスクロールさせる。
			幅の余ったシステムらしいレイアウトを活かし、一覧性の高いカードグリッドにする。
		-->
		<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{#each data.timelines as timeline (timeline.id)}
				<li>
					<a
						href="/{data.title.id}/{timeline.id}"
						class="border-border bg-surface hover:border-primary text-foreground flex flex-col items-center gap-1.5 rounded-lg border px-3 py-4 text-center no-underline transition"
					>
						<Calendar size={18} class="text-muted" aria-hidden="true" />
						<span class="text-sm font-medium"
							>{m.episode_label({ season: timeline.season, episode: timeline.episode })}</span
						>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.canManage}
	<details class="border-border bg-surface mt-6 rounded-lg border" open={addTimelineOpen}>
		<summary
			class="text-foreground flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"
		>
			<Plus size={16} aria-hidden="true" />
			{m.add_timeline_heading()}
		</summary>
		<div class="border-border border-t p-4">
			<form method="POST" action="?/createTimeline" class="flex flex-wrap items-end gap-2">
				<FormField label={m.label_season()}>
					<FormInput type="text" name="season" placeholder="1期" required />
				</FormField>
				<FormField label={m.label_episode()}>
					<FormInput type="number" name="episode" min="1" required class="w-24" />
				</FormField>
				<Button type="submit">
					<Plus size={16} aria-hidden="true" />
					{m.action_add()}
				</Button>
			</form>
		</div>
	</details>
{/if}
