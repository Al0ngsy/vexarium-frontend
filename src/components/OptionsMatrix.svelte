<script lang="ts">
	import { getOptionsMatrix } from '$lib/api';
	import type { OptionsMatrixResponse } from '$lib/types';

	// OptionStrat-inspired P/L matrix rendered in Arasaka style: rows = strikes
	// (centered on current price, each with % move), columns = expiry dates,
	// cells = projected P/L colored by magnitude. Supports range + metric modes.

	let {
		symbol,
		contractSymbol,
		onRangeChange
	}: {
		symbol: string;
		contractSymbol: string;
		onRangeChange?: (rangePct: number) => void;
	} = $props();

	let matrix = $state<OptionsMatrixResponse | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let range = $state(5); // percent
	let mode = $state<'pl' | 'pl_pct' | 'value' | 'risk'>('pl');
	let view = $state<'table' | 'graph'>('table');

	$effect(() => {
		if (contractSymbol) loadMatrix();
	});

	async function loadMatrix() {
		if (!contractSymbol) return;
		loading = true;
		error = null;
		try {
			matrix = await getOptionsMatrix(symbol, contractSymbol, range / 100);
		} catch (e) {
			matrix = null;
			error = e instanceof Error ? e.message : 'Matrix failed';
		} finally {
			loading = false;
		}
	}

	// Recompute only when the slider is released (onchange), not on every tick.
	function handleRange() {
		onRangeChange?.(range / 100);
		loadMatrix();
	}

	// Max abs value for color intensity scaling.
	const maxAbs = $derived.by(() => {
		if (!matrix) return 1;
		let m = 1;
		for (const row of matrix.strikes)
			for (const cell of row.cells) m = Math.max(m, Math.abs(cell.pl));
		return m || 1;
	});

	function cellColor(pl: number): string {
		const intensity = Math.min(Math.abs(pl) / maxAbs, 1);
		if (pl >= 0) {
			return `rgba(34,197,94,${0.08 + intensity * 0.5})`;
		}
		return `rgba(220,38,38,${0.08 + intensity * 0.5})`;
	}

	function cellText(pl: number): string {
		return pl >= 0 ? '#bbf7d0' : '#fecaca';
	}

	function cellValue(cell: { pl: number; pl_pct: number; option_value: number }, mode: string): string {
		if (mode === 'pl') return `${cell.pl >= 0 ? '+' : '−'}${Math.abs(cell.pl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
		if (mode === 'pl_pct') return `${(cell.pl_pct * 100).toFixed(1)}%`;
		if (mode === 'value') return `$${cell.option_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
		// risk: % of max loss
		const maxLoss = matrix?.strikes.reduce((m, r) => Math.min(m, r.cells.reduce((c, x) => Math.min(c, x.pl), 0)), 0) ?? 0;
		if (maxLoss >= 0) return '0%';
		return `${Math.min(100, Math.abs(cell.pl / maxLoss) * 100).toFixed(0)}%`;
	}

	function fmtExpiry(exp: string): string {
		try {
			const d = new Date(exp + 'T00:00:00');
			return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		} catch {
			return exp;
		}
	}

	function fmtStrike(s: number): string {
		return s.toFixed(0);
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<span class="label" style="color: var(--foreground-muted)">
			PROFIT / LOSS — {contractSymbol || 'SELECT A CONTRACT'}
		</span>
		<div class="flex gap-1">
			<button type="button" onclick={() => (view = 'table')}
				class="px-3 py-1 label rounded-lg" style="border: 1px solid {view === 'table' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {view === 'table' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {view === 'table' ? 'var(--accent-white)' : 'var(--foreground-muted)'};">TABLE</button>
			<button type="button" onclick={() => (view = 'graph')}
				class="px-3 py-1 label rounded-lg" style="border: 1px solid {view === 'graph' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {view === 'graph' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {view === 'graph' ? 'var(--accent-white)' : 'var(--foreground-muted)'};">GRAPH</button>
		</div>
	</div>

	{#if loading}
		<div class="flex h-40 items-center justify-center"><span class="label" style="color: var(--foreground-muted)">LOADING MATRIX…</span></div>
	{:else if error}
		<p class="label" style="color: var(--accent-primary)">{error}</p>
	{:else if matrix && matrix.strikes.length > 0}
		{#if view === 'table'}
			<div class="overflow-x-auto">
				<table class="w-full" style="border-collapse: collapse; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
					<thead>
						<tr>
							<th class="px-2 py-2 text-left" style="color: var(--foreground-muted); border-bottom: 1px solid var(--border);">STRIKE</th>
							{#each matrix.expiries as exp}
								<th class="px-2 py-2 text-center" style="color: var(--foreground-muted); border-bottom: 1px solid var(--border);">{fmtExpiry(exp)}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each matrix.strikes as row (row.strike)}
							<tr style="border-bottom: 1px solid var(--border); background: {row.strike === matrix.current_price ? 'var(--surface-2)' : 'transparent'};">
								<td class="px-2 py-1" style="color: var(--foreground);">
									{fmtStrike(row.strike)}
									<span class="label" style="color: var(--foreground-subtle); font-size: 9px;"> {row.move_pct >= 0 ? '+' : '−'}{Math.abs(row.move_pct).toFixed(1)}%</span>
								</td>
								{#each row.cells as cell}
									<td class="px-2 py-1 text-center" style="color: {cellText(cell.pl)}; background: {cellColor(cell.pl)};">
										{cellValue(cell, mode)}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<!-- GRAPH VIEW: payoff curve for the ATM strike across expiries -->
			{@const m = matrix!}
			<div class="relative" style="height: 240px; background: var(--surface); border: 1px solid var(--panel-border)">
				{#if m.strikes.length > 0}
					{@const maxAbs = Math.max(
						1,
						...m.strikes.flatMap((r) => r.cells.map((c) => Math.abs(c.pl)))
					)}
					{@const X = (i: number, n: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)}
					{@const Y = (pl: number) => 30 - (pl / maxAbs) * 25}
					<!-- zero line -->
					<svg viewBox="0 0 100 60" preserveAspectRatio="none" class="h-full w-full">
						<line x1="0" y1="30" x2="100" y2="30" stroke="var(--panel-border)" stroke-dasharray="2 2" />
						{#each m.expiries as exp, i}
							{@const atm = m.strikes.reduce((a, b) =>
								Math.abs(b.strike - m.current_price) < Math.abs(a.strike - m.current_price) ? b : a
							)}
							{@const cell = atm.cells.find((c) => c.expiry === exp)}
							<circle
								cx={X(i, m.expiries.length)}
								cy={Y(cell ? cell.pl : 0)}
								r="1.6"
								fill={(cell ? cell.pl : 0) >= 0 ? '#34d399' : '#f87171'}
							/>
						{/each}
						{#if m.expiries.length > 1}
							<path
								d={m.expiries
									.map((exp, i) => {
										const atm = m.strikes.reduce((a, b) =>
											Math.abs(b.strike - m.current_price) < Math.abs(a.strike - m.current_price) ? b : a
										);
										const cell = atm.cells.find((c) => c.expiry === exp);
										const x = X(i, m.expiries.length);
										const y = Y(cell ? cell.pl : 0);
										return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
									})
									.join(' ')}
								fill="none" stroke="var(--accent-primary)" stroke-width="1.5" vector-effect="non-scaling-stroke"
							/>
						{/if}
					</svg>
					<div class="absolute inset-x-4 bottom-1 flex justify-between label" style="font-size: 9px; color: var(--foreground-subtle)">
						{#each m.expiries as exp}<span>{fmtExpiry(exp)}</span>{/each}
					</div>
				{:else}
					<p class="label" style="color: var(--foreground-subtle); text-transform: none">
						Select a contract to see the payoff curve.
					</p>
				{/if}
			</div>
		{/if}

		<!-- Range + metric mode -->
		<div class="mt-2 flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<span class="label" style="white-space: nowrap">RANGE</span>
				<input type="range" min="1" max="15" step="1" bind:value={range} onchange={handleRange} style="accent-color: var(--accent-primary); width: 140px;" />
				<span class="data" style="font-size: 11px;">±{range}%</span>
			</div>
			<div class="flex gap-1">
				<button type="button" onclick={() => (mode = 'pl')} class="px-2 py-1 label" style="border: 1px solid {mode === 'pl' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'pl' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">P/L $</button>
				<button type="button" onclick={() => (mode = 'pl_pct')} class="px-2 py-1 label" style="border: 1px solid {mode === 'pl_pct' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'pl_pct' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">P/L %</button>
				<button type="button" onclick={() => (mode = 'value')} class="px-2 py-1 label" style="border: 1px solid {mode === 'value' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'value' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">VALUE</button>
				<button type="button" onclick={() => (mode = 'risk')} class="px-2 py-1 label" style="border: 1px solid {mode === 'risk' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'risk' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">% RISK</button>
			</div>
		</div>
	{:else}
		<p class="label" style="color: var(--foreground-subtle); text-transform: none">
			Select a contract to see the P/L matrix.
		</p>
	{/if}
</div>
