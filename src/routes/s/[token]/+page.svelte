<script lang="ts">
	import { AlertTriangle, Clock, Film, Link2, ShieldOff, Sparkles } from 'lucide-svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let needsName = $derived(
		data.resolved?.isActive && data.resolved.link.permissionLevel === 'contributor' && !data.resolved.claimedPersonName
	);
</script>

<h1 class="flex items-center gap-2 text-2xl font-bold text-foreground">
	<Film size={22} class="text-primary" aria-hidden="true" />
	Jiji 共有リンク
</h1>

{#if !data.resolved}
	<p class="mt-4 flex items-center gap-1.5 text-sm text-danger">
		<AlertTriangle size={16} aria-hidden="true" />
		このリンクは無効です。
	</p>
{:else if !data.resolved.isActive}
	<p class="mt-4 flex items-center gap-1.5 text-sm text-danger">
		<ShieldOff size={16} aria-hidden="true" />
		このリンクは期限切れ、または取り消されています。
	</p>
{:else if needsName}
	<h2 class="mt-6 flex items-center gap-1.5 text-lg font-semibold text-foreground">
		<Sparkles size={18} class="text-primary" aria-hidden="true" />
		お名前を入力してください
	</h2>
	<p class="mt-1 text-sm text-muted">
		design.md 8.5.2節 Magic Identity: パスワードもメールも不要です。名前だけで本人識別します。
	</p>
	{#if form?.message}
		<p class="mt-3 flex items-center gap-1.5 text-sm text-danger">
			<AlertTriangle size={16} aria-hidden="true" />
			{form.message}
		</p>
	{/if}
	<form method="POST" action="?/claim" class="mt-4 flex items-end gap-2">
		<label class="flex flex-col gap-1 text-sm text-muted">
			お名前
			<input
				type="text"
				name="name"
				required
				class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
			/>
		</label>
		<button
			type="submit"
			class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
		>
			続ける
		</button>
	</form>
{:else}
	<p class="mt-6 text-foreground">
		ようこそ{data.resolved.claimedPersonName ? `、${data.resolved.claimedPersonName}さん` : ''}。
	</p>
	<dl class="mt-3 space-y-1.5 text-sm text-muted">
		<div class="flex items-center gap-1.5">
			<dt class="sr-only">権限</dt>
			<dd class="rounded-full border border-border px-2 py-0.5 text-xs">{data.resolved.link.permissionLevel}</dd>
		</div>
		<div class="flex items-center gap-1.5">
			<Link2 size={14} aria-hidden="true" />
			<dt class="sr-only">対象カット</dt>
			<dd>対象カット: {data.resolved.link.targetCutIds.join(', ')}</dd>
		</div>
		<div class="flex items-center gap-1.5">
			<Clock size={14} aria-hidden="true" />
			<dt class="sr-only">有効期限</dt>
			<dd>有効期限: {data.resolved.link.expiresAt.toLocaleString('ja-JP')}</dd>
		</div>
	</dl>
	<p class="mt-4 text-xs text-muted">
		提出・レビュー機能（Submission/Review）はdesign.md 13章 Phase3で実装予定のため、このMVPではまだ利用できません。
	</p>
{/if}
