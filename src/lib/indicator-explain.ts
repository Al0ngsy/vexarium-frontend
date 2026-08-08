// ---------------------------------------------------------------------------
// Beginner-friendly explanations for the technical checks table.
//
// Every indicator gets:
//   - what:    a plain-language explanation of what the indicator measures
//   - format:  how to render its reading (prices as $, oscillators as %, …)
//   - reason:  why the current reading produced PASS / WATCH / FAIL,
//              derived from the actual values (not just the verdict)
// ---------------------------------------------------------------------------

import type { IndicatorResult } from '$lib/types';

export type CheckStatus = 'pass' | 'watch' | 'fail' | 'none';

export function verdictToStatus(v: string): CheckStatus {
	if (v === 'none') return 'none';
	if (['buy', 'strong_buy'].includes(v)) return 'pass';
	if (['sell', 'strong_sell'].includes(v)) return 'fail';
	return 'watch';
}

export const STATUS_LABEL: Record<CheckStatus, string> = {
	pass: 'PASS',
	watch: 'WATCH',
	fail: 'FAIL',
	none: 'NONE'
};

export const STATUS_ICON: Record<CheckStatus, string> = {
	pass: '✓',
	watch: '△',
	fail: '✗',
	none: '–'
};

// --- value helpers ----------------------------------------------------------

