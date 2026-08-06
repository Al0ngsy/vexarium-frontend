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
	import CompanyProfile from '../../../components/CompanyProfile.svelte';

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
		RSI: 'Momentum oscillator',
		MACD: 'Trend momentum',
		'SMA(50)/EMA(200)': 'Price vs long-term trend',
		BOLLINGER: 'Volatility bands',
		STOCHASTIC: 'Oscillator momentum',
		ATR: 'Volatility magnitude',
		ADX: 'Trend strength',
		OBV: 'Volume flow',
		VWAP: 'Volume-weighted average',
		ICHIMOKU: 'Cloud trend structure'
	};
	function signalNote(name: string): string {
		const n = name.toUpperCase();
		for (const k of Object.keys(SIGNALS)) {
			if (n.includes(k.toUpperCase())) return SIGNALS[k];
		}
		return '';
	}

	// Format an indicator's value (number or dict) as a compact readout string.
	// Dict values (SMA/EMA, MACD, Bollinger, etc.) get human-friendly labels.
	const VALUE_LABELS: Record<string, string> = {
		sma50: 'SMA50', ema200: 'EMA200', ema20: 'EMA20', ema50: 'EMA50',
		current_price: 'Price',
		macd: 'MACD', histogram: 'Hist', signal: 'Signal',
		pct_b: '%B', lower: 'Lower', upper: 'Upper', middle: 'Mid',
		atr: 'ATR', close: 'Close',
		obv: 'OBV', trend: 'Trend',
		vwap: 'VWAP',
		conversion: 'Conv', base: 'Base', cloud_top: 'Cloud↑', cloud_bottom: 'Cloud↓',
		direction: 'Dir', crossover: 'Cross',
	};
	function formatIndicatorValue(value: IndicatorResult['value']): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'number') {
			return Number.isInteger(value) ? String(value) : value.toFixed(2);
		}
		return Object.entries(value)
			.map(([k, v]) => {
				const label = VALUE_LABELS[k] || k;
				const val = typeof v === 'number' ? v.toFixed(2) : String(v);
				return `${label}:${val}`;
			})
			.join('  ');
	}

	// Symbols that get a free AI preview (matches backend FEATURED_SYMBOLS).
	const FEATURED_SYMBOLS = ['AAPL', 'MSFT', 'TSLA', 'SPY', 'NVDA', 'AMZN', 'GOOGL', 'META'];

	// Tally bullish/bearish verdicts for the hero gauge breakdown.
	const bullCount = $derived((analysis?.overall?.breakdown || []).filter((i) => ['buy', 'strong_buy'].includes(i.verdict)).length);
	const bearCount = $derived((analysis?.overall?.breakdown || []).filter((i) => ['sell', 'strong_sell'].includes(i.verdict)).length);
	const neutralCount = $derived((analysis?.overall?.breakdown || []).length - bullCount - bearCount);

	// Health-check helpers: pass/watch/fail per verdict + plain-language summary.
	const verdictStatus = (v: string): 'pass' | 'watch' | 'fail' => {
		if (['buy', 'strong_buy'].includes(v)) return 'pass';
		if (['sell', 'strong_sell'].includes(v)) return 'fail';
		return 'watch';
	};
	const statusIcon = (s: 'pass' | 'watch' | 'fail') => (s === 'pass' ? '✓' : s === 'watch' ? '△' : '✗');
	const statusLabel = (s: 'pass' | 'watch' | 'fail') => (s === 'pass' ? 'PASS' : s === 'watch' ? 'WATCH' : 'FAIL');

	const passCount = $derived((analysis?.overall?.breakdown || []).filter((i) => verdictStatus(i.verdict) === 'pass').length);
	const watchCount = $derived((analysis?.overall?.breakdown || []).filter((i) => verdictStatus(i.verdict) === 'watch').length);
	const failCount = $derived((analysis?.overall?.breakdown || []).filter((i) => verdictStatus(i.verdict) === 'fail').length);
	const totalChecks = $derived((analysis?.overall?.breakdown || []).length);

	// Grade letter from score (-10..+10).
	const gradeLetter = $derived.by(() => {
		const s = analysis?.overall?.score ?? 0;
		if (s >= 7) return 'A';
		if (s >= 4) return 'B+';
		if (s >= 1) return 'B';
		if (s >= -1) return 'C';
		if (s >= -4) return 'D';
		return 'F';
	});

	// Plain-language summary of the verdict mix.
	const plainSummary = $derived.by(() => {
		if (!analysis?.overall) return '';
		const v = analysis.overall.overall_verdict;
		const label = VERDICT_LABELS[v] || v.toUpperCase();
		if (['strong_buy', 'buy'].includes(v)) {
			return `${passCount} of ${totalChecks} checks pass. Trend and momentum are green${watchCount > 0 ? `, with ${watchCount} to watch` : ''}${failCount > 0 ? ` and ${failCount} flagging caution` : ''}.`;
		}
		if (['strong_sell', 'sell'].includes(v)) {
			return `${failCount} of ${totalChecks} checks are failing. The picture is bearish${passCount > 0 ? `, though ${passCount} still pass` : ''}.`;
		}
		return `Mixed picture: ${passCount} pass, ${watchCount} watch, ${failCount} fail. No strong edge either way.`;
	});

	// Vitals for the health-check row.
	const vitals = $derived.by(() => {
		if (!analysis) return [];
		const co = analysis.company;
		const out: { k: string; v: string; d: string }[] = [
			{ k: 'PRICE', v: formatPrice(analysis.current_price), d: `${symbol} · ${analysis.asset_type?.toUpperCase() ?? 'STOCK'}` }
		];
		if (co && co.low_52w != null && co.high_52w != null) {
			out.push({ k: '52-WEEK RANGE', v: `$${co.low_52w.toFixed(0)}–$${co.high_52w.toFixed(0)}`, d: 'yearly low–high' });
		}
		const atr = analysis.indicators.find((i) => i.name.toUpperCase().includes('ATR'));
		if (atr && typeof atr.value === 'number') {
			out.push({ k: 'VOLATILITY', v: `ATR ${atr.value.toFixed(1)}`, d: 'avg daily move' });
		}
		const rsi = analysis.indicators.find((i) => i.name.toUpperCase().includes('RSI'));
		if (rsi && typeof rsi.value === 'number') {
			out.push({ k: 'MOMENTUM', v: `RSI ${rsi.value.toFixed(0)}`, d: rsi.value > 70 ? 'overbought' : rsi.value < 30 ? 'oversold' : 'neutral' });
		}
		return out;
	});
