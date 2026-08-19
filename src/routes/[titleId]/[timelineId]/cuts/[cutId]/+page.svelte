<script lang="ts">
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Clock from '@lucide/svelte/icons/clock';
	import Plus from '@lucide/svelte/icons/plus';
	import Stamp from '@lucide/svelte/icons/stamp';
	import type { DerivedFromRelation, RepresentationType } from '$lib/core/representation';
	import type { ReadinessStatus } from '$lib/core/production-kernel';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import Button from '$lib/components/Button.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import FormSelect from '$lib/components/FormSelect.svelte';
	import ArtistPicker from '$lib/components/ArtistPicker.svelte';
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

	const RELATION_LABEL: Record<DerivedFromRelation, () => string> = {
		refined: m.derived_from_relation_refined,
		converted: m.derived_from_relation_converted,
		replaced: m.derived_from_relation_replaced,
	};

	function formatDate(date: Date): string {
		return date.toLocaleString(getLocale());
	}

	function versionOptionLabel(v: { representationType: RepresentationType; seq: number }): string {
		return `${TYPE_LABEL[v.representationType]()} v${v.seq}`;
	}

	// design.md P-03「工程は状態ではなく履歴」だが、8段のパネルを毎回スクロールして
	// 読まないと「今このカットがどこまで進んでいるか」が分からないのは日々の運用として重い。
	// パイプライン全体を一望できる帯を用意し、各パネルへのアンカーとして使う
	// （履歴そのものはこれまで通り下の詳細パネルが正）。
	type ReprSummary = { isEnabled: boolean; versions: { isApproved: boolean }[] };
	type ReprStatus = 'disabled' | 'empty' | 'pending' | 'approved';

	function reprStatus(repr: ReprSummary): ReprStatus {
		if (!repr.isEnabled) return 'disabled';
		if (repr.versions.length === 0) return 'empty';
		if (repr.versions.some((v) => v.isApproved)) return 'approved';
		return 'pending';
	}

	const STATUS_CLASS: Record<ReprStatus, string> = {
		disabled: 'border-border text-muted opacity-50',
		empty: 'border-border text-muted',
		pending: 'border-warning/40 bg-warning-surface text-warning',
		approved: 'border-success/40 bg-success/10 text-success',
	};

	const STATUS_LABEL: Record<ReprStatus, () => string> = {
		disabled: m.representation_type_disabled_badge,
		empty: m.pipeline_status_empty,
		pending: m.status_latest,
		approved: m.status_approved,
	};

	const HANDOFF_CLASS: Record<ReadinessStatus, string> = {
		not_ready: 'border-border bg-background text-muted',
		ready: 'border-primary/40 bg-primary/10 text-primary',
		awaiting_review: 'border-warning/40 bg-warning-surface text-warning',
		passed: 'border-success/40 bg-success/10 text-success',
		stale: 'border-danger/40 bg-danger/10 text-danger',
		waived: 'border-border bg-background text-muted',
	};
	const HANDOFF_LABEL: Record<ReadinessStatus, () => string> = {
		not_ready: m.handoff_status_not_ready,
		ready: m.handoff_status_ready,
		awaiting_review: m.handoff_status_awaiting_review,
		passed: m.handoff_status_passed,
		stale: m.handoff_status_stale,
		waived: m.handoff_status_waived,
	};
	const HANDOFF_REASON: Record<
		import('$lib/core/production-kernel').ReadinessReasonCode,
		() => string
	> = {
		waived: m.handoff_reason_waived,
		stale_evidence: m.handoff_reason_stale_evidence,
		blocked_dependency: m.handoff_reason_blocked_dependency,
		artist_missing: m.handoff_reason_artist_missing,
		version_missing: m.handoff_reason_version_missing,
		gate_evidence_missing: m.handoff_reason_gate_evidence_missing,
		handoff_passed: m.handoff_reason_passed,
	};
	const RIPPLE_SEVERITY_LABEL: Record<
		import('$lib/core/production-kernel').ImpactSeverity,
		() => string
	> = {
		info: m.ripple_severity_info,
		review_required: m.ripple_severity_review_required,
		blocked: m.ripple_severity_blocked,
	};

	function handoffNodeName(processNodeId: string): string {
		return (
			data.view.handoff?.nodes.find((node) => node.processNodeId === processNodeId)?.displayName ??
			processNodeId
		);
	}