function num(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function money(v: number | null, digits = 2): string {
	return v === null ? '—' : `$${v.toFixed(digits)}`;
}

function pct(v: number | null, digits = 1): string {
	return v === null ? '—' : `${(v * 100).toFixed(digits)}%`;
}

function pctRaw(v: number | null, digits = 1): string {
	// value is already a percentage (0-100 scale)
	return v === null ? '—' : `${v.toFixed(digits)}%`;
}

function signed(v: number | null, digits = 2): string {
	return v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;
}

function posInRange(price: number | null, lo: number | null, hi: number | null): string {
	if (price === null || lo === null || hi === null || hi <= lo) return '';
	const p = ((price - lo) / (hi - lo)) * 100;
	if (p < 0) return ' (below the range)';
	if (p > 100) return ' (above the range)';
	return ` (${p.toFixed(0)}% up the range)`;
}

// --- per-indicator definitions ----------------------------------------------

interface IndicatorExplain {
	what: string;
	format: (value: IndicatorResult['value']) => string;
	reason: (value: IndicatorResult['value'], status: CheckStatus) => string;
}

const EXPLAIN: Record<string, IndicatorExplain> = {
	'RSI(14)': {
		what: 'Measures how fast the price has been moving up or down over 14 days, on a 0–100 scale. Above 70 = overbought (price may have run too far, too fast). Below 30 = oversold (price may have fallen too far).',
		format: (v) => pctRaw(num(v)),
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r < 30 ? 'Oversold — sellers may be exhausted, a bounce is often near.' : 'Healthy momentum — not overbought, room to keep moving.';
			if (s === 'fail') return r > 70 ? 'Overbought — buyers may be exhausted, a pullback is often near.' : 'Momentum is weak — price is losing upward drive.';
			return r >= 30 && r <= 70 ? 'Neutral zone — no strong signal either way.' : 'Approaching an extreme — watch for a turn.';
		}
	},
	'SMA(50)/EMA(200)': {
		what: 'Compares the price to its 50-day average (short-term trend) and 200-day average (long-term trend). Price above both = uptrend. Below both = downtrend.',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			const p = num(d.current_price);
			const sma = num(d.sma50);
			const ema = num(d.ema200);
			return `${money(p)} vs SMA50 ${money(sma)} · EMA200 ${money(ema)}`;
		},
		reason: (v, st) => {
			const d = v as Record<string, unknown> | null;
			const p = num(d?.current_price);
			const sma = num(d?.sma50);
			const ema = num(d?.ema200);
			if (p === null || sma === null || ema === null) return 'No reading available.';
			if (st === 'pass') return 'Price is above both averages — the trend is up.';
			if (st === 'fail') return 'Price is below both averages — the trend is down.';
			return p > sma
				? 'Above the 50-day but below the 200-day — a recovering trend that has not confirmed yet.'
				: 'Below the 50-day but above the 200-day — a pullback inside a longer uptrend.';
		}
	},
	'MACD(12,26,9)': {
		what: 'Shows whether short-term momentum is stronger or weaker than long-term momentum. The histogram is the gap between the two lines — positive = bulls in control, negative = bears in control.',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			return `MACD ${signed(num(d.macd))} · Signal ${signed(num(d.signal))} · Hist ${signed(num(d.histogram))}`;
		},
		reason: (v, s) => {
			const d = v as Record<string, unknown> | null;
			const h = num(d?.histogram);
			const m = num(d?.macd);
			const sig = num(d?.signal);
			if (h === null || m === null || sig === null) return 'No reading available.';
			if (s === 'pass') return h > 0 ? 'Momentum is positive and the MACD line is above its signal — bulls in control.' : 'Momentum is turning positive — early sign of a shift.';
			if (s === 'fail') return h < 0 ? 'Momentum is negative and the MACD line is below its signal — bears in control.' : 'Momentum is fading — early sign of weakness.';
			return h > 0 ? 'Positive momentum, but the lines are close — the signal is not decisive yet.' : 'Negative momentum, but the lines are close — the signal is not decisive yet.';
		}
	},
	'Bollinger(20,2)': {
		what: 'Draws a band two standard deviations around the 20-day average. Price near the lower band = unusually cheap vs recent history. Near the upper band = unusually expensive. %B shows where price sits inside the band (0 = bottom, 1 = top).',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			const p = num(d.current_price);
			const lo = num(d.lower);
			const hi = num(d.upper);
			const b = num(d.pct_b);
			return `${money(p)} · %B ${b === null ? '—' : b.toFixed(2)} (band ${money(lo)}–${money(hi)})`;
		},
		reason: (v, s) => {
			const d = v as Record<string, unknown> | null;
			const b = num(d?.pct_b);
			if (b === null) return 'No reading available.';
			if (s === 'pass') return b < 0.2 ? 'Price is near the bottom of its recent range — often a better entry point.' : 'Price is below the middle of the band — relatively cheap vs recent history.';
			if (s === 'fail') return b > 0.8 ? 'Price is near the top of its recent range — often a worse entry point.' : 'Price is above the middle of the band — relatively expensive vs recent history.';
			return 'Price is in the middle of the band — fairly valued vs recent history.';
		}
	},
	'Stochastic(14,3)': {
		what: 'Shows where the latest price sits within the high–low range of the last 14 days, on a 0–100 scale. Above 80 = overbought. Below 20 = oversold.',
		format: (v) => pctRaw(num(v)),
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r < 20 ? 'Oversold — the price is near the bottom of its recent range, a bounce is often near.' : 'Below 40 — momentum is turning up from a low level.';
			if (s === 'fail') return r > 80 ? 'Overbought — the price is near the top of its recent range, a pullback is often near.' : 'Above 60 — momentum is fading from a high level.';
			return 'Neutral zone — no strong signal either way.';
		}
	},
	'ATR(14)': {
		what: 'Measures how much the price typically moves per day (volatility). A higher number = bigger swings = riskier. Useful for sizing positions and setting stop-losses.',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			const a = num(d.atr);
			const c = num(d.close);
			if (a === null) return '—';
			const pctOfPrice = c && c > 0 ? ` (${((a / c) * 100).toFixed(1)}% of price)` : '';
			return `${money(a)}/day${pctOfPrice}`;
		},
		reason: (v, s) => {
			const d = v as Record<string, unknown> | null;
			const a = num(d?.atr);
			const c = num(d?.close);
			if (a === null || c === null || c <= 0) return 'No reading available.';
			const p = (a / c) * 100;
			if (p < 2) return 'Low volatility — the stock moves less than 2% per day on average. Calmer, but less opportunity.';
			if (p > 5) return 'High volatility — the stock moves more than 5% per day on average. Expect bigger swings in either direction.';
			return 'Moderate volatility — typical day-to-day movement.';
		}
	},
	'ADX(25)': {
		what: 'Measures how strong a trend is, regardless of direction. Above 25 = a real trend is underway. Below 20 = the market is chopping sideways with no clear trend.',
		format: (v) => pctRaw(num(v)),
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r >= 25 ? 'A strong trend is underway — trend-following signals are more reliable.' : 'A trend is forming — early but present.';
			if (s === 'fail') return r < 20 ? 'No real trend — the market is chopping sideways. Directional signals are unreliable.' : 'Trend strength is fading.';
			return 'Trend strength is building but not confirmed yet.';
		}
	},
	'OBV': {
		what: 'Adds up volume on up-days and subtracts it on down-days. Rising OBV = buyers are behind the move (volume confirms). Falling OBV = the rally is not supported by real buying.',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			const o = num(d.obv);
			const t = d.trend;
			return `${t === 'rising' ? '↑' : t === 'falling' ? '↓' : '→'} ${t ?? '—'} (${o === null ? '—' : o.toLocaleString()})`;
		},
		reason: (v, s) => {
			const d = v as Record<string, unknown> | null;
			const t = d?.trend;
			if (s === 'pass') return t === 'rising' ? 'Volume is flowing in on up-days — the move is backed by real buying.' : 'Volume is starting to accumulate.';
			if (s === 'fail') return t === 'falling' ? 'Volume is leaving on down-days — rallies are not being supported by buyers.' : 'Volume is starting to drain.';
			return 'Volume flow is flat — no clear confirmation either way.';
		}
	},
	'VWAP': {
		what: 'The average price everyone paid today, weighted by volume. Price above VWAP = today\'s buyers are, on average, in profit (bullish). Below = today\'s buyers are underwater (bearish).',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			const w = num(d.vwap);
			const c = num(d.close);
			return `${money(c)} vs VWAP ${money(w)}`;
		},
		reason: (v, s) => {
			const d = v as Record<string, unknown> | null;
			const w = num(d?.vwap);
			const c = num(d?.close);
			if (w === null || c === null || w <= 0) return 'No reading available.';
			const diff = ((c - w) / w) * 100;
			if (s === 'pass') return `Price is ${diff.toFixed(1)}% above today's average — buyers are in control.`;
			if (s === 'fail') return `Price is ${Math.abs(diff).toFixed(1)}% below today's average — sellers are in control.`;
			return 'Price is sitting right at today\'s average — a tug-of-war between buyers and sellers.';
		}
	},
	'Ichimoku': {
		what: 'A Japanese all-in-one trend system. The cloud (shaded area) is support/resistance: price above the cloud = uptrend, below = downtrend, inside = indecision. Conversion/Base are short and medium trend lines.',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			const c = num(d.close);
			const t = num(d.cloud_top);
			const b = num(d.cloud_bottom);
			return `${money(c)} vs cloud ${money(b)}–${money(t)}`;
		},
		reason: (v, s) => {
			const d = v as Record<string, unknown> | null;
			const c = num(d?.close);
			const t = num(d?.cloud_top);
			const b = num(d?.cloud_bottom);
			if (c === null || t === null || b === null) return 'No reading available.';
			if (s === 'pass') return 'Price is above the cloud — the trend is up, and the cloud below acts as support.';
			if (s === 'fail') return 'Price is below the cloud — the trend is down, and the cloud above acts as resistance.';
			return 'Price is inside the cloud — the market is undecided, no clear trend.';
		}
	},
	'CCI(20)': {
		what: 'Measures how far the price has moved from its average over the last 20 days, adjusted for how wild the swings are. Above +100 = the price is stretched unusually high (overbought). Below -100 = it is stretched unusually low (oversold).',
		format: (v) => signed(num(v)),
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r < -100 ? 'Deeply oversold — the price has fallen well below its normal range; a bounce is often near.' : 'Oversold — the price is below its typical range, sellers may be running out of steam.';
			if (s === 'fail') return r > 100 ? 'Overbought — the price has run well above its normal range; a pullback is often near.' : 'Overbought — the price is stretched above its typical range, buyers may be exhausted.';
			return 'Near the middle of its range — no strong signal either way.';
		}
	},
	'Williams %R(14)': {
		what: 'Like Stochastic, it shows where the latest price sits inside the high–low range of the last 14 days, but upside-down: it is always between -100 and 0. Above -20 = overbought. Below -80 = oversold.',
		format: (v) => pctRaw(num(v)),
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r < -80 ? 'Oversold — the price is near the bottom of its 14-day range, a bounce is often near.' : 'Below -60 — momentum is turning up from a low level.';
			if (s === 'fail') return r > -20 ? 'Overbought — the price is near the top of its 14-day range, a pullback is often near.' : 'Above -40 — momentum is fading from a high level.';
			return 'Neutral zone — no strong signal either way.';
		}
	},
	'MFI(14)': {
		what: 'Like RSI, but it also counts volume: it measures whether money is flowing into the stock (buying) or out of it (selling) over 14 days. Above 80 = overbought. Below 20 = oversold.',
		format: (v) => pctRaw(num(v)),
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r < 20 ? 'Oversold with heavy outflow — sellers may be exhausted, a bounce is often near.' : 'Money flow is weak — an early sign that selling pressure is easing.';
			if (s === 'fail') return r > 80 ? 'Overbought with heavy inflow — buyers may be exhausted, a pullback is often near.' : 'Money flow is strong — buyers may be running out of steam.';
			return 'Money flow is balanced — no clear signal either way.';
		}
	},
	'ROC(12)': {
		what: 'Shows how much the price has changed over the last 12 days, as a percentage. Positive = the price rose over that period. Negative = it fell. Big numbers mean fast, strong moves.',
		format: (v) => {
			const r = num(v);
			return r === null ? '—' : `${signed(r)}%`;
		},
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r > 5 ? 'Strong momentum — the price has climbed more than 5% in 12 days.' : 'Positive momentum — the price is rising over the last 12 days.';
			if (s === 'fail') return r < -5 ? 'Sharp decline — the price has dropped more than 5% in 12 days.' : 'Negative momentum — the price is falling over the last 12 days.';
			return 'Nearly flat — the price has barely moved over the last 12 days.';
		}
	},
	'PSAR': {
		what: 'Parabolic SAR draws dots that trail the price. Dots below the price = uptrend. Dots above = downtrend. When the dots flip sides, it signals the trend may have changed — handy for knowing when to stay in or get out.',
		format: (v) => {
			const d = v as Record<string, unknown> | null;
			if (!d) return '—';
			const p = num(d.psar);
			return `${d.trend === 'up' ? '↑' : '↓'} PSAR ${money(p)}`;
		},
		reason: (v, s) => {
			const d = v as Record<string, unknown> | null;
			const p = num(d?.psar);
			if (p === null) return 'No reading available.';
			if (s === 'pass') return 'Dots are below the price — an uptrend is in place. It stays up until the dots flip above the price.';
			if (s === 'fail') return 'Dots are above the price — a downtrend is in place. It stays down until the dots flip below the price.';
			return 'No clear trend — the dots are not giving a signal yet.';
		}
	},
	'CMO(14)': {
		what: 'A momentum gauge between -100 and +100. Positive = buyers have been stronger than sellers over 14 days. Negative = sellers have been stronger. Above +50 = strong buying. Below -50 = strong selling.',
		format: (v) => pctRaw(num(v)),
		reason: (v, s) => {
			const r = num(v);
			if (r === null) return 'No reading available.';
			if (s === 'pass') return r < -50 ? 'Deeply negative — selling has been extreme; a bounce is often near.' : 'Negative but recovering — sellers were in control, buyers are stepping in.';
			if (s === 'fail') return r > 50 ? 'Strongly positive — buying has been extreme; a pullback is often near.' : 'Positive but fading — buyers were in control, sellers are stepping in.';
			return 'Balanced — buyers and sellers are roughly even over the last 14 days.';
		}
	}
};

// --- public API --------------------------------------------------------------

export function explainIndicator(indicator: IndicatorResult): {
	what: string;
	reading: string;
	reason: string;
	status: CheckStatus;
} {
	const def = EXPLAIN[indicator.name] || EXPLAIN[indicator.name.toUpperCase()];
	const status = verdictToStatus(indicator.verdict);
	if (status === 'none') {
		return {
			what: 'Not enough data to compute this indicator.',
			reading: '—',
			reason: 'Not computable with the available data.',
			status
		};
	}
	if (!def) {
		return {
			what: 'Technical check based on price history.',
			reading: String(indicator.value ?? '—'),
			reason: `Verdict: ${indicator.verdict}.`,
			status
		};
	}
	return {
		what: def.what,
		reading: def.format(indicator.value),
		reason: def.reason(indicator.value, status),
		status
	};
}
