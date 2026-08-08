<script lang="ts">
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

	const symbol = $derived(String(page.params.symbol || '').toUpperCase());

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
</script>

<svelte:head>
	<title>VEXARIUM — {symbol} OPTIONS</title>
</svelte:head>

<div>
	<DisclaimerBanner />

	<WidgetGrid view="options" defs={OPTIONS_WIDGETS} {enabled} {onToggle}>
		{#snippet children({ def }: { def: WidgetDef })}
			<WidgetCard {def} enabled={enabled[def.id] !== false} {onToggle}>
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
