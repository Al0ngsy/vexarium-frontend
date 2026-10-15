import type { AnalysisResponse, PricePoint } from '$lib/types';

// Deterministic API payloads for component tests.
const day = (i: number) => new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10) + 'T00:00:00Z';
export function bars(n = 60, base = 100, drift = 0.4): PricePoint[] {
	return Array.from({ length: n }, (_, i) => {
		const c = base + i * drift + Math.sin(i / 3) * 3;
		return { t: day(i), open: c - 0.5, high: c + 1.2, low: c - 1.3, close: c, source: 'alpaca' };
	});
}
export function analysisFixture(tf: string, verdictShift = 0): AnalysisResponse {
	const b = bars(60);
	const mk = (f: (i: number) => number) => b.map((p, i) => ({ t: p.t, v: f(i) }));
	const verdicts = ['strong_buy', 'buy', 'hold', 'sell', 'none', 'buy', 'strong_sell'] as const;
	const names = ['RSI (14)', 'MACD', 'SMA 50', 'ATR (14)', 'Parabolic SAR', 'Bollinger', 'OBV'];
	return {
		symbol: 'AAPL', asset_type: 'stock', timeframe: tf, current_price: 123.45, day_change_pct: 1.2, ytd_change_pct: 12.34,
		overall: { overall_verdict: tf === '1w' ? 'sell' : tf === '1mo' ? 'hold' : 'buy', score: 3, indicator_count: 7, breakdown: [] },
		indicators: names.map((name, i) => ({ name, verdict: verdicts[(i + verdictShift) % verdicts.length], value: name.startsWith('RSI') ? 28 : name.startsWith('ATR') ? 2.345 : name === 'MACD' ? { macd: 1.2, signal: 0.8, hist: 0.4 } : 100 + i })),
		analyzed_at: '2026-07-01T10:00:00Z',
		price_series: b,
		indicator_series: [
			{ name: 'RSI (14)', kind: 'oscillator' as const, points: mk((i) => 30 + (i % 20) * 2.2 - (i > 40 ? 12 : 0)) },
			{ name: 'MACD', kind: 'oscillator' as const, points: mk((i) => Math.sin(i / 4) * 2) },
			{ name: 'SMA 50', kind: 'overlay' as const, points: mk((i) => 100 + i * 0.35 + (i > 30 ? 2 : -2)) },
			{ name: 'Parabolic SAR', kind: 'overlay' as const, points: mk((i) => 98 + i * 0.4 + (i > 50 ? 12 : 0)) }
		],
		news_sentiment: { sentiment_score: 0.35, article_count: 3, summary: 'Positive' },
		news_articles: [
			{ headline: 'Apple does a thing', source: 'Wire', url: 'https://example.com/a', created_at: '2026-06-30T12:00:00Z', sentiment: 0.5 },
			{ headline: 'Another <b>headline</b>', source: null, url: null, created_at: null, sentiment: null },
			{ headline: 'Bearish take', source: 'Blog', url: 'https://example.com/c', created_at: '2026-06-29T12:00:00Z', sentiment: -0.6 }
		],
		company: { symbol: 'AAPL', name: 'Apple Inc.', description: 'Makes phones.', currency: 'USD', market_cap: 3.1e12, pe_ratio: 31.2, ps_ratio: 8.1, dividend_yield: 0.0045, high_52w: 130, low_52w: 90, shares_outstanding: 15.2e9, sector: 'Tech', industry: 'Consumer Electronics', exchange: 'NASDAQ' }
	};
}
export const finnhub = {
	insider: [{ name: 'Tim', shares: 1200, change: -500, filing_date: '2026-06-01' }],
	earnings: [{ period: '2026-03-31', estimate: 1.2, actual: 1.4, surprise_pct: 16.6 }],
	peers: ['MSFT', 'GOOG', 'aapl', 'AMZN']
};
export const marketNews = { sentiment: { sentiment_score: 0.1, article_count: 2, summary: 'Mixed' }, articles: [{ headline: 'Market up', source: 'X', url: 'https://example.com/m', created_at: '2026-06-30T00:00:00Z', sentiment: 0.1 }] };
export const fearGreed = { score: 62.4, rating: 'greed', timestamp: '2026-07-01T00:00:00Z', previous_1_week: 55, previous_1_month: 70, history: Array.from({ length: 30 }, (_, i) => ({ t: `2026-06-${String(i + 1).padStart(2, '0')}`, v: 40 + i })) };
