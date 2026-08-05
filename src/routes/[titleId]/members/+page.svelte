<script lang="ts">
	import {
		AlertTriangle,
		ArrowLeft,
		Ban,
		Eye,
		MessageSquare,
		Pencil,
		Shield,
		UserPlus,
		Users
	} from 'lucide-svelte';
	import type { PageProps } from './$types';
	import type { PermissionLevel } from '$lib/core/membership';

	let { data, form }: PageProps = $props();

	const PERMISSION_LEVELS = ['viewer', 'contributor', 'reviewer', 'admin'] as const;
	const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

	const PERMISSION_ICON: Record<PermissionLevel, typeof Shield> = {
		viewer: Eye,
		contributor: Pencil,
		reviewer: MessageSquare,
		admin: Shield
	};

	function scopeLabel(scopeType: string, scopeId: string): string {
		if (scopeType === 'title') return '作品全体';
		const timeline = data.timelines.find((t) => t.id === scopeId);
		return timeline ? `${timeline.season} 第${timeline.episode}話` : scopeId;
	}

	function isExpiringSoon(expiresAt: Date | null): boolean {
		return expiresAt !== null && expiresAt.getTime() - Date.now() < FOURTEEN_DAYS_MS;
	}

	function formatDate(date: Date | null): string {
		return date ? date.toLocaleDateString('ja-JP') : '無期限';
	}
</script>

<p>
	<a
		href="/{data.title.id}"
		class="flex w-fit items-center gap-1 text-sm text-primary no-underline hover:underline"
	>
		<ArrowLeft size={14} aria-hidden="true" />
		{data.title.name}
	</a>
</p>
<h1 class="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
	<Users size={22} class="text-primary" aria-hidden="true" />
	{data.title.name} メンバー
</h1>
<p class="mt-1 text-sm text-muted">
	design.md 8章: Googleスプレッドシートの共有を踏襲したアクセス権。期限が近い行は強調表示します。
</p>

{#if form?.message}
	<p class="mt-4 flex items-center gap-1.5 text-sm text-danger">
		<AlertTriangle size={16} aria-hidden="true" />
		{form.message}
	</p>
{/if}

<div class="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-b border-border text-left text-muted">
				<th class="px-4 py-2 font-medium">名前</th>
				<th class="px-4 py-2 font-medium">権限</th>
				<th class="px-4 py-2 font-medium">範囲</th>
				<th class="px-4 py-2 font-medium">有効期限</th>
				<th class="px-4 py-2"></th>
			</tr>
		</thead>
		<tbody>
			{#each data.members as member (member.membershipId)}
				{@const Icon = PERMISSION_ICON[member.permissionLevel]}
				<tr
					class="border-b border-border last:border-0"
					class:opacity-50={!member.isActive}
					class:bg-warning-surface={member.isActive && isExpiringSoon(member.expiresAt)}
				>
					<td class="px-4 py-2.5 text-foreground">{member.personName}</td>
					<td class="px-4 py-2.5">
						{#if member.isActive}
							<form method="POST" action="?/updatePermission" class="flex items-center gap-1.5">
								<input type="hidden" name="membershipId" value={member.membershipId} />
								<select
									name="permissionLevel"
									class="rounded-md border-border bg-background py-1 pr-6 pl-2 text-xs text-foreground focus:border-primary focus:ring-primary"
								>
									{#each PERMISSION_LEVELS as level (level)}
										<option value={level} selected={level === member.permissionLevel}>{level}</option>
									{/each}
								</select>
								<button
									type="submit"
									class="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
								>
									更新
								</button>
							</form>
						{:else}
							<span class="flex items-center gap-1 text-muted">
								<Icon size={14} aria-hidden="true" />
								{member.permissionLevel}
							</span>
						{/if}
					</td>
					<td class="px-4 py-2.5 text-foreground">{scopeLabel(member.scopeType, member.scopeId)}</td>
					<td class="px-4 py-2.5 text-foreground">{formatDate(member.expiresAt)}</td>
					<td class="px-4 py-2.5 text-right">
						{#if member.isActive}
							<form method="POST" action="?/revoke">
								<input type="hidden" name="membershipId" value={member.membershipId} />
								<button
									type="submit"
									class="flex items-center gap-1 rounded-md border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
								>
									<Ban size={12} aria-hidden="true" />
									失効させる
								</button>
							</form>
						{:else}
							<span class="text-xs text-muted">失効済み</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<section class="mt-8">
	<h2 class="mb-3 flex items-center gap-1.5 text-lg font-semibold text-foreground">
		<UserPlus size={18} aria-hidden="true" />
		招待
	</h2>
	<form method="POST" action="?/invite" class="space-y-4 rounded-lg border border-border bg-surface p-4">
		<fieldset class="space-y-2">
			<legend class="text-sm font-medium text-foreground">誰を</legend>
			<label class="flex flex-col gap-1 text-sm text-muted">
				既存メンバーから選ぶ
				<select
					name="existingPersonId"
					class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
				>
					<option value="">（新規に登録する）</option>
					{#each data.persons as person (person.id)}
						<option value={person.id}>{person.name}{person.email ? `（${person.email}）` : ''}</option>
					{/each}
				</select>
			</label>
			<p class="text-xs text-muted">↑を選ばない場合は、以下で新しいメンバーを登録します。</p>
			<div class="flex flex-wrap gap-2">
				<label class="flex flex-col gap-1 text-sm text-muted">
					名前
					<input
						type="text"
						name="newName"
						class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm text-muted">
					メール（internalは必須）
					<input
						type="email"
						name="newEmail"
						class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm text-muted">
					アカウント種別
					<select
						name="newAccountType"
						class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
					>
						<option value="internal">internal（社内）</option>
						<option value="external">external（外部・Magic Identity等）</option>
					</select>
				</label>
			</div>
		</fieldset>

		<fieldset class="space-y-2">
			<legend class="text-sm font-medium text-foreground">どこに・何の権限で</legend>
			<div class="flex flex-wrap gap-2">
				<label class="flex flex-col gap-1 text-sm text-muted">
					範囲
					<select
						name="scopeType"
						class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
					>
						<option value="title">作品全体</option>
						<option value="timeline">話数のみ（単話参加）</option>
					</select>
				</label>
				{#if data.timelines.length > 0}
					<label class="flex flex-col gap-1 text-sm text-muted">
						話数（範囲=話数のみ、を選んだ場合に使用）
						<select
							name="scopeTimelineId"
							class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
						>
							{#each data.timelines as timeline (timeline.id)}
								<option value={timeline.id}>{timeline.season} 第{timeline.episode}話</option>
							{/each}
						</select>
					</label>
				{/if}
				<label class="flex flex-col gap-1 text-sm text-muted">
					権限レベル
					<select
						name="permissionLevel"
						class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
					>
						<option value="viewer">viewer（閲覧のみ）</option>
						<option value="contributor">contributor（提出可）</option>
						<option value="reviewer">reviewer（レビュー・Issue可）</option>
						<option value="admin">admin（メンバー管理・Seal可）</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-sm text-muted">
					対象工程（カンマ区切り、空欄で全工程）
					<input
						type="text"
						name="processScope"
						placeholder="作画, 動画"
						class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm text-muted">
					有効期限（単話参加・外部は必須）
					<input
						type="date"
						name="expiresAt"
						class="rounded-md border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:ring-primary"
					/>
				</label>
			</div>
		</fieldset>

		<button
			type="submit"
			class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
		>
			<UserPlus size={16} aria-hidden="true" />
			招待
		</button>
	</form>
</section>
