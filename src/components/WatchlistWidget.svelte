<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getWatchlist, addToWatchlist, removeFromWatchlist } from '$lib/storage';
	import { quotes, setWatch } from '$lib/quotes.svelte';
	import { formatPrice } from '$lib/format';

	// Watchlist widget — localStorage-backed symbol list.
	// Live prices arrive via the quotes store (SSE relay on the backend).

	let symbols = $state<{ symbol: string; name?: string }[]>([]);
	let addMode = $state(false);
	let addValue = $state('');

	onMount(() => {
		symbols = getWatchlist();
		$effect(() => {
			setWatch(symbols.map((s) => s.symbol));
		});
	});

	function add() {
		const sym = addValue.trim().toUpperCase();
		if (!sym) return;
		addToWatchlist({ symbol: sym });
		symbols = getWatchlist();
		addValue = '';
		addMode = false;
	}

	function remove(sym: string) {
		removeFromWatchlist(sym);
		symbols = getWatchlist();
	}
</script>

{#if symbols.length === 0 && !addMode}
	<div class="flex flex-col items-center justify-center gap-3 py-10 text-center">
		<p class="label" style="color: var(--foreground-muted); text-transform: none;">
			No symbols saved yet.
		</p>
		<button class="btn-outline" style="padding: 6px 12px;" onclick={() => (addMode = true)}
			>+ Add symbol</button
		>
	</div>
{:else}
	<div class="flex flex-col" style="gap: 2px;">
		{#each symbols as s}
			<button
				type="button"
				class="flex items-center justify-between gap-3 rounded px-3 py-2 text-left"
				style="background: transparent; border: none; color: var(--foreground); cursor: pointer;"
				onclick={() => goto(`/s/${s.symbol}`)}
				onmouseover={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
				onmouseout={(e) => (e.currentTarget.style.background = 'transparent')}
			>
				<span class="data" style="color: var(--foreground); font-weight: 600;"
					>{s.symbol}</span
				>
				{#if s.name}
					<span class="label truncate" style="flex: 1; text-transform: none;">{s.name}</span>
				{/if}
				{#if quotes[s.symbol]}
					<span
						class="data"
						style="font-size: 0.75rem; transition: color 0.15s; {quotes[s.symbol].dir === 'up' ? 'color: var(--verdict-strong-buy);' : quotes[s.symbol].dir === 'down' ? 'color: var(--verdict-strong-sell);' : 'color: var(--foreground);'}"
						>{formatPrice(quotes[s.symbol].price)}</span
					>
				{/if}
				<span
					class="label"
					style="color: var(--foreground-subtle);"
					onclick={(e) => {
						e.stopPropagation();
						remove(s.symbol);
					}}
					title="Remove"
					>✕</span
				>
			</button>
		{/each}
		{#if addMode}
			<div class="flex gap-2 px-3 py-2">
				<input
					bind:value={addValue}
					placeholder="SYMBOL"
					onkeydown={(e) => {
						if (e.key === 'Enter') add();
						if (e.key === 'Escape') addMode = false;
					}}
					style="flex: 1; background: var(--surface-2); border: 1px solid var(--panel-border); border-radius: 6px; color: var(--foreground); padding: 6px 10px; font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; outline: none;"
				/>
				<button class="btn-primary" style="padding: 6px 12px;" onclick={add}>+</button>
			</div>
		{:else}
			<button
				class="link-crimson"
				style="background: none; border: none; padding: 8px 12px; text-align: left; font-size: 0.68rem;"
				onclick={() => (addMode = true)}
				>+ ADD SYMBOL</button
			>
		{/if}
	</div>
{/if}
