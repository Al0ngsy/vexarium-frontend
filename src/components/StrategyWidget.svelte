<script lang="ts">
	import StrategyCard from './StrategyCard.svelte';
	import { store } from '$lib/contract.svelte';
	import { getStrategiesExplanation } from '$lib/api';
	import { getToken } from '$lib/auth.svelte';
	import { renderAIMarkdown } from '$lib/markdown';

	const strategies = $derived(store.strategies?.strategies ?? []);

	let why = $state<{ name: string; text: string } | null>(null);
	let whyLoading = $state(false);
	let whyError = $state<string | null>(null);

	// Session cache: repeat "why" clicks on the same strategy are instant.
	const whyCache = new Map<string, string>();

	async function askWhy(name: string) {
		if (!store.selectedSymbol) return;
		// DEV: Pro gate removed during development; re-add the isPro() check before launch.
		const cached = whyCache.get(name);
		if (cached !== undefined) {
			why = { name, text: cached };
			return;
		}
		whyLoading = true;
		whyError = null;
		try {
			const contract = store.getSelectedContract();
			const strike = contract?.strike_price ?? 0;
			const r = await getStrategiesExplanation(store.symbol, strike, getToken() ?? undefined);
			whyCache.set(name, r.analysis);
			why = { name, text: r.analysis };
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
	<!-- Cards keep a fixed width, the AI answer box takes all remaining space
	     and grows as the widget is resized. -->
	<div class="grid gap-3" style="grid-template-columns: minmax(260px, 400px) minmax(0, 1fr); align-items: start;">
		<div class="grid gap-3" style="grid-template-columns: 1fr;">
			{#each strategies as s (s.name)}
				<StrategyCard strategy={s} />
			{/each}
		</div>

		<!-- Dedicated AI answer box next to the cards. -->
		<div
			class="panel p-3"
			style="border-color: var(--panel-border); max-height: 420px; overflow-y: auto;"
		>
			<span class="label block mb-2" style="color: var(--accent-primary); font-size: 10px;">AI ANSWER</span>
			<div class="flex flex-col gap-1">
				{#each strategies as s (s.name)}
					<button
						type="button"
						disabled={whyLoading}
						onclick={() => void askWhy(s.name)}
						class="px-2 py-1 text-left label"
						style="border: 1px solid {why?.name === s.name ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {why?.name === s.name ? 'var(--accent-primary)' : 'var(--foreground-muted)'}; background: transparent; cursor: {whyLoading ? 'wait' : 'pointer'};"
					>
						Why {s.name.toLowerCase()}?
					</button>
				{/each}
			</div>
			{#if whyLoading}
				<p class="label mt-3" style="color: var(--foreground-muted); text-transform: none; line-height: 1.5; font-size: 11px;">
					Asking the AI, usually around 15 seconds…
				</p>
			{:else if why}
				<div class="mt-3 ai-body" style="font-size: 11.5px;">
					{@html renderAIMarkdown(why.text)}
				</div>
			{:else if whyError}
				<p class="label mt-3" style="color: var(--accent-primary); text-transform: none; line-height: 1.5; font-size: 11px;">
					{whyError}
				</p>
			{:else}
				<p class="label mt-3" style="color: var(--foreground-muted); text-transform: none; line-height: 1.5; font-size: 11px;">
					Pick a strategy to get an AI explanation of why it fits the current picture.
				</p>
			{/if}
		</div>
	</div>
{:else if store.strategiesLoading}
	<p class="label" style="color: var(--foreground-muted)">Loading strategies…</p>
{:else}
	<p class="label" style="color: var(--accent-primary)">{store.strategiesError ?? 'No strategies found for this contract.'}</p>
{/if}
