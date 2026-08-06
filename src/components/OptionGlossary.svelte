<script lang="ts">
	// Beginner-first glossary / explainer. Progressive disclosure by experience
	// level: Novice shows plain-English basics; Advanced adds the Greek-jargon.

	let { level = 'novice' }: { level?: 'novice' | 'intermediate' | 'advanced' } = $props();

	const TERMS: Array<{
		key: string;
		title: string;
		novice: string;
		advanced: string;
	}> = [
		{
			key: 'option',
			title: 'OPTION',
			novice:
				'A contract that gives you the RIGHT (not the duty) to buy or sell a stock at a fixed price by a certain date. You pay a small "premium" for that right.',
			advanced:
				'A financial derivative whose value is derived from an underlying asset. Two types: CALL (right to buy) and PUT (right to sell), with a strike price and expiration.'
		},
		{
			key: 'call',
			title: 'CALL',
			novice:
				'An option that profits if the stock goes UP. You buy the right to buy the stock at a fixed price. Best for when you think the price will rise.',
			advanced:
				'A call option gives the holder the right to buy the underlying at the strike price on or before expiration. Value rises with the underlying and falls with time decay.'
		},
		{
			key: 'put',
			title: 'PUT',
			novice:
				'An option that profits if the stock goes DOWN. You buy the right to sell the stock at a fixed price. Best for when you think the price will fall.',
			advanced:
				'A put option gives the holder the right to sell the underlying at the strike price. Value rises when the underlying falls. Used to hedge or to bet bearish.'
		},
		{
			key: 'strike',
			title: 'STRIKE PRICE',
			novice:
				'The fixed price at which you can buy (call) or sell (put) the stock. The option only becomes "in the money" if the stock trades beyond this level.',
			advanced:
				'The agreed exercise price (K). Moneyness: ITM (intrinsic value > 0), ATM (near the underlying), OTM (no intrinsic value).'
		},
		{
			key: 'premium',
			title: 'PREMIUM',
			novice:
				'The price you pay to buy one option. It is your maximum possible loss if the trade goes wrong. One option controls 100 shares.',
			advanced:
				'The market price of the option. Composed of intrinsic value + time value. Buying 1 contract controls 100 shares of the underlying.'
		},
		{
			key: 'breakeven',
			title: 'BREAKEVEN',
			novice:
				'The stock price at which your option trade breaks even (no profit, no loss). For a call: strike + premium. For a put: strike − premium.',
			advanced: 'Strike ± premium. Above this a long call profits; below this a long put profits.'
		},
		{
			key: 'expiry',
			title: 'EXPIRATION',
			novice:
				'The last day the option is valid. After this date the option is worthless (unless you exercise it). Shorter time = cheaper but riskier.',
			advanced:
				'The maturity date (DTE = days to expiry). Time value decays toward zero as expiration approaches (theta decay).'
		},
		{
			key: 'delta',
			title: 'DELTA',
			novice:
				'How much the option price moves when the stock moves $1. Delta near 1 means it moves almost like the stock; near 0 means it barely reacts.',
			advanced:
				'First derivative of option price w.r.t. underlying. Roughly = probability of ending ITM. Call delta ∈ (0,1); put delta ∈ (−1,0).'
		},
		{
			key: 'theta',
			title: 'THETA',
			novice:
				'How much value the option loses each day as time passes. It always works AGAINST buyers — time is money. Longer-dated options lose value slower.',
			advanced: 'Time decay per day. Always negative for long options; accelerates as expiration nears.'
		},
		{
			key: 'iv',
			title: 'IMPLIED VOLATILITY (IV)',
			novice:
				'The market\'s guess at how much the stock will swing. Higher IV = more expensive options, because bigger swings mean bigger possible payoffs.',
			advanced:
				'The volatility implied by option prices via an option-pricing model (Black-Scholes). Higher IV = higher premium. Used to estimate chance of profit.'
		},
		{
			key: 'chance',
			title: 'CHANCE OF PROFIT',
			novice:
				'An ESTIMATE of how likely your option trade is to make money, based on the stock\'s expected swings. Higher chance usually means less potential reward.',
			advanced:
				'Estimated via a Black-Scholes normal model from implied volatility. NOT a guarantee — a statistical estimate only.'
		}
	];

	const shown = $derived(
		level === 'novice'
			? TERMS.filter((t) => !['delta', 'theta'].includes(t.key))
			: TERMS
	);
</script>

<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
	{#each shown as term}
		<div class="rounded p-3" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block mb-1" style="color: var(--accent-primary)">{term.title}</span>
			<p class="label" style="color: var(--foreground-muted); line-height: 1.6; text-transform: none">
				{level === 'advanced' ? term.advanced : term.novice}
			</p>
		</div>
	{/each}
</div>
