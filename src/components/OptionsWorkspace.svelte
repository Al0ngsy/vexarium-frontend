<script lang="ts">
	import { onMount } from 'svelte';

	import {
		analyze,
		getOptionChain,
		getOptionPayoff,
		getStrategies,
		getOptionChance
	} from '$lib/api';
	import { getToken } from '$lib/auth.svelte';
	import { formatPrice } from '$lib/format';
	import type {
		AnalysisResponse,
		OptionContract,
		OptionsPayoffResponse,
		StrategiesResponse,
		Greeks,
		OptionChanceResponse
	} from '$lib/types';
	import { VERDICT_COLORS } from '$lib/verdict';

	import VerdictBadge from './VerdictBadge.svelte';
	import ContractPicker from './ContractPicker.svelte';
	import PayoffExplorer from './PayoffExplorer.svelte';
	import OptionsMatrix from './OptionsMatrix.svelte';
	import OptionsChain from './OptionsChain.svelte';
	import StrategyCard from './StrategyCard.svelte';
	import OptionGlossary from './OptionGlossary.svelte';
	import InfoPopover from './InfoPopover.svelte';
	import SaveTradeModal from './SaveTradeModal.svelte';

	let { symbol }: { symbol: string } = $props();

	// Tabs + experience level
	type Tab = 'guided' | 'chain' | 'builder';
	let tab = $state<Tab>('guided');
	type Level = 'novice' | 'intermediate' | 'advanced';
	const LEVELS: Level[] = ['novice', 'intermediate', 'advanced'];
	let level = $state<Level>('novice');

	// 1. Symbol summary + verdict (basic analysis).
	let analysis = $state<AnalysisResponse | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// 2. Option chain + selected contract.
	let chain = $state<OptionContract[]>([]);
	let currentPrice = $state<number | null>(null);
	let dayChangePct = $state<number | null>(null);
	let delayed = $state(true);
	let chainLoading = $state(false);
	let chainError = $state<string | null>(null);
	let contractSymbol = $state('');

	// 3. Greeks / payoff (from selected contract).
	let payoff = $state<OptionsPayoffResponse | null>(null);
	let payoffError = $state<string | null>(null);

	// 4. Strategies + chance-of-profit (Pro).
	let strategyData = $state<StrategiesResponse | null>(null);
	let strategyLoading = $state(false);
	let strategyError = $state<string | null>(null);
	let strategyLoaded = $state(false);
	let chance = $state<OptionChanceResponse | null>(null);
	let chanceError = $state<string | null>(null);

	let showSave = $state(false);

	const token = $derived(getToken());

	onMount(() => {
		load();
		loadChain();
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

	async function loadChain() {
		chainLoading = true;
		chainError = null;
		try {
			const gte = new Date().toISOString().slice(0, 10);
			const lte = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
			const resp = await getOptionChain(symbol, gte, lte, 10);
			chain = resp.contracts || [];
			currentPrice = resp.current_price ?? null;
			dayChangePct = resp.day_change_pct ?? null;
			delayed = resp.delayed ?? true;
		} catch (e) {
			chain = [];
			chainError = e instanceof Error ? e.message : 'Options chain failed';
		} finally {
			chainLoading = false;
		}
	}

	async function onContractSelected(contractSymbolValue: string) {
		contractSymbol = contractSymbolValue;
		await loadStrategies(contractSymbolValue);
		await loadChance(contractSymbolValue);
	}

	async function loadStrategies(contract: string) {
		if (!contract) return;
		strategyLoading = true;
		strategyError = null;
		strategyLoaded = false;
		payoff = null;
		payoffError = null;
		try {
			const sentiment = analysis?.overall.overall_verdict ?? 'hold';
			const strike = parseStrike(contract);
			const exp = parseExpiration(contract);
			const result = await getStrategies(symbol, sentiment, strike, exp.gte, exp.lte);
			strategyData = result;
			strategyLoaded = true;
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

	// Pro-gated chance-of-profit. Handles 403 gracefully (shows PRO lock).
	async function loadChance(contract: string) {
		if (!contract) return;
		chance = null;
		chanceError = null;
		try {
			chance = await getOptionChance(symbol, contract, token ?? undefined);
		} catch (e) {
			chance = null;
			chanceError = e instanceof Error ? e.message : null;
		}
	}

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

	function formatPL(v: number): string {
		return `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;
	}
	function formatPLPct(v: number): string {
		return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
	}
	const plColor = $derived((v: number) => (v >= 0 ? '#34d399' : '#f87171'));

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

	// Selected contract details.
	const selectedContract = $derived.by(() => {
		if (!contractSymbol) return null;
		return chain.find((c) => c.symbol === contractSymbol) ?? null;
	});
	const contractStrike = $derived(selectedContract?.strike_price ?? null);
	const contractIsCall = $derived(selectedContract ? selectedContract.type.toLowerCase() === 'call' : null);
	const contractExpiry = $derived(selectedContract?.expiration_date ?? null);

	// --- Guided flow state ---
	type Sentiment = 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
	const SENTIMENTS: Sentiment[] = ['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'];
	const SENTIMENT_LABEL: Record<Sentiment, string> = {
		very_bearish: 'VERY BEARISH',
		bearish: 'BEARISH',
		neutral: 'NEUTRAL',
		bullish: 'BULLISH',
		very_bullish: 'VERY BULLISH'
	};
	const SENTIMENT_COLOR: Record<Sentiment, string> = {
		very_bearish: '#f87171',
		bearish: '#fb923c',
		neutral: '#fbbf24',
		bullish: '#4ade80',
		very_bullish: '#34d399'
	};
	// Map a technical-analysis verdict to a sentiment.
	const verdictSentiment = $derived.by<Sentiment>(() => {
		const v = analysis?.overall.overall_verdict ?? 'hold';
		switch (v) {
			case 'strong_buy':
				return 'very_bullish';
			case 'buy':
				return 'bullish';
			case 'sell':
				return 'bearish';
			case 'strong_sell':
				return 'very_bearish';
			default:
				return 'neutral';
		}
	});
	let sentiment = $state<Sentiment>('neutral');
	let targetPrice = $state<number | null>(null);
	let budget = $state<number>(1000);

	function onSentimentChange(s: Sentiment) {
		sentiment = s;
		refilterStrategyCards();
	}

	// The strategy set shown in Guided depends on sentiment. When the user picks
	// a sentiment, we reload strategies with that sentiment (if a contract is
	// selected) — otherwise just show the indicator-driven set.
	let guidedStrategies = $state<StrategiesResponse | null>(null);
	async function refilterStrategyCards() {
		if (!contractSymbol) return;
		guidedStrategies = null;
		try {
			const strike = parseStrike(contractSymbol);
			const exp = parseExpiration(contractSymbol);
			guidedStrategies = await getStrategies(symbol, sentiment, strike, exp.gte, exp.lte);
		} catch {
			guidedStrategies = null;
		}
	}

	const targetMovePct = $derived(
		targetPrice && currentPrice ? ((targetPrice - currentPrice) / currentPrice) * 100 : null
	);
	const budgetContracts = $derived(
		selectedContract?.last_price && budget > 0
			? Math.max(1, Math.floor(budget / (selectedContract.last_price * 100)))
			: null
	);
</script>

<!-- Loading state -->
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

{:else if error}
	<div class="panel flex flex-col items-center gap-4 p-12" style="border-top: 2px solid var(--accent-primary)">
		<p class="brand text-2xl" style="color: var(--accent-primary)">DATA UNAVAILABLE FOR {symbol}</p>
		<p class="label" style="color: var(--foreground-muted)">{error}</p>
		<a class="link-crimson" href="/?symbol={symbol}" onclick={() => load()}>RETRY</a>
	</div>

{:else if analysis}
	<!-- Header strip -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded px-4 py-3" style="border: 1px solid var(--panel-border); border-top: 2px solid var(--accent-primary); background: var(--surface)">
		<div class="flex items-center gap-3">
			<p class="label mb-0" style="color: var(--foreground-subtle)">OPTIONS</p>
			<p class="brand" style="font-size: 1.5rem">{symbol}</p>
			<VerdictBadge verdict={analysis.overall.overall_verdict} />
			{#if delayed}
				<span class="label" style="color: #fbbf24; border: 1px solid rgba(251,191,36,0.33); padding: 2px 6px; border-radius: 4px">DELAYED</span>
			{/if}
		</div>
		<div class="flex flex-wrap items-center gap-6">
			<div class="text-right">
				<p class="label mb-0" style="font-size: 9px">CURRENT PRICE</p>
				<p class="data" style="color: var(--foreground); font-size: 1.1rem">
					{formatPrice(currentPrice ?? analysis.current_price)}
					{#if dayChangePct !== null}
						<span class="data" style="color: {dayChangePct >= 0 ? '#34d399' : '#f87171'}; font-size: 0.8rem">
							{formatPLPct(dayChangePct)}
						</span>
					{/if}
				</p>
			</div>
			<div class="text-right">
				<p class="label mb-0" style="font-size: 9px">SENTIMENT</p>
				<p class="data" style="color: {VERDICT_COLORS[analysis.overall.overall_verdict]}">
					{analysis.overall.overall_verdict.replace('_', ' ').toUpperCase()}
				</p>
			</div>
			<a href={`/?symbol=${symbol}`} class="btn-outline" style="white-space: nowrap">VIEW ANALYSIS →</a>
		</div>
	</div>

	<!-- Experience level + tabs -->
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<div class="flex gap-1">
			<button type="button" onclick={() => (tab = 'guided')} class="px-4 py-2 label rounded-lg" style="border: 1px solid {tab === 'guided' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {tab === 'guided' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {tab === 'guided' ? 'var(--accent-white)' : 'var(--foreground-muted)'}; font-weight: {tab === 'guided' ? 700 : 600};">GUIDED</button>
			<button type="button" onclick={() => (tab = 'chain')} class="px-4 py-2 label rounded-lg" style="border: 1px solid {tab === 'chain' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {tab === 'chain' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {tab === 'chain' ? 'var(--accent-white)' : 'var(--foreground-muted)'}; font-weight: {tab === 'chain' ? 700 : 600};">CHAIN</button>
			<button type="button" onclick={() => (tab = 'builder')} class="px-4 py-2 label rounded-lg" style="border: 1px solid {tab === 'builder' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {tab === 'builder' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {tab === 'builder' ? 'var(--accent-white)' : 'var(--foreground-muted)'}; font-weight: {tab === 'builder' ? 700 : 600};">BUILDER</button>
		</div>
		<div class="flex items-center gap-2">
			<span class="label" style="color: var(--foreground-subtle)">EXPERIENCE</span>
			{#each LEVELS as l}
				<button type="button" onclick={() => (level = l)} class="px-3 py-1 label" style="border: 1px solid {level === l ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {level === l ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">{l.toUpperCase()}</button>
			{/each}
		</div>
	</div>

	<!-- ============================ GUIDED TAB ============================ -->
	{#if tab === 'guided'}
		<!-- Explain-first -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-3" style="border-bottom: 2px solid var(--accent-primary)">WHAT IS AN OPTION?</h2>
			<p class="label" style="color: var(--foreground-muted); line-height: 1.8; text-transform: none; margin-bottom: 16px;">
				An option gives you the <span style="color: var(--foreground)">right</span> — but not the
				obligation — to buy (a <span style="color: var(--accent-primary)">CALL</span>) or sell
				(a <span style="color: var(--accent-primary)">PUT</span>) a stock at a fixed price before a
				date. You pay a small <span style="color: var(--foreground)">premium</span> for that right.
				Your worst case is losing only what you paid. Below is a plain-English glossary.
			</p>
			<OptionGlossary {level} />
		</div>

		<!-- Sentiment + target + budget -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">YOUR VIEW</h2>
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div>
					<span class="label block mb-2">DO YOU THINK {symbol} WILL GO…</span>
					<div class="flex flex-wrap gap-2">
						{#each SENTIMENTS as s}
							<button type="button" onclick={() => onSentimentChange(s)} class="px-3 py-2 label" style="border: 1px solid {sentiment === s ? SENTIMENT_COLOR[s] : 'var(--panel-border)'}; background: {sentiment === s ? 'rgba(0,0,0,0.2)' : 'var(--surface)'}; color: {sentiment === s ? SENTIMENT_COLOR[s] : 'var(--foreground-muted)'};">{SENTIMENT_LABEL[s]}</button>
						{/each}
					</div>
					<p class="label mt-2" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px">
						Pre-set from your technical analysis ({analysis.overall.overall_verdict.toUpperCase()}). Change it to see different strategies.
					</p>
				</div>
				<div>
					<span class="label block mb-2">TARGET PRICE</span>
					<div class="flex items-center gap-2">
						<input type="number" bind:value={targetPrice} class="flex-1" style="background: var(--surface); border: 1px solid var(--panel-border); color: var(--foreground); padding: 8px; border-radius: 4px;" placeholder="e.g. 800" />
					</div>
					{#if targetMovePct !== null}
						<p class="label mt-2" style="color: {targetMovePct >= 0 ? '#34d399' : '#f87171'}; text-transform: none">
							= {formatPLPct(targetMovePct)} from current
						</p>
					{:else}
						<p class="label mt-2" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px">
							Where you expect the stock to be by expiry.
						</p>
					{/if}
				</div>
				<div>
					<span class="label block mb-2">BUDGET</span>
					<div class="flex items-center gap-2">
						<span class="data" style="color: var(--foreground-muted)">$</span>
						<input type="number" bind:value={budget} class="flex-1" style="background: var(--surface); border: 1px solid var(--panel-border); color: var(--foreground); padding: 8px; border-radius: 4px;" />
					</div>
					{#if budgetContracts !== null}
						<p class="label mt-2" style="color: var(--foreground-subtle); text-transform: none">
							≈ {budgetContracts} contract{budgetContracts === 1 ? '' : 's'} at {formatPrice(selectedContract?.last_price ?? null)}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Pick a contract (builder) -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">PICK A CONTRACT</h2>
			{#if chainLoading}
				<div class="flex h-40 items-center justify-center"><span class="label" style="color: var(--foreground-muted)">LOADING CONTRACTS…</span></div>
			{:else if chainError}
				<p class="label" style="color: var(--accent-primary)">{chainError}</p>
			{:else if chain.length === 0}
				<p class="label" style="color: var(--foreground-muted)">NO OPTIONS AVAILABLE FOR {symbol}.</p>
			{:else}
				<ContractPicker contracts={chain} currentPrice={currentPrice ?? analysis.current_price} selected={contractSymbol} onSelect={onContractSelected} />
				{#if strategyError}
					<p class="label mt-3" style="color: var(--accent-primary)">{strategyError}</p>
				{/if}
			{/if}
		</div>

		<!-- Strategy cards -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">STRATEGIES FOR YOUR VIEW</h2>
			{#if !contractSymbol}
				<p class="label mb-3" style="color: var(--foreground-muted); text-transform: none">Pick a contract above to see beginner-friendly strategy ideas.</p>
			{:else if (guidedStrategies?.strategies ?? strategyData?.strategies ?? []).length > 0}
				{@const list = guidedStrategies?.strategies ?? strategyData?.strategies ?? []}
				<div class="mb-3 flex items-center justify-between gap-3">
					<p class="label" style="color: var(--foreground-muted)">CONTRACT {contractSymbol.toUpperCase()} — {sentiment.toUpperCase()}</p>
					<button class="link-crimson" onclick={() => (contractSymbol = '')}>CHANGE CONTRACT</button>
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each list as strategy}
						<StrategyCard {strategy} />
					{/each}
				</div>
			{:else if strategyLoading}
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each Array(3) as _}
						<div class="panel p-4"><div class="mb-3 h-3 w-24 rounded" style="background-color: var(--surface-3)"></div><div class="h-24 rounded" style="background-color: var(--surface-3)"></div></div>
					{/each}
				</div>
			{:else}
				<p class="label" style="color: var(--foreground-muted)">{strategyError ? strategyError : 'Select a contract to see strategies.'}</p>
			{/if}
		</div>

	<!-- ============================ CHAIN TAB ============================ -->
	{:else if tab === 'chain'}
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-1" style="border-bottom: 2px solid var(--accent-primary)">OPTIONS CHAIN</h2>
			<p class="label mb-4" style="color: var(--foreground-subtle); text-transform: none; font-size: 11px">
				Every available contract for {symbol}. Calls on the left, puts on the right; the strike sits in the middle. Click a row to load it in the BUILDER.
			</p>
			{#if chainLoading}
				<div class="flex h-40 items-center justify-center"><span class="label" style="color: var(--foreground-muted)">LOADING CONTRACTS…</span></div>
			{:else if chainError}
				<p class="label" style="color: var(--accent-primary)">{chainError}</p>
			{:else}
				<OptionsChain contracts={chain} currentPrice={currentPrice ?? analysis.current_price} selected={contractSymbol} onSelect={onContractSelected} />
			{/if}
		</div>

	<!-- ============================ BUILDER TAB ============================ -->
	{:else}
		<!-- Contract strip -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">BUILD CONTRACT</h2>
			{#if chainLoading}
				<div class="flex h-40 items-center justify-center"><span class="label" style="color: var(--foreground-muted)">LOADING CONTRACTS…</span></div>
			{:else if chainError}
				<p class="label" style="color: var(--accent-primary)">{chainError}</p>
			{:else if chain.length === 0}
				<p class="label" style="color: var(--foreground-muted)">NO OPTIONS AVAILABLE FOR {symbol}.</p>
			{:else}
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div>
						<ContractPicker contracts={chain} currentPrice={currentPrice ?? analysis.current_price} selected={contractSymbol} onSelect={onContractSelected} />
					</div>
					<div style="border-left: 1px solid var(--panel-border); padding-left: 20px;">
						<span class="label block mb-3">PAYOFF EXPLORER</span>
						{#if selectedContract}
							{#key contractSymbol}
								<PayoffExplorer {symbol} contractSymbol={contractSymbol} contract={contractSymbol} currentPrice={currentPrice ?? analysis.current_price} strike={contractStrike} isCall={contractIsCall} expiry={contractExpiry} premium={payoff?.premium ?? selectedContract.last_price} breakeven={payoff?.breakeven ?? null} />
							{/key}
						{:else}
							<p class="label" style="color: var(--foreground-subtle); text-transform: none">Pick a contract to see what it's worth at any price.</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Chance of profit (Pro) -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">CHANCE OF PROFIT <span class="label" style="color: #fbbf24">PRO</span></h2>
			{#if !contractSymbol}
				<p class="label" style="color: var(--foreground-muted)">Select a contract to estimate its chance of profit.</p>
			{:else if chance}
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div>
						<span class="label block mb-1">PROB OF PROFIT <InfoPopover title="CHANCE OF PROFIT" content="An ESTIMATE of how likely this trade is to make money, from a Black-Scholes model using the option's implied volatility. Not a guarantee." /></span>
						<span class="data" style="font-size: 1.3rem; color: {(chance.prob_profit ?? 0) >= 0.5 ? '#34d399' : '#fb923c'}">{(chance.prob_profit * 100).toFixed(0)}%</span>
					</div>
					<div>
						<span class="label block mb-1">PROB ENDS ITM <InfoPopover title="PROBABILITY OF ITM" content="How likely the option ends 'in the money' (intrinsic value) by expiry." /></span>
						<span class="data" style="font-size: 1.3rem; color: var(--foreground)">{(chance.prob_itm * 100).toFixed(0)}%</span>
					</div>
					<div>
						<span class="label block mb-1">EXPECTED VALUE <InfoPopover title="EXPECTED VALUE" content="Estimated theoretical value minus the premium. Positive = statistically favourable." /></span>
						<span class="data" style="font-size: 1.3rem; color: {(chance.expected_value ?? 0) >= 0 ? '#34d399' : '#f87171'}">{formatPL(chance.expected_value)}</span>
					</div>
					<div>
						<span class="label block mb-1">BREAKEVEN</span>
						<span class="data" style="font-size: 1.3rem; color: var(--foreground)">{formatPrice(chance.breakeven)}</span>
					</div>
				</div>
				<p class="label mt-3" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px">ESTIMATE — NOT GUARANTEED.</p>
			{:else if chanceError === 'PRO_FEATURE'}
				<div class="flex items-center gap-3">
					<p class="label" style="color: var(--foreground-muted); text-transform: none">Chance of profit is a <span style="color: var(--accent-primary)">PRO</span> feature.</p>
					<a href="/pricing" class="btn-primary px-4 py-2">UPGRADE</a>
				</div>
			{:else}
				<p class="label" style="color: var(--foreground-muted)">Select a contract to estimate its chance of profit.</p>
			{/if}
		</div>

		<!-- Greeks -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary); {payoffError ? 'opacity: 0.5;' : ''}">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">GREEKS</h2>
			{#if payoff}
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{#each GREEKS as g}
						<div>
							<div class="mb-1 flex items-center gap-1">
								<span class="label">{g.label}</span>
								<InfoPopover title={g.label} content={g.text} />
							</div>
							<span class="data" style="color: var(--foreground)">{formatGreek(payoff.greeks[g.key])}</span>
						</div>
					{/each}
				</div>
				<div class="mt-4 flex flex-wrap gap-4 border-t pt-3" style="border-color: var(--panel-border)">
					<div><span class="label block">PREMIUM</span><span class="data" style="color: var(--foreground)">{formatPrice(payoff.premium)}</span></div>
					<div><span class="label block">BREAKEVEN</span><span class="data" style="color: var(--foreground)">{formatPrice(payoff.breakeven)}</span></div>
					<div><span class="label block">IMPLIED VOL</span><span class="data" style="color: var(--foreground)">{payoff.implied_volatility.toFixed(1)}%</span></div>
				</div>
			{:else}
				<p class="label" style="color: var(--foreground-muted)">Select a contract to view delta, gamma, theta, vega and rho.</p>
			{/if}
		</div>

		<!-- P/L Matrix -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">P/L MATRIX</h2>
			<OptionsMatrix {symbol} contractSymbol={contractSymbol} />
		</div>

		<!-- Payoff timeline -->
		<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
			<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">PAYOFF TIMELINE</h2>
			{#if payoff && payoff.payoff_timeline.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full text-left">
						<thead>
							<tr class="label" style="border-bottom: 1px solid var(--panel-border); color: var(--foreground-muted)">
								<th class="py-2 pr-4">DATE</th><th class="py-2 pr-4">EST. PRICE</th><th class="py-2 pr-4">P/L</th><th class="py-2 pr-4">P/L %</th>
							</tr>
						</thead>
						<tbody>
							{#each payoff.payoff_timeline as row}
								<tr class="data" style="border-bottom: 1px solid var(--panel-border)">
									<td class="py-2 pr-4" style="color: var(--foreground-muted)">{row.date}</td>
									<td class="py-2 pr-4" style="color: var(--foreground)">{formatPrice(row.estimated_option_price)}</td>
									<td class="py-2 pr-4 font-mono" style="color: {plColor(row.estimated_pl)}">{formatPL(row.estimated_pl)}</td>
									<td class="py-2 pr-4 font-mono" style="color: {plColor(row.pl_pct)}">{formatPLPct(row.pl_pct)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="label mt-3" style="color: var(--foreground-subtle)">ESTIMATE — NOT GUARANTEED</p>
			{:else}
				<p class="label" style="color: var(--foreground-muted)">Select a contract to see the projected payoff over time.</p>
			{/if}
		</div>
	{/if}

	<!-- Save to portfolio -->
	<div class="mt-6 flex justify-end">
		<button class="btn-outline" onclick={() => (showSave = true)} disabled={!currentPrice} style="opacity: {currentPrice ? 1 : 0.5}">
			SAVE TO PORTFOLIO
		</button>
	</div>

	<SaveTradeModal open={showSave} {symbol} entryPrice={currentPrice ?? analysis.current_price} onClose={() => (showSave = false)} />
{/if}
