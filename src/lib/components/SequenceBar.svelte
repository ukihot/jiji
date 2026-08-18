<script lang="ts">
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import * as m from '$lib/paraglide/messages';

	type SequenceCut = {
		cutId: string;
		number: string;
		offsetFrames: number;
		widthFrames: number;
	};

	let {
		cuts,
		totalFrames,
		cutHref,
	}: {
		cuts: SequenceCut[];
		totalFrames: number;
		cutHref: (cutId: string) => string;
	} = $props();

	const FRAMES_PER_SECOND = 24;
	let playheadFrame = $state(0);
	let isPlaying = $state(false);
	let intervalId: ReturnType<typeof setInterval> | undefined;

	const selectedCut = $derived(
		cuts.find(
			(cut) =>
				playheadFrame >= cut.offsetFrames && playheadFrame < cut.offsetFrames + cut.widthFrames,
		) ?? cuts.at(-1),
	);
	const currentTimecode = $derived(formatTimecode(playheadFrame));
	const totalTimecode = $derived(formatTimecode(totalFrames));

	function formatTimecode(frame: number): string {
		const wholeSeconds = Math.floor(frame / FRAMES_PER_SECOND);
		const frames = Math.floor(frame % FRAMES_PER_SECOND);
		const minutes = Math.floor(wholeSeconds / 60);
		const seconds = wholeSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(
			frames,
		).padStart(2, '0')}`;
	}

	function seek(frame: number): void {
		playheadFrame = Math.min(totalFrames, Math.max(0, Math.round(frame)));
	}

	function togglePlayback(): void {
		if (isPlaying) {
			isPlaying = false;
			return;
		}
		if (playheadFrame >= totalFrames) seek(0);
		isPlaying = true;
	}

	$effect(() => {
		if (isPlaying) {
			intervalId = setInterval(() => {
				if (playheadFrame >= totalFrames) {
					isPlaying = false;
					return;
				}
				seek(playheadFrame + 1);
			}, 1000 / FRAMES_PER_SECOND);
		}

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	});
</script>

<div class="space-y-3" aria-label={m.sequence_bar_label()}>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
		<button
			type="button"
			class="bg-primary text-primary-foreground focus-visible:outline-primary inline-flex size-8 items-center justify-center rounded-full shadow-sm transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2"
			onclick={togglePlayback}
			aria-label={isPlaying ? m.sequence_pause() : m.sequence_play()}
			aria-pressed={isPlaying}
		>
			{#if isPlaying}
				<Pause size={15} fill="currentColor" aria-hidden="true" />
			{:else}
				<Play size={15} fill="currentColor" aria-hidden="true" />
			{/if}
		</button>
		<span class="text-foreground font-mono text-sm tabular-nums">{currentTimecode}</span>
		<span class="text-muted text-xs">/ {totalTimecode}</span>
		{#if selectedCut}
			<a
				href={cutHref(selectedCut.cutId)}
				class="text-primary ml-auto text-sm font-medium no-underline hover:underline"
			>
				{m.sequence_current_cut({ cut: selectedCut.number })}
			</a>
		{/if}
	</div>

	<div class="relative pt-1">
		<div class="border-border bg-background relative h-16 overflow-hidden rounded-md border">
			{#each cuts as cut, index (cut.cutId)}
				<a
					href={cutHref(cut.cutId)}
					class="border-background/60 focus-visible:outline-primary absolute inset-y-0 border-r px-1 text-left text-xs font-medium transition focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 {selectedCut?.cutId ===
					cut.cutId
						? 'bg-primary/40 text-foreground'
						: index % 2 === 0
							? 'bg-primary/20 text-foreground hover:bg-primary/30'
							: 'bg-primary/10 text-foreground hover:bg-primary/20'}"
					style={`left: ${(cut.offsetFrames / totalFrames) * 100}%; width: ${(cut.widthFrames / totalFrames) * 100}%;`}
					aria-label={m.sequence_open_cut({ cut: cut.number })}
				>
					<span class="pointer-events-none block truncate">{cut.number}</span>
				</a>
			{/each}
			<div
				class="bg-primary pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 shadow-[0_0_0_1px_var(--color-primary-foreground)]"
				style={`left: ${(playheadFrame / totalFrames) * 100}%;`}
			></div>
		</div>
		<input
			type="range"
			class="accent-primary mt-2 block w-full cursor-pointer"
			min="0"
			max={totalFrames}
			step="1"
			value={playheadFrame}
			oninput={(event) => seek(Number(event.currentTarget.value))}
			aria-label={m.sequence_scrub_label()}
		/>
	</div>
</div>
