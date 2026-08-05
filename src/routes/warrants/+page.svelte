<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';

	import { getWarrants, getWarrantValue } from '$lib/api';
	import type { Warrant, WarrantValue } from '$lib/types';

	import WarrantPicker from '../../components/WarrantPicker.svelte';
	import WarrantPayoffExplorer from '../../components/WarrantPayoffExplorer.svelte';

	// Underlying comes from the query string (?underlying=...) so currency pairs
	// like "EUR/USD" (which contain a slash) survive URL encoding.
	let underlying = $derived(String(page.url.searchParams.get('underlying') || '').toUpperCase());

	let warrants = $state<Warrant[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let selected = $state<Warrant | null>(null);

	onMount(() => {
		load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			const resp = await getWarrants(underlying, undefined, 500);
			warrants = resp.warrants;
		} catch (e) {
			warrants = [];
			error = e instanceof Error ? e.message : 'Warrants failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>VEXARIUM — WARRANTS {underlying}</title>
</svelte:head>

<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<p class="label mb-1">WARRANTS · OPTIONSSCHEINE</p>
			<p class="brand" style="font-size: 2rem">{underlying || '—'}</p>
		</div>
	</div>
</div>

{#if loading}
	<div class="flex h-40 items-center justify-center">
		<span class="label" style="color: var(--foreground-muted)">LOADING WARRANTS…</span>
	</div>
{:else if error}
	<div class="panel p-6" style="border-top: 2px solid var(--accent-primary)">
		<p class="label" style="color: var(--accent-primary)">{error}</p>
		<p class="label mt-2" style="color: var(--foreground-subtle); text-transform: none">
			Warrant data is currently unavailable. Try a different underlying or retry later.
		</p>
	</div>
{:else if warrants.length === 0}
	<div class="panel p-6" style="border-top: 2px solid var(--accent-primary)">
		<p class="label" style="color: var(--foreground-muted)">NO WARRANTS FOUND FOR {underlying}.</p>
		<p class="label mt-3" style="color: var(--foreground-subtle); text-transform: none; line-height: 1.7">
			Warrant coverage is currently limited to a small set of underlyings. Try a currency pair
			(e.g. <span class="data" style="color: var(--foreground)">EUR/USD</span>,
			<span class="data" style="color: var(--foreground)">GBP/USD</span>,
			<span class="data" style="color: var(--foreground)">USD/CAD</span>) or a different symbol.
		</p>
	</div>
{:else}
	<!-- Split layout: picker left, payoff explorer right -->
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<h2 class="brand mb-4" style="border-bottom: 2px solid var(--accent-primary)">BUILD WARRANT</h2>
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div>
				<WarrantPicker
					warrants={warrants}
					underlying={underlying}
					onSelect={(w: Warrant) => (selected = w)}
				/>
			</div>
			<div style="border-left: 1px solid var(--panel-border); padding-left: 20px;">
				<span class="label block mb-3">PAYOFF EXPLORER</span>
				{#if selected}
					<WarrantPayoffExplorer
						warrant={selected}
						underlying={underlying}
					/>
				{:else}
					<p class="label" style="color: var(--foreground-subtle); text-transform: none">
						Pick a warrant on the left to see what it's worth at any underlying price.
					</p>
				{/if}
			</div>
		</div>
	</div>

	<p class="label" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px">
		⚠ DERIVATIVES INVOLVE RISK OF TOTAL LOSS. INFORMATIONAL ONLY — NOT FINANCIAL ADVICE.
	</p>
{/if}
