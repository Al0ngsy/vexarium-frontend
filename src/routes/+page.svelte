<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import type { AssetInfo, AssetType } from '$lib/types';
	import { searchAssets } from '$lib/api';
	import { getRecentAnalyses, type RecentAnalysis } from '$lib/storage';
	import { formatTimeAgo } from '$lib/format';
	import { VERDICT_COLORS, VERDICT_LABELS } from '$lib/verdict';

	let symbol = $state('');
	let assetType = $state<AssetType>('stock');
	let mode = $state<'standard' | 'options'>('standard');

	let suggestions = $state<AssetInfo[]>([]);
	let recent = $state<RecentAnalysis[]>([]);
	let dropdownOpen = $state(false);
	let activeIndex = $state(0); // flat index across all grouped rows for keyboard nav

	let inputEl: HTMLInputElement;
	let containerEl: HTMLDivElement;
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	// Group suggestions by asset type, preserving order: stock, etf, index.
	const grouped = $derived.by(() => {
		const order: AssetType[] = ['stock', 'etf', 'index'];
		const out: { type: AssetType; label: string; items: AssetInfo[] }[] = [];
		for (const t of order) {
			const items = suggestions.filter((s) => s.asset_type === t);
			if (items.length) {
				out.push({
					type: t,
					label: t.toUpperCase(),
					items
				});
			}
		}
		return out;
	});

	// Flatten grouped sections into a row model for keyboard navigation.
	const flatRows = $derived.by(() => {
		const rows: { label: string; asset: AssetInfo | null }[] = [];
		for (const g of grouped) {
			rows.push({ label: g.label, asset: null });
			for (const a of g.items) {
				rows.push({ label: a.symbol, asset: a });
			}
		}
		return rows;
	});

	const hasSuggestions = $derived(suggestions.length > 0);

	onMount(() => {
		recent = getRecentAnalyses();
		// Close the dropdown when clicking outside it.
		document.addEventListener('click', handleOutsideClick);
	});

	function handleOutsideClick(e: MouseEvent) {
		const el = containerEl as unknown as HTMLElement;
		if (el && !el.contains(e.target as Node)) {
			dropdownOpen = false;
		}
	}

	function onInput() {
		const q = symbol.trim();
		if (!q) {
			suggestions = [];
			dropdownOpen = false;
			return;
		}
		dropdownOpen = true;
		activeIndex = 0;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(async () => {
			let found = await searchAssets(q);
			// Prioritize an exact symbol match so it's always visible (e.g. typing "SPY"
			// returns ~13 SPY* symbols; the exact match otherwise sorts to the bottom).
			const qU = symbol.trim().toUpperCase();
			found = found.sort((a, b) => {
				const aExact = a.symbol.toUpperCase() === qU ? 0 : 1;
				const bExact = b.symbol.toUpperCase() === qU ? 0 : 1;
				return aExact - bExact;
			});
			suggestions = found.slice(0, 12);
			deriveAssetType(qU);
			dropdownOpen = suggestions.length > 0;
			activeIndex = 0;
		}, 250);
	}

	function deriveAssetType(sym: string) {
		if (!sym) return;
		const match = suggestions.find((s) => s.symbol.toUpperCase() === sym.toUpperCase());
		if (match) {
			assetType = match.asset_type;
		}
	}

	function selectAsset(asset: AssetInfo) {
		symbol = asset.symbol;
		assetType = asset.asset_type;
		suggestions = [];
		dropdownOpen = false;
		inputEl?.focus();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			// If a suggestion is highlighted, pick it; otherwise analyze as typed.
			if (dropdownOpen && flatRows.length > 0) {
				const row = flatRows[activeIndex];
				if (row.asset) {
					selectAsset(row.asset);
					return;
				}
			}
			onAnalyze();
		} else if (e.key === 'ArrowDown' && dropdownOpen) {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, flatRows.length - 1);
		} else if (e.key === 'ArrowUp' && dropdownOpen) {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (e.key === 'Escape') {
			dropdownOpen = false;
		}
	}

	function onAnalyze() {
		if (!symbol.trim()) return;
		const sym = symbol.trim().toUpperCase();
		dropdownOpen = false;
		// NOTE: recent-analyses history is recorded by the analysis page on SUCCESS only,
		// so a failed analysis (e.g. an index like SPX with no bar data) is never added.
		if (mode === 'options') {
			goto(`/options/${sym}`);
		} else {
			goto(`/analysis/${sym}`);
		}
	}
</script>

