import { describe, expect, it } from 'vitest';
import {
	bucketScore,
	computePatternFlags,
	computeStatsRows,
	computeVitals,
	mergeBars,
	scoreIndicators
} from './analysis-derive';
import type { AnalysisResponse, IndicatorResult, PricePoint, Verdict } from './types';

const bar = (t: string, close: number): PricePoint => ({ t, open: close, high: close, low: close, close });
const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-06-${String(i + 1).padStart(2, '0')}`);
const barsFrom = (closes: number[]) => days(closes.length).map((t, i) => bar(t, closes[i]));
const pts = (vals: number[]) => days(vals.length).map((t, i) => ({ t, v: vals[i] }));

function analysis(over: Partial<AnalysisResponse> = {}): AnalysisResponse {
	return {
		symbol: 'AAPL',
		asset_type: 'stock',
		current_price: 100,
		overall: { overall_verdict: 'hold', score: 0, indicator_count: 0, breakdown: [] },
		indicators: [],
		...over
	};
}
const ind = (name: string, verdict: Verdict, value: IndicatorResult['value'] = null): IndicatorResult => ({
	name,
	verdict,
	value
});

describe('mergeBars', () => {
	it('replaces overlapping bars by timestamp and appends new ones', () => {
		const merged = mergeBars(barsFrom([1, 2, 3]), [bar('2026-06-03', 30), bar('2026-06-04', 4)]);
		expect(merged.map((b) => [b.t, b.close])).toEqual([
			['2026-06-01', 1],
			['2026-06-02', 2],
			['2026-06-03', 30],
			['2026-06-04', 4]
		]);
	});

	it('caps the series at 600 bars, dropping the oldest', () => {
		const old = Array.from({ length: 600 }, (_, i) => bar(`t${String(i).padStart(4, '0')}`, i));
		const merged = mergeBars(old, [bar('t9999', 1), bar('t9998', 2)]);
		expect(merged).toHaveLength(600);
		expect(merged[0].t).toBe('t0002');
		expect(merged[599].t).toBe('t9998');
	});
});

describe('bucketScore', () => {
	it('maps the summed indicator score to a verdict', () => {
		expect(bucketScore(10)).toBe('strong_buy');
		expect(bucketScore(5)).toBe('strong_buy');
		expect(bucketScore(4)).toBe('buy');
		expect(bucketScore(2)).toBe('buy');
		expect(bucketScore(1)).toBe('hold');
		expect(bucketScore(0)).toBe('hold');
		expect(bucketScore(-1)).toBe('hold');
		expect(bucketScore(-2)).toBe('sell');
		expect(bucketScore(-4)).toBe('sell');
		expect(bucketScore(-5)).toBe('strong_sell');
	});
});

describe('scoreIndicators', () => {
	const all = [
		ind('A', 'strong_buy'),
		ind('B', 'buy'),
		ind('C', 'hold'),
		ind('D', 'sell'),
		ind('E', 'none')
	];

	it('sums scores, counts buckets and ignores verdict "none"', () => {
		expect(scoreIndicators(all, {})).toEqual({
			score: 2, // +2 +1 +0 -1
			verdict: 'buy',
			count: 4,
			bull: 2,
			bear: 1,
			neutral: 1
		});
	});

	it('leaves out excluded indicators', () => {
		const r = scoreIndicators(all, { A: true });
		expect(r.score).toBe(0);
		expect(r.verdict).toBe('hold');
		expect(r.count).toBe(3);
	});

	it('is neutral without indicators', () => {
		expect(scoreIndicators([], {})).toEqual({ score: 0, verdict: 'hold', count: 0, bull: 0, bear: 0, neutral: 0 });
	});
});

describe('computePatternFlags', () => {
	it('is empty without bars', () => {
		expect(computePatternFlags(null, analysis())).toEqual([]);
		expect(computePatternFlags([], analysis())).toEqual([]);
	});

	it('flags the latest MACD histogram sign flip with its age in bars', () => {
		const a = analysis({ indicator_series: [{ name: 'MACD', kind: 'oscillator', points: pts([-1, -0.5, 0.2, 0.4, 0.5]) }] });
		const flags = computePatternFlags(barsFrom([1, 2, 3, 4, 5]), a);
		expect(flags).toContainEqual({ label: 'MACD histogram turned positive', dir: 'bullish', ago: 2 });
	});

	it('flags RSI leaving oversold and entering overbought', () => {
		const up = analysis({ indicator_series: [{ name: 'RSI (14)', kind: 'oscillator', points: pts([40, 25, 29, 31]) }] });
		expect(computePatternFlags(barsFrom([1, 2, 3, 4]), up)).toContainEqual({
			label: 'RSI crossed above 30, leaving oversold',
			dir: 'bullish',
			ago: 0
		});
		const down = analysis({ indicator_series: [{ name: 'RSI', kind: 'oscillator', points: pts([50, 65, 72]) }] });
		expect(computePatternFlags(barsFrom([1, 2, 3]), down)).toContainEqual({
			label: 'RSI crossed above 70 into overbought',
			dir: 'bearish',
			ago: 0
		});
	});

	it('flags a PSAR flip below price as bullish', () => {
		// SAR above price, then below it from the 3rd bar on.
		const a = analysis({
			indicator_series: [{ name: 'Parabolic SAR', kind: 'overlay', points: pts([12, 12, 8, 9]) }]
		});
		const flags = computePatternFlags(barsFrom([10, 10, 10, 10]), a);
		expect(flags).toContainEqual({ label: 'PSAR flipped below price', dir: 'bullish', ago: 1 });
	});

	it('flags price crossing above its SMA as bullish', () => {
		// SMA above price, then below it from the 3rd bar on: the price rose through the average.
		const a = analysis({ indicator_series: [{ name: 'SMA(50)', kind: 'overlay', points: pts([12, 12, 8, 9]) }] });
		expect(computePatternFlags(barsFrom([10, 10, 10, 10]), a)).toContainEqual({
			label: 'Price crossed above SMA',
			dir: 'bullish',
			ago: 1
		});
	});

	it('flags price crossing below its SMA as bearish', () => {
		const a = analysis({ indicator_series: [{ name: 'SMA(50)', kind: 'overlay', points: pts([8, 8, 12, 11]) }] });
		expect(computePatternFlags(barsFrom([10, 10, 10, 10]), a)).toContainEqual({
			label: 'Price crossed below SMA',
			dir: 'bearish',
			ago: 1
		});
	});

	it('never calls a single-SMA flip a golden or death cross', () => {
		for (const sma of [[12, 12, 8, 9], [8, 8, 12, 11]]) {
			const a = analysis({ indicator_series: [{ name: 'SMA(50)', kind: 'overlay', points: pts(sma) }] });
			expect(computePatternFlags(barsFrom([10, 10, 10, 10]), a).map((f) => f.label).join()).not.toMatch(/golden|death/i);
		}
	});

	it('reports no SMA flag while price stays on one side of the average', () => {
		const a = analysis({ indicator_series: [{ name: 'SMA(50)', kind: 'overlay', points: pts([8, 8, 9, 9]) }] });
		expect(computePatternFlags(barsFrom([10, 10, 10, 10]), a)).toEqual([]);
	});

	it('flags prices within 3% of the 52-week high or low', () => {
		const high = analysis({ current_price: 99, company: { symbol: 'AAPL', high_52w: 100, low_52w: 50 } });
		expect(computePatternFlags(barsFrom([99]), high)).toContainEqual({
			label: 'Near 52-week high (1.0% below)',
			dir: 'bullish',
			ago: 0
		});
		const low = analysis({ current_price: 51, company: { symbol: 'AAPL', high_52w: 100, low_52w: 50 } });
		expect(computePatternFlags(barsFrom([51]), low)).toContainEqual({
			label: 'Near 52-week low (2.0% above)',
			dir: 'bearish',
			ago: 0
		});
		const mid = analysis({ current_price: 75, company: { symbol: 'AAPL', high_52w: 100, low_52w: 50 } });
		expect(computePatternFlags(barsFrom([75]), mid)).toEqual([]);
	});

	it('skips a flag whose series is missing', () => {
		expect(computePatternFlags(barsFrom([1, 2, 3]), analysis({ indicator_series: [] }))).toEqual([]);
	});
});

describe('computeStatsRows', () => {
	it('is empty without an analysis and hides rows for missing fields', () => {
		expect(computeStatsRows(null)).toEqual([]);
		expect(computeStatsRows(analysis({ company: null }))).toEqual([]);
	});

	it('formats the available company fields', () => {
		const rows = computeStatsRows(
			analysis({
				current_price: 90,
				ytd_change_pct: 12.34,
				company: {
					symbol: 'AAPL',
					currency: 'USD',
					market_cap: 3.1e12,
					pe_ratio: 31.24,
					ps_ratio: 8.1,
					dividend_yield: 0.012,
					high_52w: 100,
					low_52w: 60,
					shares_outstanding: 15.2e9
				}
			})
		);
		const byKey = Object.fromEntries(rows.map((r) => [r.k, r]));
		expect(byKey['Market cap'].v).toBe('$3.10T');
		expect(byKey['P/E'].v).toBe('31.2x');
		expect(byKey['P/S'].v).toBe('8.1x');
		expect(byKey['Dividend yield'].v).toBe('1.2%');
		expect(byKey['% off 52-week high']).toEqual({ k: '% off 52-week high', v: '-10.0%', color: '#f87171' });
		expect(byKey['YTD change']).toEqual({ k: 'YTD change', v: '+12.3%', color: '#34d399' });
		expect(byKey['52-week range'].v).toBe('60.00–100.00');
		expect(byKey['Shares outstanding'].v).toBe('15.20B');
	});
});

describe('computeVitals', () => {
	it('is empty without an analysis', () => {
		expect(computeVitals(null, 'AAPL', '1d')).toEqual([]);
	});

	it('shows price, range, volatility and momentum', () => {
		const vitals = computeVitals(
			analysis({
				current_price: 123.45,
				timeframe: '1w',
				company: { symbol: 'AAPL', currency: 'USD', low_52w: 90, high_52w: 130 },
				indicators: [ind('ATR (14)', 'hold', 2.345), ind('RSI (14)', 'buy', 28)]
			}),
			'AAPL',
			'1d'
		);
		expect(vitals).toEqual([
			{ k: 'Price', v: '$123.45', d: 'AAPL · STOCK' },
			{ k: '52-week range', v: '90.00–130.00', d: 'yearly low–high' },
			{ k: 'Volatility - 1w', v: 'ATR 2.3', d: 'avg weekly move' },
			{ k: 'Momentum - 1w', v: 'RSI 28', d: 'oversold' }
		]);
	});

	it('falls back to the selected indicator timeframe and reads ATR from a value object', () => {
		const vitals = computeVitals(analysis({ indicators: [ind('ATR', 'hold', { atr: 1.5 })] }), 'AAPL', '1mo');
		expect(vitals.find((v) => v.k.startsWith('Volatility'))).toEqual({
			k: 'Volatility - 1mo',
			v: 'ATR 1.5',
			d: 'avg monthly move'
		});
	});
});
