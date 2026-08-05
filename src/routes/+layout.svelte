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

<div class="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6">
	<header class="border-border flex items-center justify-between border-b py-4">
		<a href="/" class="text-foreground flex items-center gap-2 font-semibold no-underline">
			<Film size={20} class="text-primary" aria-hidden="true" />
			Jiji
		</a>

		<div class="flex items-center gap-4">
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
			<ModeToggle mode={data.mode} />
		</div>
	</header>

	<main class="flex-1 py-6">
		{@render children()}
	</main>
</div>
