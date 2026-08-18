<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import * as m from '$lib/paraglide/messages';

	type BurndownPoint = { date: string; remaining: number };
	type ChartComponent = Component<{ points: BurndownPoint[] }>;

	let {
		points,
		style,
	}: {
		points: BurndownPoint[];
		style: 'standard' | 'rough';
	} = $props();

	let container = $state<HTMLDivElement>();
	let Chart = $state<ChartComponent | null>(null);
	const maxRemaining = $derived(Math.max(1, ...points.map((point) => point.remaining)));

	/**
	 * LayerChart/D3 は初期ルートで最も大きい依存グラフになる。操作の判断に必須な数値は
	 * SSRで先に表示し、可視領域に入った後だけ描画ライブラリを取得する。グラフ機能自体は
	 * 維持しつつ、最初のHTML表示とSvelteのhydrateをブロックさせないための境界である。
	 */
	onMount(() => {
		let disposed = false;
		let observer: IntersectionObserver | null = null;

		const loadChart = async () => {
			if (disposed || Chart) return;
			const module =
				style === 'rough'
					? await import('./RoughBurndownChart.svelte')
					: await import('./BurndownChart.svelte');
			if (!disposed) Chart = module.default;
		};

		if (container && 'IntersectionObserver' in window) {
			observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					observer?.disconnect();
					void loadChart();
				},
				{ rootMargin: '180px 0px' },
			);
			observer.observe(container);
		} else {
			void loadChart();
		}

		return () => {
			disposed = true;
			observer?.disconnect();
		};
	});
</script>

<div bind:this={container} class="deferred-burndown" aria-label={m.burndown_chart_label()}>
	{#if Chart}
		<Chart {points} />
	{:else}
		<div class="chart-placeholder" aria-busy="true" aria-label={m.burndown_chart_loading()}>
			<div class="placeholder-grid" aria-hidden="true"></div>
			<div class="placeholder-bars" aria-hidden="true">
				{#each points as point (point.date)}
					<span style:--height={`${Math.max(3, (point.remaining / maxRemaining) * 100)}%`}></span>
				{/each}
			</div>
			<p class="text-muted placeholder-caption">{m.burndown_chart_loading_caption()}</p>
		</div>
	{/if}
</div>

<style>
	.deferred-burndown {
		min-height: 270px;
	}

	.chart-placeholder {
		position: relative;
		height: 270px;
		overflow: hidden;
		border-radius: 0.75rem;
	}

	.placeholder-grid {
		position: absolute;
		inset: 1.25rem 0 2.4rem;
		border-bottom: 1px solid var(--color-border);
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(25% - 1px),
			color-mix(in oklch, var(--color-border) 55%, transparent) calc(25% - 1px),
			color-mix(in oklch, var(--color-border) 55%, transparent) 25%
		);
	}

	.placeholder-bars {
		position: absolute;
		inset: 1.25rem 0 2.4rem 2rem;
		display: flex;
		align-items: end;
		gap: clamp(0.3rem, 1.2vw, 0.8rem);
	}

	.placeholder-bars span {
		flex: 1;
		height: var(--height);
		min-width: 0.25rem;
		border-radius: 0.45rem 0.45rem 0.1rem 0.1rem;
		background: color-mix(in oklch, var(--color-primary) 76%, transparent);
		box-shadow: 0 4px 8px color-mix(in oklch, var(--color-primary) 15%, transparent);
	}

	.placeholder-caption {
		position: absolute;
		bottom: 0.75rem;
		left: 0;
		font-size: 0.6875rem;
	}
</style>
