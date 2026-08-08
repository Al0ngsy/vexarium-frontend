<script lang="ts">
	import { onMount } from 'svelte';
	import OptionsChain from './OptionsChain.svelte';
	import { store } from '$lib/contract.svelte';

	let { symbol }: { symbol: string } = $props();

	onMount(() => {
		if (store.symbol !== symbol.toUpperCase()) void store.loadChain(symbol);
	});

	const expiries = $derived(store.getExpiries());
	const chains = $derived(store.getSelectedChain());
	const currentPrice = $derived(store.currentPrice);

	function fmtExpiry(e: string): string {
		try {
			const d = new Date(e + 'T00:00:00');
			const dte = Math.round((d.getTime() - Date.now()) / 86400000);
			return `${d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} · ${dte}D`;
		} catch {
			return e;
		}
	}
</script>

{#if store.contractsLoading && store.contracts.length === 0}
	<div class="flex h-40 items-center justify-center">
		<span class="label" style="color: var(--foreground-muted)">LOADING CONTRACTS…</span>
	</div>
{:else if store.contractsError}
	<p class="label" style="color: var(--accent-primary)">{store.contractsError}</p>
{:else if store.contracts.length === 0}
	<p class="label" style="color: var(--foreground-muted)">NO OPTIONS AVAILABLE FOR {symbol.toUpperCase()}.</p>
{:else}
	<div class="mb-3 flex flex-wrap gap-1">
		{#each expiries as e}
			<button
				type="button"
				onclick={() => store.setActiveExpiry(e)}
				class="px-3 py-1 label rounded"
				style="border: 1px solid {store.activeExpiry === e ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {store.activeExpiry === e ? 'var(--accent-primary)' : 'var(--surface)'}; color: {store.activeExpiry === e ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
			>{fmtExpiry(e)}</button
			>
		{/each}
		{#if store.delayed}
			<span class="label ml-2 self-center" style="color: #fbbf24; border: 1px solid rgba(251,191,36,0.33); padding: 2px 6px; border-radius: 4px">DELAYED</span>
		{/if}
	</div>
	<OptionsChain
		contracts={chains}
		currentPrice={currentPrice}
		selected={store.selectedSymbol}
		onSelect={(s) => void store.selectContract(s)}
	/>
	{#if store.contractsLoading}
		<p class="label mt-2" style="color: var(--foreground-muted)">Refreshing…</p>
	{/if}
{/if}
