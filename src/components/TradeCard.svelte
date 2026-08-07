<script lang="ts">
	import type { SavedTrade, StanceResponse } from '$lib/types';
	import { deleteTrade } from '$lib/storage';
	import { STANCE_COLORS, STANCE_LABELS } from '$lib/verdict';

	let {
		trade,
		stance,
		loading
	}: {
		trade: SavedTrade;
		stance: StanceResponse | null;
		loading: boolean;
	} = $props();

	const typeLabels: Record<SavedTrade['type'], string> = {
		stock: 'STOCK',
		etf: 'ETF',
		index: 'INDEX',
		option: 'OPTION'
	};

	// pnl from the server-computed stance (live price), not a client guess.
	let pnlPct = $derived(stance ? stance.pnl_pct * 100 : 0);
	let pnlColor = $derived(pnlPct >= 0 ? '#34d399' : '#f87171');

	function onRemove() {
		if (confirm(`Remove ${trade.symbol} from portfolio?`)) {
			deleteTrade(trade.id);
			window.location.reload();
		}
	}
</script>

<div class="panel p-5" style="border-radius: 4px">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<span class="brand" style="font-size: 1.25rem; letter-spacing: 0.12em">{trade.symbol}</span>
			<span
				class="label"
				style="border: 1px solid var(--panel-border); border-radius: 2px; padding: 1px 6px; color: var(--foreground-muted)"
			>
				{typeLabels[trade.type]}
			</span>
		</div>

		<div class="flex items-center gap-2">
			<span class="data" style="color: var(--foreground-muted)">${trade.entryPrice.toFixed(2)}</span>
			{#if stance}
				<span class="data" style="color: var(--foreground-subtle)">→</span>
				<span class="data" style="color: {pnlColor}">
					{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
				</span>
			{/if}
		</div>
	</div>

	<div class="mt-3 flex items-center justify-between gap-3">
		{#if loading}
			<div class="flex flex-1 flex-col gap-2">
				<div class="h-5 w-40 rounded" style="background-color: var(--surface-3)"></div>
				<div class="h-3 w-64 rounded" style="background-color: var(--surface-3)"></div>
			</div>
		{:else if stance}
			<div class="flex-1">
				<span
					class="verdict-badge"
					style="border-left-color: {STANCE_COLORS[stance.stance]}; color: {STANCE_COLORS[stance.stance]}"
				>
					{STANCE_LABELS[stance.stance]}
				</span>
				<p class="mt-2" style="font-size: 0.8rem; color: var(--foreground-muted); line-height: 1.4">
					{stance.reason}
				</p>
			</div>
		{/if}

		{#if trade.type === 'option' && trade.contract}
			<span class="label" style="color: var(--foreground-subtle)">EXPIRY: {trade.contract}</span>
		{/if}
	</div>

	<div class="mt-4 flex items-center justify-between border-t pt-3" style="border-color: var(--panel-border)">
		<div class="flex items-center gap-4">
			<a href={`/?symbol=${trade.symbol}`} class="link-crimson">VIEW ANALYSIS →</a>
			<button
				class="label"
				style="background: none; border: none; cursor: pointer; color: var(--foreground-subtle)"
				onclick={onRemove}
			>
				REMOVE
			</button>
		</div>
	</div>
</div>
