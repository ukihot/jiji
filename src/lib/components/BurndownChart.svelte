<script lang="ts">
	import { BarChart } from 'layerchart';
	import * as m from '$lib/paraglide/messages';

	let { points }: { points: Array<{ date: string; remaining: number }> } = $props();

	const data = $derived(
		points.map((point) => ({ date: new Date(point.date), remaining: point.remaining })),
	);
	const maxRemaining = $derived(Math.max(1, ...data.map((point) => point.remaining)));
	const integerTicks = $derived(Array.from({ length: maxRemaining + 1 }, (_, value) => value));

	// 「8/13/2026」ではなく「8/13」。年は見出しの「（14日間）」で十分読み取れるうえ、
	// フルの年月日表記だとx軸ラベルが密集して重なりやすい。
	function formatShortDate(value: Date): string {
		return `${value.getMonth() + 1}/${value.getDate()}`;
	}
</script>

<div class="burndown-chart" aria-label={m.burndown_chart_label()}>
	<BarChart
		{data}
		x="date"
		y="remaining"
		yDomain={[0, maxRemaining]}
		height={270}
		padding={{ top: 20, right: 16, bottom: 38, left: 34 }}
		bandPadding={0.3}
		grid={false}
		props={{
			bars: {
				radius: 9,
				fill: 'var(--color-primary)',
				stroke: 'color-mix(in oklch, var(--color-primary) 65%, var(--color-surface))',
				strokeWidth: 1,
			},
			yAxis: {
				ticks: integerTicks,
				format: 'integer',
				grid: { stroke: 'var(--color-border)', opacity: 0.55 },
				tickLabelProps: {
					class: 'burndown-axis-label',
					fontSize: 12,
					'font-weight': 400,
					fill: 'var(--color-muted)',
					stroke: 'none',
					strokeWidth: 0,
				},
			},
			xAxis: {
				ticks: 4,
				format: formatShortDate,
				tickLabelProps: {
					class: 'burndown-axis-label',
					fontSize: 11,
					'font-weight': 400,
					fill: 'var(--color-muted)',
					stroke: 'none',
					strokeWidth: 0,
				},
			},
			tooltip: {
				// LayerChartのTooltipは既定でdocument.bodyへportalされ、下のscoped CSSが
				// 効かなくなる（--color-surface-content等このプロジェクトが定義していない
				// トークンにフォールバックし、さらにcolor-scheme未設定でlight-dark()も
				// 常にlight側になるため、暗いテーマでは白背景に白文字同然になり読めなかった）。
				// portalさせずチャート内に留めることで、下の.lc-tooltip-container上書きが届くようにする。
				root: { portal: false },
				header: { format: formatShortDate },
				item: { label: m.burndown_tooltip_remaining(), format: 'integer' },
			},
		}}
	/>
</div>

<style>
	.burndown-chart :global(.lc-root-container) {
		--lc-color-primary: var(--color-primary);
		--lc-axis-color: var(--color-border);
		--lc-axis-tick-color: var(--color-muted);
		--lc-tooltip-bg: var(--color-surface);
		--lc-tooltip-color: var(--color-foreground);
		--lc-tooltip-border: var(--color-border);
	}

	.burndown-chart :global(.lc-bar) {
		filter: drop-shadow(0 5px 7px color-mix(in oklch, var(--color-primary) 20%, transparent));
	}

	.burndown-chart :global(svg) {
		overflow: visible;
	}

	.burndown-chart :global(.lc-tooltip-container) {
		color: var(--color-foreground) !important;
		background: var(--color-surface) !important;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 6px 10px;
		font-weight: 400;
		box-shadow: 0 4px 16px color-mix(in oklch, var(--color-foreground) 20%, transparent);
	}

	.burndown-chart :global(.lc-tooltip-header) {
		font-weight: 600;
	}

	.burndown-chart :global(.burndown-axis-label) {
		fill: var(--color-muted) !important;
		font-family: ui-sans-serif, system-ui, sans-serif !important;
		font-weight: 400 !important;
		paint-order: fill !important;
		stroke: none !important;
		stroke-width: 0 !important;
	}
</style>
