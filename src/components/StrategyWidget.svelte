<script lang="ts">
	import StrategyCard from './StrategyCard.svelte';
	import { store } from '$lib/contract.svelte';
	import { getStrategiesExplanation } from '$lib/api';
	import { getToken } from '$lib/auth.svelte';

	const strategies = $derived(store.strategies?.strategies ?? []);

	let why = $state<{ name: string; text: string } | null>(null);
	let whyLoading = $state(false);
	let whyError = $state<string | null>(null);

	async function askWhy(name: string) {
		if (!store.selectedSymbol) return;
		// DEV: Pro gate removed during development; re-add the isPro() check before launch.
		whyLoading = true;
		whyError = null;
		try {
			const strike = store.getSelectedContract()?.strike_price ?? 0;
			const res = await getStrategiesExplanation(store.symbol, strike, getToken() ?? undefined);
			why = { name, text: res.analysis };
		} catch (e) {
			why = null;
			whyError = e instanceof Error ? e.message : 'Explanation failed';
		} finally {
			whyLoading = false;
		}
	}
</script>

{#if !store.selectedSymbol}
	<p class="label" style="color: var(--foreground-muted); text-transform: none">
		Select a contract to see strategy ideas.
	</p>
{:else if strategies.length > 0}
	<div class="flex gap-3 overflow-x-auto pb-2" style="scrollbar-width: thin;">
		{#each strategies as s (s.name)}
			<div style="min-width: 260px;">
				<StrategyCard strategy={s} onWhy={(name) => void askWhy(name)} />
			</div>
		{/each}
	</div>
	{#if whyLoading}
		<p class="label mt-2" style="color: var(--foreground-muted)">Explaining the picks…</p>
	{:else if why}
		<div class="panel mt-2 p-3" style="border-color: var(--panel-border);">
			<span class="label block mb-1" style="color: var(--accent-primary); font-size: 10px;">WHY {why.name}?</span>
			<p class="label" style="color: var(--foreground); text-transform: none; line-height: 1.6; font-size: 11px;">{why.text}</p>
		</div>
	{:else if whyError}
		<p class="label mt-2" style="color: var(--accent-primary)">{whyError}</p>
	{/if}
{:else if store.strategiesLoading}
	<p class="label" style="color: var(--foreground-muted)">Loading strategies…</p>
{:else}
	<p class="label" style="color: var(--foreground-muted)">{store.strategiesError ?? 'No strategies found for this contract.'}</p>
{/if}
