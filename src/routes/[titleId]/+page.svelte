<script lang="ts">
	import Calendar from '@lucide/svelte/icons/calendar';
	import Plus from '@lucide/svelte/icons/plus';
	import Users from '@lucide/svelte/icons/users';
	import * as m from '$lib/paraglide/messages';
	import BackLink from '$lib/components/BackLink.svelte';
	import Button from '$lib/components/Button.svelte';
	import EntityList from '$lib/components/EntityList.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<p>
	<BackLink href="/">{m.nav_back_to_titles()}</BackLink>
</p>
<h1 class="text-foreground mt-2 text-2xl font-bold">{data.title.name}</h1>

{#if data.canManage}
	<p class="mt-2">
		<a
			href="/{data.title.id}/members"
			class="text-primary flex w-fit items-center gap-1.5 text-sm no-underline hover:underline"
		>
			<Users size={16} aria-hidden="true" />
			{m.members_link()}
		</a>
	</p>
{/if}

<section class="mt-8">
	<h2 class="text-foreground mb-3 text-lg font-semibold">{m.timelines_heading()}</h2>
	{#if data.timelines.length === 0}
		<p class="text-muted text-sm">{m.timelines_empty()}</p>
	{:else}
		<EntityList>
			{#each data.timelines as timeline (timeline.id)}
				<li>
					<a
						href="/{data.title.id}/{timeline.id}"
						class="text-foreground hover:bg-background flex items-center gap-2 px-4 py-3 no-underline"
					>
						<Calendar size={16} class="text-muted" aria-hidden="true" />
						{m.episode_label({ season: timeline.season, episode: timeline.episode })}
					</a>
				</li>
			{/each}
		</EntityList>
	{/if}
</section>

{#if data.canManage}
	<section class="mt-8">
		<h2 class="text-foreground mb-3 text-lg font-semibold">{m.add_timeline_heading()}</h2>
		{#if form?.message}
			<ErrorNotice message={form.message} class="mb-3" />
		{/if}
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
	</section>
{/if}
