<script lang="ts">
	import InfoPopover from './InfoPopover.svelte';
	import { formatPrice } from '$lib/format';
	import { store } from '$lib/contract.svelte';

	// DEV: the Pro gate was removed during development; before launch re-add
	// the isPro() branch that shows the upgrade panel for free users.
	const chance = $derived(store.chance);

	function barWidth(p: number): string {
		return `${Math.max(0, Math.min(100, p * 100)).toFixed(1)}%`;
	}
	function fmtPL(v: number): string {
		return `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`;
	}
</script>

{#if !store.selectedSymbol}
	<p class="label" style="color: var(--foreground-muted); text-transform: none">
		Select a contract to estimate its chance of profit.
	</p>
{:else if chance}
	<div class="flex flex-col gap-4">
		<div>
			<div class="mb-1 flex items-center justify-between">
				<span class="label" style="color: var(--foreground-muted)">PROB OF PROFIT <InfoPopover title="CHANCE OF PROFIT" content="An ESTIMATE of how likely this trade is to make money, from a Black-Scholes model using the option's implied volatility. Not a guarantee." /></span>
				<span class="data" style="color: {(chance.prob_profit ?? 0) >= 0.5 ? '#34d399' : '#fb923c'}">{(chance.prob_profit * 100).toFixed(0)}%</span>
			</div>
			<div class="h-1.5 w-full overflow-hidden rounded" style="background: var(--surface-3)">
				<div class="h-full rounded" style="width: {barWidth(chance.prob_profit)}; background: #34d399"></div>
			</div>
		</div>
		<div>
			<div class="mb-1 flex items-center justify-between">
				<span class="label" style="color: var(--foreground-muted)">PROB ENDS ITM <InfoPopover title="PROBABILITY OF ITM" content="How likely the option ends 'in the money' (intrinsic value) by expiry." /></span>
				<span class="data" style="color: var(--foreground)">{(chance.prob_itm * 100).toFixed(0)}%</span>
			</div>
			<div class="h-1.5 w-full overflow-hidden rounded" style="background: var(--surface-3)">
				<div class="h-full rounded" style="width: {barWidth(chance.prob_itm)}; background: var(--accent-primary)"></div>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-2 border-t pt-3" style="border-color: var(--panel-border)">
			<div>
				<span class="label block" style="font-size: 9px; color: var(--foreground-muted)">EXPECTED VALUE</span>
				<span class="data" style="font-size: 13px; color: {(chance.expected_value ?? 0) >= 0 ? '#34d399' : '#f87171'}">{fmtPL(chance.expected_value)}</span>
			</div>
			<div>
				<span class="label block" style="font-size: 9px; color: var(--foreground-muted)">BREAKEVEN</span>
				<span class="data" style="font-size: 13px; color: var(--foreground)">{formatPrice(chance.breakeven)}</span>
			</div>
		</div>
		<p class="label" style="color: var(--foreground-subtle); font-size: 10px">ESTIMATE, NOT GUARANTEED.</p>
	</div>
{:else}
	<p class="label" style="color: var(--foreground-muted)">
		{store.chanceError === 'PRO_FEATURE' ? 'Chance of profit is a PRO feature.' : 'Select a contract to estimate its chance of profit.'}
	</p>
{/if}
