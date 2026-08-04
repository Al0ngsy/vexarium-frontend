<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	import { analyze, getOptionPayoff, getStrategies } from '$lib/api';
	import type {
		AnalysisResponse,
		OptionsPayoffResponse,
		StrategiesResponse,
		Greeks
	} from '$lib/types';
	import { VERDICT_COLORS } from '$lib/verdict';

	import VerdictBadge from '../../../components/VerdictBadge.svelte';
	import StrategyCard from '../../../components/StrategyCard.svelte';
	import InfoPopover from '../../../components/InfoPopover.svelte';
	import SaveTradeModal from '../../../components/SaveTradeModal.svelte';

	let symbol = $derived(String(page.params.symbol || '').toUpperCase());

	// 1. Symbol summary + verdict (basic analysis).
	let analysis = $state<AnalysisResponse | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// 2. Strategies.
	let contractSymbol = $state('');

	// 3. Greeks / payoff (from selected contract).
	let payoff = $state<OptionsPayoffResponse | null>(null);
	let payoffError = $state<string | null>(null);

	let showSave = $state(false);

	onMount(() => {
		load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			analysis = await analyze(symbol);
		} catch (e) {
			analysis = null;
			error = e instanceof Error ? e.message : 'Analysis failed';
		} finally {
			loading = false;
		}
	}

	async function loadStrategies() {
		if (!contractSymbol) return;
		const contract = contractSymbol.toUpperCase();
		strategyLoading = true;
		strategyError = null;
		strategyLoaded = false;
		payoff = null;
		payoffError = null;
		try {
			// Overall sentiment drives the strategy set.
			const sentiment = analysis?.overall.overall_verdict ?? 'hold';
			const strike = parseStrike(contract);
			const exp = parseExpiration(contract);

			const result = await getStrategies(
				symbol,
				sentiment,
				strike,
				exp.gte,
				exp.lte
			);
			strategyData = result;
			strategyLoaded = true;

			// Greeks + payoff timeline for the same contract.
			loadPayoff(contract);
		} catch (e) {
			strategyError = e instanceof Error ? e.message : 'Strategies failed';
		} finally {
			strategyLoading = false;
		}
	}

	async function loadPayoff(contract: string) {
		payoffError = null;
		try {
			payoff = await getOptionPayoff(symbol, contract);
		} catch (e) {
			payoff = null;
			payoffError = e instanceof Error ? e.message : 'Payoff failed';
		}
	}

	// Parse OCC-style symbol, e.g. SPY250919C00750000.
	// Root + 6-digit expiry + [CP] + 5-digit strike.
	function parseStrike(contract: string): number {
		const m = contract.match(/[CP](\d{5,8})$/);
		if (m) return parseInt(m[1], 10) / 1000;
		return 0;
	}

	function parseExpiration(contract: string): { gte: string; lte: string } {
		const m = contract.match(/(\d{6})[CP]/);
		if (m) {
			const d = m[1];
			const formatted = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
			return { gte: formatted, lte: formatted };
		}
		return { gte: '', lte: '' };
	}

	function formatPrice(v: number | null): string {
		if (v === null || v === undefined) return '—';
		return `$${v.toFixed(2)}`;
	}

	function formatPL(v: number): string {
		return `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;
	}

	function formatPLPct(v: number): string {
		return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
	}

	const plColor = $derived((v: number) => (v >= 0 ? '#16a34a' : '#dc2626'));

	const GREEKS: Array<{ key: keyof Greeks; label: string; text: string }> = [
		{
			key: 'delta',
			label: 'DELTA',
			text: 'How much the option price moves for a $1 move in the stock. Near 1 = moves like the stock; near 0 = barely reacts.'
		},
		{
			key: 'gamma',
			label: 'GAMMA',
			text: 'How fast delta changes as the stock moves. Higher gamma = the option reacts more violently to price swings.'
		},
		{
			key: 'theta',
			label: 'THETA',
			text: 'How much value the option loses per day as time passes. Always works against option buyers (time decay).'
		},
		{
			key: 'vega',
			label: 'VEGA',
			text: 'How much the option price changes when implied volatility moves 1%. Higher vega = more sensitive to volatility.'
		},
		{
			key: 'rho',
			label: 'RHO',
			text: 'How much the option price changes when interest rates move 1%. Usually small; matters most for long-dated options.'
		}
	];

	function formatGreek(v: number): string {
		return v.toFixed(4);
	}

	// --- strategy state (runes) ---
	let strategyData = $state<StrategiesResponse | null>(null);
	let strategyLoading = $state(false);
	let strategyError = $state<string | null>(null);
	let strategyLoaded = $state(false);
</script>

<svelte:head>
	<title>VEXARIUM — OPTIONS {symbol}</title>
</svelte:head>

<!-- Loading state: static gray panels -->
{#if loading}
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--panel-border)">
		<div class="mb-4 h-6 w-40 rounded" style="background-color: var(--surface-3)"></div>
		<div class="h-4 w-24 rounded" style="background-color: var(--surface-3)"></div>
	</div>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each Array(3) as _}
			<div class="panel p-4">
				<div class="mb-3 h-3 w-24 rounded" style="background-color: var(--surface-3)"></div>
				<div class="h-24 rounded" style="background-color: var(--surface-3)"></div>
			</div>
		{/each}
	</div>

<!-- Error state -->
{:else if error}
	<div class="panel flex flex-col items-center gap-4 p-12" style="border-top: 2px solid var(--accent-primary)">
		<p class="brand text-2xl" style="color: var(--accent-primary)">
			DATA UNAVAILABLE FOR {symbol}
		</p>
		<p class="label" style="color: var(--foreground-muted)">{error}</p>
		<a class="link-crimson" href="/analysis/{symbol}" onclick={() => load()}>RETRY</a>
	</div>

{:else if analysis}
	<!-- 1. Symbol summary panel -->
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="label mb-1">OPTIONS ANALYSIS</p>
				<p class="brand" style="font-size: 2rem">{symbol}</p>
			</div>
			<div class="flex items-center gap-4">
				<VerdictBadge verdict={analysis.overall.overall_verdict} />
				<div class="text-right">
					<p class="label mb-1">CURRENT PRICE</p>
					<p class="data" style="color: var(--foreground); font-size: 1.25rem">
						{formatPrice(analysis.current_price)}
					</p>
				</div>
			</div>
		</div>
		<div
			class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
			style="border-color: var(--panel-border)"
		>
			<span class="label">SENTIMENT</span>
			<span class="data" style="color: {VERDICT_COLORS[analysis.overall.overall_verdict]}">
				{analysis.overall.overall_verdict.replace('_', ' ').toUpperCase()}
			</span>
		</div>
	</div>

	<!-- 2. Strategy Cards -->
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">STRATEGIES</h2>

		{#if !strategyLoaded}
			<p class="label mb-3" style="color: var(--foreground-muted); text-transform: none">
				Enter an option contract to see beginner-friendly strategy recommendations.
			</p>
			<div class="mb-4 flex flex-wrap items-center gap-3">
				<input
					type="text"
					bind:value={contractSymbol}
					placeholder="e.g. SPY250919C00750000"
					class="rounded border px-3 py-2 font-mono"
					style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground); flex: 1; min-width: 200px;"
				/>
				<button
					class="btn-primary"
					onclick={loadStrategies}
					disabled={strategyLoading || !contractSymbol}
					style="opacity: {strategyLoading || !contractSymbol ? 0.5 : 1}"
				>
					{strategyLoading ? 'LOADING…' : 'LOAD STRATEGIES'}
				</button>
			</div>
			{#if strategyError}
				<p class="label" style="color: var(--accent-primary)">{strategyError}</p>
			{/if}
		{:else if strategyData && strategyData.strategies.length > 0}
			<div class="mb-3 flex items-center justify-between gap-3">
				<p class="label" style="color: var(--foreground-muted)">
					CONTRACT {contractSymbol.toUpperCase()} — {strategyData.sentiment.toUpperCase()}
				</p>
				<button class="link-crimson" onclick={() => (strategyLoaded = false)}>CHANGE CONTRACT</button>
			</div>
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
				{#each strategyData.strategies as strategy}
					<StrategyCard {strategy} />
				{/each}
			</div>
		{:else if strategyLoading}
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
				{#each Array(3) as _}
					<div class="panel p-4">
						<div class="mb-3 h-3 w-24 rounded" style="background-color: var(--surface-3)"></div>
						<div class="h-24 rounded" style="background-color: var(--surface-3)"></div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- 3. Greeks panel -->
	<div
		class="panel mb-6 p-6"
		style="border-top: 2px solid var(--accent-primary); {payoffError ? 'opacity: 0.5;' : ''}"
	>
		<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">GREEKS</h2>
		{#if payoff}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{#each GREEKS as g}
					<div>
						<div class="mb-1 flex items-center gap-1">
							<span class="label">{g.label}</span>
							<InfoPopover title={g.label} content={g.text} />
						</div>
						<span class="data" style="color: var(--foreground)">
							{formatGreek(payoff.greeks[g.key])}
						</span>
					</div>
				{/each}
			</div>
			<div class="mt-4 flex flex-wrap gap-4 border-t pt-3" style="border-color: var(--panel-border)">
				<div>
					<span class="label block">PREMIUM</span>
					<span class="data" style="color: var(--foreground)">{formatPrice(payoff.premium)}</span>
				</div>
				<div>
					<span class="label block">BREAKEVEN</span>
					<span class="data" style="color: var(--foreground)">{formatPrice(payoff.breakeven)}</span>
				</div>
				<div>
					<span class="label block">IMPLIED VOL</span>
					<span class="data" style="color: var(--foreground)">{payoff.implied_volatility.toFixed(1)}%</span>
				</div>
			</div>
		{:else if strategyLoaded}
			<p class="label" style="color: var(--foreground-muted)">
				{payoffError ? payoffError : 'Load strategies to see Greek exposure for the selected contract.'}
			</p>
		{:else}
			<p class="label" style="color: var(--foreground-muted)">
				Load a contract to view delta, gamma, theta, vega and rho.
			</p>
		{/if}
	</div>

	<!-- 4. Payoff timeline table -->
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">PAYOFF TIMELINE</h2>
		{#if payoff && payoff.payoff_timeline.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-left">
					<thead>
						<tr class="label" style="border-bottom: 1px solid var(--panel-border); color: var(--foreground-muted)">
							<th class="py-2 pr-4">DATE</th>
							<th class="py-2 pr-4">EST. PRICE</th>
							<th class="py-2 pr-4">P/L</th>
							<th class="py-2 pr-4">P/L %</th>
						</tr>
					</thead>
					<tbody>
						{#each payoff.payoff_timeline as row}
							<tr class="data" style="border-bottom: 1px solid var(--panel-border)">
								<td class="py-2 pr-4" style="color: var(--foreground-muted)">{row.date}</td>
								<td class="py-2 pr-4" style="color: var(--foreground)">
									{formatPrice(row.estimated_option_price)}
								</td>
								<td class="py-2 pr-4 font-mono" style="color: {plColor(row.estimated_pl)}">
									{formatPL(row.estimated_pl)}
								</td>
								<td class="py-2 pr-4 font-mono" style="color: {plColor(row.pl_pct)}">
									{formatPLPct(row.pl_pct)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="label mt-3" style="color: var(--foreground-subtle)">
				ESTIMATE — NOT GUARANTEED
			</p>
		{:else}
			<p class="label" style="color: var(--foreground-muted)">
				Load a contract to see the projected payoff over time.
			</p>
		{/if}
	</div>

	<!-- 5. Save to portfolio -->
	<div class="mt-6 flex justify-end">
		<button
			class="btn-outline"
			onclick={() => (showSave = true)}
			disabled={!analysis.current_price}
			style="opacity: {analysis.current_price ? 1 : 0.5}"
		>
			SAVE TO PORTFOLIO
		</button>
	</div>

	<SaveTradeModal
		open={showSave}
		{symbol}
		entryPrice={analysis.current_price}
		onClose={() => (showSave = false)}
	/>
{/if}
