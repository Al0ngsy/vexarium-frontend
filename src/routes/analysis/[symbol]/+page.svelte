<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	import { analyze, getAIAnalysis } from '$lib/api';
	import type { AnalysisResponse, AssetType, IndicatorSeries, IndicatorResult } from '$lib/types';
	import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '$lib/verdict';
	import { addRecentAnalysis } from '$lib/storage';
	import { getToken, getUser, initAuth } from '$lib/auth.svelte';

	import IndicatorChart from '../../../components/IndicatorChart.svelte';
	import SaveTradeModal from '../../../components/SaveTradeModal.svelte';

	let symbol = $derived(String(page.params.symbol || '').toUpperCase());
	let assetType = $state<AssetType>('stock');

	let analysis = $state<AnalysisResponse | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let showSave = $state(false);
	let aiLoading = $state(false);
	let aiMessage = $state<string | null>(null);
	let aiPreview = $state(false);
	let newsOpen = $state(false);

	// AI analysis is a Pro feature. All indicators are free.
	let authed = $state(false);
	let proUser = $state(false);

	onMount(() => {
		initAuth();
		authed = !!getToken();
		proUser = getUser()?.tier === 'pro';
		load();
	});

	async function load() {
		loading = true;
		error = null;
		aiMessage = null;
		try {
			// All indicators are free — single analysis path returns all 10.
			analysis = await analyze(symbol, assetType);
			// Record this analysis into local recent-analyses history so it shows on home.
			if (analysis?.overall?.overall_verdict) {
				addRecentAnalysis({
					symbol,
					assetType,
					analyzedAt: analysis.analyzed_at ?? new Date().toISOString(),
					verdict: analysis.overall.overall_verdict
				});
			}
		} catch (e) {
			analysis = null;
			error = e instanceof Error ? e.message : 'Analysis failed';
		} finally {
			loading = false;
		}
	}

	async function runAI() {
		aiLoading = true;
		aiMessage = null;
		aiPreview = false;
		try {
			const res = await getAIAnalysis(symbol, assetType, getToken() ?? undefined);
			aiMessage = res.analysis;
			aiPreview = !!res.is_preview;
		} catch (e) {
			aiMessage = `AI analysis failed: ${e instanceof Error ? e.message : 'unknown error'}`;
		} finally {
			aiLoading = false;
		}
	}

	function seriesFor(name: string): IndicatorSeries | null {
		const found = (analysis?.indicator_series || []).find(
			(s) => s.name.toLowerCase() === name.toLowerCase()
		);
		return found ?? null;
	}

	function formatPrice(v: number | null): string {
		if (v === null || v === undefined) return '—';
		return `$${v.toFixed(2)}`;
	}

	// Short one-line signal note per indicator (mirrors IndicatorCard's explanations).
	const SIGNALS: Record<string, string> = {
		RSI: 'Neutral momentum zone',
		MACD: 'Momentum rising',
		'SMA 50': 'Golden-cross uptrend',
		'SMA 200': 'Long-term trend',
		'EMA 20': 'Short-term trend line',
		'EMA 50': 'Mid-term trend line',
		STOCHASTIC: 'Oscillator mid-range',
		BOLLINGER: 'Mid-band',
		ATR: 'Moderate volatility',
		ADX: 'Weak trend strength',
		OBV: 'Volume confirms advance',
		VWAP: 'At volume-weighted avg',
		ICHIMOKU: 'Above the cloud',
		'BOLLINGER %B': 'Position inside bands'
	};
	function signalNote(name: string): string {
		const n = name.toUpperCase();
		for (const k of Object.keys(SIGNALS)) {
			if (n.includes(k.toUpperCase())) return SIGNALS[k];
		}
		return '';
	}

	// Format an indicator's value (number or dict) as a compact readout string.
	function formatIndicatorValue(value: IndicatorResult['value']): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'number') {
			return Number.isInteger(value) ? String(value) : value.toFixed(2);
		}
		return Object.entries(value)
			.map(([k, v]) => `${k}:${typeof v === 'number' ? v.toFixed(1) : v}`)
			.join(' ');
	}

	// Symbols that get a free AI preview (matches backend FEATURED_SYMBOLS).
	const FEATURED_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'SPY', 'NVDA', 'AMZN', 'GOOGL', 'META'];

	// Tally bullish/bearish verdicts for the hero gauge breakdown.
	const bullCount = $derived((analysis?.overall?.breakdown || []).filter((i) => ['buy', 'strong_buy'].includes(i.verdict)).length);
	const bearCount = $derived((analysis?.overall?.breakdown || []).filter((i) => ['sell', 'strong_sell'].includes(i.verdict)).length);
	const neutralCount = $derived((analysis?.overall?.breakdown || []).length - bullCount - bearCount);
</script>

<svelte:head>
	<title>VEXARIUM — {symbol}</title>
</svelte:head>

