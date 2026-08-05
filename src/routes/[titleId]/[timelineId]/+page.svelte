<script lang="ts">
	import {
		AlertTriangle,
		ArrowLeft,
		Ban,
		CheckCircle2,
		Clock,
		Link2,
		Plus,
		Share2,
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const PIXELS_PER_FRAME = 0.5;

	function toPx(frames: number): number {
		return Math.max(24, Math.round(frames * PIXELS_PER_FRAME));
	}

	function formatDate(date: Date): string {
		return date.toLocaleString('ja-JP');
	}
</script>

<p>
	<a
		href="/{data.view.title.id}"
		class="text-primary flex w-fit items-center gap-1 text-sm no-underline hover:underline"
	>
		<ArrowLeft size={14} aria-hidden="true" />
		{data.view.title.name}
	</a>
</p>
<h1 class="text-foreground mt-2 text-2xl font-bold">
	{data.view.title.name}
	{data.view.timeline.season} 第{data.view.timeline.episode}話
</h1>

{#if form?.message}
	<p class="text-danger mt-4 flex items-center gap-1.5 text-sm">
		<AlertTriangle size={16} aria-hidden="true" />
		{form.message}
	</p>
{/if}

{#if form?.shareLinkCreated}
	<p class="border-success/30 bg-success/10 text-foreground mt-4 rounded-lg border p-3 text-sm">
		<span class="text-success flex items-center gap-1.5 font-medium">
			<CheckCircle2 size={16} aria-hidden="true" />
			共有リンクを発行しました（このURLはこの画面にしか表示されません）
		</span>
		<code class="mt-1 block text-xs break-all">{form.shareLinkCreated.url}</code>
		<span class="text-muted mt-1 flex items-center gap-1 text-xs">
			<Clock size={12} aria-hidden="true" />
			有効期限: {formatDate(form.shareLinkCreated.expiresAt)}
		</span>
	</p>
{/if}

<section class="mt-8" aria-label="Timeline">
	<h2 class="text-foreground mb-3 text-lg font-semibold">
		Timeline（{data.view.totalFrames}コマ）
	</h2>
	{#if data.view.cuts.length === 0}
		<p class="text-muted text-sm">まだカットがありません。</p>
	{:else}
		<div class="border-border bg-surface flex gap-0.5 overflow-x-auto rounded-lg border p-2">
			{#each data.view.cuts as cut (cut.cutId)}
				<div
					class="bg-primary text-primary-foreground flex shrink-0 items-center justify-center overflow-hidden rounded-sm px-1 text-xs whitespace-nowrap"
					style="width: {toPx(cut.widthFrames)}px; height: 44px;"
					title="{cut.number}（{cut.plannedFrames}コマ）"
				>
					{cut.number}
				</div>
			{/each}
		</div>
	{/if}
</section>

{#if data.canAddCut}
	<section class="mt-8">
		<h2 class="text-foreground mb-3 flex items-center gap-1.5 text-lg font-semibold">
			<Plus size={18} aria-hidden="true" />
			カットを追加
		</h2>
		<form method="POST" action="?/addCut" class="flex flex-wrap items-end gap-2">
			<label class="text-muted flex flex-col gap-1 text-sm">
				カット番号
				<input
					type="text"
					name="number"
					placeholder="C-001"
					required
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
				/>
			</label>
			<label class="text-muted flex flex-col gap-1 text-sm">
				並び順
				<input
					type="number"
					name="sortOrder"
					required
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary w-20 rounded-md px-2 py-1.5 text-sm"
				/>
			</label>
			<label class="text-muted flex flex-col gap-1 text-sm">
				予定尺（コマ数）
				<input
					type="number"
					name="plannedFrames"
					min="1"
					required
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary w-28 rounded-md px-2 py-1.5 text-sm"
				/>
			</label>
			<label class="text-muted flex flex-col gap-1 text-sm">
				シーンタグ（カンマ区切り）
				<input
					type="text"
					name="sceneTags"
					placeholder="夜, 屋内"
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
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

{#if data.canShare}
	<section class="mt-8">
		<h2 class="text-foreground mb-1 flex items-center gap-1.5 text-lg font-semibold">
			<Share2 size={18} aria-hidden="true" />
			共有リンク
		</h2>
		<p class="text-muted mb-3 text-xs">
			design.md 8.5節: viewerは匿名可、contributorは開いた人がMagic
			Identity（名前入力）で本人識別されます。
		</p>

		{#if data.shareLinks.length > 0}
			<ul
				class="divide-border border-border bg-surface mb-4 divide-y overflow-hidden rounded-lg border"
			>
				{#each data.shareLinks as link (link.id)}
					<li class="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
						<span class="text-muted flex items-center gap-1">
							<Link2 size={14} aria-hidden="true" />
							{link.targetCutIds.join(', ')}
						</span>
						<span class="border-border text-foreground rounded-full border px-2 py-0.5 text-xs">
							{link.permissionLevel}
						</span>
						{#if link.isActive}
							<span class="text-success flex items-center gap-1 text-xs">
								<CheckCircle2 size={12} aria-hidden="true" />
								有効
							</span>
						{:else}
							<span class="text-muted flex items-center gap-1 text-xs">
								<Ban size={12} aria-hidden="true" />
								失効
							</span>
						{/if}
						<span class="text-muted text-xs">期限: {formatDate(link.expiresAt)}</span>
						{#if link.isActive}
							<form method="POST" action="?/revokeShareLink" class="ml-auto">
								<input type="hidden" name="shareLinkId" value={link.id} />
								<button
									type="submit"
									class="border-danger/40 text-danger hover:bg-danger/10 flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
								>
									<Ban size={12} aria-hidden="true" />
									取り消す
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.view.cuts.length > 0}
			<form
				method="POST"
				action="?/createShareLink"
				class="border-border bg-surface space-y-3 rounded-lg border p-4"
			>
				<fieldset class="flex flex-wrap gap-x-4 gap-y-1">
					<legend class="text-muted mb-1 text-sm">対象カット</legend>
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
					<label class="text-muted flex flex-col gap-1 text-sm">
						権限
						<select
							name="permissionLevel"
							class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
						>
							<option value="viewer">viewer（閲覧のみ）</option>
							<option value="contributor">contributor（提出可・Magic Identity必須）</option>
						</select>
					</label>
					<label class="text-muted flex flex-col gap-1 text-sm">
						有効期限（日、最長90日）
						<input
							type="number"
							name="expiresInDays"
							min="1"
							max="90"
							value="7"
							required
							class="border-border bg-background text-foreground focus:border-primary focus:ring-primary w-24 rounded-md px-2 py-1.5 text-sm"
						/>
					</label>
					<button
						type="submit"
						class="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
					>
						<Share2 size={16} aria-hidden="true" />
						共有リンクを発行
					</button>
				</div>
			</form>
		{/if}
	</section>
{/if}
