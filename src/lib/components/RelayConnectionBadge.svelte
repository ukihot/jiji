<script lang="ts">
	import Wifi from '@lucide/svelte/icons/wifi';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import * as m from '$lib/paraglide/messages';
	import { relayConnection } from '$lib/client/relay-connection.svelte';

	/** trueなら/relayへのリンクとして描画する。falseなら見た目だけ同じ、押せない表示にする。 */
	let { clickable = false }: { clickable?: boolean } = $props();

	let connected = $derived(relayConnection.status === 'online');
</script>

{#snippet badgeContent()}
	{#if connected}
		<Wifi size={13} aria-hidden="true" />
		{m.relay_badge_connected()}
	{:else}
		<WifiOff size={13} aria-hidden="true" />
		{m.relay_badge_disconnected()}
	{/if}
{/snippet}

{#if clickable}
	<a href="/relay" class="relay-badge no-underline" class:connected title={relayConnection.message}>
		{@render badgeContent()}
	</a>
{:else}
	<span class="relay-badge" class:connected title={relayConnection.message}>
		{@render badgeContent()}
	</span>
{/if}

<style>
	.relay-badge {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 999px;
		padding: 0.3rem 0.6rem;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		background: color-mix(in oklch, var(--color-muted) 12%, transparent);
		color: var(--color-muted);
	}

	.relay-badge.connected {
		background: color-mix(in oklch, var(--color-success) 14%, transparent);
		color: var(--color-success);
	}
</style>
