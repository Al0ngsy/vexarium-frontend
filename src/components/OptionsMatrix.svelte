<script lang="ts">
	import { getOptionsMatrix } from '$lib/api';
	import { positionTip, clearTip } from '$lib/tooltip';
	import type { OptionsMatrixResponse } from '$lib/types';

	// OptionStrat-inspired P/L matrix: rows = strikes
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
	let dates = $state(8); // date columns
	let mode = $state<'pl' | 'pl_pct' | 'value' | 'risk'>('pl');
	let view = $state<'table' | 'graph'>('table');
	let boxW = $state(0);

	$effect(() => {
		if (contractSymbol) loadMatrix();
	});

	async function loadMatrix() {
		if (!contractSymbol) return;
		loading = true;
		error = null;
		try {
			matrix = await getOptionsMatrix(symbol, contractSymbol, range / 100, 100, dates);
		} catch (e) {
			// Keep the previous matrix visible on refresh errors; only a first
			// load failure ends with matrix === null (error branch shows).
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

	// SVG viewBox width matching the real container aspect (240px tall).
	const viewW = $derived(boxW > 0 ? Math.max((60 * boxW) / 240, 60) : 100);

	// Max abs value for color intensity scaling.
	const maxAbs = $derived.by(() => {
		if (!matrix) return 1;
		let m = 1;
		for (const row of matrix.strikes)
			for (const cell of row.cells) m = Math.max(m, Math.abs(cell.pl));
		return m || 1;
	});

	// Row closest to ATM: minimal |move_pct| (float equality never fires).
	const atmStrike = $derived(
		matrix && matrix.strikes.length > 0
			? matrix.strikes.reduce((a, b) => (Math.abs(b.move_pct) < Math.abs(a.move_pct) ? b : a))
					.strike
			: null
	);

	// Graph-view geometry: the ATM row's P/L across the date columns, plus
	// profit/loss area fills split at the zero line.
	const graphMax = $derived.by(() => {
		const m = matrix;
		if (!m) return 1;
		let mx = 1;
		for (const r of m.strikes) for (const c of r.cells) mx = Math.max(mx, Math.abs(c.pl));
		return mx || 1;
	});

	const graphPts = $derived.by(() => {
		const m = matrix;
		if (!m || m.strikes.length === 0) return [] as { x: number; y: number; pl: number }[];
		const n = m.expiries.length;
		const atm = m.strikes.reduce((a, b) =>
			Math.abs(b.strike - m.current_price) < Math.abs(a.strike - m.current_price) ? b : a
		);
		return m.expiries.map((exp, i) => {
			const cell = atm.cells.find((c) => c.expiry === exp);
			const pl = cell ? cell.pl : 0;
			const x = n === 1 ? viewW / 2 : (i / (n - 1)) * viewW;
			const y = 30 - (pl / graphMax) * 25;
			return { x, y, pl };
		});
	});

	function buildAreas(pts: { x: number; y: number; pl: number }[], sign: number): string[] {
		const paths: string[] = [];
		let seg: { x: number; y: number; pl: number }[] = [];
		for (const p of pts) {
			const inSign = sign > 0 ? p.pl >= 0 : p.pl <= 0;
			if (inSign) {
				seg.push(p);
			} else if (seg.length) {
				// Linearly interpolate the zero crossing between the last
				// in-sign point and this out-of-sign point.
				const q = seg[seg.length - 1];
				const t = q.pl / (q.pl - p.pl);
				seg.push({ x: q.x + (p.x - q.x) * t, y: 30, pl: 0 });
				paths.push(areaPath(seg));
				seg = [];
			}
		}
		if (seg.length > 1) paths.push(areaPath(seg));
		return paths;
	}

	function areaPath(seg: { x: number; y: number }[]): string {
		const pts = seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
		return `M ${seg[0].x.toFixed(1)},30 L ${pts} L ${seg[seg.length - 1].x.toFixed(1)},30 Z`;
	}

	const profitAreas = $derived(buildAreas(graphPts, 1));
	const lossAreas = $derived(buildAreas(graphPts, -1));
	const graphLine = $derived(
		graphPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
	);

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
			PROFIT / LOSS, {contractSymbol || 'SELECT A CONTRACT'}
		</span>
		<div class="flex gap-1">
			<button type="button" onclick={() => (view = 'table')}
				class="px-3 py-1 label rounded-lg" style="border: 1px solid {view === 'table' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {view === 'table' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {view === 'table' ? 'var(--accent-white)' : 'var(--foreground-muted)'};">TABLE</button>
			<button type="button" onclick={() => (view = 'graph')}
				class="px-3 py-1 label rounded-lg" style="border: 1px solid {view === 'graph' ? 'var(--accent-primary)' : 'var(--panel-border)'}; background: {view === 'graph' ? 'var(--accent-primary)' : 'var(--surface)'}; color: {view === 'graph' ? 'var(--accent-white)' : 'var(--foreground-muted)'};">GRAPH</button>
		</div>
	</div>

	{#if !matrix && loading}
		<div class="flex h-40 items-center justify-center"><span class="label" style="color: var(--foreground-muted)">LOADING MATRIX…</span></div>
	{:else if !matrix && error}
		<p class="label" style="color: var(--accent-primary)">{error}</p>
	{:else if matrix && matrix.strikes.length > 0}
		{#if error}
			<p class="label" style="color: var(--accent-primary)">{error}</p>
		{/if}
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
							<tr style="border-bottom: 1px solid var(--border); background: {row.strike === atmStrike ? 'var(--surface-2)' : 'transparent'};">
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
			<!-- GRAPH VIEW: ATM payoff curve across dates with profit/loss areas -->
			<div class="relative" bind:clientWidth={boxW} style="height: 240px; background: var(--surface); border: 1px solid var(--panel-border)">
				{#if graphPts.length > 0}
					<svg viewBox={`0 0 ${viewW.toFixed(1)} 60`} preserveAspectRatio="none" class="h-full w-full">
						{#each lossAreas as d}
							<path d={d} fill="rgba(248,113,113,0.18)" stroke="none" />
						{/each}
						{#each profitAreas as d}
							<path d={d} fill="rgba(52,211,153,0.18)" stroke="none" />
						{/each}
						<!-- zero line -->
						<line x1="0" y1="30" x2={viewW.toFixed(1)} y2="30" stroke="var(--panel-border)" stroke-dasharray="2 2" />
						{#if graphLine}
							<path d={graphLine} fill="none" stroke="var(--accent-primary)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
						{/if}
						{#each graphPts as p}
							<circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2" fill={p.pl >= 0 ? '#34d399' : '#f87171'} />
						{/each}
					</svg>
					<div class="absolute inset-x-4 bottom-1 flex justify-between label" style="font-size: 9px; color: var(--foreground-subtle)">
						{#each matrix!.expiries as exp}<span>{fmtExpiry(exp)}</span>{/each}
					</div>
					<div class="absolute left-2 top-1 flex flex-col data" style="font-size: 9px; color: var(--foreground-subtle); line-height: 1.6">
						<span>+{graphMax.toFixed(0)}</span><span>$0</span><span>−{graphMax.toFixed(0)}</span>
					</div>
				{:else}
					<p class="label" style="color: var(--foreground-subtle); text-transform: none">
						Select a contract to see the payoff curve.
					</p>
				{/if}
			</div>
		{/if}

	{:else}
		<p class="label" style="color: var(--foreground-subtle); text-transform: none">
			Select a contract to see the P/L matrix.
		</p>
	{/if}

	{#if contractSymbol}
		<!-- Range + metric mode: rendered outside the loading branch so the
		     slider stays mounted while the matrix refreshes. -->
		<div class="mt-2 flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<span class="label" style="white-space: nowrap">RANGE</span>
				<input type="range" min="1" max="15" step="1" bind:value={range} onchange={handleRange} style="accent-color: var(--accent-primary); width: 140px;" />
				<span class="data" style="font-size: 11px;">±{range}%</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="label" style="white-space: nowrap">DATES</span>
				<input type="range" min="2" max="16" step="1" bind:value={dates} onchange={handleRange} style="accent-color: var(--accent-primary); width: 140px;" />
				<span class="data" style="font-size: 11px;">{dates} steps</span>
			</div>
		<div class="flex gap-1">
			<span class="indicator-tip" onmouseenter={(e) => positionTip(e.currentTarget)} onmouseleave={(e) => clearTip(e.currentTarget)}>
				<button type="button" onclick={() => (mode = 'pl')} class="px-2 py-1 label" style="border: 1px solid {mode === 'pl' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'pl' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">P/L $</button>
				<span class="tooltip">Estimated profit or loss in dollars if the stock trades at that price on that date.</span>
			</span>
			<span class="indicator-tip" onmouseenter={(e) => positionTip(e.currentTarget)} onmouseleave={(e) => clearTip(e.currentTarget)}>
				<button type="button" onclick={() => (mode = 'pl_pct')} class="px-2 py-1 label" style="border: 1px solid {mode === 'pl_pct' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'pl_pct' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">P/L %</button>
				<span class="tooltip">The same profit or loss as a percentage of the premium paid.</span>
			</span>
			<span class="indicator-tip" onmouseenter={(e) => positionTip(e.currentTarget)} onmouseleave={(e) => clearTip(e.currentTarget)}>
				<button type="button" onclick={() => (mode = 'value')} class="px-2 py-1 label" style="border: 1px solid {mode === 'value' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'value' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">VALUE</button>
				<span class="tooltip">The estimated option value per contract at that price and date.</span>
			</span>
			<span class="indicator-tip" onmouseenter={(e) => positionTip(e.currentTarget)} onmouseleave={(e) => clearTip(e.currentTarget)}>
				<button type="button" onclick={() => (mode = 'risk')} class="px-2 py-1 label" style="border: 1px solid {mode === 'risk' ? 'var(--accent-primary)' : 'var(--panel-border)'}; color: {mode === 'risk' ? 'var(--accent-primary)' : 'var(--foreground-muted)'};">% RISK</button>
				<span class="tooltip">How much of the maximum possible loss is at stake at that price and date.</span>
			</span>
		</div>
			{#if loading}
				<span class="label" style="color: var(--foreground-muted)">Refreshing…</span>
			{/if}
		</div>
	{/if}
</div>