<div class="flex flex-col items-center">
	<!-- Hero -->
	<div class="flex flex-col items-center py-16 text-center">
		<div
			class="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
			style="border-color: var(--panel-border); background-color: var(--surface);"
		>
			<span class="h-2 w-2 rounded-full" style="background-color: var(--verdict-strong-buy); box-shadow: 0 0 8px var(--verdict-strong-buy);"></span>
			<span class="label" style="color: var(--foreground-muted); letter-spacing: 0.06em;">10 FREE CHECKS · AI SECOND OPINION ON PRO</span>
		</div>
		<h1 class="brand" style="font-size: 2.6rem; letter-spacing: 0.02em; text-transform: none; line-height: 1.1;">
			Check before you <span style="color: var(--accent-primary)">buy.</span>
		</h1>
		<p class="label mt-4 mb-8" style="color: var(--foreground-muted); text-transform: none; font-weight: 400; font-size: 1rem; max-width: 560px; line-height: 1.6;">
			A plain-language health check for any stock, ETF or option. Built for beginners, deep enough for pros.
		</p>

		<!-- Symbol input with grouped autocomplete -->
		<div class="panel flex w-full max-w-xl flex-col gap-6 p-6" style="box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);">
			<label class="label" for="symbol">SYMBOL</label>
			<div class="relative" bind:this={containerEl}>
				<input
					id="symbol"
					bind:this={inputEl}
					autocomplete="off"
					placeholder="Enter symbol — e.g. AAPL, SPY, NVDA"
					bind:value={symbol}
					oninput={onInput}
					onkeydown={onKeydown}
					onfocus={() => {
						if (hasSuggestions) dropdownOpen = true;
					}}
					class="w-full rounded-lg border px-4 py-3 font-mono"
					style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground); text-transform: uppercase;"
				/>

				<!-- Grouped dropdown -->
				{#if dropdownOpen && grouped.length > 0}
					<div
						class="absolute z-30 mt-1 w-full overflow-hidden rounded-lg"
						style="background-color: var(--surface); border: 1px solid var(--panel-border); max-height: 320px; overflow-y: auto; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);"
					>
						{#each grouped as group, gi}
							{@const groupOffset = flatRows.findIndex((r) => r.label === group.label)}
							<!-- Section header -->
							<div
								class="px-3 py-1.5 label"
								style="background-color: var(--surface-3); color: var(--accent-primary); border-bottom: 1px solid var(--panel-border);"
							>
								{group.label} — {group.items.length}
							</div>
							{#each group.items as asset, ai}
								{@const rowIndex = groupOffset + 1 + ai}
								<button
									type="button"
									onclick={() => selectAsset(asset)}
									onmouseenter={() => (activeIndex = rowIndex)}
									class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
									style="background-color: {activeIndex === rowIndex ? 'var(--surface-active)' : 'transparent'}; border-bottom: 1px solid var(--grid-line);"
								>
									<span class="data" style="color: var(--foreground)">{asset.symbol}</span>
									<span class="label truncate" style="color: var(--foreground-muted)">{asset.name}</span>
								</button>
							{/each}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Mode toggle -->
			<div>
				<span class="label block mb-2">MODE</span>
				<div class="flex gap-2">
					<button
						onclick={() => (mode = 'standard')}
						class="flex-1 rounded-lg px-3 py-2 label"
						style="border: 1px solid {mode === 'standard' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background-color: {mode === 'standard' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {mode === 'standard' ? 'var(--accent-white)' : 'var(--foreground-muted)'}; font-weight: {mode === 'standard' ? 700 : 600};"
					>
						STOCK / ETF
					</button>
					<button
						onclick={() => (mode = 'options')}
						class="flex-1 rounded-lg px-3 py-2 label"
						style="border: 1px solid {mode === 'options' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background-color: {mode === 'options' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {mode === 'options' ? 'var(--accent-white)' : 'var(--foreground-muted)'}; font-weight: {mode === 'options' ? 700 : 600};"
					>
						OPTIONS
					</button>
				</div>
			</div>

			<!-- Analyze button -->
			<button class="btn-primary w-full" onclick={onAnalyze}>RUN CHECK</button>
		</div>
	</div>

	<!-- Recent analyses (local-only history). Daily auto-update is a future Pro feature. -->
	<div class="mt-4 w-full max-w-xl">
		<div class="section-title" style="margin-top: 0;">RECENT ANALYSES <span class="line"></span></div>
		{#if recent.length === 0}
			<p class="label" style="color: var(--foreground-muted)">NO RECENT ANALYSES.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each recent as r}
					{@const color = r.verdict !== 'pending' ? (VERDICT_COLORS[r.verdict as keyof typeof VERDICT_COLORS] ?? '#8b96a8') : '#8b96a8'}
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
