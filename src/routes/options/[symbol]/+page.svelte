<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import WidgetGrid from '../../../components/WidgetGrid.svelte';
	import WidgetCard from '../../../components/WidgetCard.svelte';
	import WidgetLibrary from '../../../components/WidgetLibrary.svelte';
	import WatchlistWidget from '../../../components/WatchlistWidget.svelte';
	import DisclaimerBanner from '../../../components/DisclaimerBanner.svelte';
	import OptionsChainWidget from '../../../components/OptionsChainWidget.svelte';
	import PayoffWidget from '../../../components/PayoffWidget.svelte';
	import GreeksWidget from '../../../components/GreeksWidget.svelte';
	import ProbabilityWidget from '../../../components/ProbabilityWidget.svelte';
	import MatrixWidget from '../../../components/MatrixWidget.svelte';
	import StrategyWidget from '../../../components/StrategyWidget.svelte';
	import { OPTIONS_WIDGETS, loadEnabled, type WidgetDef } from '$lib/layout.svelte';
	import { store } from '$lib/contract.svelte';
	import { formatPrice } from '$lib/format';

	const symbol = $derived(String(page.params.symbol || '').toUpperCase());

	// Ensure the header has chain data even if the chain widget gets disabled
	// (loadChain sets store.symbol synchronously, so a second call never fires).
	onMount(() => {
		if (store.symbol !== symbol) void store.loadChain(symbol);
	});

	const dayChange = $derived(store.dayChangePct);
	const dayColor = $derived(
		dayChange === null ? 'var(--foreground-muted)' : dayChange >= 0 ? '#34d399' : '#f87171'
	);

	let enabled = $state<Record<string, boolean>>({});
	function initEnabled() {
		const stored = loadEnabled('options');
		if (Object.keys(stored).length > 0) {
			enabled = stored;
		} else {
			enabled = Object.fromEntries(OPTIONS_WIDGETS.map((d) => [d.id, true]));
		}
	}
	initEnabled();
	function onToggle(id: string) {
		enabled[id] = enabled[id] === false;
	}
	function onEnable(id: string) {
		enabled[id] = true;
	}

	// Per-widget "how to use" info shown in the card header.
	const WIDGET_INFO: Record<string, { title: string; content: string }> = {
		'options-chain': {
			title: 'How to use the options chain',
			content:
				'Pick an expiry from the chips to see that expiration. Each row pairs a call (left) and a put (right) around the strike. ITM and OTM filter by moneyness. Click a row to select the contract, the payoff, greeks, probability and matrix widgets then react to it. Quotes are delayed and indicative.'
		},
		'payoff-explorer': {
			title: 'How to use the payoff explorer',
			content:
				'The green line shows how much money this option would be worth at expiry for every possible stock price. The vertical blue line marks the current price. Drag the PRICE slider, or click anywhere on the chart, to see the option value and your profit or loss at that price. The DATE slider moves the day forward, showing how time decay shrinks the value. The timeline below lists the estimated price and P/L day by day. All numbers are Black-Scholes estimates, not guarantees.'
		},
		greeks: {
			title: 'What are the greeks?',
			content:
				'Greeks measure how an option price reacts to changes. Delta: price move per $1 in the stock. Gamma: how fast delta itself changes. Theta: value lost per day (time decay). Vega: sensitivity to implied volatility. Rho: sensitivity to interest rates. Each cell has its own info icon with a plain-English explanation.'
		},
		probability: {
			title: 'What does chance of profit mean?',
			content:
				"Prob of profit estimates how likely this trade is to end up making money, using the market's implied volatility in a Black-Scholes model. Prob ends ITM is the chance the option finishes in the money, meaning it still has value at expiry. Expected value compares the fair price with what you pay. These are estimates, not guarantees."
		},
		strategies: {
			title: 'How strategies are picked',
			content:
				'The suggestions are built from the technical indicators of the stock, for example a bullish setup leads to calls and a bearish one to puts. Each card shows the payoff chart, max profit, max loss and breakeven. Click "Why this pick?" on a card for an AI explanation of why it fits the current picture.'
		},
		'pl-matrix': {
			title: 'How to read the P/L matrix',
			content:
				"Rows are future prices of the stock with the move in percent, columns are dates. Each cell estimates your contract's profit or loss at that price on that date, green for profit, red for loss. The highlighted row is closest to the current price. Drag the range slider to widen or narrow the price window."
		}
	};
</script>

<svelte:head>
	<title>VEXARIUM · {symbol} OPTIONS</title>
</svelte:head>

<div>
	<DisclaimerBanner />

	<!-- Compact header strip: rendered from the shared contract store (no extra API call). -->
	<div
		class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-2.5"
		style="background: var(--surface); border: 1px solid var(--panel-border);"
	>
		<div>
			<div class="data" style="font-size: 1.05rem; font-weight: 600; color: var(--foreground)">{symbol}</div>
			<div class="label" style="font-size: 10px; color: var(--foreground-subtle)">Options workspace</div>
		</div>
		<div class="data" style="font-size: 1.15rem; font-weight: 600; color: var(--foreground)">
			{store.currentPrice !== null ? formatPrice(store.currentPrice) : '—'}
		</div>
		{#if dayChange !== null}
			<span class="data" style="font-size: 12px; color: {dayColor}">
				{dayChange >= 0 ? '▲ +' : '▼ −'}{Math.abs(dayChange).toFixed(2)}%
			</span>
		{/if}
		{#if store.delayed}
			<span
				class="label"
				style="color: #f59e0b; border: 1px solid rgba(245,158,11,0.33); padding: 2px 8px; border-radius: 4px"
			>DELAYED</span>
		{/if}
		<a
			href={`/s/${symbol}`}
			class="btn"
			style="margin-left: auto; background: var(--surface-2); border: 1px solid var(--panel-border); color: var(--foreground); padding: 6px 12px; border-radius: 8px; font-size: 12px; text-decoration: none;"
		>Stock analysis</a
		>
	</div>

	<WidgetGrid view="options" defs={OPTIONS_WIDGETS} {enabled} {onToggle}>
		{#snippet children({ def }: { def: WidgetDef })}
			<WidgetCard {def} enabled={enabled[def.id] !== false} {onToggle} info={WIDGET_INFO[def.id] ?? null}>
				<div style="height: 100%;">
					{#if def.id === 'options-chain'}
						<OptionsChainWidget {symbol} />
					{:else if def.id === 'payoff-explorer'}
						<PayoffWidget {symbol} />
					{:else if def.id === 'greeks'}
						<GreeksWidget />
					{:else if def.id === 'probability'}
						<ProbabilityWidget />
					{:else if def.id === 'pl-matrix'}
						<MatrixWidget {symbol} />
					{:else if def.id === 'strategies'}
						<StrategyWidget />
					{:else if def.id === 'watchlist'}
						<WatchlistWidget />
					{/if}
				</div>
			</WidgetCard>
		{/snippet}
	</WidgetGrid>

	<WidgetLibrary view="options" defs={OPTIONS_WIDGETS} enabled={enabled} onEnable={onEnable} />
</div>
