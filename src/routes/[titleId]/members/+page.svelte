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
		Users,
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
		admin: Shield,
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
		class="text-primary flex w-fit items-center gap-1 text-sm no-underline hover:underline"
	>
		<ArrowLeft size={14} aria-hidden="true" />
		{data.title.name}
	</a>
</p>
<h1 class="text-foreground mt-2 flex items-center gap-2 text-2xl font-bold">
	<Users size={22} class="text-primary" aria-hidden="true" />
	{data.title.name} メンバー
</h1>
<p class="text-muted mt-1 text-sm">
	design.md 8章: Googleスプレッドシートの共有を踏襲したアクセス権。期限が近い行は強調表示します。
</p>

{#if form?.message}
	<p class="text-danger mt-4 flex items-center gap-1.5 text-sm">
		<AlertTriangle size={16} aria-hidden="true" />
		{form.message}
	</p>
{/if}

<div class="border-border bg-surface mt-6 overflow-x-auto rounded-lg border">
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr class="border-border text-muted border-b text-left">
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
					class="border-border border-b last:border-0"
					class:opacity-50={!member.isActive}
					class:bg-warning-surface={member.isActive && isExpiringSoon(member.expiresAt)}
				>
					<td class="text-foreground px-4 py-2.5">{member.personName}</td>
					<td class="px-4 py-2.5">
						{#if member.isActive}
							<form method="POST" action="?/updatePermission" class="flex items-center gap-1.5">
								<input type="hidden" name="membershipId" value={member.membershipId} />
								<select
									name="permissionLevel"
									class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md py-1 pr-6 pl-2 text-xs"
								>
									{#each PERMISSION_LEVELS as level (level)}
										<option value={level} selected={level === member.permissionLevel}
											>{level}</option
										>
									{/each}
								</select>
								<button
									type="submit"
									class="border-border text-foreground hover:bg-background rounded-md border px-2 py-1 text-xs"
								>
									更新
								</button>
							</form>
						{:else}
							<span class="text-muted flex items-center gap-1">
								<Icon size={14} aria-hidden="true" />
								{member.permissionLevel}
							</span>
						{/if}
					</td>
					<td class="text-foreground px-4 py-2.5">{scopeLabel(member.scopeType, member.scopeId)}</td
					>
					<td class="text-foreground px-4 py-2.5">{formatDate(member.expiresAt)}</td>
					<td class="px-4 py-2.5 text-right">
						{#if member.isActive}
							<form method="POST" action="?/revoke">
								<input type="hidden" name="membershipId" value={member.membershipId} />
								<button
									type="submit"
									class="border-danger/40 text-danger hover:bg-danger/10 flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
								>
									<Ban size={12} aria-hidden="true" />
									失効させる
								</button>
							</form>
						{:else}
							<span class="text-muted text-xs">失効済み</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<section class="mt-8">
	<h2 class="text-foreground mb-3 flex items-center gap-1.5 text-lg font-semibold">
		<UserPlus size={18} aria-hidden="true" />
		招待
	</h2>
	<form
		method="POST"
		action="?/invite"
		class="border-border bg-surface space-y-4 rounded-lg border p-4"
	>
		<fieldset class="space-y-2">
			<legend class="text-foreground text-sm font-medium">誰を</legend>
			<label class="text-muted flex flex-col gap-1 text-sm">
				既存メンバーから選ぶ
				<select
					name="existingPersonId"
					class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
				>
					<option value="">（新規に登録する）</option>
					{#each data.persons as person (person.id)}
						<option value={person.id}
							>{person.name}{person.email ? `（${person.email}）` : ''}</option
						>
					{/each}
				</select>
			</label>
			<p class="text-muted text-xs">↑を選ばない場合は、以下で新しいメンバーを登録します。</p>
			<div class="flex flex-wrap gap-2">
				<label class="text-muted flex flex-col gap-1 text-sm">
					名前
					<input
						type="text"
						name="newName"
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
					/>
				</label>
				<label class="text-muted flex flex-col gap-1 text-sm">
					メール（internalは必須）
					<input
						type="email"
						name="newEmail"
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
					/>
				</label>
				<label class="text-muted flex flex-col gap-1 text-sm">
					アカウント種別
					<select
						name="newAccountType"
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
					>
						<option value="internal">internal（社内）</option>
						<option value="external">external（外部・Magic Identity等）</option>
					</select>
				</label>
			</div>
		</fieldset>

		<fieldset class="space-y-2">
			<legend class="text-foreground text-sm font-medium">どこに・何の権限で</legend>
			<div class="flex flex-wrap gap-2">
				<label class="text-muted flex flex-col gap-1 text-sm">
					範囲
					<select
						name="scopeType"
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
					>
						<option value="title">作品全体</option>
						<option value="timeline">話数のみ（単話参加）</option>
					</select>
				</label>
				{#if data.timelines.length > 0}
					<label class="text-muted flex flex-col gap-1 text-sm">
						話数（範囲=話数のみ、を選んだ場合に使用）
						<select
							name="scopeTimelineId"
							class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
						>
							{#each data.timelines as timeline (timeline.id)}
								<option value={timeline.id}>{timeline.season} 第{timeline.episode}話</option>
							{/each}
						</select>
					</label>
				{/if}
				<label class="text-muted flex flex-col gap-1 text-sm">
					権限レベル
					<select
						name="permissionLevel"
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
					>
						<option value="viewer">viewer（閲覧のみ）</option>
						<option value="contributor">contributor（提出可）</option>
						<option value="reviewer">reviewer（レビュー・Issue可）</option>
						<option value="admin">admin（メンバー管理・Seal可）</option>
					</select>
				</label>
				<label class="text-muted flex flex-col gap-1 text-sm">
					対象工程（カンマ区切り、空欄で全工程）
					<input
						type="text"
						name="processScope"
						placeholder="作画, 動画"
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
					/>
				</label>
				<label class="text-muted flex flex-col gap-1 text-sm">
					有効期限（単話参加・外部は必須）
					<input
						type="date"
						name="expiresAt"
						class="border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md px-2 py-1.5 text-sm"
					/>
				</label>
			</div>
		</fieldset>

		<button
			type="submit"
			class="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
		>
			<UserPlus size={16} aria-hidden="true" />
			招待
		</button>
	</form>
</section>
