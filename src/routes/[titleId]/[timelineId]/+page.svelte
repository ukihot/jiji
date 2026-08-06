<script lang="ts">
	import Ban from '@lucide/svelte/icons/ban';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import Clock from '@lucide/svelte/icons/clock';
	import Frame from '@lucide/svelte/icons/frame';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Plus from '@lucide/svelte/icons/plus';
	import Share2 from '@lucide/svelte/icons/share-2';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	import Button from '$lib/components/Button.svelte';
	import EntityList from '$lib/components/EntityList.svelte';
	import ErrorNotice from '$lib/components/ErrorNotice.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import FormInput from '$lib/components/FormInput.svelte';
	import FormSelect from '$lib/components/FormSelect.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PermissionBadge from '$lib/components/PermissionBadge.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const PIXELS_PER_FRAME = 0.5;

	function toPx(frames: number): number {
		return Math.max(32, Math.round(frames * PIXELS_PER_FRAME));
	}

	function formatDate(date: Date): string {
		return date.toLocaleString(getLocale());
	}

	// 管理系フォーム（カット追加・共有リンク発行）は毎回開きっぱなしにせず、
	// 「初めて訪れた・空の話数（＝今すぐ入力すべき）」「直前の送信でエラーが出た」
	// 「共有リンクを今まさに発行した」場合だけ自動で開く。日常的な閲覧では畳んでおき、
	// 本来の主役であるカット帯に視線が集中するようにする。
	const hasFormError = $derived(!!form?.message);
	const addCutOpen = $derived(data.view.cuts.length === 0 || hasFormError);
	const shareOpen = $derived(
		data.shareLinks.length > 0 || !!form?.shareLinkCreated || hasFormError,
	);
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
		},
	]}
/>

<PageHeader
	title={m.episode_label({
		season: data.view.timeline.season,
		episode: data.view.timeline.episode,
	})}
	subtitle={data.view.title.name}
