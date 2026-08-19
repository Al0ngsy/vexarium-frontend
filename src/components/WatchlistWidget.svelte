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
			<div
				class="watch-row"
				role="button"
				tabindex="0"
				onclick={() => goto(`/s/${s.symbol}`)}
				onkeydown={(e) => {
					if (e.key === 'Enter') goto(`/s/${s.symbol}`);
				}}
			>
				<span class="watch-sym">{s.symbol}</span>
				<span class="watch-name">{s.name ?? ''}</span>

				{#if quotes[s.symbol]}
					{@const q = quotes[s.symbol]}
					{@const pc = q.prevClose}
					{@const d = pc ? q.price - pc : null}
					{@const pct = pc && d !== null ? (d / pc) * 100 : null}
					<span class="watch-quote">
						<span
							class="watch-price"
							style="color: {q.dir === 'up'
								? 'var(--verdict-strong-buy)'
								: q.dir === 'down'
									? 'var(--verdict-strong-sell)'
									: 'var(--foreground)'};"
							>{formatPrice(q.price)}</span
						>
						{#if d !== null && pct !== null}
							<span
								class="watch-chg"
								style="color: {d >= 0 ? 'var(--verdict-strong-buy)' : 'var(--verdict-strong-sell)'};"
								>{d >= 0 ? '+' : ''}{formatPrice(d)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</span
							>
						{:else}
							<span class="watch-chg q-muted">—</span>
						{/if}
						<span class="watch-prev q-muted">{pc != null ? `prev ${formatPrice(pc)}` : '—'}</span>
					</span>
				{:else}
					<span class="watch-quote q-muted">
						<span class="watch-price">—</span>
						<span class="watch-chg">—</span>
						<span class="watch-prev">—</span>
					</span>
				{/if}

				<button
					type="button"
					class="watch-del"
					title="Remove {s.symbol}"
					onclick={(e) => {
						e.stopPropagation();
						remove(s.symbol);
					}}
					>✕</button
				>
			</div>
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

<style>
	.watch-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 8px;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.12s;
	}
	.watch-row:hover {
		background: var(--surface-2);
	}
	.watch-row:focus-visible {
		outline: 1px solid var(--accent-primary);
		outline-offset: -1px;
	}
	.watch-sym {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.74rem;
		color: var(--foreground);
		width: 56px;
		flex-shrink: 0;
		text-transform: uppercase;
	}
	.watch-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.72rem;
		text-transform: none;
		color: var(--foreground-subtle);
	}
	/* Right-aligned mono number block: price / change / previous close. */
	.watch-quote {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
		font-family: var(--font-mono);
		flex-shrink: 0;
		line-height: 1.15;
	}
	.watch-price {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--foreground);
		transition: color 0.15s;
	}
	.watch-chg {
		font-size: 0.68rem;
	}
	.watch-prev {
		font-size: 0.62rem;
	}
	.q-muted {
		color: var(--foreground-subtle);
	}
	/* Ghost remove button: hidden until the row is hovered/focused. */
	.watch-del {
		background: none;
		border: none;
		color: var(--foreground-subtle);
		font-size: 0.7rem;
		line-height: 1;
		padding: 4px 6px;
		border-radius: 4px;
		cursor: pointer;
		opacity: 0;
		flex-shrink: 0;
		transition: opacity 0.12s;
	}
	.watch-row:hover .watch-del,
	.watch-row:focus-within .watch-del {
		opacity: 1;
	}
	.watch-del:hover {
		color: var(--verdict-strong-sell);
		background: var(--surface-2);
	}
</style>
