<script lang="ts">
	import StrategyCard from './StrategyCard.svelte';
	import { store } from '$lib/contract.svelte';
	import { streamOptionsStrategiesExplanation } from '$lib/api';
	import { getToken } from '$lib/auth.svelte';
	import { renderAIMarkdown } from '$lib/markdown';

	const strategies = $derived(store.strategies?.strategies ?? []);

	let why = $state<{ name: string; text: string } | null>(null);
	let whyLoading = $state(false);
	let whyError = $state<string | null>(null);

	// Session cache: repeat "why" clicks on the same strategy are instant.
	const whyCache = new Map<string, string>();

	// Every strategy the engine knows; explore = those not already suggested.
	const ALL_STRATEGIES = [
		'LONG CALL',
		'LONG PUT',
		'BULL CALL SPREAD',
		'BEAR PUT SPREAD',
		'COVERED CALL',
		'CASH-SECURED PUT',
		'SHORT PUT'
	];
	const explore = $derived(ALL_STRATEGIES.filter((n) => !strategies.some((s) => s.name === n)));

	async function askWhy(name: string, exploreStrategy?: string) {
		if (!store.selectedSymbol) return;
		// DEV: Pro gate removed during development; re-add the isPro() check before launch.
		const cacheKey = exploreStrategy ?? name;
		const cached = whyCache.get(cacheKey);
		if (cached !== undefined) {
			why = { name, text: cached };
			return;
		}
		whyLoading = true;
		whyError = null;
		why = { name, text: '' };
		try {
			const contract = store.getSelectedContract();
			const strike = contract?.strike_price ?? 0;
			const full = await streamOptionsStrategiesExplanation(
				store.symbol,
				strike,
				(chunk) => {
					why = { name, text: (why?.text ?? '') + chunk };
				},
				getToken() ?? undefined,
				exploreStrategy
			);
			whyCache.set(cacheKey, full);
			why = { name, text: full };
		} catch (e) {
			why = null;
			whyError = e instanceof Error ? e.message : 'Explanation failed';
		} finally {
			whyLoading = false;
		}
	}

	// Split the answer into a big blue headline, the markdown body, and the
	// boxed disclaimer footer (same presentation as the stock AI opinion).
	function splitAnswer(text: string): { headline: string; body: string; footer: string } {
		const marker = 'This is not financial advice. AI can make/will make mistakes.';
		const i = text.lastIndexOf(marker);
		let body = text;
		let footer = '';
		if (i !== -1) {
			body = text.slice(0, i).replace(/\s*--+\s*$/g, '').trimEnd();
			footer = marker;
		}
		const lines = body.split('\n');
		let headline = '';
		const first = lines[0]?.trim() ?? '';
		if (first && (first.startsWith('## ') || first.startsWith('**'))) {
			headline = first.replace(/^##\s*/, '').replace(/^\*\*|\*\*$/g, '');
			body = lines.slice(1).join('\n').trim();
		}
		return { headline, body, footer };
	}

	const answerParts = $derived(why ? splitAnswer(why.text) : null);
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
			{#if explore.length > 0}
				<span class="label block mt-2 mb-1" style="color: var(--foreground-subtle); font-size: 9px;">EXPLORE MORE</span>
				<div class="flex flex-col gap-1">
					{#each explore as n (n)}
						<button
							type="button"
							disabled={whyLoading}
							onclick={() => void askWhy(n, n)}
							class="px-2 py-1 text-left label"
							style="border: 1px dashed {why?.name === n ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {why?.name === n ? 'var(--accent-primary)' : 'var(--foreground-muted)'}; background: transparent; cursor: {whyLoading ? 'wait' : 'pointer'};"
						>
							Why {n.toLowerCase()} now?
						</button>
					{/each}
				</div>
			{/if}
			{#if whyLoading}
				<p class="label mt-3" style="color: var(--foreground-muted); text-transform: none; line-height: 1.5; font-size: 11px;">
					Asking the AI, streaming the answer…
				</p>
			{:else if whyError}
				<p class="label mt-3" style="color: var(--accent-primary); text-transform: none; line-height: 1.5; font-size: 11px;">
					{whyError}
				</p>
			{:else if !why}
				<p class="label mt-3" style="color: var(--foreground-muted); text-transform: none; line-height: 1.5; font-size: 11px;">
					Pick a strategy to get an AI explanation of why it fits the current picture.
				</p>
			{/if}
			{#if why && answerParts}
				{#if answerParts.headline}
					<div class="ai-headline">{answerParts.headline}</div>
				{/if}
				{#if answerParts.body}
					<div class="ai-body" style="font-size: 11.5px;">
						{@html renderAIMarkdown(answerParts.body)}
					</div>
				{/if}
				{#if answerParts.footer}
					<div class="ai-disclaimer">{answerParts.footer}</div>
				{/if}
			{/if}
		</div>
	</div>
{:else if store.strategiesLoading}
	<p class="label" style="color: var(--foreground-muted)">Loading strategies…</p>
{:else}
	<p class="label" style="color: var(--accent-primary)">{store.strategiesError ?? 'No strategies found for this contract.'}</p>
{/if}

<style>
	/* Same visual language as the stock AI opinion: big blue headline,
	   styled markdown body, boxed disclaimer footer. */
	.ai-headline {
		margin-top: 12px;
		color: var(--accent-primary);
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.01em;
	}
	.ai-disclaimer {
		margin-top: 12px;
		padding: 8px 10px;
		border-top: 1px solid var(--panel-border);
		border-bottom: 1px solid var(--panel-border);
		color: var(--foreground-muted);
		font-size: 10px;
		line-height: 1.5;
		text-align: center;
		text-transform: none;
	}
</style>
