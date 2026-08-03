<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { analyze } from '$lib/api';
	import type { AnalysisResponse, AssetType } from '$lib/types';
	import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '$lib/verdict';

	import IndicatorCard from '../../../components/IndicatorCard.svelte';
	import SaveTradeModal from '../../../components/SaveTradeModal.svelte';

	let symbol = $derived(String(page.params.symbol || '').toUpperCase());
	let assetType = $state<AssetType>('stock');

	let analysis = $state<AnalysisResponse | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let showSave = $state(false);
	let aiMessage = $state<string | null>(null);

	onMount(() => {
		load();
	});

	async function load() {
		loading = true;
		error = null;
		aiMessage = null;
		try {
			analysis = await analyze(symbol, assetType);
		} catch (e) {
			analysis = null;
			error = e instanceof Error ? e.message : 'Analysis failed';
		} finally {
			loading = false;
		}
	}

	function runAI() {
		aiMessage = 'AI analysis coming soon';
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
			<span class="label">OVERALL SCORE</span>
			<span class="data" style="color: var(--foreground)">{analysis.overall.score}</span>
		</div>
	</div>

	<!-- 2. Indicator Cards -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each analysis.indicators as indicator}
			<IndicatorCard {indicator} />
		{/each}
	</div>

	<!-- 3. AI Analysis panel -->
	<div class="panel mt-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="flex items-center justify-between">
			<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">AI ANALYSIS</h2>
			<button class="btn-outline" onclick={runAI}>RUN AI ANALYSIS</button>
		</div>
		{#if aiMessage}
			<p class="label mt-4" style="color: var(--foreground-muted)">{aiMessage}</p>
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
