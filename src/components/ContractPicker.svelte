<script lang="ts">
	import type { OptionContract } from '$lib/types';

	// Concept C contract picker: EXPIRY chips -> CALL/PUT toggle -> STRIKE ladder
	// centered on the current underlying price (shows % distance + premium).

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

	let expiry = $state('');
	let ctype = $state<'call' | 'put'>('call');
	let strike = $state<number | null>(null);

	const DAY_MS = 86400000;

	// Unique, sorted expiries (chronological; default-select the nearest).
	const expiries = $derived.by(() => {
		const set = new Set(contracts.map((c) => c.expiration_date).filter(Boolean));
		return [...set].sort();
	});

	function formatExpiry(e: string): string {
		try {
			const d = new Date(e + 'T00:00:00');
			const dte = Math.round((d.getTime() - Date.now()) / DAY_MS);
			const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
			return `${d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} · ${dow} · ${dte}D`;
		} catch {
			return e;
		}
	}

	// Strikes available for the chosen expiry + type.
	const strikes = $derived.by(() => {
		const list = contracts.filter(
			(c) => c.expiration_date === expiry && c.type.toLowerCase() === ctype
		);
		return [...new Set(list.map((c) => c.strike_price))].sort((a, b) => a - b);
	});

	// Strike closest to the current price (the "ATM" strike to default to).
	const nearestStrike = $derived.by(() => {
		if (!strikes.length || !currentPrice) return null;
		return strikes.reduce((best, s) =>
			Math.abs(s - currentPrice) < Math.abs(best - currentPrice) ? s : best
		);
	});

	// Default the expiry to the nearest future one once the chain loads.
	$effect(() => {
		if (!expiry && expiries.length) expiry = expiries[0];
	});

	// Auto-select + center on the ATM strike when expiry/type/price changes.
	$effect(() => {
		const n = nearestStrike;
		if (n != null) strike = n;
	});

	// The selected contract (full OCC symbol) given the current parts.
	const matchedContract = $derived.by(() =>
		contracts.find(
			(c) =>
				c.expiration_date === expiry &&
				c.type.toLowerCase() === ctype &&
				c.strike_price === strike
		) ?? null
	);

	// Keep the parent informed of the default-selected contract.
	$effect(() => {
		if (matchedContract && matchedContract.symbol !== selected) {
			onSelect(matchedContract.symbol);
		}
	});

	function onStrikeChosen(s: number) {
		strike = s;
		const c = matchedContract;
		if (c) onSelect(c.symbol);
	}

	function pctFromCurrent(s: number): number {
		if (!currentPrice) return 0;
		return ((s - currentPrice) / currentPrice) * 100;
	}

	function premiumFor(s: number): number | null {
		const c = contracts.find(
			(x) => x.expiration_date === expiry && x.type.toLowerCase() === ctype && x.strike_price === s
		);
		// Alpaca often reports last_price = 0 for less-liquid strikes; hide those.
		const p = c ? c.last_price : null;
		return p && p > 0 ? p : null;
	}
</script>

<div class="flex flex-col gap-5">
	<!-- EXPIRY chips -->
	<div>
		<span class="label block mb-2">EXPIRY</span>
		<div class="flex flex-wrap gap-2">
			{#each expiries as e}
				<button
					type="button"
					onclick={() => { expiry = e; strike = null; }}
					class="px-3 py-2 text-left"
					style="border: 1px solid {expiry === e ? 'var(--accent-primary)' : 'var(--panel-border)'}; background-color: {expiry === e ? 'rgba(200,30,30,0.08)' : 'var(--surface)'}; box-shadow: {expiry === e ? 'inset 0 0 0 1px var(--accent-primary)' : 'none'};"
				>
					<span class="block label" style="color: {expiry === e ? 'var(--foreground)' : 'var(--foreground-muted)'}">
						{formatExpiry(e)}
					</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- CALL / PUT toggle -->
	<div>
		<span class="label block mb-2">TYPE</span>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => { ctype = 'call'; strike = null; }}
				class="flex-1 px-3 py-2 label text-center"
				style="border: 1px solid {ctype === 'call' ? '#16a34a' : 'var(--panel-border)'}; background-color: {ctype === 'call' ? 'rgba(22,163,74,0.08)' : 'var(--surface)'}; color: {ctype === 'call' ? '#16a34a' : 'var(--foreground-muted)'};"
			>
				CALL
			</button>
			<button
				type="button"
				onclick={() => { ctype = 'put'; strike = null; }}
				class="flex-1 px-3 py-2 label text-center"
				style="border: 1px solid {ctype === 'put' ? '#dc2626' : 'var(--panel-border)'}; background-color: {ctype === 'put' ? 'rgba(220,38,38,0.08)' : 'var(--surface)'}; color: {ctype === 'put' ? '#dc2626' : 'var(--foreground-muted)'};"
			>
				PUT
			</button>
		</div>
	</div>

	<!-- STRIKE ladder centered on current price -->
	<div>
		<span class="label block mb-2">
			STRIKE · CENTERED ON <span class="data" style="color: #16a34a">
				{currentPrice ? `$${currentPrice.toFixed(2)}` : '—'}
			</span>
		</span>
		{#if strikes.length > 0}
			<div class="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
				{#each strikes as s}
					{@const pct = pctFromCurrent(s)}
					{@const nearATM = Math.abs(pct) < 0.5}
					{@const prem = premiumFor(s)}
					<button
						type="button"
						onclick={() => onStrikeChosen(s)}
						class="flex items-center justify-between px-3 py-2"
						style="border: 1px solid {strike === s ? 'var(--accent-primary)' : 'var(--panel-border)'}; background-color: {strike === s ? 'rgba(200,30,30,0.1)' : 'var(--surface)'}; box-shadow: {strike === s ? 'inset 0 0 0 1px var(--accent-primary)' : 'none'};"
					>
						<span class="data" style="color: {nearATM ? '#16a34a' : pct > 0 ? '#22c55e' : '#f97316'}">
							{s.toFixed(0)}
						</span>
						<span class="data" style="font-size: 11px; color: {pct === 0 ? 'var(--foreground-muted)' : pct > 0 ? '#22c55e' : '#f97316'}">
							{pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%
						</span>
						{#if prem !== null}
							<span class="data" style="font-size: 12px; color: var(--foreground)">
								${prem.toFixed(2)}
							</span>
						{:else}
							<span class="label" style="font-size: 10px; color: var(--foreground-subtle)">N/A</span>
						{/if}
					</button>
				{/each}
			</div>
		{:else}
			<div class="rounded border px-3 py-2 label" style="border-color: var(--panel-border); color: var(--foreground-subtle);">
				{expiry ? 'NO STRIKES FOR THIS EXPIRY' : 'SELECT EXPIRY FIRST'}
			</div>
		{/if}
	</div>

	{#if matchedContract}
		<p class="label" style="color: var(--foreground-muted); text-transform: none">
			CONTRACT: <span class="data" style="color: var(--foreground)">{matchedContract.symbol}</span>
		</p>
	{/if}
</div>
