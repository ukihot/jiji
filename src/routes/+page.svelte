<script lang="ts">
	import Film from '@lucide/svelte/icons/film';
	import Plus from '@lucide/svelte/icons/plus';
	import * as m from '$lib/paraglide/messages';
	import Button from '$lib/components/Button.svelte';
	import EntityList from '$lib/components/EntityList.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="space-y-1">
	<h1 class="text-foreground text-2xl font-bold">Jiji</h1>
	<p class="text-muted text-sm">
		{m.home_tagline()}
	</p>
</div>

<section class="mt-8">
	<h2 class="text-foreground mb-3 text-lg font-semibold">{m.home_titles_heading()}</h2>
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
						class="text-foreground hover:bg-background block px-4 py-3 no-underline"
					>
						{title.name}
					</a>
				</li>
			{/each}
		</EntityList>
	{/if}
</section>

{#if data.currentPerson}
	<section class="mt-8">
		<h2 class="text-foreground mb-3 text-lg font-semibold">{m.home_create_heading()}</h2>
		{#if form?.message}
			<ErrorNotice message={form.message} class="mb-3" />
		{/if}
		<form method="POST" action="?/createTitle" class="flex items-end gap-2">
			<FormField label={m.label_title_name()}>
				<FormInput type="text" name="name" required />
			</FormField>
			<Button type="submit">
				<Plus size={16} aria-hidden="true" />
				{m.action_create()}
			</Button>
		</form>
	</section>
{/if}
