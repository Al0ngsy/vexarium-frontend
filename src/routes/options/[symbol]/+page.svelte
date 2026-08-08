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

	<div
		class="mb-4 rounded-xl px-3 py-1.5 text-center"
		style="background-color: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.3);"
	>
		<span class="label" style="color: var(--accent-primary); letter-spacing: 0.08em;">
			🚧 OPTIONS WORKSPACE — UNDER CONSTRUCTION. SOME FEATURES ARE INCOMPLETE OR EXPERIMENTAL.
		</span>
	</div>

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
