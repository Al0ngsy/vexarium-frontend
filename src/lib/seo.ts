// Per-route SEO data. Pages return `{ seo }` from their load function and the
// root layout renders it once (title, description, Open Graph), so
// a page never has to emit its own meta tags next to the layout's. No canonical /
// og:url: prerendered pages only know a placeholder origin at build time.

export interface Seo {
	title: string;
	description: string;
	/** Ask search engines to skip the page (account and auth screens). */
	noindex?: boolean;
}

export const DEFAULT_SEO: Seo = {
	title: 'VEXARIUM',
	description:
		'VEXARIUM — check before you buy or sell. Technical indicator and options analysis. Informational only, not financial advice.'
};

/** Symbols arrive from the URL: normalise for display. */
export function normalizeSymbol(raw: string): string {
	return raw.trim().toUpperCase();
}

export function stockSeo(rawSymbol: string): Seo {
	const symbol = normalizeSymbol(rawSymbol);
	return {
		title: `${symbol} analysis: indicators, verdict and AI opinion | VEXARIUM`,
		description: `Technical analysis for ${symbol}: indicator checks, a buy/hold/sell verdict across 1-day, 1-week and 1-month timeframes, key statistics, news sentiment and an AI second opinion. Informational only, not financial advice.`
	};
}

export function optionsSeo(rawSymbol: string): Seo {
	const symbol = normalizeSymbol(rawSymbol);
	return {
		title: `${symbol} options: chain, greeks, payoff and strategies | VEXARIUM`,
		description: `${symbol} options workspace: option chain by expiry, greeks, payoff explorer, chance of profit, P/L matrix and strategy ideas. Quotes are delayed and indicative. Informational only, not financial advice.`
	};
}

/** SEO for sign-in / account screens: no search value, so keep them out of the index. */
export function privateSeo(title: string): Seo {
	return {
		title: `${title} | VEXARIUM`,
		description: 'VEXARIUM account. Informational only, not financial advice.',
		noindex: true
	};
}