</script>

<Breadcrumb
	items={[
		{ label: m.nav_back_to_titles(), href: '/' },
		{ label: data.view.title.name, href: `/${data.view.title.id}` },
		{
			label: m.episode_label({
				season: data.view.timeline.season,
				episode: data.view.timeline.episode,
			}),
			href: `/${data.view.title.id}/${data.view.timeline.id}`,
		},
		{ label: data.view.cut.number },
	]}
/>

<PageHeader
	title={data.view.cut.number}
	subtitle="{data.view.title.name} ・ {m.episode_label({
		season: data.view.timeline.season,
		episode: data.view.timeline.episode,
	})}"
/>
<p class="text-muted mt-1 text-sm">{m.cut_evolution_hint()}</p>

{#if form?.message}
	<ErrorNotice message={form.message} class="mt-4" />
{/if}

{#if data.view.handoff}
	<section class="cut-surface handoff-surface mt-6" aria-label={m.handoff_rail_label()}>
		<div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<div>
				<p class="cut-eyebrow">READINESS PROJECTION</p>
				<h2 class="text-foreground text-sm font-semibold">Handoff Rail</h2>
				<p class="text-muted mt-0.5 text-xs">
					{m.handoff_rail_hint({ version: data.view.handoff.blueprintVersion })}
				</p>
			</div>
		</div>
		<ol class="rail-scroll flex gap-3 overflow-x-auto pb-2">
			{#each data.view.handoff.nodes as node (node.processNodeId)}
				<li class="flex min-w-46 items-stretch">
					<article class="handoff-node w-full {HANDOFF_CLASS[node.status]}">
						<div class="flex items-start justify-between gap-2">
							<h3 class="text-sm font-semibold">{node.displayName}</h3>
							<span class="text-[0.65rem] font-medium whitespace-nowrap"
								>{HANDOFF_LABEL[node.status]()}</span
							>
						</div>
						<p class="mt-2 text-xs opacity-85">
							{node.artistName
								? m.artist_assigned({ name: node.artistName })
								: m.artist_unassigned()}
						</p>
						<p class="mt-1 text-xs opacity-85">{HANDOFF_REASON[node.reason]()}</p>
						{#if node.blockedByProcessNodeIds.length > 0}
							<p class="mt-1 text-xs opacity-85">
								{m.handoff_prerequisites()}
								{node.blockedByProcessNodeIds
									.map(
										(id) =>
											data.view.handoff?.nodes.find((candidate) => candidate.processNodeId === id)
												?.displayName ?? id,
									)
									.join('、')}
							</p>
						{/if}
						{#if node.ripple.length > 0}
							<p class="mt-2 border-t border-current/15 pt-2 text-xs opacity-85">
								<span class="font-medium">Ripple:</span>
								{node.ripple
									.map(
										(impact) =>
											`${impact.displayName}（${RIPPLE_SEVERITY_LABEL[impact.severity]()}）`,
									)
									.join('、')}
							</p>
							<details class="mt-1 text-xs opacity-85">
								<summary class="cursor-pointer">{m.handoff_show_impact_reason()}</summary>
								<ul class="mt-1 space-y-1">
									{#each node.ripple as impact (impact.processNodeId)}
										<li>{impact.path.map(handoffNodeName).join(' → ')}</li>
									{/each}
								</ul>
							</details>
						{/if}
						{#if data.canReview && node.gateId && node.latestVersionId && node.status !== 'passed'}
							<form method="POST" action="?/recordGateEvidence" class="mt-3 flex gap-1.5">
								<input type="hidden" name="gateId" value={node.gateId} />
								<input type="hidden" name="versionId" value={node.latestVersionId} />
								<input type="hidden" name="result" value="passed" />
								<Button type="submit" variant="outline" class="text-xs"
									>{m.action_pass_gate()}</Button
								>
							</form>
						{/if}
					</article>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<section class="cut-surface mt-6" aria-label={m.pipeline_status_heading()}>
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<h2 class="cut-eyebrow">
			{m.pipeline_status_heading()}
		</h2>
		<p class="text-muted text-xs">{m.pipeline_status_hint()}</p>
	</div>
	<ol class="flex items-stretch overflow-x-auto">
		{#each data.view.representations as repr, i (repr.type)}
			{@const status = reprStatus(repr)}
			{#if i > 0}
				<li class="flex w-4 shrink-0 items-center sm:w-8" aria-hidden="true">
					<span class="bg-border h-px w-full"></span>
				</li>
			{/if}
			<li class="shrink-0">
				<a
					href="#repr-{repr.type}"
					class="flex min-w-22 flex-col items-center gap-1 rounded-lg border px-2.5 py-2 text-center no-underline transition hover:opacity-80 {STATUS_CLASS[
						status
					]}"
				>
					<span class="text-xs font-medium">{TYPE_LABEL[repr.type]()}</span>
					<span class="text-[0.65rem] opacity-80">{STATUS_LABEL[status]()}</span>
				</a>
			</li>
		{/each}
	</ol>
</section>

<div class="mt-4 space-y-4">
	{#each data.view.representations as repr (repr.type)}
		<Panel class="scroll-mt-20" id="repr-{repr.type}">
			<div class="flex items-center justify-between">
				<h2 class="text-foreground flex items-center gap-1.5 font-semibold">
					{TYPE_LABEL[repr.type]()}
					{#if !repr.isEnabled}
						<span
							class="border-border text-muted rounded-full border px-1.5 py-0.5 text-xs font-normal"
						>
							{m.representation_type_disabled_badge()}
						</span>
					{/if}
				</h2>
				{#if repr.versions.length === 0}
					<span class="text-muted text-xs">{m.representation_no_versions()}</span>
				{/if}
			</div>
			<div class="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
				<span class="text-muted">{m.label_artist()}:</span>
				{#if data.canManageAssignments}
					<form
						method="POST"
						action="?/assignRepresentation"
						class="flex flex-wrap items-end gap-2"
					>
						<input type="hidden" name="representationType" value={repr.type} />
						<ArtistPicker artists={data.assignablePersons} selectedId={repr.assignee?.id ?? null} />
						<Button type="submit" variant="outline">{m.action_save()}</Button>
					</form>
				{:else if repr.assignee}
					<span class="text-foreground">{repr.assignee.name}</span>
				{:else}
					<span class="text-muted">{m.artist_unassigned()}</span>
				{/if}
			</div>

			{#if repr.versions.length > 0}
				<ul class="mt-2 space-y-2">
					{#each repr.versions as v (v.versionId)}
						<li class="border-border rounded-md border p-2 text-sm">
							<div class="flex flex-wrap items-center gap-2">
								<span class="text-foreground font-mono text-xs">v{v.seq}</span>
								{#if v.isApproved}
									<span class="text-success flex items-center gap-1 text-xs">
										<CheckCircle2 size={12} aria-hidden="true" />
										{m.status_approved()}
									</span>
								{:else if v.isLatest}
									<span class="text-muted flex items-center gap-1 text-xs">
										<Clock size={12} aria-hidden="true" />
										{m.status_latest()}
									</span>
								{/if}
								<span class="text-muted text-xs">{v.processStep}</span>
							</div>
							<p class="text-muted mt-1 truncate text-xs" title={v.fileRef}>{v.fileRef}</p>
							<p class="text-muted text-xs">{v.submittedByName} ・ {formatDate(v.submittedAt)}</p>
							{#if v.derivedFrom}
								<p class="text-muted text-xs">
									← {versionOptionLabel(v.derivedFrom)} ({RELATION_LABEL[v.derivedFrom.relation]()})
								</p>
							{/if}
							{#if v.seal}
								<p class="text-muted mt-1 flex items-center gap-1 text-xs">
									<Stamp size={12} aria-hidden="true" />
									{m.seal_info({
										name: v.seal.sealedByName,
										hash: v.seal.hash.slice(0, 8),
									})}
								</p>
							{/if}

							{#if v.reviews.length > 0}
								<ul class="mt-1 space-y-0.5">
									{#each v.reviews as r (r.reviewId)}
										<li class="text-xs {r.result === 'approved' ? 'text-success' : 'text-danger'}">
											{r.result === 'approved'
												? m.review_result_approved()
												: m.review_result_returned()}
											— {r.reviewerName}{#if r.comment}: {r.comment}{/if}
										</li>
									{/each}
								</ul>
							{/if}

							<div class="mt-2 flex flex-wrap items-center gap-2">
								{#if data.canReview}
									<form
										method="POST"
										action="?/submitReview"
										class="flex flex-wrap items-end gap-2"
									>
										<input type="hidden" name="versionId" value={v.versionId} />
										<FormSelect name="result" compact>
											<option value="approved">{m.review_result_approved()}</option>
											<option value="returned">{m.review_result_returned()}</option>
										</FormSelect>
										<FormInput
											type="text"
											name="comment"
											placeholder={m.label_review_comment()}
											class="w-40"
										/>
										<Button type="submit" variant="outline">{m.action_submit_review()}</Button>
									</form>
								{/if}
								{#if data.canSeal && !v.isApproved}
									<form method="POST" action="?/sealVersion">
										<input type="hidden" name="versionId" value={v.versionId} />
										<input type="hidden" name="representationId" value={repr.representationId} />
										<Button type="submit" variant="outline">
											<Stamp size={12} aria-hidden="true" />
											{m.action_seal_version()}
										</Button>
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			{#if data.canSubmit && repr.isEnabled}
				<form method="POST" action="?/submitVersion" class="mt-3 flex flex-wrap items-end gap-2">
					<input type="hidden" name="representationType" value={repr.type} />
					<FormField label={m.label_process_step()}>
						<FormInput type="text" name="processStep" placeholder="LO" required class="w-24" />
					</FormField>
					<FormField label={m.label_file_ref()}>
						<FormInput
							type="text"
							name="fileRef"
							placeholder="//shared/..."
							required
							class="w-56"
						/>
					</FormField>
					<FormField label={m.label_proxy_ref_optional()}>
						<FormInput type="text" name="proxyRef" class="w-40" />
					</FormField>
					<FormField label={m.label_derived_from()}>
						<FormSelect name="derivedFromVersionId" compact class="w-40">
							<option value="">{m.label_derived_from_none()}</option>
							{#each data.view.allVersionsForDerivedFrom as ref (ref.versionId)}
								<option value={ref.versionId}>{versionOptionLabel(ref)}</option>
							{/each}
						</FormSelect>
					</FormField>
					<FormField label={m.label_derived_from_relation()}>
						<FormSelect name="derivedFromRelation" compact>
							<option value="refined">{m.derived_from_relation_refined()}</option>
							<option value="converted">{m.derived_from_relation_converted()}</option>
							<option value="replaced">{m.derived_from_relation_replaced()}</option>
						</FormSelect>
					</FormField>
					<Button type="submit">
						<Plus size={16} aria-hidden="true" />
						{m.action_submit_version()}
					</Button>
				</form>
			{/if}
		</Panel>
	{/each}
</div>

<style>
	.cut-surface {
		padding: 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: color-mix(in oklch, var(--color-surface) 94%, transparent);
		box-shadow: 0 12px 30px color-mix(in oklch, var(--color-foreground) 5%, transparent);
	}

	.handoff-surface {
		background:
			linear-gradient(
				130deg,
				color-mix(in oklch, var(--color-primary) 6%, transparent),
				transparent 40%
			),
			var(--color-surface);
	}

	.cut-eyebrow {
		color: var(--color-muted);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		line-height: 1.25;
	}

	.rail-scroll {
		scroll-padding-inline: 0.5rem;
		scroll-snap-type: x proximity;
	}

	.handoff-node {
		scroll-snap-align: start;
		padding: 0.875rem;
		border-radius: 0.9rem;
		box-shadow: 0 8px 18px color-mix(in oklch, var(--color-foreground) 4%, transparent);
	}
</style>