>
	{#snippet actions()}
		<span
			class="border-border text-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
		>
			<Clapperboard size={14} aria-hidden="true" />
			{m.cut_count_label({ count: data.view.cuts.length })}
		</span>
		<span
			class="border-border text-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
		>
			<Frame size={14} aria-hidden="true" />
			{m.timeline_heading({ frames: data.view.totalFrames })}
		</span>
	{/snippet}
</PageHeader>

{#if form?.message}
	<ErrorNotice message={form.message} class="mt-4" />
{/if}

{#if form?.shareLinkCreated}
	<p class="border-success/30 bg-success/10 text-foreground mt-4 rounded-lg border p-3 text-sm">
		<span class="text-success flex items-center gap-1.5 font-medium">
			<CheckCircle2 size={16} aria-hidden="true" />
			{m.sharelink_created_notice()}
		</span>
		<code class="mt-1 block text-xs break-all">{form.shareLinkCreated.url}</code>
		<span class="text-muted mt-1 flex items-center gap-1 text-xs">
			<Clock size={12} aria-hidden="true" />
			{m.label_expiry()}: {formatDate(form.shareLinkCreated.expiresAt)}
		</span>
	</p>
{/if}

<!--
	作品としての「生きたタイムライン」そのもの。以前はページの一項目として
	見出し付きセクションの中に埋もれていたが、これはこのページで一番大事な情報なので
	見出しに頼らず、面積と余白そのもので主役だと分かるようにする。
-->
<section class="border-border bg-surface mt-6 rounded-xl border p-3" aria-label="Timeline">
	{#if data.view.cuts.length === 0}
		<p class="text-muted flex items-center justify-center gap-2 px-4 py-12 text-sm">
			{m.cuts_empty()}
		</p>
	{:else}
		<div class="flex gap-1 overflow-x-auto pb-1">
			{#each data.view.cuts as cut (cut.cutId)}
				<a
					href="/{data.view.title.id}/{data.view.timeline.id}/cuts/{cut.cutId}"
					class="bg-primary text-primary-foreground flex shrink-0 items-center justify-center overflow-hidden rounded-md px-1.5 font-mono text-xs whitespace-nowrap no-underline shadow-sm transition hover:opacity-85 hover:shadow-md"
					style="width: {toPx(cut.widthFrames)}px; height: 64px;"
					title="{cut.number}（{cut.plannedFrames}コマ）"
				>
					{cut.number}
				</a>
			{/each}
		</div>
	{/if}
</section>

{#if data.canAddCut || data.canShare}
	<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
		{#if data.canAddCut}
			<details class="border-border bg-surface h-fit rounded-lg border" open={addCutOpen}>
				<summary
					class="text-foreground flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"
				>
					<Plus size={16} aria-hidden="true" />
					{m.add_cut_heading()}
				</summary>
				<div class="border-border border-t p-4">
					<form method="POST" action="?/addCut" class="flex flex-wrap items-end gap-2">
						<FormField label={m.label_cut_number()}>
							<FormInput type="text" name="number" placeholder="C-001" required />
						</FormField>
						<FormField label={m.label_sort_order()}>
							<FormInput type="number" name="sortOrder" required class="w-20" />
						</FormField>
						<FormField label={m.label_planned_frames()}>
							<FormInput type="number" name="plannedFrames" min="1" required class="w-28" />
						</FormField>
						<FormField label={m.label_scene_tags()}>
							<FormInput type="text" name="sceneTags" placeholder="夜, 屋内" />
						</FormField>
						<Button type="submit">
							<Plus size={16} aria-hidden="true" />
							{m.action_add()}
						</Button>
					</form>
				</div>
			</details>
		{/if}

		{#if data.canShare}
			<details class="border-border bg-surface h-fit rounded-lg border" open={shareOpen}>
				<summary
					class="text-foreground flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"
				>
					<Share2 size={16} aria-hidden="true" />
					{m.sharelink_heading()}
				</summary>
				<div class="border-border space-y-3 border-t p-4">
					<p class="text-muted text-xs">
						{m.sharelink_hint()}
					</p>

					{#if data.shareLinks.length > 0}
						<EntityList>
							{#each data.shareLinks as link (link.id)}
								<li class="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
									<span class="text-muted flex items-center gap-1">
										<Link2 size={14} aria-hidden="true" />
										{link.targetCutIds.join(', ')}
									</span>
									<PermissionBadge level={link.permissionLevel} />
									{#if link.isActive}
										<span class="text-success flex items-center gap-1 text-xs">
											<CheckCircle2 size={12} aria-hidden="true" />
											{m.status_active()}
										</span>
									{:else}
										<span class="text-muted flex items-center gap-1 text-xs">
											<Ban size={12} aria-hidden="true" />
											{m.status_inactive()}
										</span>
									{/if}
									<span class="text-muted text-xs"
										>{m.label_expiry()}: {formatDate(link.expiresAt)}</span
									>
									{#if link.isActive}
										<form method="POST" action="?/revokeShareLink" class="ml-auto">
											<input type="hidden" name="shareLinkId" value={link.id} />
											<Button type="submit" variant="danger-outline">
												<Ban size={12} aria-hidden="true" />
												{m.action_revoke_sharelink()}
											</Button>
										</form>
									{/if}
								</li>
							{/each}
						</EntityList>
					{/if}

					{#if data.view.cuts.length > 0}
						<Panel tag="form" method="POST" action="?/createShareLink" class="space-y-3">
							<fieldset class="flex flex-wrap gap-x-4 gap-y-1">
								<legend class="text-muted mb-1 text-sm">{m.label_target_cuts()}</legend>
								{#each data.view.cuts as cut (cut.cutId)}
									<label class="text-foreground flex items-center gap-1.5 text-sm">
										<input
											type="checkbox"
											name="cutIds"
											value={cut.cutId}
											class="border-border text-primary focus:ring-primary rounded"
										/>
										{cut.number}
									</label>
								{/each}
							</fieldset>
							<div class="flex flex-wrap items-end gap-2">
								<FormField label={m.label_permission()}>
									<FormSelect name="permissionLevel">
										<option value="viewer">{m.sharelink_permission_viewer_option()}</option>
										<option value="contributor"
											>{m.sharelink_permission_contributor_option()}</option
										>
									</FormSelect>
								</FormField>
								<FormField label={m.label_expiry_days()}>
									<FormInput
										type="number"
										name="expiresInDays"
										min="1"
										max="90"
										value="7"
										required
										class="w-24"
									/>
								</FormField>
								<Button type="submit">
									<Share2 size={16} aria-hidden="true" />
									{m.action_create_sharelink()}
								</Button>
							</div>
						</Panel>
					{/if}
				</div>
			</details>
		{/if}
	</div>
{/if}
