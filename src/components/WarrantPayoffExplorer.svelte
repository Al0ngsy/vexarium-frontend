<script lang="ts">
	import { onMount } from 'svelte';
	import { getWarrantValue } from '$lib/api';
	import type { Warrant, WarrantValue } from '$lib/types';

	// Warrant payoff explorer: draggable underlying-price slider showing what the
	// warrant is worth at that price (intrinsic / cover_ratio based).

	let {
		warrant,
		underlying
	}: {
		warrant: Warrant;
		underlying: string;
	} = $props();

	const strike = $derived(warrant.strike ?? 0);
	const coverRatio = $derived(warrant.cover_ratio ?? 1);
	const premium = $derived(warrant.bid ?? 0);
	const isCall = $derived((warrant.exercise_right || 'CALL').toUpperCase() === 'CALL');

	// Slider range centered on strike (±30%).
	const lo = $derived(strike ? Math.round(strike * 0.7) : 0);
	const hi = $derived(strike ? Math.round(strike * 1.3) : 100);
	const mid = $derived(Math.round((lo + hi) / 2));

	let price = $state(0);
	let value = $state<WarrantValue | null>(null);
	let loading = $state(false);

	$effect(() => {
		if (strike) {
			price = Math.round(strike);
			loadValue(price);
		}
	});

	async function loadValue(p: number) {
		loading = true;
		try {
			value = await getWarrantValue(
				warrant.wkn, p, strike, premium, coverRatio, isCall ? 'CALL' : 'PUT'
			);
		} catch {
			value = null;
		} finally {
			loading = false;
		}
	}

	// Payoff curve (intrinsic at expiry).
	const curve = $derived.by(() => {
		if (!strike) return [];
		const pts = [];
		for (let p = lo; p <= hi; p += Math.max(1, Math.round((hi - lo) / 60))) {
			const intrinsic = isCall ? Math.max(p - strike, 0) : Math.max(strike - p, 0);
			pts.push({ x: p, pl: intrinsic / coverRatio - premium });
		}
		return pts;
	});

	const maxAbs = $derived.by(() => {
		let m = 1;
		for (const pt of curve) m = Math.max(m, Math.abs(pt.pl));
		return m || 1;
	});

	const X = (px: number) => ((px - lo) / (hi - lo)) * 100;
	const Y = (pl: number) => 30 - (pl / maxAbs) * 26;
	const polyline = $derived(curve.map((p) => `${X(p.x).toFixed(1)},${Y(p.pl).toFixed(1)}`).join(' '));
	const curX = $derived(X(price));
	const curY = $derived(curve.length ? Y(curve.reduce((a, b) => (Math.abs(b.x - price) < Math.abs(a.x - price) ? b : a)).pl) : 30);

	function fmt(v: number | null | undefined, dp = 2): string {
		if (v === null || v === undefined || isNaN(v)) return '—';
		return `${v.toFixed(dp)}`;
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Contract strip -->
	<div class="flex flex-wrap items-center gap-2">
		<span class="data" style="font-size: 12px; color: var(--foreground-muted)">{warrant.wkn}</span>
		<span class="label" style="color: var(--foreground-muted)">STRIKE {fmt(strike)}</span>
		<span class="label" style="color: var(--foreground-muted)">PREMIUM {fmt(premium, 3)}</span>
		<span class="label" style="color: var(--foreground-muted)">RATIO 1:{coverRatio}</span>
	</div>

	<!-- Payoff graph -->
	<div class="relative" style="height: 240px; background: var(--surface); border: 1px solid var(--panel-border)">
		<svg viewBox="0 0 100 60" preserveAspectRatio="none" class="h-full w-full"
			onclick={(e) => {
				const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
				const frac = (e.clientX - rect.left) / rect.width;
				price = Math.round(lo + frac * (hi - lo));
				loadValue(price);
			}}>
			<line x1="0" y1="30" x2="100" y2="30" stroke="var(--panel-border)" stroke-dasharray="2 2" />
			<path d="M{polyline}" fill="none" stroke="#16a34a" stroke-width="1.5" vector-effect="non-scaling-stroke" />
			<line x1={curX} y1="0" x2={curX} y2="60" stroke="var(--accent-primary)" stroke-width="0.4" stroke-dasharray="1 1" />
			<circle cx={curX} cy={curY} r="1.6" fill="var(--accent-primary)" stroke="var(--white)" stroke-width="0.6" />
		</svg>
		<div class="absolute inset-x-4 bottom-1 flex justify-between data" style="font-size: 9px; color: var(--foreground-subtle)">
			<span>{lo}</span><span>{mid}</span><span>{hi}</span>
		</div>
		<div class="absolute left-2 top-1 flex flex-col data" style="font-size: 9px; color: var(--foreground-subtle); line-height: 1.6">
			<span>+{maxAbs.toFixed(1)}</span><span>$0</span><span>−{maxAbs.toFixed(1)}</span>
		</div>
	</div>

	<!-- Price slider -->
	<div class="flex items-center gap-3">
		<span class="label" style="white-space: nowrap">UNDERLYING</span>
		<input type="range" min={lo} max={hi} step="1" bind:value={price} oninput={() => loadValue(price)} class="flex-1"
			style="accent-color: var(--accent-primary)" />
		<span class="data" style="min-width: 80px; text-align: right">{underlying} @ {price}</span>
	</div>

	<!-- Readouts -->
	<div class="grid grid-cols-4 gap-2">
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">WARRANT VALUE</span>
			<span class="data" style="font-size: 15px; color: var(--foreground)">{loading ? '…' : fmt(value?.estimated_option_price, 3)}</span>
		</div>
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">P/L</span>
			<span class="data" style="font-size: 15px; color: {(value?.estimated_pl ?? 0) >= 0 ? '#16a34a' : '#dc2626'}">{loading ? '…' : fmt(value?.estimated_pl, 3)}</span>
		</div>
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">P/L %</span>
			<span class="data" style="font-size: 15px; color: {(value?.pl_pct ?? 0) >= 0 ? '#16a34a' : '#dc2626'}">{loading ? '…' : fmt((value?.pl_pct ?? 0) * 100, 1)}%</span>
		</div>
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">LEVERAGE</span>
			<span class="data" style="font-size: 15px; color: var(--foreground)">{warrant.leverage ? `${warrant.leverage.toFixed(1)}x` : '—'}</span>
		</div>
	</div>

	<p class="label" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px">
		ESTIMATE — INTRINSIC VALUE AT EXPIRY. NOT GUARANTEED.
	</p>
</div>
