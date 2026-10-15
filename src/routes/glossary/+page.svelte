<script lang="ts">
	import { GLOSSARY_GROUPS, type GlossaryEntry } from '$lib/glossary-data';

	// Plain-English appendix for every term VEXARIUM shows.
	// Grouped beginner to advanced; entries cross-link via anchor ids.
	// Search is a plain client-side filter over name + all text.

	let q = $state('');

	function hay(e: GlossaryEntry): string {
		return (e.name + ' ' + e.def + ' ' + e.why + ' ' + (e.vex ?? '') + ' ' + e.conns.join(' ')).toLowerCase();
	}

	const NAME = new Map<string, string>();
	for (const g of GLOSSARY_GROUPS) for (const e of g.entries) NAME.set(e.id, e.name);

	const visibleGroups = $derived(
		q.trim() === ''
			? GLOSSARY_GROUPS
			: GLOSSARY_GROUPS.map((g) => ({ ...g, entries: g.entries.filter((e) => hay(e).includes(q.trim().toLowerCase())) }))
					.filter((g) => g.entries.length > 0)
	);

	const matchCount = $derived(
		q.trim() === '' ? GLOSSARY_GROUPS.reduce((n, g) => n + g.entries.length, 0) : visibleGroups.reduce((n, g) => n + g.entries.length, 0)
	);
</script>

