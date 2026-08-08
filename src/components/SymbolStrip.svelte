<script lang="ts">
	import type { AnalysisResponse } from '$lib/types';
	import { formatPrice } from '$lib/format';
	import { VERDICT_COLORS, VERDICT_LABELS, VERDICT_ICONS } from '$lib/verdict';
	import { quotes, setWatch } from '$lib/quotes.svelte';

	// Full-width symbol strip: name · price · verdict · grade · actions.
	let {
		analysis,
		symbol,
		onSave,
		optionsHref = `/options/${symbol}`
	}: {
		analysis: AnalysisResponse;
		symbol: string;
		onSave?: () => void;
		optionsHref?: string;
	} = $props();

	$effect(() => {
		setWatch([symbol]);
	});

	// Live quote overrides the analysis price when a tick has arrived.
	const live = $derived(quotes[symbol] ?? null);
	const shownPrice = $derived(live?.price ?? analysis.current_price);

	const co = $derived(analysis.company ?? null);
	const currency = $derived(co?.currency ?? null);
	const gradeLetter = $derived.by(() => {
		const s = analysis.overall?.score ?? 0;
		if (s >= 7) return 'A';
		if (s >= 4) return 'B+';
		if (s >= 1) return 'B';
		if (s >= -1) return 'C';
		if (s >= -4) return 'D';
		return 'F';
	});
	const verdict = $derived(analysis.overall?.overall_verdict ?? 'hold');
	const vColor = $derived(VERDICT_COLORS[verdict]);

	// 52-week position (if company data present).
	const rangePos = $derived.by(() => {
		if (!co || co.low_52w == null || co.high_52w == null || analysis.current_price == null)
			return null;
		const range = co.high_52w - co.low_52w;
		if (range <= 0) return null;
		return Math.min(100, Math.max(0, ((analysis.current_price - co.low_52w) / range) * 100));
	});

	// Day change from the new analysis.day_change_pct field; hide the line if absent.
	const dayChange = $derived.by(() => {
		const pct = analysis.day_change_pct;
		if (pct == null || analysis.current_price == null) return null;
		return { abs: (analysis.current_price * pct) / 100, pct };
	});
</script>

<div class="sym-strip">
	<div>
		<div class="sym-name" style="font-size: 1.1rem; font-weight: 600; letter-spacing: -0.01em;">
			{co?.name ?? symbol}
		</div>
		<div class="sym-ticker" style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--foreground-subtle);">
			{symbol} · {co?.exchange ?? 'NASDAQ'} · {analysis.asset_type?.toUpperCase() ?? 'STOCK'}
		</div>
	</div>

	<div>
		<div
			class="data"
			style="font-size: 1.4rem; font-weight: 600; color: {live?.dir === 'up'
				? 'var(--verdict-strong-buy)'
				: live?.dir === 'down'
					? 'var(--verdict-strong-sell)'
					: 'var(--foreground)'}; transition: color 0.15s;"
		>
			{formatPrice(shownPrice, currency)}
		</div>
		{#if dayChange}
			<div
				style="font-family: var(--font-mono); font-size: 0.78rem; color: {dayChange.abs >= 0
					? 'var(--verdict-strong-buy)'
					: 'var(--verdict-strong-sell)'};"
			>
				{dayChange.abs >= 0 ? '▲' : '▼'}
				{dayChange.abs >= 0 ? '+' : '−'}{Math.abs(dayChange.abs).toFixed(2)}
				({dayChange.pct < 0 ? '−' : ''}{Math.abs(dayChange.pct).toFixed(2)}%)
			</div>
		{/if}
	</div>

	{#if rangePos !== null}
		<div style="flex: 1; max-width: 240px; display: flex; flex-direction: column; gap: 4px;">
			<div class="label" style="font-size: 0.64rem;">52-week range</div>
			<div style="height: 4px; background: var(--surface-2); border-radius: 2px; position: relative; border: 1px solid var(--panel-border);">
				<div
					style="position: absolute; top: -1px; left: 0; height: 6px; width: {rangePos}%; background: linear-gradient(90deg, var(--verdict-strong-sell), var(--verdict-hold), var(--verdict-strong-buy)); border-radius: 2px;"
				></div>
				<div
					style="position: absolute; top: -4px; left: {rangePos}%; width: 10px; height: 12px; background: var(--foreground); border-radius: 2px; transform: translateX(-50%);"
				></div>
			</div>
			<div class="labels" style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.66rem; color: var(--foreground-subtle);">
				<span>{formatPrice(co?.low_52w, currency)}</span>
				<span>{formatPrice(co?.high_52w, currency)}</span>
			</div>
		</div>
	{/if}

	<span
		class="verdict-badge"
		style="border-color: {vColor}; color: {vColor};"
		title={analysis.overall?.indicator_count
			? `${analysis.overall.indicator_count} indicators`
			: ''}
	>
		<span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
		{VERDICT_LABELS[verdict]} {VERDICT_ICONS[verdict]}
	</span>

	<span
		class="grade"
		style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--panel-border); font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600;"
	>
		<span style="color: {vColor};">{gradeLetter}</span>
		<span style="color: var(--foreground-subtle); font-size: 0.66rem;">
			{analysis.overall?.breakdown?.length ?? 0} checks
		</span>
	</span>

	<div style="margin-left: auto; display: flex; gap: 8px; align-items: center;">
		{#if onSave}
			<button class="btn" style="background: var(--surface-2); border: 1px solid var(--panel-border); color: var(--foreground); padding: 7px 14px; border-radius: 6px; font-size: 0.72rem; cursor: pointer;" onclick={onSave}>
				Save trade
			</button>
		{/if}
		<a
			href={optionsHref}
			class="btn-primary"
			style="padding: 7px 14px; border-radius: 6px; font-size: 0.72rem; text-decoration: none;"
			>Options →</a
		>
	</div>
</div>
