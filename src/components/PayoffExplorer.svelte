<script lang="ts">
	import { onMount } from 'svelte';
	import { getOptionValueAtPrice } from '$lib/api';
	import { formatPrice } from '$lib/format';
	import type { OptionValueAtPrice } from '$lib/types';

	// Concept C payoff explorer: payoff graph + draggable price slider + readouts.
	// The user drags the underlying price (or clicks the chart) to see what the
	// option is worth at that price / date.

	let {
		symbol,
		contractSymbol,
		contract,
		currentPrice,
		strike,
		isCall,
		expiry,
		premium,
		breakeven
	}: {
		symbol: string;
		contractSymbol: string;
		contract: string | null;
		currentPrice: number | null;
		strike: number | null;
		isCall: boolean | null;
		expiry: string | null;
		premium: number | null;
		breakeven: number | null;
	} = $props();

	// Slider range: current price ±15%.
	const lo = $derived(currentPrice ? Math.round(currentPrice * 0.85) : 0);
	const hi = $derived(currentPrice ? Math.round(currentPrice * 1.15) : 100);
	const mid = $derived(currentPrice ? Math.round(currentPrice) : 0);

	let price = $state(0);
	let dte = $state(0); // target date offset in days from today
	let value = $state<OptionValueAtPrice | null>(null);
	let loading = $state(false);
	let boxW = $state(0);

	// Initialize the slider only when the contract changes (not on every premium
	// update). Keeping a stable key in the parent is the primary fix, but this
	// guards against re-init on unrelated prop churn (e.g. premium arriving late).
	let lastContract = $state('');
	$effect(() => {
		if (contractSymbol && contractSymbol !== lastContract) {
			lastContract = contractSymbol;
			dte = 0;
			if (currentPrice) {
				price = Math.round(currentPrice);
				loadValue(price);
			}
		}
	});

	const DAY_MS = 86400000;
	// Days from today to the contract expiry; dates are 'YYYY-MM-DD' (UTC).
	const daysToExpiry = $derived(
		expiry ? Math.max(0, Math.round((new Date(expiry + 'T00:00:00').getTime() - Date.now()) / DAY_MS)) : 0
	);
	const targetDate = $derived(
		dte > 0 ? new Date(Date.now() + dte * DAY_MS).toISOString().slice(0, 10) : undefined
	);

	async function loadValue(p: number) {
		if (!contractSymbol) return;
		loading = true;
		try {
			value = await getOptionValueAtPrice(symbol, contractSymbol, p, targetDate);
		} catch {
			value = null;
		} finally {
			loading = false;
		}
	}

	function onSlider() {
		loadValue(price);
	}

	function onDateSlider() {
		loadValue(price);
	}

	function fmtTargetDate(): string {
		if (!targetDate) return 'Today';
		const d = new Date(targetDate + 'T00:00:00');
		return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${dte}d`;
	}

	// Build the payoff curve for the chart (intrinsic at expiry per price point).
	const curve = $derived.by(() => {
		if (!strike || !premium || isCall === null || isCall === undefined) return [];
		const pts = [];
		for (let p = lo; p <= hi; p += 1) {
			const intrinsic = isCall ? Math.max(p - strike, 0) : Math.max(strike - p, 0);
			pts.push({ x: p, pl: intrinsic - premium });
		}
		return pts;
	});

	const maxAbs = $derived.by(() => {
		let m = 1;
		for (const pt of curve) m = Math.max(m, Math.abs(pt.pl));
		return m || 1;
	});

	// SVG geometry: viewBox width matches the container's real aspect so the
	// curve is never stretched (container is 240px tall, w-full wide).
	const viewW = $derived(boxW > 0 ? Math.max((60 * boxW) / 240, 60) : 100);
	const X = (px: number) => ((px - lo) / (hi - lo)) * viewW;
	const Y = (pl: number) => 30 - (pl / maxAbs) * 26;
	const polyline = $derived(curve.map((p) => `${X(p.x).toFixed(1)},${Y(p.pl).toFixed(1)}`).join(' '));
	const curX = $derived(X(price));
	const curY = $derived(curve.length ? Y(curve.reduce((a, b) => (Math.abs(b.x - price) < Math.abs(a.x - price) ? b : a)).pl) : 30);

	function formatPL(v: number): string {
		return `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Contract strip -->
	<div class="flex flex-wrap items-center gap-2">
		<span class="data" style="font-size: 12px; color: var(--foreground-muted)">{contractSymbol || '—'}</span>
		<span class="label" style="color: var(--foreground-muted)">PREMIUM {formatPrice(premium)}</span>
		<span class="label" style="color: var(--foreground-muted)">BREAKEVEN {formatPrice(breakeven)}</span>
	</div>

	<!-- Payoff graph -->
	<div class="relative" bind:clientWidth={boxW} style="height: 240px; background: var(--surface); border: 1px solid var(--panel-border)">
		<svg viewBox={`0 0 ${viewW.toFixed(1)} 60`} preserveAspectRatio="none" class="h-full w-full"
			onclick={(e) => {
				const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
				const frac = (e.clientX - rect.left) / rect.width;
				const p = Math.round(lo + frac * (hi - lo));
				price = p;
				loadValue(p);
			}}>
			<!-- zero line -->
			<line x1="0" y1="30" x2={viewW.toFixed(1)} y2="30" stroke="var(--panel-border)" stroke-dasharray="2 2" />
			<!-- payoff curve -->
			<path d="M{polyline}" fill="none" stroke="#34d399" stroke-width="1.5" vector-effect="non-scaling-stroke" />
			<!-- breakeven marker -->
			{#if breakeven && breakeven >= lo && breakeven <= hi}
				<circle cx={X(breakeven)} cy="30" r="1.4" fill="var(--foreground)" />
				<text x={X(breakeven)} y="56" fill="var(--foreground-muted)" font-size="3" text-anchor="middle">BE</text>
			{/if}
			<!-- current price line -->
			<line x1={curX} y1="0" x2={curX} y2="60" stroke="var(--accent-primary)" stroke-width="0.4" stroke-dasharray="1 1" />
			<circle cx={curX} cy={curY} r="1.6" fill="var(--accent-primary)" stroke="var(--white)" stroke-width="0.6" />
		</svg>
		<div class="absolute inset-x-4 bottom-1 flex justify-between data" style="font-size: 9px; color: var(--foreground-subtle)">
			<span>${lo}</span><span>${mid}</span><span>${hi}</span>
		</div>
		<div class="absolute left-2 top-1 flex flex-col data" style="font-size: 9px; color: var(--foreground-subtle); line-height: 1.6">
			<span>+${maxAbs.toFixed(0)}</span><span>$0</span><span>−${maxAbs.toFixed(0)}</span>
		</div>
		<div class="absolute right-2 top-1 label" style="font-size: 9px; color: var(--foreground-subtle)">
			Payoff at expiry
		</div>
	</div>

	<!-- Price slider -->
	<div class="flex items-center gap-3">
		<span class="label" style="white-space: nowrap">PRICE</span>
		<input type="range" min={lo} max={hi} step="1" bind:value={price} oninput={onSlider} class="flex-1"
			style="accent-color: var(--accent-primary)" />
		<span class="data" style="min-width: 90px; text-align: right">
			{formatPrice(price)} <span class="label" style="color: var(--foreground-muted)">
				{currentPrice ? `${((price - currentPrice) / currentPrice * 100).toFixed(1)}%` : ''}
			</span>
		</span>
	</div>

	<!-- Target date slider: today -> expiry -->
	{#if daysToExpiry > 0}
		<div class="flex items-center gap-3">
			<span class="label" style="white-space: nowrap">DATE</span>
			<input type="range" min="0" max={daysToExpiry} step="1" bind:value={dte} oninput={onDateSlider} class="flex-1"
				style="accent-color: var(--accent-primary)" />
			<span class="data" style="min-width: 90px; text-align: right">{fmtTargetDate()}</span>
		</div>
	{/if}

	<!-- Readouts -->
	<div class="grid grid-cols-4 gap-2">
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">OPTION VALUE</span>
			<span class="data" style="font-size: 15px; color: var(--foreground)">
				{loading ? '…' : formatPrice(value?.estimated_option_price ?? premium)}
			</span>
		</div>
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">P/L</span>
			<span class="data" style="font-size: 15px; color: {(value?.estimated_pl ?? 0) >= 0 ? '#34d399' : '#f87171'}">
				{loading ? '…' : formatPL(value?.estimated_pl ?? 0)}
			</span>
		</div>
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">P/L %</span>
			<span class="data" style="font-size: 15px; color: {(value?.pl_pct ?? 0) >= 0 ? '#34d399' : '#f87171'}">
				{loading ? '…' : `${(value?.pl_pct ?? 0) >= 0 ? '+' : '−'}${Math.abs((value?.pl_pct ?? 0) * 100).toFixed(1)}%`}
			</span>
		</div>
		<div class="p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block" style="font-size: 9px">DTE</span>
			<span class="data" style="font-size: 15px; color: var(--foreground)">
				{value?.days_to_expiry ?? '—'}
			</span>
		</div>
	</div>

	<p class="label" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px">
		ESTIMATE VIA BLACK-SCHOLES, NOT GUARANTEED.
	</p>
</div>