<div class="gloss-grid">
	<!-- Sticky sidebar: group index, desktop only. -->
	<nav class="side" aria-label="Glossary groups">
		<p class="label block mb-2" style="color: var(--foreground-subtle)">Groups</p>
		<div class="flex flex-col gap-1">
			{#each GLOSSARY_GROUPS as g}
				<a href="#{g.id}" class="side-link">{g.title}</a>
			{/each}
			<a href="#how-it-fits" class="side-link">How it fits together</a>
		</div>
	</nav>

	<main>
		<!-- Header + search -->
		<header>
			<h1 class="brand" style="font-size: 1.5rem">Glossary</h1>
			<p class="label" style="color: var(--foreground-muted); text-transform: none; line-height: 1.6; margin-top: 6px; max-width: 640px">
				Plain-English explanations of every term VEXARIUM shows: market data, options, greeks, strategies,
				indicators and portfolio management. Start anywhere, or search.
			</p>
			<div class="search">
				<input
					type="search"
					bind:value={q}
					placeholder="Search terms, for example delta or stop loss"
					aria-label="Search glossary"
				/>
				<span class="label" style="color: var(--foreground-subtle); white-space: nowrap; flex-shrink: 0">
					{matchCount} {matchCount === 1 ? 'term' : 'terms'}
				</span>
			</div>
		</header>

		<!-- Mobile chip row -->
		<nav class="chips" aria-label="Glossary groups">
			{#each GLOSSARY_GROUPS as g}
				<a href="#{g.id}" class="chip">{g.title}</a>
			{/each}
			<a href="#how-it-fits" class="chip">How it fits together</a>
		</nav>

		{#each visibleGroups as g}
			<section id={g.id} class="group">
				<h2 class="group-title">{g.title}</h2>
				<p class="label" style="color: var(--foreground-subtle); text-transform: none; margin-bottom: 14px">{g.blurb}</p>
				<div class="flex flex-col gap-3">
					{#each g.entries as e}
						<article id={e.id} class="entry">
							<h3 class="entry-name">{e.name}</h3>
							<p class="entry-def">{e.def}</p>
							<p class="entry-why"><span class="label">Why it matters: </span>{e.why}</p>
							{#if e.conns.length > 0}
								<p class="entry-conns">
									<span class="label">Related: </span>
									{#each e.conns as c, i}
										{#if NAME.has(c)}
											<a href="#{c}">{NAME.get(c)}</a>{i < e.conns.length - 1 ? ', ' : ''}
										{/if}
									{/each}
								</p>
							{/if}
							{#if e.vex}
								<p class="entry-vex">In VEXARIUM: {e.vex}</p>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		{/each}

		{#if visibleGroups.length === 0}
			<div class="panel p-8 text-center">
				<p class="label" style="color: var(--foreground-muted)">No terms match "{q}". Try a shorter word.</p>
			</div>
		{/if}

		<!-- How the pieces fit together -->
		<section id="how-it-fits" class="group">
			<h2 class="group-title">How the pieces fit together</h2>
			<div class="panel p-5 flex flex-col gap-3" style="line-height: 1.7; font-size: 0.9rem; color: var(--foreground-muted)">
				<p>
					You start with direction. The analysis page runs every indicator in this glossary against the
					price history and tallies the verdicts into one overall call, from strong buy to strong sell. The
					traffic-light checks (pass, watch, fail) show which side the evidence is on, the fear and greed
					index frames the market mood, and news sentiment tells you whether headlines agree with the
					charts. If the evidence is mixed, that in itself is the answer: no edge, smaller size or no trade.
				</p>
				<p>
					Once you have a direction, the option chain is where you pick the instrument. For every
					expiration you see calls and puts at every strike, with bid, ask, last price, model value and
					implied volatility. Moneyness and the distance percentage tell you how far each contract is from
					the current price, and IV tells you how much the market expects the stock to move. Cheap-looking
					options are usually cheap because they are far out of the money or about to decay.
				</p>
				<p>
					Before committing, you read the risk numbers. The greeks describe the position: delta for
					direction, gamma for how violently it reacts, theta for the cost of waiting, vega for exposure to
					volatility. The payoff curve draws the shape of the trade, the P/L matrix projects it across
					strikes and dates, and the probability widget converts it into odds, expected value and breakeven.
					A strategy that fits the picture shows its max profit, max loss and return on risk on the cards,
					so you can compare ideas by reward per dollar at risk rather than by hope.
				</p>
				<p>
					Finally, you manage what you own. Every trade you save gets a stance: take profit when the thesis
					worked, cut loss when it broke, hold while it is still playing out. Stop losses and take profits
					convert the analysis into rules that survive emotion, and a trailing stop lets a winner run
					without giving back the gains. Across the whole portfolio, diversification keeps one wrong call
					from being the only story. The glossary ends where the trading begins: understanding first, size
					second, discipline always.
				</p>
			</div>
		</section>
	</main>
</div>

<style>
	.gloss-grid {
		display: grid;
		gap: 28px;
	}
	@media (min-width: 1024px) {
		.gloss-grid {
			grid-template-columns: 200px minmax(0, 1fr);
		}
	}
	.side {
		display: none;
		position: sticky;
		top: 72px;
		align-self: start;
		max-height: calc(100vh - 88px);
		overflow-y: auto;
		padding-right: 8px;
	}
	@media (min-width: 1024px) {
		.side {
			display: block;
		}
	}
	.side-link {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--foreground-muted);
		text-decoration: none;
		padding: 4px 8px;
		border-radius: 6px;
	}
	.side-link:hover {
		color: var(--accent-primary);
		background: var(--surface-2);
	}
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 14px;
		padding: 8px 14px;
		max-width: 560px;
		background: var(--surface-2);
		border: 1px solid var(--panel-border);
		border-radius: 8px;
	}
	.search:focus-within {
		border-color: var(--accent-primary);
	}
	.search input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--foreground);
		font-family: var(--font-body);
		font-size: 0.85rem;
	}
	.search input::placeholder {
		color: var(--foreground-subtle);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	@media (min-width: 1024px) {
		.chips {
			display: none;
		}
	}
	.chip {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--foreground-muted);
		text-decoration: none;
		padding: 5px 12px;
		border: 1px solid var(--panel-border);
		border-radius: 999px;
		background: var(--surface);
	}
	.chip:hover {
		color: var(--accent-primary);
		border-color: var(--accent-primary);
	}
	.group {
		scroll-margin-top: 76px;
		margin-top: 28px;
	}
	.group:first-of-type {
		margin-top: 8px;
	}
	.group-title {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--foreground);
		border-bottom: 1px solid var(--panel-border);
		padding-bottom: 8px;
		margin-bottom: 4px;
	}
	.entry {
		scroll-margin-top: 76px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--panel-border);
		border-radius: 8px;
		border-left: 3px solid var(--panel-border);
	}
	.entry:target {
		border-color: var(--accent-primary);
		border-left-color: var(--accent-primary);
	}
	.entry-name {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--foreground);
		margin-bottom: 4px;
	}
	.entry-def {
		font-size: 0.85rem;
		color: var(--foreground);
		line-height: 1.55;
		margin-bottom: 6px;
	}
	.entry-why,
	.entry-conns {
		font-size: 0.78rem;
		color: var(--foreground-muted);
		line-height: 1.55;
		margin: 2px 0;
	}
	.entry-conns a {
		color: var(--accent-primary);
		text-decoration: none;
	}
	.entry-conns a:hover {
		text-decoration: underline;
	}
	.entry-vex {
		font-size: 0.72rem;
		color: var(--foreground-subtle);
		line-height: 1.5;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px dashed var(--panel-border);
	}
</style>