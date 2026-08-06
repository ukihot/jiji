<script lang="ts">
	import Film from '@lucide/svelte/icons/film';
	import Plus from '@lucide/svelte/icons/plus';
	import * as m from '$lib/paraglide/messages';
	import Button from '$lib/components/Button.svelte';
	import EntityList from '$lib/components/EntityList.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const createOpen = $derived(data.titles.length === 0 || !!form?.message);
</script>

<div class="max-w-2xl">
	<PageHeader title="Jiji" subtitle={m.home_tagline()} icon={Film} />

	<section class="mt-8">
		<h2 class="text-muted mb-3 text-xs font-semibold tracking-wide uppercase">
			{m.home_titles_heading()}
		</h2>
		{#if data.titles.length === 0}
			<p class="text-muted flex items-center gap-2 text-sm">
				<Film size={16} aria-hidden="true" />
				{m.home_titles_empty()}
			</p>
		{:else}
			<EntityList>
				{#each data.titles as title (title.id)}
					<li>
						<a
							href="/{title.id}"
							class="text-foreground hover:bg-background flex items-center gap-2 px-4 py-3 no-underline"
						>
							<Film size={16} class="text-muted shrink-0" aria-hidden="true" />
							{title.name}
						</a>
					</li>
				{/each}
			</EntityList>
		{/if}
	</section>

	{#if data.currentPerson}
		{#if form?.message}
			<ErrorNotice message={form.message} class="mt-6" />
		{/if}
		<details class="border-border bg-surface mt-6 rounded-lg border" open={createOpen}>
			<summary
				class="text-foreground flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"
			>
				<Plus size={16} aria-hidden="true" />
				{m.home_create_heading()}
			</summary>
			<div class="border-border border-t p-4">
				<form method="POST" action="?/createTitle" class="flex flex-wrap items-end gap-2">
					<FormField label={m.label_title_name()}>
						<FormInput type="text" name="name" required />
					</FormField>
					<Button type="submit">
						<Plus size={16} aria-hidden="true" />
						{m.action_create()}
					</Button>
				</form>
			</div>
		</details>
	{/if}
</div>
