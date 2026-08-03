<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createOptionsChart, AreaSeries } from 'lightweight-charts';
	import type { IChartApiBase } from 'lightweight-charts';
	import {
		CHART_THEME,
		PROFIT_COLOR,
		LOSS_COLOR
	} from '$lib/chart-theme';

	let {
		points,
		height = 120
	}: {
		points: Array<{ price: number; pl: number }>;
		height?: number;
	} = $props();

	let container: HTMLDivElement;

	// createOptionsChart uses a price-based horizontal scale (x = price).
	type PayoffChart = IChartApiBase<number>;
	let chart: PayoffChart | null = null;
	let series: ReturnType<PayoffChart['addSeries']> | null = null;

	onMount(() => {
		if (!container) return;

		chart = createOptionsChart(container, {
			...CHART_THEME,
			localization: { precision: 2 },
			timeScale: {
				...CHART_THEME.timeScale,
				visible: false
			},
			rightPriceScale: {
				...CHART_THEME.rightPriceScale,
				visible: false
			},
			handleScroll: false,
			handleScale: false,
			crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { visible: false } }
		});

		series = chart.addSeries(AreaSeries, {
			lineColor: PROFIT_COLOR,
			topColor: 'rgba(22, 163, 74, 0.25)',
			bottomColor: 'rgba(220, 38, 38, 0.25)',
			lineWidth: 2,
			priceLineVisible: false,
			lastValueVisible: false,
			crosshairMarkerVisible: false
		});

		applyData(points);
		chart.timeScale().fitContent();
	});

	onDestroy(() => {
		chart?.remove();
		chart = null;
		series = null;
	});

	function applyData(data: Array<{ price: number; pl: number }>) {
		if (!chart || !series) return;
		series.setData(
			data.map((d) => ({
				time: d.price,
				value: d.pl,
				color: d.pl >= 0 ? PROFIT_COLOR : LOSS_COLOR
			}))
		);
		chart.timeScale().fitContent();
	}

	$effect(() => {
		applyData(points);
	});
</script>

<div bind:this={container} style="height: {height}px; width: 100%;"></div>