<!-- Disclaimer banner -->
<div class="mb-6">
	<p class="caption" style="font-size: 0.7rem; letter-spacing: 0.12em; color: var(--foreground-subtle)">
		⚠ THIS IS NOT FINANCIAL ADVICE. SEE DISCLAIMER.
	</p>
</div>

<!-- Loading state: static gray panels, no pulse -->
{#if loading}
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--panel-border)">
		<div class="mb-4 h-6 w-40 rounded" style="background-color: var(--surface-3)"></div>
		<div class="mb-2 h-4 w-64 rounded" style="background-color: var(--surface-3)"></div>
		<div class="h-4 w-32 rounded" style="background-color: var(--surface-3)"></div>
	</div>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each Array(6) as _}
			<div class="panel p-4">
				<div class="mb-3 h-3 w-20 rounded" style="background-color: var(--surface-3)"></div>
				<div class="h-4 w-28 rounded" style="background-color: var(--surface-3)"></div>
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
		<button class="btn-outline" onclick={load}>RETRY</button>
	</div>

<!-- Success state -->
{:else if analysis}
	<!-- 1. Hero: overall verdict + score gauge + price chart -->
<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<p class="label mb-1">OVERALL VERDICT</p>
			<p
				class="brand"
				style="font-size: 2rem; color: {VERDICT_COLORS[analysis.overall.overall_verdict]}"
			>
				{VERDICT_LABELS[analysis.overall.overall_verdict]} {VERDICT_ICONS[analysis.overall.overall_verdict]}
			</p>
		</div>
		<div class="text-right">
			<p class="label mb-1">{symbol}</p>
			<p class="data" style="color: var(--foreground); font-size: 1.25rem">
				{formatPrice(analysis.current_price)}
			</p>
		</div>
	</div>
	<div
		class="mt-5 grid grid-cols-1 gap-6 border-t pt-5 md:grid-cols-3"
		style="border-color: var(--panel-border)"
	>
		<!-- Score gauge -->
		<div>
			<p class="label mb-2">OVERALL SCORE</p>
			<div class="flex items-baseline gap-3">
				<span
					class="data"
					style="font-size: 2.4rem; font-weight: 700; color: {VERDICT_COLORS[analysis.overall.overall_verdict]}"
				>
					{analysis.overall.score > 0 ? '+' : ''}{analysis.overall.score}
				</span>
				<span class="label" style="color: var(--foreground-muted)">
					{bullCount} BULL · {neutralCount} NEUTRAL · {bearCount} BEAR
				</span>
			</div>
			<div class="mt-2 flex gap-1">
				{#each analysis.overall.breakdown as _, i}
					{@const on = i < Math.max(0, analysis.overall.score + 5)}
					<span
						class="h-1.5 flex-1 rounded"
						style="background-color: {on ? VERDICT_COLORS[analysis.overall.overall_verdict] : 'var(--surface-3)'};"
					></span>
				{/each}
			</div>
		</div>
		<!-- Price chart (spans 2 cols) -->
		<div class="md:col-span-2">
			<p class="label mb-2">PRICE — LAST 120 DAYS</p>
			{#if (analysis.price_series?.length ?? 0) > 0}
				<IndicatorChart
					series={{ name: 'PRICE', kind: 'overlay', points: [] }}
					priceSeries={analysis.price_series}
					height={180}
				/>
			{:else}
				<div class="flex h-44 items-center justify-center rounded border border-dashed" style="border-color: var(--panel-border)">
					<span class="label" style="color: var(--foreground-muted)">NO PRICE DATA</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- 1c. News sentiment + headlines dropdown -->
{#if analysis.news_sentiment}
	{@const ns = analysis.news_sentiment}
	{@const color = ns.sentiment_score > 0.2 ? '#16a34a' : ns.sentiment_score < -0.2 ? '#dc2626' : '#ca8a04'}
	<div class="panel mb-6 overflow-hidden" style="border-top: 2px solid var(--panel-border)">
		<button
			class="flex w-full flex-wrap items-center justify-between gap-3 p-4"
			onclick={() => (newsOpen = !newsOpen)}
		>
			<span class="label">NEWS SENTIMENT</span>
			<div class="flex items-center gap-4">
				<span class="data" style="color: {color}">{ns.summary}</span>
				<span class="label" style="color: var(--foreground-muted)">{ns.article_count} ARTICLES · SCORE {ns.sentiment_score}</span>
				<span class="label" style="color: var(--accent-primary)">{newsOpen ? '▲ HIDE' : '▼ SHOW HEADLINES'}</span>
			</div>
		</button>
		{#if newsOpen && (analysis.news_articles?.length ?? 0) > 0}
			<div class="flex flex-col border-t" style="border-color: var(--panel-border)">
				{#each analysis.news_articles as article}
					<a
						href={article.url || '#'}
						target="_blank"
						rel="noopener noreferrer"
						class="flex flex-col gap-1 px-4 py-3 transition-colors"
						style="border-bottom: 1px solid var(--grid-line); text-decoration: none;"
					>
						<span class="data" style="color: var(--foreground); line-height: 1.4">{article.headline}</span>
						<span class="label" style="color: var(--foreground-muted)">
							{article.source || 'SOURCE'}{article.created_at ? ` · ${new Date(article.created_at).toLocaleDateString()}` : ''}
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<!-- 2. Technicals readout table -->
<div class="panel mb-6 overflow-hidden" style="border-top: 2px solid var(--panel-border)">
	<div class="flex items-center justify-between border-b px-4 py-3" style="border-color: var(--panel-border)">
		<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">TECHNICALS</h2>
		<span class="label" style="color: var(--foreground-muted)">{analysis.indicators.length} INDICATORS</span>
	</div>
	<div class="overflow-x-auto">
		<table class="w-full text-left">
			<thead>
				<tr class="label" style="border-bottom: 1px solid var(--panel-border); color: var(--foreground-subtle)">
					<th class="px-4 py-2.5">INDICATOR</th>
					<th class="px-4 py-2.5">VALUE</th>
					<th class="px-4 py-2.5">VERDICT</th>
					<th class="px-4 py-2.5">SIGNAL</th>
				</tr>
			</thead>
			<tbody>
				{#each analysis.indicators as indicator}
					{@const vc = VERDICT_COLORS[indicator.verdict] || '#9999a0'}
					{@const vl = VERDICT_LABELS[indicator.verdict] || indicator.verdict.toUpperCase()}
					<tr class="group transition-colors" style="border-bottom: 1px solid var(--grid-line);">
						<td class="px-4 py-3">
							<div class="flex items-center gap-2.5">
								<span class="h-full w-1 self-stretch rounded" style="background-color: {vc};"></span>
								<span class="label" style="color: var(--foreground); text-transform: none">{indicator.name}</span>
							</div>
						</td>
						<td class="px-4 py-3 data" style="color: var(--foreground)">{formatIndicatorValue(indicator.value)}</td>
						<td class="px-4 py-3">
							<span
								class="label rounded px-2 py-1"
								style="background-color: {vc}22; color: {vc}; border: 1px solid {vc}44;"
							>
								{VERDICT_ICONS[indicator.verdict] || ''} {vl}
							</span>
						</td>
						<td class="px-4 py-3">
							<span class="label" style="color: var(--foreground-muted); text-transform: none">
								{signalNote(indicator.name)}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

	<!-- 3. AI Analysis panel (Pro-only, with free preview for featured symbols) -->
	{@const isFeatured = FEATURED_SYMBOLS.includes(symbol.toUpperCase())}
	<div class="panel mt-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">AI ANALYSIS</h2>
				{#if !proUser && isFeatured}
					<span class="label rounded px-2 py-1" style="background-color: #16a34a22; color: #16a34a; border: 1px solid #16a34a44;">FREE PREVIEW</span>
				{/if}
			</div>
			{#if proUser || isFeatured}
				<button class="btn-outline" onclick={runAI} disabled={aiLoading}>RUN AI ANALYSIS</button>
			{:else}
				<span class="label rounded px-2 py-1" style="background-color: var(--accent-primary)22; color: var(--accent-primary); border: 1px solid var(--accent-primary)44;">🔒 PRO</span>
			{/if}
		</div>
		{#if aiLoading}
			<p class="mt-4 font-mono" style="color: var(--accent-primary); letter-spacing: 0.15em">ANALYZING...</p>
		{:else if aiMessage}
			<div class="mt-4">
				{#if aiPreview}
					<div class="mb-3 flex items-center justify-between rounded px-3 py-2" style="background-color: #16a34a15; border: 1px solid #16a34a44;">
						<span class="label" style="color: #16a34a">FREE PREVIEW — UNLOCK AI FOR ALL SYMBOLS</span>
						<a class="label link-crimson" href="/pricing">UPGRADE →</a>
					</div>
				{/if}
				<p class="label mt-2" style="color: var(--foreground); line-height: 1.6; white-space: pre-wrap;">
					{aiMessage}
				</p>
			</div>
		{:else if proUser}
			<p class="mt-4 label" style="color: var(--foreground-muted); text-transform: none">
				Run AI to get a natural-language interpretation of the indicators and news.
			</p>
		{:else if isFeatured}
			<p class="mt-4 label" style="color: var(--foreground-muted); text-transform: none">
				{symbol} is a featured symbol — get a free preview of the AI analysis. Unlock AI for every symbol with Pro.
			</p>
		{:else}
			<p class="mt-4 label" style="color: var(--foreground-muted); text-transform: none">
				AI analysis summarizes the technical indicators and news sentiment. It's available to
				Pro subscribers. Upgrade to unlock AI analysis.
			</p>
		{/if}
	</div>

	<!-- 4. Save to portfolio -->
	<div class="mt-6 flex justify-end">
		<button class="btn-outline" onclick={() => (showSave = true)}>SAVE TO PORTFOLIO</button>
	</div>

	<SaveTradeModal
		open={showSave}
		{symbol}
		entryPrice={analysis.current_price}
		onClose={() => (showSave = false)}
	/>
{/if}
