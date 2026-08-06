<script lang="ts">
	import Settings from '@lucide/svelte/icons/settings';
	import Users from '@lucide/svelte/icons/users';
	import type { RepresentationType } from '$lib/core/representation';
	import * as m from '$lib/paraglide/messages';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import Button from '$lib/components/Button.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const TYPE_LABEL: Record<RepresentationType, () => string> = {
		storyboard: m.representation_type_storyboard,
		animatic: m.representation_type_animatic,
		layout: m.representation_type_layout,
		animation: m.representation_type_animation,
		bg: m.representation_type_bg,
		cg_render: m.representation_type_cg_render,
		composite: m.representation_type_composite,
		final: m.representation_type_final,
	};
</script>

<Breadcrumb
	items={[
		{ label: m.nav_back_to_titles(), href: '/' },
		{ label: data.title.name, href: `/${data.title.id}` },
		{ label: m.project_settings_heading() },
	]}
/>

<PageHeader title={m.project_settings_heading()} icon={Settings} />

{#if form?.message}
	<ErrorNotice message={form.message} class="mt-4" />
{/if}

<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
	<Panel>
		<a
			href="/{data.title.id}/members"
			class="text-foreground flex items-center gap-2 no-underline hover:underline"
		>
			<Users size={18} aria-hidden="true" />
			{m.members_link()}
		</a>
	</Panel>

	<Panel tag="form" method="POST" action="?/updateRepresentationTypes" class="space-y-3">
		<div>
			<h2 class="text-foreground text-sm font-semibold">{m.representation_types_heading()}</h2>
			<p class="text-muted mt-0.5 text-xs">{m.representation_types_hint()}</p>
		</div>
		<fieldset class="flex flex-wrap gap-x-4 gap-y-2">
			<legend class="sr-only">{m.representation_types_heading()}</legend>
			{#each data.representationTypes as rt (rt.type)}
				<label class="text-foreground flex items-center gap-1.5 text-sm">
					<input
						type="checkbox"
						name="enabledTypes"
						value={rt.type}
						checked={rt.enabled}
						class="border-border text-primary focus:ring-primary rounded"
					/>
					{TYPE_LABEL[rt.type]()}
				</label>
			{/each}
		</fieldset>
		<Button type="submit">{m.action_save()}</Button>
	</Panel>
</div>
