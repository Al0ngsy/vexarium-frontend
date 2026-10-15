// Glossary content: every term VEXARIUM shows, grouped beginner to advanced.
// Entries cross-link through `conns` (ids of related entries). Presentation
// lives in routes/glossary/+page.svelte.

export interface GlossaryEntry {
	id: string;
	name: string;
	def: string;
	why: string;
	/** ids of related entries */
	conns: string[];
	/** how the term appears in VEXARIUM */
	vex?: string;
}

export interface GlossaryGroup {
	id: string;
	title: string;
	blurb: string;
	entries: GlossaryEntry[];
}

export const GLOSSARY_GROUPS: GlossaryGroup[] = [
	{
		id: 'g-market-basics',
		title: 'Market basics',
		blurb: 'The price, size and mood of the market you are looking at.',
		entries: [
			{
				id: 'ticker',
				name: 'Ticker',
				def: 'The short code a stock, ETF or index trades under, such as AAPL for Apple.',
				why: 'It is how you find a security everywhere in VEXARIUM: the topbar search, the watchlist and the analysis page all key off the ticker.',
				conns: ['market-cap', 'pe-ratio'],
				vex: 'The topbar search field and every page URL use it, for example /s/AAPL.'
			},
			{
				id: 'bid',
				name: 'Bid',
				def: 'The highest price a buyer is currently willing to pay for a security.',
				why: 'If you want to sell immediately, you get the bid, not the last price. A wide gap between bid and ask tells you the security is hard to trade.',
				conns: ['ask', 'bid-ask-spread', 'mid-price', 'last-price'],
				vex: 'Shown in the options chain as the BID column on the call side and the rightmost column on the put side.'
			},
			{
				id: 'ask',
				name: 'Ask',
				def: 'The lowest price a seller is currently willing to accept for a security.',
				why: 'If you want to buy immediately, you pay the ask. The ask is the realistic entry price for a quick fill.',
				conns: ['bid', 'bid-ask-spread', 'last-price'],
				vex: 'Shown in the options chain as the ASK column; the matrix and payoff explorer price scenarios from mid prices and model values.'
			},
			{
				id: 'bid-ask-spread',
				name: 'Bid-ask spread',
				def: 'The gap between the bid and the ask, in dollars and as a percentage.',
				why: 'The spread is a hidden cost: buy at the ask, and the market immediately values your position at the bid. Wide spreads on options mean the quote is indicative and fills are uncertain.',
				conns: ['bid', 'ask', 'delayed-data', 'option-chain'],
				vex: 'The chain shows the spread implicitly through the paired bid and ask columns; the deltas of both are part of every option snapshot.'
			},
			{
				id: 'mid-price',
				name: 'Mid price',
				def: 'The average of the bid and the ask, used as a fair estimate of where a trade would actually happen.',
				why: 'When volume is thin or quotes are delayed, the mid price is a more honest number than the last trade.',
				conns: ['bid', 'ask', 'last-price', 'theoretical-value'],
				vex: 'Used as the reference price when VEXARIUM estimates option value and P/L scenarios.'
			},
			{
				id: 'last-price',
				name: 'Last price',
				def: 'The price of the most recent completed trade in a security.',
				why: 'It is real money changing hands, but it can be stale in a thin market. Combine it with bid and ask to judge whether the quote is still meaningful.',
				conns: ['bid', 'ask', 'mid-price', 'volume'],
				vex: 'Shown as the LAST column in the options chain and as the live price on the analysis page.'
			},
			{
				id: 'delayed-data',
				name: 'Delayed data',
				def: 'Quotes that lag the real market by roughly 15 minutes instead of streaming live.',
				why: 'Free data feeds are delayed, so the price you see may already be wrong by the time you act. Treat displayed numbers as indicative, especially for options.',
				conns: ['last-price', 'bid-ask-spread', 'volume'],
				vex: 'The chain carries a delayed badge, and a footnote explains quotes are indicative.'
			},
			{
				id: 'market-cap',
				name: 'Market cap',
				def: 'The total dollar value of a company: share price multiplied by all shares outstanding.',
				why: 'It sizes a company: mega-cap and large-cap are established giants, small-cap means more risk and more potential. Big caps tend to swing less.',
				conns: ['shares-outstanding', 'pe-ratio', 'ps-ratio'],
				vex: 'A card in the company profile, plus a key statistic on the analysis page.'
			},
			{
				id: 'pe-ratio',
				name: 'P/E ratio',
				def: 'Price divided by yearly earnings per share: what you pay for each dollar of annual profit.',
				why: 'A high P/E means the market expects strong future growth and already prices it in; a low P/E can mean cheap or can mean the market doubts the earnings.',
				conns: ['forward-pe', 'ps-ratio', 'earnings-eps', 'market-cap'],
				vex: 'Company profile valuation card and the key statistics widget, with a plain-English band explanation on hover.'
			},
			{
				id: 'forward-pe',
				name: 'Forward P/E',
				def: 'The P/E ratio using expected future earnings instead of the last reported year.',
				why: 'It shows whether the current price already accounts for expected growth. A forward P/E far below the trailing P/E signals fast expected earnings growth.',
				conns: ['pe-ratio', 'earnings-eps'],
				vex: 'Company profile valuation card, explained with the same banded tooltips.'
			},
			{
				id: 'ps-ratio',
				name: 'P/S ratio',
				def: 'Price divided by yearly sales (revenue) per share.',
				why: 'Useful for young companies that are not profitable yet, where P/E is meaningless. A rich P/S means investors are paying for future growth.',
				conns: ['pe-ratio', 'market-cap'],
				vex: 'Company profile valuation card.'
			},
			{
				id: 'dividend-yield',
				name: 'Dividend yield',
				def: 'The yearly cash dividend paid per share, as a percentage of the share price.',
				why: 'It is income you collect just for holding. A high yield may fund the payout with risk, and a 0% yield simply means the company pays none.',
				conns: ['pe-ratio', 'earnings-eps'],
				vex: 'Company profile and key statistics, always shown as a percentage.'
			},
			{
				id: 'week-52-high-low',
				name: '52-week high and low',
				def: 'The highest and lowest price the security traded at during the last year.',
				why: 'It frames where the price sits in its recent history. Near the high can mean momentum or an expensive entry; near the low can mean a bargain or a falling knife.',
				conns: ['moneyness', 'ytd-change', 'take-profit', 'stop-loss'],
				vex: 'Company profile position bar, vitals and key statistics; a near-high or near-low readout flags a pattern.'
			},
			{
				id: 'volume',
				name: 'Volume',
				def: 'How many shares traded in a given period.',
				why: 'Volume confirms moves: a rally on rising volume has buying behind it, a rally on shrinking volume is easy to reverse.',
				conns: ['open-interest', 'obv', 'mfi'],
				vex: 'The data feed does not provide option volume, so the chain explains that the column is omitted.'
			},
			{
				id: 'open-interest',
				name: 'Open interest',
				def: 'The number of option contracts that are currently open, meaning not yet closed or expired.',
				why: 'High open interest means a liquid contract with tight spreads; low open interest means you may struggle to get out at a fair price.',
				conns: ['volume', 'option-chain', 'bid-ask-spread'],
				vex: 'The free data feed does not provide it; the chain footnote states it is omitted.'
			},
			{
				id: 'fear-greed-index',
				name: 'Fear and greed index',
				def: 'A 0-100 gauge of market mood built by CNN from several market indicators, where low is fear and high is greed.',
				why: 'Extreme fear often marks selling that is close to exhausted, and extreme greed often marks crowded optimism. It is a mood read, not a timing signal.',
				conns: ['news-sentiment', 'overbought-oversold', 'verdict-scale'],
				vex: 'A dedicated widget with a gauge, a 1-week and 1-month change and a 3-month trend line.'
			},
			{
				id: 'news-sentiment',
				name: 'News sentiment',
				def: 'How positive or negative recent headlines about a company or the broad market are, scored automatically per article.',
				why: 'News moves prices in the short term, and sentiment aggregates it into one number. A negative score with falling price confirms weakness; conflicting signals mean noise.',
				conns: ['fear-greed-index', 'verdict-scale', 'volume'],
				vex: 'Each news article carries a sentiment score chip; a summary line shows the aggregate and article count.'
			},
			{
				id: 'shares-outstanding',
				name: 'Shares outstanding',
				def: 'The total number of shares of a company that exist.',
				why: 'Price times shares outstanding equals the market cap, so it is the bridge between the per-share price and the whole-company value.',
				conns: ['market-cap', 'earnings-eps'],
				vex: 'Company profile and key statistics.'
			},
			{
				id: 'earnings-eps',
				name: 'Earnings and EPS',
				def: 'Earnings are the company profit for a period; EPS is that profit divided by shares outstanding, the per-share figure markets trade on.',
				why: 'EPS is the E in P/E. When actual EPS beats the analyst estimate, the stock often jumps; a miss often drops it.',
				conns: ['pe-ratio', 'forward-pe'],
				vex: 'The earnings widget compares estimate and actual EPS per quarter and colors beats and misses, including the surprise percentage.'
			},
			{
				id: 'ytd-change',
				name: 'YTD change',
				def: 'How much the price has moved since the start of the year, as a percentage.',
				why: 'It is the quickest measure of how a stock is doing this year versus the broad market.',
				conns: ['week-52-high-low', 'news-sentiment'],
				vex: 'A key statistic on the analysis page, colored green or red.'
			},
			{
				id: 'insider-transactions',
				name: 'Insider transactions',
				def: 'Buying or selling of the company stock by its own executives and large holders, reported as filings.',
				why: 'Insiders know the business from the inside. Sustained insider buying can be a quiet signal of confidence, though insiders sell for many unrelated reasons.',
				conns: ['news-sentiment', 'verdict-scale'],
				vex: 'The insider widget lists recent filings with buy or sell direction and share counts.'
			},
			{
				id: 'peers',
				name: 'Peers',
				def: 'Companies in the same industry that compete with or resemble the one you are looking at.',
				why: 'Comparing a stock to its peers shows whether an apparent strength or weakness is company-specific or just the whole sector moving.',
				conns: ['pe-ratio', 'market-cap'],
				vex: 'The peer widget offers one-click comparison, and peers appear in the compare selector over the price chart.'
			}
		]
	},
	{
		id: 'g-options-basics',
		title: 'Options basics',
		blurb: 'What a contract is, how it is quoted, and the vocabulary of the chain.',
		entries: [
			{
				id: 'option',
				name: 'Option',
				def: 'A contract that gives the buyer the right, but not the obligation, to trade 100 shares of a stock at a fixed price until a fixed date.',
				why: 'Options let you bet on direction, hedge a position, or sell risk to others with a known maximum loss. The price you pay or receive is the premium.',
				conns: ['call-option', 'put-option', 'premium', 'contract-options', 'strike-price', 'expiration'],
				vex: 'Options analysis lives under /options/[symbol], with the chain, payoff explorer and matrix widgets.'
			},
			{
				id: 'call-option',
				name: 'Call',
				def: 'An option that gives the buyer the right to buy 100 shares at the strike price.',
				why: 'A call profits when the stock rises. It is the way to bet up cheaply, but it loses all value if the stock stays below the strike through expiry.',
				conns: ['put-option', 'strike-price', 'in-the-money', 'premium', 'delta'],
				vex: 'The left half of every chain group, and the basis of long call, covered call and bull call spread strategies.'
			},
			{
				id: 'put-option',
				name: 'Put',
				def: 'An option that gives the buyer the right to sell 100 shares at the strike price.',
				why: 'A put profits when the stock falls and also works as insurance for shares you own. It is the way to bet down without shorting the stock.',
				conns: ['call-option', 'strike-price', 'in-the-money', 'premium', 'delta'],
				vex: 'The right half of every chain group, and the basis of long put, short put and bear put spread strategies.'
			},
			{
				id: 'strike-price',
				name: 'Strike price',
				def: 'The fixed price per share at which the option holder can buy or sell the stock.',
				why: 'Together with the current price it decides moneyness, and together with the premium it decides the breakeven. It is the reference point of every option.',
				conns: ['in-the-money', 'moneyness', 'breakeven', 'option-chain'],
				vex: 'The center column of the chain, colored by distance from the current price, with the percentage move shown below.'
			},
			{
				id: 'expiration',
				name: 'Expiration date',
				def: 'The last day the option holder can exercise; after it, the contract ceases to exist.',
				why: 'Time is the option buyer enemy: the closer expiry gets, the faster the premium decays. Expiry also sets which payoff scenarios are possible.',
				conns: ['days-to-expiry', 'time-decay', 'theta', 'option-chain'],
				vex: 'Every chain group is headed by its expiry, and the payoff explorer date slider runs from today to expiry.'
			},
			{
				id: 'days-to-expiry',
				name: 'Days to expiry (DTE)',
				def: 'The number of calendar days remaining until the option expires.',
				why: 'DTE drives time decay, probability estimates and greeks. Same-day contracts are so volatile that VEXARIUM skips them entirely.',
				conns: ['expiration', 'time-decay', 'theta', 'probability-of-profit'],
				vex: 'Shown in the chain header and the payoff explorer DTE readout.'
			},
			{
				id: 'premium',
				name: 'Premium',
				def: 'The price paid for an option, quoted per share, so one contract costs 100 times the displayed premium.',
				why: 'It is the maximum loss of an option buyer and the income of an option seller, and it is where intrinsic value and extrinsic value come together.',
				conns: ['intrinsic-value', 'extrinsic-value', 'contract-options', 'black-scholes', 'max-loss'],
				vex: 'Shown on the selected contract strip, and the P/L% matrix mode expresses results as a percentage of the premium paid.'
			},
			{
				id: 'intrinsic-value',
				name: 'Intrinsic value',
				def: 'The value the option would have if exercised right now: for a call, price minus strike when positive, and zero otherwise.',
				why: 'It is the floor an option can never trade below for long. Deep in the money, the option behaves almost like the stock itself.',
				conns: ['extrinsic-value', 'in-the-money', 'premium', 'delta'],
				vex: 'The chain rows are priced around intrinsic value, and at 0 DTE the model prices options at exactly their intrinsic value.'
			},
			{
				id: 'extrinsic-value',
				name: 'Extrinsic value',
				def: 'The part of the premium above intrinsic value: what you pay for time and for the chance of a big move.',
				why: 'Extrinsic value is what decays away as expiry approaches. It is why an out of the money option still costs something and why sellers exist.',
				conns: ['intrinsic-value', 'time-decay', 'implied-volatility', 'theta'],
				vex: 'The concept behind the payoff explorer estimates: drag the date slider and watch value erode.'
			},
			{
				id: 'in-the-money',
				name: 'In the money (ITM)',
				def: 'An option with intrinsic value: a call above the strike, a put below it.',
				why: 'ITM options are more expensive, move more like the stock and have a higher probability of ending profitable. The chain filter narrows to them.',
				conns: ['at-the-money', 'out-of-the-money', 'moneyness', 'intrinsic-value', 'probability-itm'],
				vex: 'The chain ITM filter and the color coding of strike distance both refer to moneyness.'
			},
			{
				id: 'at-the-money',
				name: 'At the money (ATM)',
				def: 'An option whose strike is roughly equal to the current stock price.',
				why: 'ATM options have the most time value, the highest gamma and the most uncertain outcome. That makes them expensive in both directions.',
				conns: ['in-the-money', 'out-of-the-money', 'gamma', 'extrinsic-value'],
				vex: 'The P/L matrix highlights the ATM strike row and the graph view plots its payoff across dates.'
			},
			{
				id: 'out-of-the-money',
				name: 'Out of the money (OTM)',
				def: 'An option with no intrinsic value: a call below the strike, a put above it.',
				why: 'OTM options are cheap because they are pure bets on a move, and they lose all value if the move does not happen. High probability of loss, high leverage.',
				conns: ['in-the-money', 'at-the-money', 'moneyness', 'probability-of-profit', 'extrinsic-value'],
				vex: 'The chain OTM filter; the strike distance percentage shown under each strike tells you how far out it is.'
			},
			{
				id: 'moneyness',
				name: 'Moneyness',
				def: 'Where the strike sits relative to the current price: in, at or out of the money, including how far in or out as a percentage.',
				why: 'Moneyness decides the character of an option: its delta, its probability, its time value and how it reacts to moves.',
				conns: ['in-the-money', 'at-the-money', 'out-of-the-money', 'delta', 'probability-itm'],
				vex: 'The chain shows moneyness as the signed distance percentage under each strike, colored per side.'
			},
			{
				id: 'breakeven',
				name: 'Breakeven (options)',
				def: 'The stock price at expiry where the option trade ends at zero profit and zero loss.',
				why: 'For a call it is strike plus premium, for a put strike minus premium, and for a spread it is the level where the legs balance. It is the first number to check before entering.',
				conns: ['strike-price', 'premium', 'max-profit', 'max-loss'],
				vex: 'Shown on the probability widget, the strategy cards and the payoff explorer, where the breakeven marker sits on the chart.'
			},
			{
				id: 'assignment',
				name: 'Assignment',
				def: 'The process of an option seller being obligated to fulfill the contract when the buyer exercises.',
				why: 'Sellers must be ready for it: a cash-secured put can turn into 100 shares of stock at the strike, and a covered call can have the shares called away.',
				conns: ['exercise', 'cash-secured-put', 'covered-call', 'short-put'],
				vex: 'Assignment risk is the core reason the strategy cards for shorts mention keeping cash or shares ready.'
			},
			{
				id: 'exercise',
				name: 'Exercise',
				def: 'The action of using the option right: buying (call) or selling (put) the 100 shares at the strike.',
				why: 'Most options are closed by selling the contract back rather than exercising, but exercise is what links options to actual share ownership.',
				conns: ['assignment', 'in-the-money', 'contract-options'],
				vex: 'Relevant when a short put or a covered call position matures toward expiry.'
			},
			{
				id: 'contract-options',
				name: 'Contract (options)',
				def: 'The standard trading unit: one option contract represents 100 shares of the underlying.',
				why: 'Every displayed premium multiplies by 100 to become real dollars, and every P/L number on the matrix assumes this standard size.',
				conns: ['premium', 'option', 'option-chain'],
				vex: 'The matrix and strategy numbers are all quoted in contract terms.'
			},
			{
				id: 'option-chain',
				name: 'Option chain',
				def: 'The full table of every call and put available for a stock, grouped by expiration and ordered by strike.',
				why: 'It is the marketplace view of options: side by side you see calls and puts at every strike with bid, ask, last, model value and implied volatility.',
				conns: ['call-option', 'put-option', 'strike-price', 'expiration', 'implied-volatility', 'occ-symbol'],
				vex: 'The chain widget is the starting point of the options page; clicking a row selects the contract everywhere else.'
			},
			{
				id: 'occ-symbol',
				name: 'OCC symbol',
				def: 'The standardized identifier of an option contract, encoding ticker, expiration, call or put, and strike.',
				why: 'It is the contract passport: the same symbol works across brokers and data feeds, so it is the safest way to refer to a specific option.',
				conns: ['option-chain', 'expiration', 'strike-price'],
				vex: 'Shown in small text on the selected contract strip in the payoff explorer.'
			}
		]
	},
	{
		id: 'g-volatility-pricing',
		title: 'Volatility and pricing',
		blurb: 'Where option prices come from, how the models estimate them, and how to read the risk numbers.',
		entries: [
			{
				id: 'implied-volatility',
				name: 'Implied volatility (IV)',
				def: 'The annualized volatility of the stock that the current option price implies, expressed as a percentage.',
				why: 'IV is the market forecast of how much the stock will move: high IV means expensive options and a market expecting big swings. It is the single most informative option number.',
				conns: ['historical-volatility', 'black-scholes', 'vega', 'extrinsic-value', 'probability-of-profit'],
				vex: 'The IV column in the chain and the sigma tile in the greeks widget.'
			},
			{
				id: 'historical-volatility',
				name: 'Historical volatility',
				def: 'How much the stock actually moved in the past, measured from its price history and annualized.',
				why: 'Comparing it with IV tells you whether options are cheap or expensive relative to reality: IV above historical volatility means fear is being priced in.',
				conns: ['implied-volatility', 'atr', 'bollinger'],
				vex: 'The ATR indicator is VEXARIUM daily volatility measure, and the greeks widget contrasts expected vs actual movement.'
			},
			{
				id: 'black-scholes',
				name: 'Black-Scholes model',
				def: 'A mathematical formula that estimates a fair option price from current price, strike, time to expiry, interest rate and implied volatility.',
				why: 'It is the industry standard for pricing and the engine behind VEXARIUM model values, but it assumes constant volatility and frictionless markets. Treat its outputs as estimates, not guarantees.',
				conns: ['implied-volatility', 'theoretical-value', 'probability-of-profit', 'vega', 'time-decay'],
				vex: 'Powers the THEO chain column, the payoff explorer, the P/L matrix and the probability widget; every one carries an estimate disclaimer.'
			},
			{
				id: 'theoretical-value',
				name: 'Theoretical value',
				def: 'The option price produced by the Black-Scholes model, as opposed to the traded bid or ask.',
				why: 'It is the fair-value yardstick: when the market quote sits far above model value, someone is paying extra for supply or fear.',
				conns: ['black-scholes', 'mid-price', 'implied-volatility'],
				vex: 'The THEO column in the chain and the option value readout in the payoff explorer.'
			},
			{
				id: 'probability-of-profit',
				name: 'Probability of profit',
				def: 'The model estimate of the chance that the trade makes money by expiry, derived from the current IV.',
				why: 'It turns a price into odds. Remember the estimate only models the price distribution; it does not guarantee outcomes, and high probability trades pay less.',
				conns: ['probability-itm', 'expected-value', 'implied-volatility', 'black-scholes'],
				vex: 'The probability widget bar, colored green above 50% and orange below.'
			},
			{
				id: 'probability-itm',
				name: 'Probability of ending ITM',
				def: 'The model estimate of the chance that the option has intrinsic value at expiry.',
				why: 'It is the raw directional probability, before premium costs. Profitability needs this, plus enough premium for the stock to pass the breakeven, which is why it is always higher than probability of profit.',
				conns: ['probability-of-profit', 'in-the-money', 'moneyness', 'breakeven'],
				vex: 'The second bar in the probability widget, shown in the accent color.'
			},
			{
				id: 'expected-value',
				name: 'Expected value',
				def: 'The probability-weighted average P/L of the trade, meaning the average result if you ran it many times.',
				why: 'A positive expected value is the mathematical definition of an edge, but it hides variance: a pleasant average can come from many small wins and rare large losses.',
				conns: ['probability-of-profit', 'max-profit', 'max-loss', 'risk-reward'],
				vex: 'The expected value readout on the probability widget, green when positive and red when negative.'
			},
			{
				id: 'payoff-curve',
				name: 'Payoff curve',
				def: 'A graph of the trade P/L against the stock price, normally drawn at expiry.',
				why: 'One glance shows the shape of the risk: where it profits, where it loses, where the breakeven sits and what the extremes look like. Every strategy has its own signature curve.',
				conns: ['pl-matrix', 'breakeven', 'max-profit', 'max-loss', 'long-call'],
				vex: 'The payoff explorer chart with a draggable price slider, and the mini chart on every strategy card.'
			},
			{
				id: 'pl-matrix',
				name: 'P/L matrix',
				def: 'A grid of projected P/L across a range of strikes (rows) and expiration dates (columns).',
				why: 'It answers the timing question the payoff curve cannot: what is this trade worth if the stock moves X% by date Y? Modes show the result in dollars, as a percentage of premium, as option value, or as percent of the max loss realized.',
				conns: ['payoff-curve', 'expected-value', 'time-decay', 'probability-of-profit'],
				vex: 'The P/L matrix widget with the range and dates sliders and the P/L $, P/L %, VALUE and RISK modes, plus a graph view of the at-the-money row.'
			},
			{
				id: 'time-decay',
				name: 'Time decay',
				def: 'The steady loss of extrinsic value as the expiration date approaches.',
				why: 'It is the tax every option buyer pays and every seller collects. Decay accelerates in the last weeks, which is why short-dated options are the favorite of sellers and the danger of buyers.',
				conns: ['theta', 'extrinsic-value', 'days-to-expiry', 'short-put', 'covered-call'],
				vex: 'The payoff explorer date slider demonstrates it live: drag the date forward and the estimated value shrinks.'
			}
		]
	},
	{
		id: 'g-greeks',
		title: 'The greeks',
		blurb: 'The five sensitivity numbers that describe how an option reacts to the world.',
		entries: [
			{
				id: 'delta',
				name: 'Delta',
				def: 'How much the option price moves, in dollars, for a one-dollar move in the stock; calls run from 0 to 1 and puts from 0 to -1.',
				why: 'Delta is the directional exposure: a delta of 0.6 call behaves like owning 60 shares. It also approximates the probability of ending ITM, which is why the two numbers look alike.',
				conns: ['gamma', 'moneyness', 'probability-itm', 'call-option', 'put-option'],
				vex: 'First tile of the greeks widget, shown to four decimals.'
			},
			{
				id: 'gamma',
				name: 'Gamma',
				def: 'How fast delta itself changes as the stock moves.',
				why: 'High gamma means the option reacts more violently: near the money and near expiry, positions swing between feeling like shares and feeling like nothing. It is the source of both opportunity and whiplash.',
				conns: ['delta', 'at-the-money', 'days-to-expiry'],
				vex: 'Second tile of the greeks widget.'
			},
			{
				id: 'theta',
				name: 'Theta',
				def: 'How much value the option loses per day as time passes, in dollars.',
				why: 'Theta always works against option buyers and for sellers. It is the concrete number behind time decay, and it grows as expiry approaches.',
				conns: ['time-decay', 'days-to-expiry', 'extrinsic-value', 'short-put'],
				vex: 'Third tile of the greeks widget; the payoff explorer also shows decay by date.'
			},
			{
				id: 'vega',
				name: 'Vega',
				def: 'How much the option price changes when implied volatility moves by one percentage point.',
				why: 'High vega means the position is a bet on volatility direction as much as on price. Long-dated options carry the most vega, which is why IV changes hurt or help them most.',
				conns: ['implied-volatility', 'historical-volatility', 'time-decay'],
				vex: 'Fourth tile of the greeks widget, alongside the sigma (IV) tile.'
			},
			{
				id: 'rho',
				name: 'Rho',
				def: 'How much the option price changes when interest rates move by one percentage point.',
				why: 'It is usually small enough to ignore for short-dated options, but it grows for long-dated ones because the strike money is tied up longer.',
				conns: ['vega', 'days-to-expiry', 'black-scholes'],
				vex: 'Fifth tile of the greeks widget.'
			}
		]
	},
	{
		id: 'g-strategies',
		title: 'Strategies',
		blurb: 'The trade blueprints VEXARIUM suggests, each with its own risk shape.',
		entries: [
			{
				id: 'long-call',
				name: 'Long call',
				def: 'Buying a call option, the classic bet that the stock rises above the breakeven before expiry.',
				why: 'Maximum loss is the premium paid, maximum profit is theoretically unlimited, which makes it the highest leverage way to play a stock you believe in.',
				conns: ['call-option', 'breakeven', 'max-loss', 'delta', 'time-decay'],
				vex: 'The first strategy card when the engine sees a bullish picture.'
			},
			{
				id: 'long-put',
				name: 'Long put',
				def: 'Buying a put option, a bet that the stock falls, or insurance against a drop in shares you hold.',
				why: 'It profits from falls with limited cost, but theta eats it every day, so it wants a timely move, not a slow grind down.',
				conns: ['put-option', 'breakeven', 'max-loss', 'theta', 'diversification'],
				vex: 'The listed strategy for a bearish picture.'
			},
			{
				id: 'short-put',
				name: 'Short put',
				def: 'Selling a put to collect premium, profiting if the stock stays above the breakeven.',
				why: 'It is the income side of the options market: you take the risk of owning the stock at a cheaper price in exchange for premium now. Losses can be large if the stock collapses.',
				conns: ['cash-secured-put', 'assignment', 'theta', 'max-loss', 'premium'],
				vex: 'Suggested when the picture is neutral-to-bullish; the card shows capped reward and the full assignment risk.'
			},
			{
				id: 'cash-secured-put',
				name: 'Cash-secured put',
				def: 'Selling a put while setting aside enough cash to buy the 100 shares if assigned.',
				why: 'It turns the short put risk into a plan: worst case you own a stock you liked anyway at the strike minus the premium collected. It is the beginner standard for selling puts.',
				conns: ['short-put', 'assignment', 'premium', 'max-loss', 'position'],
				vex: 'The strategy card explains that assigned puts become stock at strike minus premium.'
			},
			{
				id: 'covered-call',
				name: 'Covered call',
				def: 'Owning 100 shares and selling a call against them, collecting premium while giving up upside above the strike.',
				why: 'It harvests income and a little downside cushion from a stock you already hold, in exchange for capping the gain you would get from a rally.',
				conns: ['call-option', 'assignment', 'theta', 'take-profit', 'position'],
				vex: 'Suggested when you own shares and the engine sees a flat-to-bullish outlook.'
			},
			{
				id: 'bull-call-spread',
				name: 'Bull call spread',
				def: 'Buying a lower-strike call and selling a higher-strike call of the same expiry.',
				why: 'It keeps most of the long call upside but pays for it by selling the far tail, which cuts the cost and caps the loss at the net premium.',
				conns: ['debit-credit', 'defined-risk', 'max-profit', 'max-loss', 'long-call'],
				vex: 'The strategy the engine switches to when volatility is high, to keep the bullish bet defined-risk.'
			},
			{
				id: 'bear-put-spread',
				name: 'Bear put spread',
				def: 'Buying a higher-strike put and selling a lower-strike put of the same expiry.',
				why: 'The bearish mirror of the bull call spread: cheaper than a plain long put, with both profit and loss capped.',
				conns: ['debit-credit', 'defined-risk', 'max-profit', 'max-loss', 'long-put'],
				vex: 'Suggested for bearish ideas when defined risk matters.'
			},
			{
				id: 'debit-credit',
				name: 'Debit and credit spreads',
				def: 'A spread costs a debit when you pay net premium to enter, and brings a credit when you receive net premium.',
				why: 'The direction of money matters: debit spreads need the stock to move past the breakeven; credit spreads just need it to stay on the right side. Credit trades feel easier but take on tail risk.',
				conns: ['bull-call-spread', 'bear-put-spread', 'short-put', 'premium', 'max-loss'],
				vex: 'Every strategy card shows whether the trade is a debit or credit through its return on risk and max profit and loss lines.'
			},
			{
				id: 'defined-risk',
				name: 'Defined risk',
				def: 'A trade whose maximum possible loss is known exactly at entry.',
				why: 'Defined risk means you can size the trade so the worst case is survivable, which is the difference between a setback and an account-ending event.',
				conns: ['max-loss', 'bull-call-spread', 'bear-put-spread', 'spreads-multileg'],
				vex: 'The engine prefers defined-risk spreads when volatility is high.'
			},
			{
				id: 'max-profit',
				name: 'Max profit',
				def: 'The best possible result of a trade, usually achieved at or beyond a specific price at expiry.',
				why: 'Knowing the ceiling sets expectations: direction is only part of the outcome, and for spreads the ceiling arrives only if the stock finishes on the right side of the short leg.',
				conns: ['max-loss', 'return-on-risk', 'payoff-curve', 'breakeven'],
				vex: 'A field on every strategy card.'
			},
			{
				id: 'max-loss',
				name: 'Max loss',
				def: 'The worst possible result of a trade, known for buyers and spread traders, open-ended for naked shorts.',
				why: 'Max loss is the number that decides position size. If the worst case keeps you in the game, the trade is a candidate; if it hurts, it is too big.',
				conns: ['max-profit', 'defined-risk', 'risk-reward', 'stop-loss'],
				vex: 'A field on every strategy card, and the reference point for the matrix RISK mode.'
			},
			{
				id: 'return-on-risk',
				name: 'Return on risk',
				def: 'Max profit divided by max loss, the reward per dollar at risk.',
				why: 'It is the single best strategy comparison number: a trade risking 1 to make 2 is twice as capital-efficient as one risking 1 to make 1, regardless of direction.',
				conns: ['max-profit', 'max-loss', 'risk-reward', 'defined-risk'],
				vex: 'Shown as a percentage on every strategy card, colored orange for attractive and red for weak.'
			},
			{
				id: 'spreads-multileg',
				name: 'Spreads (multi-leg)',
				def: 'A strategy built from two or more options on the same stock, usually one bought and one sold.',
				why: 'Adding a sold leg trades away some upside or insurance in exchange for a cheaper cost, a smaller loss, or income. The two legs together define the risk shape.',
				conns: ['debit-credit', 'defined-risk', 'bull-call-spread', 'bear-put-spread'],
				vex: 'The engine mixes single-leg and spread ideas on the strategy widget.'
			}
		]
	},
	{
		id: 'g-indicators',
		title: 'Technical indicators',
		blurb: 'Every automated check on the analysis page, what it measures and how to read its verdict.',
		entries: [
			{
				id: 'rsi',
				name: 'RSI (relative strength index)',
				def: 'Measures how fast the price has moved up or down over 14 days, on a 0-100 scale.',
				why: 'Above 70 the stock is overbought and due for a rest, below 30 oversold and due for a bounce. It is the fastest single glance at momentum and exhaustion.',
				conns: ['overbought-oversold', 'stochastic', 'mfi', 'check-status'],
				vex: 'A core indicator, shown with reading and reason; crossing 30 or 70 also generates a pattern flag.'
			},
			{
				id: 'sma-ema',
				name: 'SMA and EMA',
				def: 'Moving averages of the closing price: the 50-day (short trend) and the 200-day (long trend) line.',
				why: 'Price above both means the trend is up, below both means down. When the 50-day crosses the 200-day you get the classic golden cross (bullish) or death cross (bearish).',
				conns: ['macd', 'adx', 'psar', 'check-status'],
				vex: 'One combined check showing price versus both averages, plus golden and death cross pattern flags.'
			},
			{
				id: 'macd',
				name: 'MACD',
				def: 'The gap between a fast and a slow moving average, showing whether short-term momentum beats long-term momentum.',
				why: 'A positive and widening gap means bulls control the momentum; a flip of the histogram is one of the earliest warning signs of a trend change.',
				conns: ['sma-ema', 'rsi', 'check-status'],
				vex: 'Rendered as MACD, signal and histogram values, with a histogram sign-flip pattern flag.'
			},
			{
				id: 'bollinger',
				name: 'Bollinger bands',
				def: 'A band two standard deviations around the 20-day average, marking unusually cheap and unusually expensive price levels.',
				why: 'Price riding the lower band is stretched down and often bounces; the upper band marks stretched-up prices. The %B reading places the price inside the band.',
				conns: ['atr', 'overbought-oversold', 'historical-volatility', 'check-status'],
				vex: 'Shows price, %B and the band range, with richer entries flagged near the lower band.'
			},
			{
				id: 'stochastic',
				name: 'Stochastic oscillator',
				def: 'Where the latest price sits inside the high-low range of the last 14 days, on a 0-100 scale.',
				why: 'Above 80 the price is near the top of its recent range (overbought), below 20 near the bottom (oversold). It works best in sideways markets.',
				conns: ['rsi', 'williams-r', 'overbought-oversold', 'check-status'],
				vex: 'A core oscillator check with its own verdict.'
			},
			{
				id: 'atr',
				name: 'ATR (average true range)',
				def: 'How much the price typically moves per day, in dollars and as a percentage of the price.',
				why: 'It is the volatility ruler: below 2% of price is calm, above 5% is wild. ATR also tells you how far a stop loss must sit to survive normal noise.',
				conns: ['historical-volatility', 'stop-loss', 'bollinger', 'check-status'],
				vex: 'A key statistic on the analysis page and a full indicator check with a percentage-of-price reading.'
			},
			{
				id: 'adx',
				name: 'ADX',
				def: 'Measures how strong a trend is, regardless of direction.',
				why: 'Above 25 there is a real trend to follow; below 20 the market chops sideways and directional signals mislead. ADX tells you whether to trust the other indicators at all.',
				conns: ['sma-ema', 'macd', 'check-status'],
				vex: 'An indicator check; the verdict text warns when trendless conditions make signals unreliable.'
			},
			{
				id: 'obv',
				name: 'OBV (on-balance volume)',
				def: 'Adds up volume on up-days and subtracts it on down-days, tracking whether money is flowing with the price.',
				why: 'Rising OBV confirms a rally is backed by real buying; a rally with falling OBV is on borrowed time. It is volume, translated into a trend line.',
				conns: ['volume', 'mfi', 'check-status'],
				vex: 'Shown as a rising, falling or flat trend with the raw value.'
			},
			{
				id: 'vwap',
				name: 'VWAP',
				def: 'The average price everyone paid for the stock today, weighted by how much traded at each price.',
				why: 'Price above VWAP means today buyers are, on average, in profit; below means they are underwater. Institutions use it as the fair intraday reference.',
				conns: ['volume', 'last-price', 'check-status'],
				vex: 'An indicator check comparing the close to VWAP with the percentage gap.'
			},
			{
				id: 'ichimoku',
				name: 'Ichimoku cloud',
				def: 'A Japanese all-in-one trend system where a shaded cloud acts as dynamic support and resistance.',
				why: 'Above the cloud is an uptrend with the cloud as floor, below is a downtrend with it as ceiling, and inside is indecision. One glance gives trend, support and momentum.',
				conns: ['sma-ema', 'adx', 'check-status'],
				vex: 'Shown as price versus the cloud top and bottom.'
			},
			{
				id: 'cci',
				name: 'CCI (commodity channel index)',
				def: 'How far the price has moved from its 20-day average, adjusted for how wild the swings are.',
				why: 'Above +100 the price is stretched unusually high, below -100 unusually low, which makes it a cyclical overbought and oversold gauge with few false signals in ranges.',
				conns: ['overbought-oversold', 'bollinger', 'check-status'],
				vex: 'An extended indicator check with signed readings.'
			},
			{
				id: 'williams-r',
				name: 'Williams %R',
				def: 'The same close-versus-range idea as Stochastic, but upside-down, running between -100 and 0.',
				why: 'Above -20 is overbought and below -80 is oversold. It reads like Stochastic with the polarity flipped.',
				conns: ['stochastic', 'overbought-oversold', 'check-status'],
				vex: 'One of the extended indicator checks.'
			},
			{
				id: 'mfi',
				name: 'MFI (money flow index)',
				def: 'Like RSI, but weighted by volume, measuring whether money is flowing into or out of the stock over 14 days.',
				why: 'Above 80 means heavy buying that may be exhausting itself, below 20 heavy selling that may be done. Divergence between MFI and price is a classic warning.',
				conns: ['rsi', 'obv', 'volume', 'check-status'],
				vex: 'An extended indicator check that combines price and volume flow.'
			},
			{
				id: 'roc',
				name: 'ROC (rate of change)',
				def: 'The percentage the price moved over the last 12 days.',
				why: 'Big positive numbers mean fast, strong advances; big negative numbers mean sharp declines. It is momentum without the smoothing.',
				conns: ['rsi', 'macd', 'check-status'],
				vex: 'Shown as a signed percentage with thresholds at plus and minus 5%.'
			},
			{
				id: 'psar',
				name: 'PSAR (parabolic SAR)',
				def: 'Dots that trail the price and flip sides when the trend changes.',
				why: 'Dots below the price mean uptrend, above mean downtrend, and a flip is a clean exit or entry cue. It is the indicator for knowing when to stay in and when to get out.',
				conns: ['sma-ema', 'stop-loss', 'adx', 'check-status'],
				vex: 'Shown with a trend arrow and the dot level, plus flip pattern flags.'
			},
			{
				id: 'cmo',
				name: 'CMO (Chande momentum oscillator)',
				def: 'A momentum gauge between -100 and +100 measuring whether buyers or sellers were stronger over 14 days.',
				why: 'Beyond +50 buying has been extreme and may reverse; below -50 selling has been extreme and may bounce. It is RSI in a different scale.',
				conns: ['rsi', 'overbought-oversold', 'check-status'],
				vex: 'An extended momentum check.'
			},
			{
				id: 'verdict-scale',
				name: 'Verdict scale: strong buy to strong sell',
				def: 'The five-step opinion each indicator and the overall page assigns: strong buy, buy, hold, sell, strong sell.',
				why: 'Individual verdicts are votes, not commands: the page scores them (strong opinions count double) and the overall verdict is the tally. Hold means no edge, not a recommendation to do nothing.',
				conns: ['check-status', 'stance', 'news-sentiment'],
				vex: 'Every indicator chip is colored by its verdict, and the symbol strip plus the verdict summary show the overall result; verdicts also drive the strategy engine direction.'
			},
			{
				id: 'overbought-oversold',
				name: 'Overbought and oversold',
				def: 'A condition where the price has run so far and so fast that the move is statistically stretched relative to recent history.',
				why: 'Stretched moves tend to snap back, but in strong trends a stock can stay overbought for weeks. Treat these labels as caution flags, not reversal signals.',
				conns: ['rsi', 'stochastic', 'bollinger', 'mfi', 'verdict-scale'],
				vex: 'The RSI, Stochastic, Williams %R, CCI, MFI and CMO checks all use these labels directly.'
			},
			{
				id: 'check-status',
				name: 'Check status: pass, watch, fail',
				def: 'The traffic-light summary of an indicator verdict: buy and strong buy count as pass, sell and strong sell as fail, everything else as watch, and uncomputable as none.',
				why: 'PASS and FAIL collapse five verdicts into a fast green or red scan, so the page can show how many checks support the overall call at a glance.',
				conns: ['verdict-scale', 'verdict-summary', 'news-sentiment'],
				vex: 'The status icon chips on every indicator card; double-clicking a chip excludes it from the tally and the overall verdict re-scores live.'
			},
			{
				id: 'verdict-summary',
				name: 'Overall verdict and score',
				def: 'The aggregated conclusion: the page adds up indicator scores (strong buy 2, buy 1, hold 0, sell -1, strong sell -2) into one verdict with a count of bullish, neutral and bearish checks.',
				why: 'It is the bottom line the whole analysis page is designed to produce, and it is shown per timeframe (day, week, month) so you can see whether the picture agrees across horizons.',
				conns: ['verdict-scale', 'check-status', 'stance', 'fear-greed-index'],
				vex: 'The symbol strip badge, the summary box and the three timeframe cards all show it.'
			}
		]
	},
	{
		id: 'g-risk-portfolio',
		title: 'Risk and portfolio',
		blurb: 'Managing what you actually own: positions, exits and the discipline around them.',
		entries: [
			{
				id: 'position',
				name: 'Position',
				def: 'A holding in your portfolio, from a handful of shares to an options contract, tracked by entry price and quantity.',
				why: 'A position is where every analysis becomes real money. Recording entry price and quantity is what lets the app judge whether a trade is working.',
				conns: ['stance', 'stop-loss', 'take-profit', 'entry-price'],
				vex: 'The save trade modal records symbol, type, entry price and quantity into the portfolio page.'
			},
			{
				id: 'entry-price',
				name: 'Entry price and quantity',
				def: 'What you paid per share and how many shares (or contracts) you bought.',
				why: 'Entry price is the baseline for every P/L calculation, and quantity is what turns a percentage move into dollars of exposure.',
				conns: ['position', 'breakeven-portfolio', 'max-loss'],
				vex: 'Fields in the save trade modal; the portfolio page uses them to compute total invested and P/L.'
			},
			{
				id: 'stance',
				name: 'Stance',
				def: 'The automated verdict on an open position: take profit, hold, or cut loss, based on the live price versus your entry.',
				why: 'It removes emotion from the hardest decision in trading: what to do with a position right now. A green take profit says the idea worked; a red cut loss says the idea is broken.',
				conns: ['take-profit', 'stop-loss', 'trailing-stop-loss', 'verdict-scale'],
				vex: 'The portfolio page evaluates every saved trade and shows a colored stance badge with a plain-English reason.'
			},
			{
				id: 'stop-loss',
				name: 'Stop loss',
				def: 'A pre-decided exit price at which you sell to cap a loss, so a small mistake cannot become a big one.',
				why: 'A stop decided before entering is discipline; a stop invented while the trade is down is usually panic. Set it at a level the stock noise will not trigger by accident, which is where ATR helps.',
				conns: ['trailing-stop-loss', 'max-loss', 'atr', 'stance'],
				vex: 'The stance engine flags positions whose live price has moved against the entry far enough to warrant cutting.'
			},
			{
				id: 'trailing-stop-loss',
				name: 'Trailing stop loss (TSL)',
				def: 'A stop loss that automatically moves up as the price rises, locking in gains while letting a winner keep running.',
				why: 'It solves the winner problem: you never give back a whole rally, and you never sell just because a stock paused. The stop only ever moves in the profit direction.',
				conns: ['stop-loss', 'take-profit', 'psar', 'position'],
				vex: 'Referenced in the stance reasoning as the way to protect a position that has moved in your favor.'
			},
			{
				id: 'take-profit',
				name: 'Take profit',
				def: 'A pre-decided price or gain at which you sell a winner, converting paper profit into realized profit.',
				why: 'Without a take profit, a winning trade is just a losing trade waiting to happen; with one, you bank the outcome the analysis said was likely.',
				conns: ['stance', 'trailing-stop-loss', 'max-profit', 'risk-reward'],
				vex: 'One of the three stance labels, shown in green when a saved position has gained enough to bank.'
			},
			{
				id: 'breakeven-portfolio',
				name: 'Break-even (portfolio)',
				def: 'The price at which a position is worth exactly what you paid for it, including the entry price adjusted for costs.',
				why: 'It is the psychological anchor of a trade: above it you are managing a winner, below it a loser. Knowing it precisely keeps decisions rational.',
				conns: ['entry-price', 'position', 'take-profit', 'stop-loss'],
				vex: 'The stance reasoning implicitly compares the live price to your recorded entry price.'
			},
			{
				id: 'risk-reward',
				name: 'Risk/reward',
				def: 'How much you stand to lose compared to how much you stand to gain on a trade.',
				why: 'Trades with favorable risk/reward can lose half the time and still make money over many attempts. It is the bridge between a single trade and a profitable process.',
				conns: ['return-on-risk', 'max-loss', 'max-profit', 'expected-value'],
				vex: 'On the strategy cards it appears as return on risk; on the portfolio side it is what stop loss and take profit levels together define.'
			},
			{
				id: 'diversification',
				name: 'Diversification',
				def: 'Spreading your money across different stocks, sectors and asset types so no single failure breaks the portfolio.',
				why: 'Concentration multiplies conviction and ruin alike. A portfolio of uncorrelated positions survives the inevitable wrong call, which is the only kind anyone makes sometimes.',
				conns: ['position', 'peers', 'risk-reward', 'news-sentiment'],
				vex: 'The peer comparison and watchlist tools exist to help you see beyond a single symbol.'
			}
		]
	}
];
