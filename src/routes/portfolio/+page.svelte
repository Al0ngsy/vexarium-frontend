<script lang="ts">
	import { onMount } from 'svelte';

	import type { SavedTrade, StanceResponse } from '$lib/types';
	import { getTrades } from '$lib/storage';
	import { getStance } from '$lib/api';

	import TradeCard from '../../components/TradeCard.svelte';
	import DisclaimerBanner from '../../components/DisclaimerBanner.svelte';

	interface StanceState {
		loading: boolean;
		data: StanceResponse | null;
	}

	let trades = $state<SavedTrade[]>([]);
	let loaded = $state(false);
	let stances = $state<Record<string, StanceState>>({});

	async function evaluate(trade: SavedTrade) {
		stances[trade.id] = { loading: true, data: null };
		try {
			// The backend fetches the live quote; the client only stores entry prices.
			const res = await getStance(trade);
			stances[trade.id] = { loading: false, data: res };
		} catch {
			stances[trade.id] = { loading: false, data: null };
		}
	}

	async function evaluateAll() {
		for (const trade of trades) {
			evaluate(trade);
		}
	}

	onMount(async () => {
		trades = getTrades();
		loaded = true;
		await evaluateAll();
	});

	async function refresh() {
		await evaluateAll();
	}

	let totalInvested = $derived(trades.reduce((sum, t) => sum + t.entryPrice * t.quantity, 0));

	function formatMoney(v: number): string {
		return `$${v.toFixed(2)}`;
	}
</script>

<svelte:head>
	<title>VEXARIUM — PORTFOLIO</title>
</svelte:head>

{#if loaded && trades.length === 0}
	<div
		class="panel flex flex-col items-center gap-4 p-12 text-center"
		style="border-top: 2px solid var(--accent-primary)"
	>
		<p class="brand" style="font-size: 1.5rem">NO SAVED TRADES.</p>
		<p class="label" style="color: var(--foreground-muted)">ANALYZE A SYMBOL TO BEGIN TRACKING.</p>
		<a href="/" class="link-crimson">GO TO ANALYSIS →</a>
	</div>
{:else if loaded}
	<DisclaimerBanner />

	<!-- Summary -->
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
			<div>
				<p class="label mb-1">TRADES</p>
				<p class="data" style="font-size: 1.25rem; color: var(--foreground)">{trades.length}</p>
			</div>
			<div>
				<p class="label mb-1">TOTAL INVESTED</p>
				<p class="data" style="font-size: 1.25rem; color: var(--foreground)">
					{formatMoney(totalInvested)}
				</p>
			</div>
		</div>
	</div>

	<!-- Trade list -->
	<div>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="brand">PORTFOLIO</h2>
			<button
				class="link-crimson"
				style="background: none; border: none; padding: 0"
				onclick={refresh}
			>
				REFRESH
			</button>
		</div>

		<div class="flex flex-col gap-3">
			{#each trades as trade}
				<TradeCard
					{trade}
					stance={stances[trade.id]?.data ?? null}
					loading={stances[trade.id]?.loading ?? true}
				/>
			{/each}
		</div>
	</div>
{/if}
