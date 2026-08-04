<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { analyze, analyzeExtended, getAIAnalysis } from '$lib/api';
	import type { AnalysisResponse, AssetType, IndicatorSeries, NewsSentiment } from '$lib/types';
	import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '$lib/verdict';
	import { addRecentAnalysis } from '$lib/storage';

	import IndicatorCard from '../../../components/IndicatorCard.svelte';
	import IndicatorChart from '../../../components/IndicatorChart.svelte';
	import SaveTradeModal from '../../../components/SaveTradeModal.svelte';

	let symbol = $derived(String(page.params.symbol || '').toUpperCase());
	let assetType = $state<AssetType>('stock');
	let proMode = $state(false); // dev toggle: Free (5 indicators) vs Pro (10 indicators)

	let analysis = $state<AnalysisResponse | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let showSave = $state(false);
	let aiLoading = $state(false);
	let aiMessage = $state<string | null>(null);

	onMount(() => {
		load();
	});

	async function load() {
		loading = true;
		error = null;
		aiMessage = null;
		try {
			analysis = proMode ? await analyzeExtended(symbol, assetType) : await analyze(symbol, assetType);
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

	function toggleTier() {
		proMode = !proMode;
		load();
	}

	async function runAI() {
		aiLoading = true;
		aiMessage = null;
		try {
			const res = await getAIAnalysis(symbol, assetType);
			aiMessage = res.analysis;
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
	<!-- 1. Overall Verdict Hero -->
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<div>
					<p class="label mb-1">OVERALL VERDICT</p>
					<p
						class="brand"
						style="font-size: 2rem; color: {VERDICT_COLORS[analysis.overall.overall_verdict]}"
					>
						{VERDICT_LABELS[analysis.overall.overall_verdict]} {VERDICT_ICONS[analysis.overall.overall_verdict]}
					</p>
				</div>
			</div>
			<div class="text-right">
				<p class="label mb-1">{symbol}</p>
				<p class="data" style="color: var(--foreground); font-size: 1.25rem">
					{formatPrice(analysis.current_price)}
				</p>
			</div>
		</div>
		<div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style="border-color: var(--panel-border)">
			<div class="flex items-center gap-3">
				<span class="label">OVERALL SCORE</span>
				<span class="data" style="color: var(--foreground)">{analysis.overall.score}</span>
			</div>
			<!-- Dev Free/Pro toggle -->
			<button
				class="label rounded px-3 py-1.5"
				onclick={toggleTier}
				title="Dev toggle: preview Free vs Pro (DEV_FORCE_PRO=true in backend .env)"
				style="border: 1px solid {proMode ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {proMode ? 'var(--surface-active)' : 'var(--surface)'}; color: {proMode ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
			>
				{proMode ? 'PRO — 10 INDICATORS' : 'FREE — 5 INDICATORS'} ⇄
			</button>
		</div>
	</div>

	<!-- 1c. News sentiment -->
	{#if analysis.news_sentiment}
		{@const ns = analysis.news_sentiment}
		{@const color = ns.sentiment_score > 0.2 ? '#16a34a' : ns.sentiment_score < -0.2 ? '#dc2626' : '#ca8a04'}
		<div class="panel mb-6 flex flex-wrap items-center justify-between gap-3 p-4" style="border-top: 2px solid var(--panel-border)">
			<span class="label">NEWS SENTIMENT</span>
			<div class="flex items-center gap-4">
				<span class="data" style="color: {color}">{ns.summary}</span>
				<span class="label" style="color: var(--foreground-muted)">{ns.article_count} ARTICLES · SCORE {ns.sentiment_score}</span>
			</div>
		</div>
	{/if}

	<!-- 1b. Price chart (below verdict hero) -->
	{#if (analysis.price_series?.length ?? 0) > 0}
		<div class="panel mb-6 p-4" style="border-top: 2px solid var(--panel-border)">
			<p class="label mb-2">PRICE — {symbol}</p>
			<IndicatorChart
				series={{ name: 'PRICE', kind: 'overlay', points: [] }}
				priceSeries={analysis.price_series}
			/>
		</div>
	{/if}

	<!-- 2. Indicator Cards -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each analysis.indicators as indicator}
			{@const s = seriesFor(indicator.name)}
			<div class="flex flex-col gap-3">
				<IndicatorCard {indicator} />
				{#if s && (s.points?.length ?? 0) > 0}
					<IndicatorChart series={s} priceSeries={analysis.price_series} />
				{/if}
			</div>
		{/each}
	</div>

	<!-- 3. AI Analysis panel -->
	<div class="panel mt-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="flex items-center justify-between">
			<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">AI ANALYSIS</h2>
			<button class="btn-outline" onclick={runAI} disabled={aiLoading}>RUN AI ANALYSIS</button>
		</div>
		{#if aiLoading}
			<p class="mt-4 font-mono" style="color: var(--accent-primary); letter-spacing: 0.15em">ANALYZING...</p>
		{:else if aiMessage}
			<div class="mt-4">
				<p class="label mt-2" style="color: var(--foreground); line-height: 1.6; white-space: pre-wrap;">
					{aiMessage}
				</p>
			</div>
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
