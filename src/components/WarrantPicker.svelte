<script lang="ts">
	import type { Warrant } from '$lib/types';

	// Warrant picker: CALL/PUT toggle -> STRIKE ladder centered on current
	// underlying price (shows leverage, omega, bid/ask, maturity).
	// onSelect emits the full Warrant record.

	let {
		warrants,
		underlying,
		onSelect
	}: {
		warrants: Warrant[];
		underlying: string;
		onSelect: (w: Warrant) => void;
	} = $props();

	let right = $state<'CALL' | 'PUT'>('CALL');
	let selectedWkn = $state('');

	const filtered = $derived(
		warrants.filter((w) => (w.exercise_right || 'CALL').toUpperCase() === right)
	);

	function pick(w: Warrant) {
		selectedWkn = w.wkn;
		onSelect(w);
	}
</script>

<div class="flex flex-col gap-5">
	<!-- CALL / PUT toggle -->
	<div>
		<span class="label block mb-2">TYPE</span>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => (right = 'CALL')}
				class="flex-1 px-3 py-2 label text-center"
				style="border: 1px solid {right === 'CALL' ? '#16a34a' : 'var(--panel-border)'}; background-color: {right === 'CALL' ? 'rgba(22,163,74,0.08)' : 'var(--surface)'}; color: {right === 'CALL' ? '#16a34a' : 'var(--foreground-muted)'};"
			>
				CALL
			</button>
			<button
				type="button"
				onclick={() => (right = 'PUT')}
				class="flex-1 px-3 py-2 label text-center"
				style="border: 1px solid {right === 'PUT' ? '#dc2626' : 'var(--panel-border)'}; background-color: {right === 'PUT' ? 'rgba(220,38,38,0.08)' : 'var(--surface)'}; color: {right === 'PUT' ? '#dc2626' : 'var(--foreground-muted)'};"
			>
				PUT
			</button>
		</div>
	</div>

	<!-- Warrant ladder -->
	<div>
		<span class="label block mb-2">WARRANTS · {right}</span>
		{#if filtered.length > 0}
			<div class="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
				{#each filtered as w (w.wkn)}
					<button
						type="button"
						onclick={() => pick(w)}
						class="flex flex-col px-3 py-2 text-left"
						style="border: 1px solid {selectedWkn === w.wkn ? 'var(--accent-primary)' : 'var(--panel-border)'}; background-color: {selectedWkn === w.wkn ? 'rgba(200,30,30,0.1)' : 'var(--surface)'}; box-shadow: {selectedWkn === w.wkn ? 'inset 0 0 0 1px var(--accent-primary)' : 'none'};"
					>
						<div class="flex items-center justify-between gap-2">
							<span class="data" style="font-size: 13px; color: var(--foreground)">
								{w.strike != null ? `${w.strike.toFixed(2)}` : '—'}
							</span>
							<span class="data" style="font-size: 11px; color: var(--foreground-muted)">
								{w.strike_pct != null ? `${w.strike_pct.toFixed(1)}%` : ''}
							</span>
							<span class="data" style="font-size: 11px; color: var(--foreground)">
								{w.bid != null ? `${w.bid.toFixed(3)}` : '—'}
							</span>
						</div>
						<div class="mt-1 flex flex-wrap gap-2">
							{#if w.leverage != null}<span class="label" style="font-size: 9px; color: var(--foreground-muted)">LEV {w.leverage.toFixed(1)}x</span>{/if}
							{#if w.omega != null}<span class="label" style="font-size: 9px; color: var(--foreground-muted)">OMEGA {w.omega.toFixed(1)}</span>{/if}
							{#if w.maturity}<span class="label" style="font-size: 9px; color: var(--foreground-muted)">MAT {w.maturity.slice(0, 7)}</span>{/if}
							<span class="label" style="font-size: 9px; color: var(--foreground-subtle)">{w.wkn}</span>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<div class="rounded border px-3 py-2 label" style="border-color: var(--panel-border); color: var(--foreground-subtle);">
				NO {right} WARRANTS FOR {underlying}.
			</div>
		{/if}
	</div>
</div>
