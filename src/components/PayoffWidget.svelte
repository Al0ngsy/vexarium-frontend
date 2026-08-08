<script lang="ts">
	import PayoffExplorer from './PayoffExplorer.svelte';
	import { formatPrice } from '$lib/format';
	import { store } from '$lib/contract.svelte';

	let { symbol }: { symbol: string } = $props();

	const selected = $derived(store.getSelectedContract());
	const payoff = $derived(store.payoff);
	const isCall = $derived(selected ? selected.type.toLowerCase() === 'call' : null);

	function fmtPL(v: number): string {
		return `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;
	}
	function fmtPLPct(v: number): string {
		return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
	}
	const plColor = $derived((v: number) => (v >= 0 ? '#34d399' : '#f87171'));
</script>

{#if !selected}
	<p class="label" style="color: var(--foreground-muted); text-transform: none">
		Select a contract to see its payoff curve and timeline.
	</p>
{:else}
	{#key store.selectedSymbol}
		<PayoffExplorer
			{symbol}
			contractSymbol={store.selectedSymbol}
			contract={store.selectedSymbol}
			currentPrice={store.currentPrice}
			strike={selected.strike_price}
			isCall={isCall}
			expiry={selected.expiration_date}
			premium={payoff?.premium ?? selected.last_price}
			breakeven={payoff?.breakeven ?? null}
		/>
	{/key}

	<div class="mt-4">
		<span class="label block mb-2" style="color: var(--foreground-muted)">PAYOFF TIMELINE</span>
		{#if payoff && payoff.payoff_timeline.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-left" style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
					<thead>
						<tr class="label" style="border-bottom: 1px solid var(--panel-border); color: var(--foreground-muted)">
							<th class="py-1 pr-4">DATE</th>
							<th class="py-1 pr-4">EST. PRICE</th>
							<th class="py-1 pr-4">P/L</th>
							<th class="py-1 pr-4">P/L %</th>
						</tr>
					</thead>
					<tbody>
						{#each payoff.payoff_timeline as row}
							<tr style="border-bottom: 1px solid var(--panel-border)">
								<td class="py-1 pr-4" style="color: var(--foreground-muted)">{row.date}</td>
								<td class="py-1 pr-4" style="color: var(--foreground)">{formatPrice(row.estimated_option_price)}</td>
								<td class="py-1 pr-4" style="color: {plColor(row.estimated_pl)}">{fmtPL(row.estimated_pl)}</td>
								<td class="py-1 pr-4" style="color: {plColor(row.pl_pct)}">{fmtPLPct(row.pl_pct)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="label mt-2" style="color: var(--foreground-subtle); font-size: 10px">ESTIMATE — NOT GUARANTEED</p>
		{:else if store.payoffLoading}
			<p class="label" style="color: var(--foreground-muted)">Loading…</p>
		{:else}
			<p class="label" style="color: var(--foreground-muted)">No timeline for this contract.</p>
		{/if}
	</div>
{/if}