</script>

<svelte:head>
	<title>VEXARIUM — {symbol}</title>
</svelte:head>

<!-- Loading state: static gray panels, no pulse -->
{#if loading}
	<div class="panel mb-6 p-6">
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
	<!-- 1. Health-check hero: verdict + grade ring + vitals + plain-language + charts -->
	<div class="panel mb-6 p-6">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="label mb-1">HEALTH CHECK — {symbol}</p>
				<p
					class="brand"
					style="font-size: 1.6rem; color: {VERDICT_COLORS[analysis.overall.overall_verdict]}"
				>
					{VERDICT_LABELS[analysis.overall.overall_verdict]} {VERDICT_ICONS[analysis.overall.overall_verdict]}
				</p>
				<p class="label mt-2" style="color: var(--foreground-muted); text-transform: none; max-width: 360px; line-height: 1.5;">
					{plainSummary}
				</p>
			</div>
			<div class="flex items-center gap-5">
				<div class="text-right">
					<p class="label mb-1">{symbol}</p>
					<p class="data" style="color: var(--foreground); font-size: 1.25rem">
						{formatPrice(analysis.current_price)}
					</p>
					<a href={`/options/${symbol}`} class="btn-outline mt-3 inline-block">
						VIEW OPTIONS →
					</a>
				</div>
				<!-- Grade ring -->
				<div class="grade-ring">
					<svg width="92" height="92" viewBox="0 0 92 92">
						<circle cx="46" cy="46" r="38" fill="none" stroke="var(--panel-border)" stroke-width="8"/>
						<circle
							cx="46" cy="46" r="38" fill="none"
							stroke="{VERDICT_COLORS[analysis.overall.overall_verdict]}"
							stroke-width="8" stroke-linecap="round"
							stroke-dasharray="238.8"
							stroke-dashoffset="{238.8 * (1 - Math.max(0, Math.min(1, (analysis.overall.score + 10) / 20)))}"
						/>
					</svg>
					<div class="grade"><b>{gradeLetter}</b><span>{passCount}/{totalChecks}</span></div>
				</div>
			</div>
		</div>

		<!-- Vitals -->
		<div class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
			{#each vitals as v}
				<div class="vital">
					<div class="k">{v.k}</div>
					<div class="v">{v.v}</div>
					<div class="d">{v.d}</div>
				</div>
			{/each}
		</div>

		<!-- Plain-language box -->
		<div class="plainbox mt-4">
			<div class="k">What this means for you</div>
			<p>
				{VERDICT_LABELS[analysis.overall.overall_verdict]} — {bullCount} of {totalChecks} checks are bullish, {neutralCount} neutral, {bearCount} bearish.
				{analysis.overall.score > 0 ? 'The overall bias is positive.' : analysis.overall.score < 0 ? 'The overall bias is negative.' : 'The overall bias is neutral.'}
				Use the checks below to understand why, and the AI second opinion for a plain-language read.
			</p>
		</div>

		<!-- Charts -->
		<div class="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<p class="label mb-2">PRICE — LAST 120 DAYS</p>
				{#if (analysis.price_series?.length ?? 0) > 0}
					<IndicatorChart
						series={{ name: 'PRICE', kind: 'overlay', points: [] }}
						priceSeries={analysis.price_series}
						height={180}
					/>
				{:else}
					<div class="flex h-44 items-center justify-center rounded-lg border border-dashed" style="border-color: var(--panel-border)">
						<span class="label" style="color: var(--foreground-muted)">NO PRICE DATA</span>
					</div>
				{/if}
			</div>
			<div>
				<p class="label mb-2">RSI — MOMENTUM</p>
				{#if seriesFor('RSI') && seriesFor('RSI')!.points.length > 0}
					<IndicatorChart series={seriesFor('RSI')!} height={180} />
				{:else}
					<div class="flex h-44 items-center justify-center rounded-lg border border-dashed" style="border-color: var(--panel-border)">
						<span class="label" style="color: var(--foreground-muted)">NO RSI DATA</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- 1c. Company / ETF profile + fundamentals (free, keyless: Yahoo + Wikipedia) -->
	{#if analysis.company && (analysis.company.name || analysis.company.description || analysis.company.market_cap !== null)}
		{@const co = analysis.company}
		{@const range = (co.high_52w ?? 0) - (co.low_52w ?? 0)}
		{@const pos = range > 0 && analysis.current_price ? Math.min(100, Math.max(0, ((analysis.current_price - (co.low_52w ?? 0)) / range) * 100)) : 0}
		<div class="panel mb-6 overflow-hidden">
			<div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style="border-color: var(--panel-border)">
				<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">ABOUT {symbol}</h2>
				<span class="label" style="color: var(--foreground-muted)">
					{co.name || symbol}{co.exchange ? ` · ${co.exchange}` : ''}{co.currency ? ` · ${co.currency}` : ''}
				</span>
			</div>
			<div class="p-4">
				<CompanyProfile company={co} {symbol} {pos} />
			</div>
		</div>
	{/if}

	<!-- 1d. News sentiment + headlines dropdown -->
	{#if analysis.news_sentiment}
		{@const ns = analysis.news_sentiment}
		{@const color = ns.sentiment_score > 0.2 ? 'var(--verdict-strong-buy)' : ns.sentiment_score < -0.2 ? 'var(--verdict-strong-sell)' : 'var(--verdict-hold)'}
		<div class="panel mb-6 overflow-hidden">
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

	<!-- 2. The checks (technicals readout table) -->
	<div class="panel mb-6 overflow-hidden">
		<div class="flex items-center justify-between border-b px-4 py-3" style="border-color: var(--panel-border)">
			<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">THE CHECKS</h2>
			<span class="label" style="color: var(--foreground-muted)">{analysis.indicators.length} INDICATORS · {passCount} PASS · {watchCount} WATCH · {failCount} FAIL</span>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full text-left">
				<thead>
					<tr class="label" style="border-bottom: 1px solid var(--panel-border); color: var(--foreground-subtle)">
						<th class="px-4 py-2.5">CHECK</th>
						<th class="px-4 py-2.5">READING</th>
						<th class="px-4 py-2.5">STATUS</th>
						<th class="px-4 py-2.5">WHAT IT TELLS YOU</th>
					</tr>
				</thead>
				<tbody>
					{#each analysis.indicators as indicator}
						{@const vc = VERDICT_COLORS[indicator.verdict] || '#8b96a8'}
						{@const vl = VERDICT_LABELS[indicator.verdict] || indicator.verdict.toUpperCase()}
						{@const st = verdictStatus(indicator.verdict)}
						<tr class="group transition-colors" style="border-bottom: 1px solid var(--grid-line);">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2.5">
									<span class="h-full w-1 self-stretch rounded" style="background-color: {vc};"></span>
									<span class="label" style="color: var(--foreground); text-transform: none">{indicator.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 data" style="color: var(--foreground)">{formatIndicatorValue(indicator.value)}</td>
							<td class="px-4 py-3">
								<span class="chip chip-{st}">
									{statusIcon(st)} {statusLabel(st)}
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

	<!-- 3. AI second opinion (Pro-only, with free preview for featured symbols) -->
	{@const isFeatured = FEATURED_SYMBOLS.includes(symbol.toUpperCase())}
	<div class="panel mt-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">AI SECOND OPINION</h2>
				{#if !proUser && isFeatured}
					<span class="label rounded-full px-2 py-1" style="background-color: rgba(52, 211, 153, 0.12); color: var(--verdict-strong-buy); border: 1px solid rgba(52, 211, 153, 0.35);">FREE PREVIEW</span>
				{/if}
			</div>
			{#if proUser || isFeatured}
				<button class="btn-outline" onclick={runAI} disabled={aiLoading}>RUN AI ANALYSIS</button>
			{:else}
				<span class="label rounded-full px-2 py-1" style="background-color: rgba(245, 158, 11, 0.12); color: var(--accent-primary); border: 1px solid rgba(245, 158, 11, 0.35);">🔒 PRO</span>
			{/if}
		</div>
		{#if aiLoading}
			<p class="mt-4 font-mono" style="color: var(--accent-primary); letter-spacing: 0.15em">ANALYZING...</p>
		{:else if aiMessage}
			<div class="mt-4">
				{#if aiPreview}
					<div class="mb-3 flex items-center justify-between rounded-lg px-3 py-2" style="background-color: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.35);">
						<span class="label" style="color: var(--verdict-strong-buy)">FREE PREVIEW — UNLOCK AI FOR ALL SYMBOLS</span>
						<a class="label link-crimson" href="/pricing">UPGRADE →</a>
					</div>
				{/if}
				<p class="label mt-2" style="color: var(--foreground); line-height: 1.6; white-space: pre-wrap; text-transform: none;">
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
