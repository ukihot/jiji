<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';

	type RoughVizBar = {
		redraw: (options: RoughVizBarOptions) => void;
		remove: () => void;
		responsive: boolean;
	};

	type RoughVizBarConstructor = new (options: RoughVizBarOptions) => RoughVizBar;

	type RoughVizBarOptions = {
		element: string;
		data: { labels: string[]; values: number[] };
		color: string;
		stroke: string;
		strokeWidth: number;
		innerStrokeWidth: number;
		axisStrokeWidth: number;
		axisRoughness: number;
		roughness: number;
		bowing: number;
		fillStyle: 'cross-hatch';
		fillWeight: number;
		padding: number;
		interactive: boolean;
		font: string;
		axisFontSize: string;
		yValueFormat: string;
		margin: { top: number; right: number; bottom: number; left: number };
	};

	let { points }: { points: Array<{ date: string; remaining: number }> } = $props();
	let container: HTMLDivElement;
	let chart: RoughVizBar | null = null;
	const chartId = 'rough-burndown-chart';

	function formatShortDate(isoDate: string): string {
		const value = new Date(isoDate);
		return `${value.getMonth() + 1}/${value.getDate()}`;
	}

	function chartOptions(): RoughVizBarOptions {
		const styles = getComputedStyle(document.documentElement);
		const primary = styles.getPropertyValue('--color-primary').trim() || '#3976d2';
		const foreground = styles.getPropertyValue('--color-foreground').trim() || '#1e293b';

		return {
			element: `#${chartId}`,
			data: {
				labels: points.map((point) => formatShortDate(point.date)),
				values: points.map((point) => point.remaining),
			},
			color: primary,
			stroke: foreground,
			strokeWidth: 1.2,
			innerStrokeWidth: 1.2,
			axisStrokeWidth: 0.7,
			axisRoughness: 0.7,
			roughness: 0.9,
			bowing: 0.4,
			fillStyle: 'cross-hatch',
			fillWeight: 0.9,
			padding: 0.22,
			interactive: false,
			font: 'ui-sans-serif, system-ui, sans-serif',
			axisFontSize: '12px',
			yValueFormat: 'd',
			margin: { top: 18, right: 20, bottom: 48, left: 36 },
		};
	}

	function keepIntegerYAxisLabels(): void {
		container.querySelectorAll<SVGGElement>(`.yAxis${chartId} .tick`).forEach((tick) => {
			const value = Number((tick as SVGGElement & { __data__?: unknown }).__data__);
			tick.style.display = Number.isInteger(value) ? '' : 'none';
		});
	}

	function reduceXAxisLabels(): void {
		const ticks = Array.from(container.querySelectorAll<SVGGElement>(`.xAxis${chartId} .tick`));
		const maximumLabels = Math.max(2, Math.floor(container.clientWidth / 58));
		const step = Math.max(1, Math.ceil((ticks.length - 1) / (maximumLabels - 1)));

		ticks.forEach((tick, index) => {
			const isEndpoint = index === 0 || index === ticks.length - 1;
			tick.style.display = isEndpoint || index % step === 0 ? '' : 'none';
		});
	}

	function styleAxisLabels(): void {
		const muted = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-muted')
			.trim();

		container.querySelectorAll<SVGTextElement>('.tick text').forEach((label) => {
			label.setAttribute('fill', muted || '#64748b');
			label.setAttribute('stroke', 'none');
			label.setAttribute('stroke-width', '0');
			label.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
			label.style.fontSize = '11px';
			label.style.fontWeight = '400';
			label.style.paintOrder = 'fill';
		});
	}

	onMount(() => {
		// rough-viz はDOMに直接SVGを生成するライブラリなので、SSR後のブラウザ上でだけ読み込む。
		let disposed = false;
		let resizeObserver: ResizeObserver | null = null;

		void import('rough-viz').then((module) => {
			if (disposed) return;

			const RoughVizBar = module.Bar as unknown as RoughVizBarConstructor;
			chart = new RoughVizBar(chartOptions());
			chart.responsive = false;
			keepIntegerYAxisLabels();
			reduceXAxisLabels();
			styleAxisLabels();

			resizeObserver = new ResizeObserver(() => {
				chart?.redraw(chartOptions());
				keepIntegerYAxisLabels();
				reduceXAxisLabels();
				styleAxisLabels();
			});
			resizeObserver.observe(container);
		});

		return () => {
			disposed = true;
			resizeObserver?.disconnect();
			chart?.remove();
			chart = null;
		};
	});
</script>

<div
	bind:this={container}
	id={chartId}
	class="rough-burndown-chart h-[250px] w-full"
	aria-label={m.rough_burndown_chart_label()}
></div>

<style>
	.rough-burndown-chart :global(svg) {
		display: block;
		height: 100%;
		width: 100%;
		overflow: visible;
	}

	.rough-burndown-chart :global(.tick text) {
		fill: var(--color-muted) !important;
		font-family: ui-sans-serif, system-ui, sans-serif !important;
		font-size: 11px !important;
		font-weight: 400 !important;
		paint-order: fill !important;
		stroke: none !important;
		stroke-width: 0 !important;
	}
</style>
