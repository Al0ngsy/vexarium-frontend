<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { AssetInfo, AssetType } from '$lib/types';
	import { searchAssets } from '$lib/api';
	import { getRecentAnalyses, addRecentAnalysis, type RecentAnalysis } from '$lib/storage';
	import { formatTimeAgo } from '$lib/format';
	import { VERDICT_COLORS, VERDICT_LABELS } from '$lib/verdict';

	let symbol = $state('');
	let assetType = $state<AssetType>('stock');
	let optionsMode = $state(false);

	let suggestions = $state<AssetInfo[]>([]);
	let recent = $state<RecentAnalysis[]>([]);

	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	const assetTypes: { value: AssetType; label: string }[] = [
		{ value: 'stock', label: 'STOCK' },
		{ value: 'etf', label: 'ETF' },
		{ value: 'index', label: 'INDEX' }
	];

	onMount(() => {
		recent = getRecentAnalyses();
	});

	function onInput() {
		const q = symbol.trim();
		if (!q) {
			suggestions = [];
			return;
		}
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(async () => {
			const found = await searchAssets(q);
			suggestions = found.slice(0, 10);
			// Derive asset_type automatically from the best exact match, if any.
			deriveAssetType(symbol.trim().toUpperCase());
		}, 250);
	}

	function deriveAssetType(sym: string) {
		if (!sym) return;
		// Only auto-derive if the user hasn't manually overridden... we keep manual as fallback.
		// Use the currently cached suggestions for an exact symbol match.
		const match = suggestions.find(
			(s) => s.symbol.toUpperCase() === sym.toUpperCase()
		);
		if (match) {
			assetType = match.asset_type;
		}
	}

	function onPick() {
		// When the user selects a datalist suggestion, derive the asset type from it.
		deriveAssetType(symbol.trim().toUpperCase());
	}

	function onAnalyze() {
		if (!symbol.trim()) return;
		const sym = symbol.trim().toUpperCase();
		// Record into recent analyses history (local only).
		addRecentAnalysis({
			symbol: sym,
			assetType,
			analyzedAt: new Date().toISOString(),
			verdict: 'pending'
		});
		recent = getRecentAnalyses();
		if (optionsMode) {
			goto(`/options/${sym}`);
		} else {
			goto(`/analysis/${sym}`);
		}
	}
</script>

<div class="flex flex-col items-center justify-center py-24">
	<!-- Brand -->
	<h1
		class="brand mb-2 text-3xl"
		style="font-size: 2rem; border-bottom: 2px solid var(--accent-primary)"
	>
		VEXARIUM
	</h1>
	<p class="label mb-12">ENTER SYMBOL — TECHNICAL &amp; OPTIONS ANALYSIS</p>

	<!-- Symbol input -->
	<div class="panel flex w-full max-w-xl flex-col gap-6 p-6">
		<label class="label" for="symbol">SYMBOL</label>
		<input
			id="symbol"
			list="symbol-suggestions"
			autocomplete="off"
			placeholder="ENTER SYMBOL"
			bind:value={symbol}
			oninput={onInput}
			onchange={onPick}
			onkeydown={(e) => e.key === 'Enter' && onAnalyze()}
			class="w-full rounded border px-4 py-3 text-lg font-mono uppercase"
			style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground); text-transform: uppercase;"
		/>
		<datalist id="symbol-suggestions">
			{#each suggestions as s}
				<option value={s.symbol}>{s.symbol} — {s.name}</option>
			{/each}
		</datalist>

		<!-- Asset type selector -->
		<div>
			<span class="label block mb-2">ASSET TYPE</span>
			<div class="flex gap-2">
				{#each assetTypes as at}
					<button
						onclick={() => (assetType = at.value)}
						class="flex-1 rounded px-3 py-2 label"
						style="border: 1px solid {assetType === at.value ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {assetType === at.value ? 'var(--surface-active)' : 'var(--surface)'}; color: {assetType === at.value ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
					>
						{at.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Mode toggle -->
		<div>
			<span class="label block mb-2">MODE</span>
			<div class="flex gap-2">
				<button
					onclick={() => (optionsMode = false)}
					class="flex-1 rounded px-3 py-2 label"
					style="border: 1px solid {!optionsMode ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {!optionsMode ? 'var(--surface-active)' : 'var(--surface)'}; color: {!optionsMode ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
				>
					STANDARD
				</button>
				<button
					onclick={() => (optionsMode = true)}
					class="flex-1 rounded px-3 py-2 label"
					style="border: 1px solid {optionsMode ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {optionsMode ? 'var(--surface-active)' : 'var(--surface)'}; color: {optionsMode ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
				>
					OPTIONS
				</button>
			</div>
		</div>

		<!-- Analyze button -->
		<button class="btn-primary w-full" onclick={onAnalyze}>ANALYZE</button>
	</div>

	<!-- Recent analyses (local-only history). Daily auto-update is a future Pro feature. -->
	<div class="mt-10 w-full max-w-xl">
		<h2 class="brand mb-4" style="border-bottom: 2px solid var(--panel-border)">RECENT ANALYSES</h2>
		{#if recent.length === 0}
			<p class="label" style="color: var(--foreground-muted)">NO RECENT ANALYSES.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each recent as r}
					{@const color = r.verdict !== 'pending' ? (VERDICT_COLORS[r.verdict as keyof typeof VERDICT_COLORS] ?? '#9999a0') : '#9999a0'}
					{@const label = r.verdict !== 'pending' ? (VERDICT_LABELS[r.verdict as keyof typeof VERDICT_LABELS] ?? 'PENDING') : 'PENDING'}
					<a
						href={`/analysis/${r.symbol}`}
						class="panel flex items-center justify-between gap-3 p-3 transition-colors"
						style="border-color: var(--panel-border); text-decoration: none;"
					>
						<div class="flex items-center gap-3">
							<span class="data" style="color: var(--foreground)">{r.symbol}</span>
							<span class="label" style="color: {color}">{label}</span>
						</div>
						<span class="label" style="color: var(--foreground-muted)">
							ANALYZED {formatTimeAgo(r.analyzedAt)}
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
