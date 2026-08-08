<script lang="ts">
	import StrategyCard from './StrategyCard.svelte';
	import { store } from '$lib/contract.svelte';

	const strategies = $derived(store.strategies?.strategies ?? []);
</script>

{#if !store.selectedSymbol}
	<p class="label" style="color: var(--foreground-muted); text-transform: none">
		Select a contract to see strategy ideas.
	</p>
{:else if strategies.length > 0}
	<div class="flex gap-3 overflow-x-auto pb-2" style="scrollbar-width: thin;">
		{#each strategies as s (s.name)}
			<div style="min-width: 260px;">
				<StrategyCard strategy={s} />
			</div>
		{/each}
	</div>
{:else if store.strategiesLoading}
	<p class="label" style="color: var(--foreground-muted)">Loading strategies…</p>
{:else}
	<p class="label" style="color: var(--foreground-muted)">{store.strategiesError ?? 'No strategies found for this contract.'}</p>
{/if}
