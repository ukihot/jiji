<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import UserRoundPlus from '@lucide/svelte/icons/user-round-plus';
	import * as m from '$lib/paraglide/messages';

	type Artist = { id: string; name: string };

	let {
		artists,
		selectedId = $bindable<string | null>(null),
		name = 'assigneeId',
		class: className = '',
	}: { artists: Artist[]; selectedId?: string | null; name?: string; class?: string } = $props();

	let dialog: HTMLDialogElement;
	let query = $state('');
	const selectedArtist = $derived(artists.find((artist) => artist.id === selectedId) ?? null);
	const matches = $derived(
		artists.filter((artist) =>
			artist.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
		),
	);

	function open(): void {
		query = '';
		dialog.showModal();
	}

	function choose(id: string): void {
		selectedId = id;
		dialog.close();
	}
</script>

<input type="hidden" {name} value={selectedId ?? ''} />
<button
	type="button"
	onclick={open}
	class="border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none {className}"
>
	<UserRoundPlus size={15} class="text-primary shrink-0" aria-hidden="true" />
	<span class={selectedArtist ? '' : 'text-muted'}
		>{selectedArtist?.name ?? m.artist_picker_unassigned()}</span
	>
</button>

<dialog
	bind:this={dialog}
	class="backdrop:bg-foreground/30 border-border bg-surface m-auto w-[min(92vw,34rem)] rounded-2xl border p-0 text-inherit shadow-2xl"
	aria-label={m.artist_picker_trigger()}
>
	<div class="border-border flex items-center justify-between border-b px-5 py-4">
		<div>
			<p class="text-foreground font-semibold">{m.artist_picker_heading()}</p>
			<p class="text-muted mt-0.5 text-xs">{m.artist_picker_hint()}</p>
		</div>
		<button
			type="button"
			class="text-muted hover:text-foreground rounded-md px-2 py-1 text-sm"
			onclick={() => dialog.close()}>{m.artist_picker_close()}</button
		>
	</div>
	<div class="p-4">
		<label
			class="border-border bg-background focus-within:border-primary flex items-center gap-2 rounded-lg border px-3 py-2"
		>
			<Search size={16} class="text-muted" aria-hidden="true" />
			<input
				bind:value={query}
				class="text-foreground placeholder:text-muted w-full border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
				placeholder={m.artist_picker_search_placeholder()}
			/>
		</label>
		<div class="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
			{#if matches.length === 0}
				<p class="text-muted px-3 py-8 text-center text-sm">{m.artist_picker_empty()}</p>
			{:else}
				{#each matches as artist (artist.id)}
					<button
						type="button"
						onclick={() => choose(artist.id)}
						class="text-foreground hover:bg-primary/10 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition"
					>
						<span>{artist.name}</span>{#if artist.id === selectedId}<span
								class="text-primary text-xs font-medium">{m.artist_picker_selected()}</span
							>{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>
</dialog>
