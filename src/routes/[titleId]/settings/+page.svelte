<script lang="ts">
	import Settings from '@lucide/svelte/icons/settings';
	import Users from '@lucide/svelte/icons/users';
	import type { RepresentationType } from '$lib/core/representation';
	import * as m from '$lib/paraglide/messages';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import Button from '$lib/components/Button.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import FormSelect from '$lib/components/FormSelect.svelte';
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

	function nodeLabel(node: {
		capabilityKey: string;
		representationType: RepresentationType | null;
	}) {
		return (
			data.terms.find((term) => term.capabilityKey === node.capabilityKey)?.displayName ??
			(node.representationType ? TYPE_LABEL[node.representationType]() : node.capabilityKey)
		);
	}

	const EDGE_LABEL: Record<'requires' | 'feeds' | 'informs', () => string> = {
		requires: m.blueprint_edge_requires,
		feeds: m.blueprint_edge_feeds,
		informs: m.blueprint_edge_informs,
	} as const;
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
	<Panel class="settings-link-panel">
		<a href="/{data.title.id}/members" class="text-foreground flex items-center gap-3 no-underline">
			<span
				class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl"
			>
				<Users size={18} aria-hidden="true" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="settings-eyebrow">COLLABORATION</span>
				<span class="mt-1 block text-sm font-semibold">{m.members_link()}</span>
			</span>
			<span class="text-muted" aria-hidden="true">↗</span>
		</a>
	</Panel>

	<Panel tag="form" method="POST" action="?/updateRepresentationTypes" class="space-y-3">
		<div>
			<p class="settings-eyebrow">BLUEPRINT</p>
			<h2 class="text-foreground text-sm font-semibold">Atelier Setup</h2>
			<p class="text-muted mt-0.5 text-xs">
				{m.settings_atelier_hint()}
			</p>
		</div>
		<fieldset class="flex flex-wrap gap-x-2 gap-y-2">
			<legend class="sr-only">{m.representation_types_heading()}</legend>
			{#each data.representationTypes as rt (rt.type)}
				<label
					class="border-border bg-background/60 text-foreground flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
				>
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
		<Button type="submit">{m.action_publish_blueprint()}</Button>
		{#if form?.success}
			<p class="text-success text-xs">
				{m.settings_blueprint_published({ version: form.version ?? 0 })}
			</p>
		{/if}
	</Panel>

	<Panel class="space-y-3">
		<div>
			<p class="settings-eyebrow">CURRENT CONTRACT</p>
			<h2 class="text-foreground text-sm font-semibold">
				{m.settings_current_production_grammar()}
			</h2>
			<p class="text-muted mt-0.5 text-xs">{m.settings_current_production_grammar_hint()}</p>
		</div>
		{#if data.blueprint}
			<p class="text-muted text-xs">
				{m.settings_published_blueprint({ version: data.blueprint.version })}
			</p>
			<ol class="flex flex-wrap items-center gap-2">
				{#each data.blueprint.nodes as node, index (node.id)}
					{#if index > 0}
						<span class="text-muted" aria-hidden="true">→</span>
					{/if}
					<li
						class="border-border bg-background text-foreground rounded-full border px-2.5 py-1 text-xs"
					>
						{data.terms.find((term) => term.capabilityKey === node.capabilityKey)?.displayName ??
							TYPE_LABEL[node.representationType!]()}
					</li>
				{/each}
			</ol>
		{:else}
			<p class="text-muted text-sm">
				{m.settings_no_blueprint()}
			</p>
		{/if}
	</Panel>

	{#if data.structureMap}
		<Panel class="structure-map-panel space-y-4 lg:col-span-2">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<p class="settings-eyebrow">GRAPH PROJECTION</p>
					<h2 class="text-foreground text-sm font-semibold">Structure Map</h2>
					<p class="text-muted mt-0.5 text-xs">
						{m.settings_structure_map_hint()}
					</p>
				</div>
				<span class="text-muted text-xs"
					>Blueprint v{data.structureMap.nodes.length > 0 ? data.blueprint?.version : ''}</span
				>
			</div>
			<ol class="structure-map-grid">
				{#each data.structureMap.nodes as node (node.id)}
					{@const incoming = data.structureMap.edges.filter((edge) => edge.toNodeId === node.id)}
					<li class="structure-node" style:--node-layer={node.layer}>
						<div class="flex items-start justify-between gap-2">
							<span class="text-foreground text-sm font-semibold">{nodeLabel(node)}</span>
							<span
								class="text-muted rounded-full border border-current/20 px-1.5 py-0.5 text-[0.65rem] tabular-nums"
							>
								{m.settings_structure_layer({ layer: node.layer + 1 })}
							</span>
						</div>
						{#if incoming.length === 0}
							<p class="text-muted mt-2 text-xs">{m.settings_structure_startable()}</p>
						{:else}
							<ul class="text-muted mt-3 flex flex-wrap gap-1.5 text-xs">
								{#each incoming as edge (edge.fromNodeId + edge.relation)}
									{@const source = data.structureMap.nodes.find(
										(candidate) => candidate.id === edge.fromNodeId,
									)}
									<li class="edge-chip">
										<span class="text-foreground"
											>{source ? nodeLabel(source) : edge.fromNodeId}</span
										>
										<span class="text-muted">· {EDGE_LABEL[edge.relation]()}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ol>
			<p class="text-muted text-xs">
				{m.settings_structure_note()}
			</p>
		</Panel>
	{/if}

	{#if data.blueprint}
		<Panel tag="form" method="POST" action="?/defineStudioTerm" class="space-y-3">
			<div>
				<p class="settings-eyebrow">LOCAL DIALECT</p>
				<h2 class="text-foreground text-sm font-semibold">{m.settings_glossary_heading()}</h2>
				<p class="text-muted mt-0.5 text-xs">
					{m.settings_glossary_hint()}
				</p>
			</div>
			<div class="grid gap-2 sm:grid-cols-2">
				<FormField label={m.label_standard_process()}>
					<FormSelect name="capabilityKey" required>
						{#each data.blueprint.nodes as node (node.id)}
							<option value={node.capabilityKey}>
								{TYPE_LABEL[node.representationType!]()}
							</option>
						{/each}
					</FormSelect>
				</FormField>
				<FormField label={m.label_title_term_name()}>
					<FormInput name="displayName" placeholder={m.placeholder_title_term_name()} required />
				</FormField>
				<FormField label={m.label_aliases_optional()}>
					<FormInput name="aliases" placeholder={m.placeholder_aliases()} />
				</FormField>
				<FormField label={m.label_usage_note_optional()}>
					<FormInput name="usageNote" placeholder={m.placeholder_usage_note()} />
				</FormField>
			</div>
			<Button type="submit" variant="outline">{m.action_register_term()}</Button>

			{#if data.terms.length > 0}
				<ul class="border-border divide-border divide-y rounded-lg border text-sm">
					{#each data.terms as term (term.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
							<span class="text-foreground font-medium">{term.displayName}</span>
							<span class="text-muted text-xs">
								{data.blueprint.nodes.find((node) => node.capabilityKey === term.capabilityKey)
									? TYPE_LABEL[
											data.blueprint.nodes.find(
												(node) => node.capabilityKey === term.capabilityKey,
											)!.representationType!
										]()
									: term.capabilityKey}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Panel>
	{/if}
</div>

<style>
	.settings-eyebrow {
		color: var(--color-muted);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		line-height: 1;
	}

	:global(.settings-link-panel) a {
		transition:
			transform 150ms ease,
			color 150ms ease;
	}

	:global(.settings-link-panel) a:hover {
		transform: translateX(3px);
	}

	:global(.structure-map-panel) {
		background:
			linear-gradient(
				140deg,
				color-mix(in oklch, var(--color-primary) 5%, transparent),
				transparent 38%
			),
			var(--color-surface);
	}

	.structure-map-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.structure-node {
		position: relative;
		min-height: 8.25rem;
		padding: 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 0.9rem;
		background: color-mix(in oklch, var(--color-background) 52%, transparent);
		box-shadow: inset 3px 0 0
			color-mix(in oklch, var(--color-primary) calc(18% + (var(--node-layer) * 8%)), transparent);
	}

	.edge-chip {
		padding: 0.3rem 0.45rem;
		border: 1px solid color-mix(in oklch, var(--color-border) 70%, transparent);
		border-radius: 999px;
		background: color-mix(in oklch, var(--color-surface) 55%, transparent);
		font-size: 0.6875rem;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.settings-link-panel) a {
			transition: none;
		}

		:global(.settings-link-panel) a:hover {
			transform: none;
		}
	}
</style>
