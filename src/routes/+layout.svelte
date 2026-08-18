<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import Film from '@lucide/svelte/icons/film';
	import LogIn from '@lucide/svelte/icons/log-in';
	import ModeToggle from '$lib/components/ModeToggle.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();
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
