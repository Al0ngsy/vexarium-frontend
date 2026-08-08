<script lang="ts">
	import OptionsMatrix from './OptionsMatrix.svelte';
	import { store } from '$lib/contract.svelte';

	let { symbol }: { symbol: string } = $props();
</script>

{#if !store.selectedSymbol}
	<p class="label" style="color: var(--foreground-muted); text-transform: none">
		Select a contract to see the P/L matrix.
	</p>
{:else}
	<OptionsMatrix {symbol} contractSymbol={store.selectedSymbol} />
{/if}
