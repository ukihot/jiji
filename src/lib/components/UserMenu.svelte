<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Settings from '@lucide/svelte/icons/settings';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import User from '@lucide/svelte/icons/user';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import type { CurrentPerson } from '$lib/server/auth/internal';

	let { person }: { person: CurrentPerson } = $props();
	let menu: HTMLDetailsElement;
	let trigger: HTMLElement;

	function closeMenu({ restoreFocus = false } = {}) {
		if (!menu?.open) return;

		menu.open = false;
		if (restoreFocus) trigger?.focus();
	}

	afterNavigate(() => {
		closeMenu();
	});

	onMount(() => {
		function closeWhenLeavingMenu(event: PointerEvent | FocusEvent) {
			if (event.target instanceof Node && !menu?.contains(event.target)) {
				closeMenu();
			}
		}

		function closeOnEscape(event: KeyboardEvent) {
			if (event.key !== 'Escape' || !menu?.open) return;

			event.preventDefault();
			closeMenu({ restoreFocus: true });
		}

		document.addEventListener('pointerdown', closeWhenLeavingMenu);
		document.addEventListener('focusin', closeWhenLeavingMenu);
		document.addEventListener('keydown', closeOnEscape);

		return () => {
			document.removeEventListener('pointerdown', closeWhenLeavingMenu);
			document.removeEventListener('focusin', closeWhenLeavingMenu);
			document.removeEventListener('keydown', closeOnEscape);
		};
	});
</script>

<details bind:this={menu} class="relative">
	<summary
		bind:this={trigger}
		class="text-muted flex cursor-pointer list-none items-center gap-1.5 text-sm [&::-webkit-details-marker]:hidden"
	>
		<User size={16} aria-hidden="true" />
		{person.name}
		<ChevronDown size={14} aria-hidden="true" />
	</summary>
	<div
		class="border-border bg-surface absolute right-0 z-10 mt-2 w-44 rounded-md border p-1 shadow-lg"
	>
		<a
			href="/settings"
			class="text-foreground hover:bg-background flex items-center gap-2 rounded px-2 py-1.5 text-sm no-underline"
		>
			<Settings size={14} aria-hidden="true" />
			{m.user_settings_link()}
		</a>
		{#if person.workspaceRole === 'owner' || person.workspaceRole === 'admin'}
			<a
				href="/audit"
				class="text-foreground hover:bg-background flex items-center gap-2 rounded px-2 py-1.5 text-sm no-underline"
			>
				<ScrollText size={14} aria-hidden="true" />
				{m.audit_log_link()}
			</a>
		{/if}
		<form method="POST" action="/logout">
			<button
				type="submit"
				class="text-danger hover:bg-danger/10 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
			>
				<LogOut size={14} aria-hidden="true" />
				{m.logout_action()}
			</button>
		</form>
	</div>
</details>
