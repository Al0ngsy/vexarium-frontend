<script lang="ts">
	import type { OptionContract } from '$lib/types';

	// Two-sided TradingView-style options chain, in Arasaka style.
	// Groups contracts by expiration; each group is a mirrored
	//   CALLS | STRIKE + IV | PUTS
	// table with bid/ask, last, theoretical, intrinsic, time value, spread,
	// and distance from the underlying. Rows are clickable to select a contract.
	// Volume / open interest columns are omitted (Alpaca's free tier does not
	// provide them) — a footnote explains this.

	let {
		contracts,
		currentPrice,
		selected = '',
		onSelect
	}: {
		contracts: OptionContract[];
		currentPrice: number | null;
		selected?: string;
		onSelect: (symbol: string) => void;
	} = $props();

	const DAY_MS = 86400000;

	function fmtPrice(v: number): string {
		if (v === null || v === undefined || v === 0) return '—';
		return `$${v.toFixed(2)}`;
	}
	function fmtPct(v: number): string {
		if (v === null || v === undefined) return '—';
		return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
	}
	function fmtIV(v: number): string {
		if (v === null || v === undefined || v === 0) return '—';
		return `${(v * 100).toFixed(1)}%`;
	}
	function fmtExpiry(e: string): string {
		try {
			const d = new Date(e + 'T00:00:00');
			const dte = Math.round((d.getTime() - Date.now()) / DAY_MS);
			const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
			return `${d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} · ${dow} · ${dte}D`;
		} catch {
			return e;
		}
	}
	function moneynessColor(c: OptionContract): string {
		// ITM calls / OTM puts etc. colored by distance direction.
		if (c.distance_pct > 0) return '#4ade80'; // call OTM (green) / put ITM
		if (c.distance_pct < 0) return '#fb923c'; // call ITM / put OTM
		return 'var(--foreground)';
	}
	// Distance sign flips meaning for calls vs puts.
	function distColor(c: OptionContract): string {
		if (c.distance_pct === 0) return 'var(--foreground-muted)';
		// For a call: +distance = OTM (further above). For a put: +distance = ITM.
		const isCall = c.type === 'call';
		const otm = isCall ? c.distance_pct > 0 : c.distance_pct < 0;
		return otm ? '#4ade80' : '#fb923c';
	}

	// Group contracts by expiration.
	const groups = $derived.by(() => {
		const map = new Map<string, OptionContract[]>();
		for (const c of contracts) {
			if (!c.expiration_date) continue;
			const arr = map.get(c.expiration_date) ?? [];
			arr.push(c);
			map.set(c.expiration_date, arr);
		}
		const keys = [...map.keys()].sort();
		return keys.map((k) => {
			const list = map.get(k)!;
			const calls = list.filter((c) => c.type === 'call').sort((a, b) => a.strike_price - b.strike_price);
			const puts = list.filter((c) => c.type === 'put').sort((a, b) => b.strike_price - a.strike_price);
			return { expiry: k, calls, puts, dte: list[0]?.days_to_expiry ?? 0 };
		});
	});

	const maxRows = $derived.by(() => {
		let m = 1;
		for (const g of groups) m = Math.max(m, g.calls.length, g.puts.length);
		return m;
	});
</script>

<div class="flex flex-col gap-4">
	<!-- Column headers -->
	<div class="label grid grid-cols-2 gap-2 px-1" style="color: var(--foreground-muted)">
		<div class="grid grid-cols-5 gap-1 text-left">
			<span>BID</span><span>ASK</span><span>LAST</span><span>THEO</span><span>IV</span>
		</div>
		<div class="grid grid-cols-5 gap-1 text-right">
			<span>IV</span><span>THEO</span><span>LAST</span><span>ASK</span><span>BID</span>
		</div>
	</div>

	{#each groups as group}
		<div class="panel p-3" style="border-top: 2px solid var(--accent-primary)">
			<div class="mb-2 flex items-center justify-between">
				<span class="brand" style="font-size: 0.8rem">{fmtExpiry(group.expiry)}</span>
				<span class="label" style="color: var(--foreground-subtle)">{group.calls.length + group.puts.length} CONTRACTS</span>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full" style="border-collapse: collapse; font-family: 'JetBrains Mono', monospace; font-size: 11px; min-width: 720px;">
					<tbody>
						{#each Array(maxRows) as _, i}
							{@const call = group.calls[i]}
							{@const put = group.puts[i]}
							<tr style="border-bottom: 1px solid var(--grid-line);">
								<!-- CALL side -->
								<td class="w-1/2 pr-1">
									{#if call}
										<button
											type="button"
											onclick={() => onSelect(call.symbol)}
											class="grid w-full grid-cols-5 items-center gap-1 py-1 px-1 text-left"
											style="border: 1px solid {selected === call.symbol ? 'var(--accent-primary)' : 'transparent'}; background: {selected === call.symbol ? 'rgba(200,30,30,0.08)' : 'transparent'};"
										>
											<span class="data" style="font-size: 11px">{fmtPrice(call.bid)}</span>
											<span class="data" style="font-size: 11px">{fmtPrice(call.ask)}</span>
											<span class="data" style="font-size: 11px">{fmtPrice(call.last_price)}</span>
											<span class="data" style="font-size: 11px; color: var(--foreground-muted)">{fmtPrice(call.theoretical_value)}</span>
											<span class="data" style="font-size: 11px; color: var(--foreground-muted)">{fmtIV(call.implied_volatility)}</span>
										</button>
									{:else}
										<div class="py-1"></div>
									{/if}
								</td>
								<!-- STRIKE + IV center -->
								<td class="w-1 border-l border-r px-2" style="border-color: var(--panel-border);">
									{#if call}
										<div class="flex flex-col items-center py-1">
											<span class="data" style="font-size: 12px; color: {distColor(call)}">{call.strike_price.toFixed(0)}</span>
											<span class="label" style="font-size: 8px; color: var(--foreground-subtle)">{fmtPct(call.distance_pct)}</span>
										</div>
									{:else}
										<div class="py-1"></div>
									{/if}
								</td>
								<!-- PUT side -->
								<td class="w-1/2 pl-1">
									{#if put}
										<button
											type="button"
											onclick={() => onSelect(put.symbol)}
											class="grid w-full grid-cols-5 items-center gap-1 py-1 px-1 text-right"
											style="border: 1px solid {selected === put.symbol ? 'var(--accent-primary)' : 'transparent'}; background: {selected === put.symbol ? 'rgba(200,30,30,0.08)' : 'transparent'};"
										>
											<span class="data" style="font-size: 11px; color: var(--foreground-muted)">{fmtIV(put.implied_volatility)}</span>
											<span class="data" style="font-size: 11px; color: var(--foreground-muted)">{fmtPrice(put.theoretical_value)}</span>
											<span class="data" style="font-size: 11px">{fmtPrice(put.last_price)}</span>
											<span class="data" style="font-size: 11px">{fmtPrice(put.ask)}</span>
											<span class="data" style="font-size: 11px">{fmtPrice(put.bid)}</span>
										</button>
									{:else}
										<div class="py-1"></div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/each}

	{#if contracts.length === 0}
		<p class="label" style="color: var(--foreground-muted)">NO OPTIONS AVAILABLE.</p>
	{/if}

	<p class="label mt-1" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px; line-height: 1.5">
		THEORETICAL = BLACK-SCHOLES ESTIMATE. VOLUME &amp; OPEN INTEREST ARE NOT PROVIDED BY THE DATA FEED AND ARE OMITTED. QUOTES ARE DELAYED (INDICATIVE).
	</p>
</div>
