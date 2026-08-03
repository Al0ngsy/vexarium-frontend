<script lang="ts">
	import type { IndicatorResult } from '$lib/types';
	import VerdictBadge from './VerdictBadge.svelte';

	let { indicator }: { indicator: IndicatorResult } = $props();

	let expanded = $state(false);

	// Plain-language explanations for progressive disclosure.
	const EXPLANATIONS: Record<string, string> = {
		RSI:
			'Relative Strength Index — momentum oscillator (0-100); above 70 is overbought, below 30 is oversold.',
		MACD: 'Moving Average Convergence Divergence — trend momentum; signal-line crossovers mark shifts in trend strength.',
		'SMA 50': '50-day Simple Moving Average — recent average price; price above suggests short-term uptrend.',
		'SMA 200': '200-day Simple Moving Average — long-term trend; the 50/200 crossover is the classic golden/death cross.',
		'EMA 20': '20-day Exponential Moving Average — gives more weight to recent prices; short-term trend line.',
		'EMA 50': '50-day Exponential Moving Average — mid-term trend line weighted toward recent action.',
		STOCHASTIC: 'Stochastic oscillator — compares close to the recent high/low range; signals overbought/oversold.',
		'Bollinger Bands': 'Volatility bands around a moving average; price at the edges signals overbought/oversold.',
		ATR: 'Average True Range — measures volatility; higher values mean wider expected price swings.',
		ADX: 'Average Directional Index — gauges trend strength; above 25 is a strong trend, below 20 is range-bound.',
		OBV: 'On-Balance Volume — cumulative volume flow; rising OBV confirms price advances.',
		CCI: 'Commodity Channel Index — detects cyclical turns; extreme readings signal overbought/oversold.',
		MOMENTUM: 'Rate-of-change momentum — how fast price is moving; rising momentum confirms the trend.',
		'VOLUME': 'Trading volume — participation level; price moves on strong volume are more significant.',
		'VOLUME SMA': 'Volume Moving Average — baseline trading activity used to spot unusual volume spikes.',
		SUPPORT: 'Support level — a price floor where buying historically absorbs selling pressure.',
		RESISTANCE: 'Resistance level — a price ceiling where selling historically caps advances.',
		'BOLLINGER %B': 'Percent-B — position within the Bollinger Bands; 0/1 mark the band edges.',
		'CANDLE PATTERN': 'Single-candle shape analysis — patterns like doji or engulfing signal potential reversals.'
	};

	function formatValue(value: IndicatorResult['value']): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'number') {
			return Number.isInteger(value) ? String(value) : value.toFixed(2);
		}
		// Object of key:value pairs (e.g. { sma20: 123.4, sma50: 120.1 })
		return Object.entries(value)
			.map(([k, v]) => `${k.toUpperCase()}:${typeof v === 'number' ? v.toFixed(2) : v}`)
			.join(' ');
	}

	function explanation(): string | null {
		const key = Object.keys(EXPLANATIONS).find(
			(k) => indicator.name.toLowerCase() === k.toLowerCase() || indicator.name.toLowerCase().includes(k.toLowerCase())
		);
		return key ? EXPLANATIONS[key] : null;
	}
</script>

<div
	class="panel cursor-pointer p-4 transition-colors"
	style="border-color: var(--panel-border)"
	onclick={() => (expanded = !expanded)}
>
	<div class="mb-2 flex items-center justify-between gap-2">
		<span class="label">{indicator.name}</span>
		<VerdictBadge verdict={indicator.verdict} />
	</div>
	<div class="data" style="color: var(--foreground)">{formatValue(indicator.value)}</div>

	{#if expanded && explanation()}
		<p class="label mt-3" style="color: var(--foreground-muted); line-height: 1.5">
			{explanation()}
		</p>
	{/if}
</div>
