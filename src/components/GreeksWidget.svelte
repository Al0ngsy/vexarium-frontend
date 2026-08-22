<script lang="ts">
	import InfoPopover from './InfoPopover.svelte';
	import { store } from '$lib/contract.svelte';
	import type { Greeks } from '$lib/types';

	const ITEMS: Array<{ key: keyof Greeks; sym: string; name: string; text: string }> = [
		{
			key: 'delta',
			sym: 'Δ',
			name: 'Delta',
			text: 'How much the option price moves for a $1 move in the stock. Near 1 = moves like the stock; near 0 = barely reacts.'
		},
		{
			key: 'gamma',
			sym: 'Γ',
			name: 'Gamma',
			text: 'How fast delta changes as the stock moves. Higher gamma = the option reacts more violently to price swings.'
		},
		{
			key: 'theta',
			sym: 'Θ',
			name: 'Theta',
			text: 'How much value the option loses per day as time passes. Always works against option buyers (time decay).'
		},
		{
			key: 'vega',
			sym: 'ν',
			name: 'Vega',
			text: 'How much the option price changes when implied volatility moves 1%. Higher vega = more sensitive to volatility.'
		},
		{
			key: 'rho',
			sym: 'ρ',
			name: 'Rho',
			text: 'How much the option price changes when interest rates move 1%. Usually small; matters most for long-dated options.'
		}
	];

	const payoff = $derived(store.payoff);

	function cell(key: string, value: string): string {
		return `border: 1px solid var(--panel-border); background: var(--surface); padding: 8px;`;
	}
</script>

{#if !store.selectedSymbol}
	<p class="label" style="color: var(--foreground-muted); text-transform: none">
		Select a contract to view delta, gamma, theta, vega and rho.
	</p>
{:else if store.payoffLoading && !payoff}
	<p class="label" style="color: var(--foreground-muted)">Loading…</p>
{:else if payoff}
	<!-- Boxes reflow with widget width: 3+ columns wide, 2 columns narrow. -->
	<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px;">
		{#each ITEMS as g}
			<div style={cell(g.key, '')}>
				<div class="mb-1 flex items-center justify-between gap-1">
					<span class="data" style="color: var(--accent-primary); font-size: 13px">{g.sym}</span>
					<InfoPopover title={g.name.toUpperCase()} content={g.text} />
				</div>
				<span class="label block" style="font-size: 9px; color: var(--foreground-muted)">{g.name}</span>
				<span class="data" style="font-size: 13px; color: var(--foreground)">{payoff.greeks[g.key].toFixed(4)}</span>
			</div>
		{/each}
		<div style={cell('iv', '')}>
			<div class="mb-1 flex items-center justify-between gap-1">
				<span class="data" style="color: var(--accent-primary); font-size: 13px">σ</span>
				<InfoPopover title="IMPLIED VOLATILITY" content="The market's forecast of future price movement, annualized. Higher IV = more expensive options." />
			</div>
			<span class="label block" style="font-size: 9px; color: var(--foreground-muted)">Implied vol</span>
			<span class="data" style="font-size: 13px; color: var(--foreground)">{(payoff.implied_volatility * 100).toFixed(1)}%</span>
		</div>
	</div>
{:else if store.payoffError}
	<p class="label" style="color: var(--accent-primary)">{store.payoffError}</p>
{/if}
