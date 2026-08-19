<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import Film from '@lucide/svelte/icons/film';
	import LogIn from '@lucide/svelte/icons/log-in';
	import ModeToggle from '$lib/components/ModeToggle.svelte';
	import RelayConnectionBadge from '$lib/components/RelayConnectionBadge.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import { resumeActiveRelayConnection } from '$lib/client/relay-connection.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();

	// バッジ自体はrelayEnabled/役職に関係なく内部スタッフ全員に見せる（チーム全体のアンビエントな状態表示）。
	// クリックして/relayへ飛べる（＝ヘッダーからのショートカット）のはworkspaceRoleがowner/adminだけに絞る。
	// 実際のアクセス制御自体は/relay側のrelayEnabledチェックのまま変えない。
	let showsRelayBadge = $derived(data.currentPerson?.accountType === 'internal');
	let canOperateRelay = $derived(
		data.currentPerson?.accountType === 'internal' && data.currentPerson?.relayEnabled === true,
	);
	let canOpenRelayPage = $derived(
		data.currentPerson?.workspaceRole === 'owner' || data.currentPerson?.workspaceRole === 'admin',
	);

	// design.md 9.6.1: Directory Handleへの許可は端末・ブラウザ単位で持続する。ログイン直後や
	// ページ再読込のたびに毎回/relayを開いて「再開」を押させないよう、許可済みなら黙って繋ぎ直す。
	onMount(() => {
		if (canOperateRelay) void resumeActiveRelayConnection();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="bg-background flex min-h-screen flex-col">
	<!--
		基幹システムらしい「常に居場所と自分・見た目操作にアクセスできるツールバー」。
		以前はページ本文と同じ細い列に収まる、ブログのようなヘッダーだった。
		ここは sticky にして、縦に長いページ（カット詳細など）をスクロールしても
		ユーザーメニューやテーマ切り替えに手が届く状態を保つ。
	-->
	<header class="border-border/80 bg-surface/88 sticky top-0 z-20 border-b backdrop-blur-xl">
		<div
			class="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
		>
			<a href="/" class="text-foreground flex items-center gap-3 font-semibold no-underline">
				<span
					class="bg-primary text-primary-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
				>
					<Film size={16} aria-hidden="true" />
				</span>
				<span class="flex items-baseline gap-2 tracking-tight">
					<span>Jiji</span>
					<span
						class="text-muted hidden text-[10px] font-medium tracking-[0.18em] uppercase sm:inline"
						>production</span
					>
				</span>
			</a>

			<div class="flex items-center gap-3">
				{#if showsRelayBadge}
					<RelayConnectionBadge clickable={canOpenRelayPage} />
				{/if}
				{#if data.currentPerson}
					<UserMenu person={data.currentPerson} />
				{:else}
					<a
						href="/dev-login"
						class="text-primary flex items-center gap-1.5 text-sm no-underline hover:underline"
					>
						<LogIn size={16} aria-hidden="true" />
						{m.nav_login()}
					</a>
				{/if}
				<span class="bg-border h-5 w-px" aria-hidden="true"></span>
				<ModeToggle mode={data.mode} />
			</div>
		</div>
	</header>

	<main class="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
		{@render children()}
	</main>
</div>
