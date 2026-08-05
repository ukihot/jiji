<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import { Film, LogIn, User } from 'lucide-svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6">
	<header class="border-border flex items-center justify-between border-b py-4">
		<a href="/" class="text-foreground flex items-center gap-2 font-semibold no-underline">
			<Film size={20} class="text-primary" aria-hidden="true" />
			Jiji
		</a>

		<div class="flex items-center gap-4">
			{#if data.currentPerson}
				<span class="text-muted flex items-center gap-1.5 text-sm">
					<User size={16} aria-hidden="true" />
					{data.currentPerson.name}
				</span>
			{:else}
				<a
					href="/dev-login"
					class="text-primary flex items-center gap-1.5 text-sm no-underline hover:underline"
				>
					<LogIn size={16} aria-hidden="true" />
					ログイン
				</a>
			{/if}
			<ThemeSwitcher theme={data.theme} mode={data.mode} />
		</div>
	</header>

	<main class="flex-1 py-6">
		{@render children()}
	</main>
</div>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
	{/each}
</div>
