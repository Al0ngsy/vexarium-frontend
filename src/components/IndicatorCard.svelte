<script lang="ts">
	import type { IndicatorResult } from '$lib/types';
	import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '$lib/verdict';

	let { indicator }: { indicator: IndicatorResult } = $props();

	// Plain-language explanations for each technical indicator.
	const EXPLANATIONS: Record<string, string> = {
		RSI: 'Momentum oscillator (0-100). Above 70 = overbought, below 30 = oversold.',
		MACD: 'Trend momentum. Signal-line crossovers mark shifts in trend strength.',
		'SMA 50': '50-day average price. Price above it suggests a short-term uptrend.',
		'SMA 200': '200-day average. The 50/200 crossover is the classic golden/death cross.',
		'EMA 20': '20-day average weighted toward recent prices — short-term trend line.',
		'EMA 50': '50-day average weighted toward recent prices — mid-term trend line.',
		STOCHASTIC: 'Compares close to the recent high/low range. Signals overbought/oversold.',
		BOLLINGER: 'Volatility bands around a moving average. Price at the edges = overbought/oversold.',
		ATR: 'Measures volatility — how much the price typically moves. Higher = wider swings.',
		ADX: 'Gauges trend strength. Above 25 = strong trend, below 20 = range-bound.',
		OBV: 'Cumulative volume flow. Rising OBV confirms price advances.',
		VWAP: 'Volume-weighted average price — the true average price for the day.',
		ICHIMOKU: 'Cloud-based trend system. Price above the cloud = bullish, below = bearish.',
		'BOLLINGER %B': 'Position within the Bollinger Bands. 0/1 mark the band edges.'
	};

	function explanation(): string | null {
		const name = indicator.name.toUpperCase();
		for (const key of Object.keys(EXPLANATIONS)) {
			if (name.includes(key.toUpperCase())) return EXPLANATIONS[key];
		}
		return null;
	}

	function formatValue(value: IndicatorResult['value']): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'number') {
			return Number.isInteger(value) ? String(value) : value.toFixed(2);
		}
		// Object of key:value pairs (e.g. { sma50: 123.4, ema200: 120.1 })
		return Object.entries(value)
			.map(([k, v]) => `${k.toUpperCase()}:${typeof v === 'number' ? v.toFixed(2) : v}`)
			.join('  ');
	}

	const vColor = VERDICT_COLORS[indicator.verdict] || '#9999a0';
	const vLabel = VERDICT_LABELS[indicator.verdict] || indicator.verdict.toUpperCase();
	const vIcon = VERDICT_ICONS[indicator.verdict] || '—';
	const expl = explanation();
</script>

<div class="panel flex flex-col gap-3 p-4" style="border-left: 3px solid {vColor}; border-color: var(--panel-border);">
	<!-- Header: name + verdict -->
	<div class="flex items-start justify-between gap-2">
		<span class="label">{indicator.name}</span>
		<span
			class="label shrink-0 rounded px-2 py-1"
			style="background-color: {vColor}22; color: {vColor}; border: 1px solid {vColor}44;"
		>
			{vIcon} {vLabel}
		</span>
	</div>

	<!-- Value -->
	<div class="data" style="color: var(--foreground); font-size: 1.1rem;">
		{formatValue(indicator.value)}
	</div>

	<!-- Explanation (always visible, compact) -->
	{#if expl}
		<p class="label" style="color: var(--foreground-muted); line-height: 1.5; font-size: 0.7rem; letter-spacing: 0.02em;">
			{expl}
		</p>
	{/if}
</div>
