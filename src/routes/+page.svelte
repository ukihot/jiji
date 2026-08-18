<script lang="ts">
	import Film from '@lucide/svelte/icons/film';
	import Plus from '@lucide/svelte/icons/plus';
	import * as m from '$lib/paraglide/messages';
	import Button from '$lib/components/Button.svelte';
	import DeferredBurndownChart from '$lib/components/DeferredBurndownChart.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import ArtistPicker from '$lib/components/ArtistPicker.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const createOpen = $derived(data.canCreateTitle && (data.titles.length === 0 || !!form?.message));
	const remainingWork = $derived(data.burndown.at(-1)?.remaining ?? 0);
	const completedWork = $derived(data.workItems.filter((item) => item.isDone).length);
	let artistId = $state<string | null>(null);
</script>

<div class="space-y-8">
	<PageHeader title="Jiji" subtitle={m.home_tagline()} icon={Film} />
	{#if data.currentPerson?.workspaceRole}
		<section
			class="cockpit-hero border-border relative overflow-hidden rounded-3xl border p-5 sm:p-7"
		>
			<div class="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true"></div>
			<div
				class="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] xl:items-end"
			>
				<div>
					<p class="text-primary text-[10px] font-semibold tracking-[0.22em] uppercase">
						Workspace / live
					</p>
					<div class="mt-3 flex flex-wrap items-end justify-between gap-4">
						<div>
							<h2 class="text-foreground text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
								{m.home_cockpit_heading()}
							</h2>
							<p class="text-muted mt-2 max-w-xl text-sm leading-6">
								{m.home_cockpit_hint()}
							</p>
						</div>
						<div class="flex items-center gap-2 pb-0.5">
							<span class="bg-success h-2 w-2 rounded-full" aria-hidden="true"></span>
							<span class="text-muted text-xs">{m.home_event_projection_ready()}</span>
						</div>
					</div>
					<div class="mt-7 grid grid-cols-3 gap-2 sm:max-w-2xl sm:gap-3">
						<div class="cockpit-metric">
							<span>READY</span>
							<strong>{data.frontierItems.length}</strong>
							<p>{m.home_ready_metric()}</p>
						</div>
						<div class="cockpit-metric">
							<span>ACTIVE</span>
							<strong>{data.workItems.length}</strong>
							<p>{m.home_active_metric()}</p>
						</div>
						<div class="cockpit-metric">
							<span>REMAIN</span>
							<strong>{remainingWork}</strong>
							<p>{m.home_remaining_metric()}</p>
						</div>
					</div>
				</div>

				<div class="border-border/90 bg-background/40 rounded-2xl border p-4 backdrop-blur-sm">
					<div class="flex items-center justify-between gap-3">
						<div>
							<h3 class="text-foreground text-sm font-semibold">Readiness Frontier</h3>
							<p class="text-muted mt-0.5 text-xs">{m.home_frontier_hint()}</p>
						</div>
						<span class="text-primary text-xs font-semibold">NOW</span>
					</div>
					{#if data.frontierItems.length === 0}
						<p class="text-muted py-7 text-sm">
							{m.home_frontier_empty()}
						</p>
					{:else}
						<ul class="mt-4 space-y-1">
							{#each data.frontierItems.slice(0, 4) as item, index (item.id)}
								<li>
									<a href={item.href} class="frontier-link">
										<span class="frontier-index">{String(index + 1).padStart(2, '0')}</span>
										<span class="min-w-0 flex-1">
											<span class="text-foreground block truncate text-sm font-medium"
												>{item.label}</span
											>
											<span class="text-muted mt-0.5 block text-xs">{item.processName}</span>
										</span>
										<span class="text-primary text-sm" aria-hidden="true">↗</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</section>

		<div class="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
			<section class="surface-panel min-w-0 p-5 sm:p-6">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="panel-eyebrow">MY PRODUCTION</p>
						<h2 class="text-foreground mt-1 text-lg font-semibold tracking-[-0.025em]">
							{m.home_my_production_heading()}
						</h2>
					</div>
					<div class="text-right">
						<p class="text-foreground text-2xl font-semibold tracking-tight">
							{completedWork}/{data.workItems.length}
						</p>
						<p class="text-muted text-xs">{m.home_completed_label()}</p>
					</div>
				</div>
				{#if data.workItems.length === 0}
					<p class="text-muted py-12 text-sm">
						{m.home_no_assigned_work()}
					</p>
				{:else}
					<ul class="divide-border/80 border-border/80 mt-5 divide-y border-y">
						{#each data.workItems as item (item.id)}
							<li>
								<a href={item.href} class="work-item-link">
									<span
										class={item.isDone ? 'work-state is-complete' : 'work-state'}
										aria-hidden="true"
									></span>
									<span class="min-w-0 flex-1">
										<span class="text-foreground block truncate text-sm font-medium"
											>{item.label}</span
										>
										<span class="text-muted mt-1 block text-xs"
											>{m.home_artist_assignment({ name: item.assigneeName })}</span
										>
									</span>
									<span
										class={item.isDone ? 'text-success text-xs font-medium' : 'text-muted text-xs'}
										>{item.isDone ? m.home_work_completed() : m.home_work_in_progress()}</span
									>
									<span class="text-muted text-base" aria-hidden="true">→</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<div class="grid gap-5">
				<section class="surface-panel overflow-hidden p-5 sm:p-6">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="panel-eyebrow">LAYERCHART / 14 DAYS</p>
							<h2 class="text-foreground mt-1 text-lg font-semibold tracking-[-0.025em]">
								{m.workspace_burndown_heading()}
							</h2>
						</div>
						<div class="text-right">
							<span class="text-foreground text-2xl font-semibold tracking-tight"
								>{remainingWork}</span
							>
							<span class="text-muted ml-1 text-xs">{m.home_remaining_suffix()}</span>
						</div>
					</div>
					{#if data.burndown.length > 0}
						<div class="chart-frame mt-3">
							<DeferredBurndownChart
								points={data.burndown}
								style={data.burndownStyle === 'rough' ? 'rough' : 'standard'}
							/>
						</div>
					{/if}
				</section>

				<section class="surface-panel p-5 sm:p-6">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="panel-eyebrow">EVENT STREAM</p>
							<h2 class="text-foreground mt-1 text-lg font-semibold tracking-[-0.025em]">
								{m.workspace_activity_heading()}
							</h2>
						</div>
						<span class="text-muted text-xs">{data.activity.length}</span>
					</div>
					{#if data.activity.length === 0}
						<p class="text-muted mt-4 text-sm">{m.workspace_activity_empty()}</p>
					{:else}
						<ul class="mt-4 space-y-3">
							{#each data.activity.slice(0, 5) as event (event.id)}
								<li class="activity-entry">
									<span
										class="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
										aria-hidden="true"
									></span>
									<div class="min-w-0">
										<p class="text-foreground truncate font-mono text-xs">{event.type}</p>
										<p class="text-muted mt-0.5 text-xs">{event.createdAt.toLocaleString()}</p>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		</div>
	{/if}

	<section class="surface-panel p-5 sm:p-6">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="panel-eyebrow">TITLE INDEX</p>
				<h2 class="text-foreground mt-1 text-lg font-semibold tracking-[-0.025em]">
					{m.home_titles_heading()}
				</h2>
			</div>
			<span class="text-muted text-sm">{m.home_title_count({ count: data.titles.length })}</span>
		</div>
		{#if data.titles.length === 0}
			<p class="text-muted mt-7 flex items-center gap-2 text-sm">
				<Film size={16} aria-hidden="true" />
				{m.home_titles_empty()}
			</p>
		{:else}
			<div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{#each data.titles as title, index (title.id)}
					<a href="/{title.id}" class="title-card">
						<span class="text-muted text-xs font-medium tabular-nums"
							>{String(index + 1).padStart(2, '0')}</span
						>
						<span
							class="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl"
						>
							<Film size={17} aria-hidden="true" />
						</span>
						<span class="text-foreground min-w-0 flex-1 truncate text-sm font-semibold"
							>{title.name}</span
						>
						<span class="text-muted" aria-hidden="true">↗</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	{#if data.canCreateTitle}
		{#if form?.message}
			<ErrorNotice message={form.message} class="mt-6" />
		{/if}
		<details class="surface-panel group" open={createOpen}>
			<summary
				class="text-foreground flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold sm:px-6 [&::-webkit-details-marker]:hidden"
			>
				<Plus size={16} aria-hidden="true" />
				{m.home_create_heading()}
			</summary>
			<div class="border-border border-t p-5 sm:p-6">
				<form method="POST" action="?/createTitle" class="flex flex-wrap items-end gap-2">
					<FormField label={m.label_title_name()}>
						<FormInput type="text" name="name" required />
					</FormField>
					<FormField label={m.label_artist()}>
						<ArtistPicker artists={data.assignablePersons} bind:selectedId={artistId} />
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

<style>
	.cockpit-hero {
		background:
			linear-gradient(
				120deg,
				color-mix(in oklch, var(--color-surface) 88%, var(--color-primary) 12%),
				var(--color-surface)
			),
			var(--color-surface);
		box-shadow: 0 22px 48px color-mix(in oklch, var(--color-foreground) 10%, transparent);
	}

	.cockpit-hero::after {
		position: absolute;
		top: -8rem;
		right: -4rem;
		width: 20rem;
		height: 20rem;
		border: 1px solid color-mix(in oklch, var(--color-primary) 34%, transparent);
		border-radius: 999px;
		box-shadow:
			0 0 0 2.5rem color-mix(in oklch, var(--color-primary) 5%, transparent),
			0 0 0 5rem color-mix(in oklch, var(--color-primary) 3%, transparent);
		content: '';
		pointer-events: none;
	}

	.cockpit-metric {
		min-width: 0;
		padding: 0.8rem 0.9rem;
		border: 1px solid color-mix(in oklch, var(--color-border) 80%, transparent);
		border-radius: 0.9rem;
		background: color-mix(in oklch, var(--color-background) 32%, transparent);
	}

	.cockpit-metric span,
	.panel-eyebrow {
		display: block;
		color: var(--color-muted);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		line-height: 1;
	}

	.cockpit-metric strong {
		display: block;
		margin-top: 0.5rem;
		color: var(--color-foreground);
		font-size: 1.45rem;
		font-weight: 650;
		letter-spacing: -0.05em;
		line-height: 1;
	}

	.cockpit-metric p {
		margin-top: 0.45rem;
		color: var(--color-muted);
		font-size: 0.6875rem;
		line-height: 1;
	}

	.surface-panel {
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: color-mix(in oklch, var(--color-surface) 94%, transparent);
		box-shadow: 0 12px 30px color-mix(in oklch, var(--color-foreground) 5%, transparent);
	}

	.frontier-link,
	.work-item-link,
	.title-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border-radius: 0.75rem;
		text-decoration: none;
		transition:
			background-color 150ms ease,
			transform 150ms ease;
	}

	.frontier-link {
		padding: 0.65rem 0.5rem;
	}

	.frontier-link:hover,
	.work-item-link:hover,
	.title-card:hover {
		background: color-mix(in oklch, var(--color-primary) 8%, transparent);
		transform: translateX(2px);
	}

	.frontier-index {
		width: 1.6rem;
		color: var(--color-primary);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.work-item-link {
		padding: 0.95rem 0.25rem;
	}

	.work-state {
		width: 0.5rem;
		height: 0.5rem;
		border: 1px solid var(--color-muted);
		border-radius: 999px;
	}

	.work-state.is-complete {
		border-color: var(--color-success);
		background: var(--color-success);
	}

	.chart-frame {
		margin-inline: -0.5rem;
		border-top: 1px solid color-mix(in oklch, var(--color-border) 55%, transparent);
	}

	.activity-entry {
		display: flex;
		gap: 0.6rem;
	}

	.title-card {
		min-height: 5.25rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		background: color-mix(in oklch, var(--color-background) 25%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.frontier-link,
		.work-item-link,
		.title-card {
			transition: none;
		}

		.frontier-link:hover,
		.work-item-link:hover,
		.title-card:hover {
			transform: none;
		}
	}
</style>
