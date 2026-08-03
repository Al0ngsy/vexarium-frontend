<script lang="ts">
	import type { StrategyCard as Strategy } from '$lib/types';
	import InfoPopover from './InfoPopover.svelte';
	import PayoffChart from './PayoffChart.svelte';
	import { BREAKEVEN_COLOR } from '$lib/chart-theme';

	let { strategy }: { strategy: Strategy } = $props();

	// Beginner-friendly explanations keyed by strategy name.
	const EXPLANATIONS: Record<string, string> = {
		'LONG CALL':
			'You buy a call option. Profit if price rises above the breakeven. Max loss = premium paid.',
		'CASH-SECURED PUT':
			'You sell a put and set aside cash to buy shares if assigned. Profit if price stays above the strike minus premium.',
		'COVERED CALL':
			'You own shares and sell a call against them. Collect premium; upside capped at the strike.',
		'SHORT PUT': 'You sell a put to collect premium. Profit if price stays above breakeven.',
		'BULL CALL SPREAD': 'Buy a lower-strike call, sell a higher-strike call. Capped upside and loss.'
	};

	function explanation(): string {
		return (
			EXPLANATIONS[strategy.name.toUpperCase()] ??
			'This options strategy combines one or more option contracts with defined risk and reward.'
		);
	}

	function fmt(v: number | null): string {
		if (v === null || v === undefined) return '—';
		return `$${v.toFixed(2)}`;
	}

	// return_on_risk is a ratio (0..1); show as %.
	function rorPct(): number | null {
		if (strategy.return_on_risk === null || strategy.return_on_risk === undefined) return null;
		return strategy.return_on_risk * 100;
	}

	const rorColor = $derived(
		strategy.return_on_risk !== null && strategy.return_on_risk !== undefined
			? strategy.return_on_risk > 0.15
				? '#ea580c'
				: '#dc2626'
			: 'var(--foreground-muted)'
	);

	// Payoff curve points feed the mini chart (x = price, y = P/L).
	const curve = $derived(
		strategy.payoff_curve.map((p) => ({
			price: p.estimated_option_price,
			pl: p.estimated_pl
		}))
	);
</script>

<div class="panel flex flex-col p-4" style="border-color: var(--panel-border)">
	<div class="mb-1 flex items-start justify-between gap-2">
		<span class="label" style="color: var(--foreground)">{strategy.name}</span>
		<InfoPopover title={strategy.name} content={explanation()} />
	</div>
	<p class="label mb-3" style="color: var(--foreground-muted); text-transform: none; line-height: 1.5">
		{strategy.subtitle}
	</p>

	<div class="mb-3">
		<PayoffChart points={curve} height={110} />
	</div>

	<div class="grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3" style="border-color: var(--panel-border)">
		<div>
			<span class="label block">RETURN ON RISK</span>
			<span class="data" style="color: {rorColor}">
				{rorPct() === null ? '—' : `${rorPct()!.toFixed(1)}%`}
			</span>
		</div>
		<div>
			<span class="label block">MAX PROFIT</span>
			<span class="data" style="color: var(--foreground)">{fmt(strategy.max_profit)}</span>
		</div>
		<div>
			<span class="label block">MAX LOSS</span>
			<span class="data" style="color: var(--foreground)">{fmt(strategy.max_loss)}</span>
		</div>
		<div>
			<span class="label block">BREAKEVEN</span>
			<span class="data" style="color: {BREAKEVEN_COLOR}">{fmt(strategy.breakeven)}</span>
		</div>
	</div>
</div>
