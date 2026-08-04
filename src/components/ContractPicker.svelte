<script lang="ts">
	import type { OptionContract } from '$lib/types';

	// A step-by-step option contract picker. The user selects EXPIRY → CALL/PUT →
	// STRIKE instead of typing a raw OCC symbol. Emits the selected contract's
	// full symbol (OCC code) on change.

	let {
		contracts,
		selected = '',
		onSelect
	}: {
		contracts: OptionContract[];
		selected?: string;
		onSelect: (symbol: string) => void;
	} = $props();

	let expiry = $state('');
	let ctype = $state<'call' | 'put'>('call');
	let strike = $state<number | null>(null);

	// Unique, sorted expiries.
	const expiries = $derived.by(() => {
		const set = new Set(contracts.map((c) => c.expiration_date).filter(Boolean));
		return [...set].sort();
	});

	// Strikes available for the chosen expiry + type.
	const strikes = $derived.by(() => {
		const list = contracts.filter(
			(c) => c.expiration_date === expiry && c.type.toLowerCase() === ctype
		);
		return [...new Set(list.map((c) => c.strike_price))].sort((a, b) => a - b);
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

	function onStrikeChosen(s: number) {
		strike = s;
		const c = matchedContract;
		if (c) onSelect(c.symbol);
	}
</script>

<div class="flex flex-col gap-4">
	<!-- EXPIRY -->
	<div>
		<span class="label block mb-1">EXPIRY</span>
		<select
			bind:value={expiry}
			onchange={() => (strike = null)}
			class="w-full rounded border px-3 py-2"
			style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground);"
		>
			<option value="" disabled>SELECT EXPIRY</option>
			{#each expiries as e}
				<option value={e}>{e}</option>
			{/each}
		</select>
	</div>

	<!-- CALL / PUT -->
	<div>
		<span class="label block mb-1">TYPE</span>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => (ctype = 'call')}
				class="flex-1 rounded px-3 py-2 label"
				style="border: 1px solid {ctype === 'call' ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {ctype === 'call' ? 'var(--surface-active)' : 'var(--surface)'}; color: {ctype === 'call' ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
			>
				CALL
			</button>
			<button
				type="button"
				onclick={() => (ctype = 'put')}
				class="flex-1 rounded px-3 py-2 label"
				style="border: 1px solid {ctype === 'put' ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {ctype === 'put' ? 'var(--surface-active)' : 'var(--surface)'}; color: {ctype === 'put' ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
			>
				PUT
			</button>
		</div>
	</div>

	<!-- STRIKE -->
	<div>
		<span class="label block mb-1">STRIKE</span>
		{#if strikes.length > 0}
			<select
				bind:value={strike}
				onchange={() => onStrikeChosen(strike as number)}
				class="w-full rounded border px-3 py-2"
				style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground);"
			>
				<option value="" disabled>SELECT STRIKE</option>
				{#each strikes as s}
					<option value={s}>{s.toFixed(2)}</option>
				{/each}
			</select>
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
