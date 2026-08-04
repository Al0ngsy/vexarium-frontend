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
	let optionsMode = $state(false);

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
		<span style="color: var(--foreground)">VEX</span><span style="color: var(--accent-primary)">ARIUM</span>
	</h1>
	<p class="label mb-12">ENTER SYMBOL — TECHNICAL &amp; OPTIONS ANALYSIS</p>

	<!-- Symbol input with grouped autocomplete -->
	<div class="panel flex w-full max-w-xl flex-col gap-6 p-6">
		<label class="label" for="symbol">SYMBOL</label>
		<div class="relative" bind:this={containerEl}>
			<input
				id="symbol"
				bind:this={inputEl}
				autocomplete="off"
				placeholder="ENTER SYMBOL"
				bind:value={symbol}
				oninput={onInput}
				onkeydown={onKeydown}
				onfocus={() => {
					if (hasSuggestions) dropdownOpen = true;
				}}
				class="w-full rounded border px-4 py-3 text-lg font-mono uppercase"
				style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground); text-transform: uppercase;"
			/>

			<!-- Grouped dropdown -->
			{#if dropdownOpen && grouped.length > 0}
				<div
					class="absolute z-30 mt-1 w-full overflow-hidden rounded"
					style="background-color: var(--surface); border: 1px solid var(--panel-border); max-height: 320px; overflow-y: auto;"
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
