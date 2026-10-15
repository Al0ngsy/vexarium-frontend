import type { AnalysisResponse, PricePoint, Verdict } from "./types";
import { formatPrice } from "./format";
import { verdictToStatus } from "./indicator-explain";

// Pure derivations for the analysis page (no runes, no I/O): everything here is
// a function of the /analysis payload and the bar series, so it is unit-testable
// and shared by the analysis store and the widgets.

export interface StatRow {
	k: string;
	v: string;
	color?: string;
}

export interface Vital {
	k: string;
	v: string;
	d: string;
}


// ---- indicator scoring ----------------------------------------------------
// Verdict 'none' contributes 0 and is never counted (mirrors the backend).
const INDICATOR_SCORES: Record<string, number> = {
	strong_buy: 2,
	buy: 1,
	hold: 0,
	sell: -1,
	strong_sell: -2,
};

export function bucketScore(s: number): Verdict {
	if (s >= 5) return "strong_buy";
	if (s >= 2) return "buy";
	if (s <= -5) return "strong_sell";
	if (s <= -2) return "sell";
	return "hold";
}

export interface ClientVerdict {
	score: number;
	verdict: Verdict;
	count: number;
	bull: number;
	bear: number;
	neutral: number;
}

/** Client-side verdict over the indicators that are not excluded. */
export function scoreIndicators(
	indicators: AnalysisResponse["indicators"],
	excluded: Record<string, boolean>,
): ClientVerdict {
	const scored = indicators.filter(
		(i) => !excluded[i.name] && verdictToStatus(i.verdict) !== "none",
	);
	const score = scored.reduce((sum, i) => sum + (INDICATOR_SCORES[i.verdict] ?? 0), 0);
	return {
		score,
		verdict: bucketScore(score),
		count: scored.length,
		bull: scored.filter((i) => ["buy", "strong_buy"].includes(i.verdict)).length,
		bear: scored.filter((i) => ["sell", "strong_sell"].includes(i.verdict)).length,
		neutral: scored.filter((i) => verdictToStatus(i.verdict) === "watch").length,
	};
}

// ---- bars -----------------------------------------------------------------
export function mergeBars(old: PricePoint[], fresh: PricePoint[]): PricePoint[] {
	const freshT = new Set(fresh.map((p) => p.t));
	const kept = old.filter((p) => !freshT.has(p.t));
	const merged = [...kept, ...fresh];
	return merged.length > 600 ? merged.slice(merged.length - 600) : merged;
}

// ---- pattern flags (P4) ---------------------------------------------------
export type PatternFlag = {
	label: string;
	dir: "bullish" | "bearish";
	ago: number; // bars since the event (0 = current, not bar-counted)
};
export function computePatternFlags(
	bars: PricePoint[] | null,
	analysis: AnalysisResponse | null,
): PatternFlag[] {
	const flags: PatternFlag[] = [];
	const series = analysis?.indicator_series ?? [];
	if (!bars || bars.length === 0) return flags;

	const closes = bars.map((b) => b.close);
	const tIdx = new Map(bars.map((b, i) => [b.t, i]));
	const byT = (pts: { t: string; v: number }[]): (number | null)[] => {
		const out: (number | null)[] = new Array(bars.length).fill(null);
		for (const p of pts) {
			const i = tIdx.get(p.t);
			if (i !== undefined && p.v != null) out[i] = p.v;
		}
		return out;
	};
	// Most recent line-vs-close side flip (SMA/PSAR style), scanning backward.
	const flipVsPrice = (
		vals: (number | null)[],
		tag: string,
		belowBullish: boolean,
	): PatternFlag | null => {
		for (let i = vals.length - 1; i >= 1; i--) {
			const v = vals[i];
			const vp = vals[i - 1];
			const c = closes[i];
			const cp = closes[i - 1];
			if (v == null || vp == null || c == null || cp == null) continue;
			const below = v < c;
			const wasBelow = vp < cp;
			if (below && !wasBelow)
				return {
					label: belowBullish
						? `${tag} flipped below price`
						: `${tag} crossed below price`,
					dir: belowBullish ? "bullish" : "bearish",
					ago: vals.length - 1 - i,
				};
			if (!below && wasBelow)
				return {
					label: belowBullish
						? `${tag} flipped above price`
						: `${tag} crossed above price`,
					dir: belowBullish ? "bearish" : "bullish",
					ago: vals.length - 1 - i,
				};
		}
		return null;
	};
	// Most recent sign flip of a zero-centered oscillator (MACD histogram).
	const signFlip = (
		v: number[],
		bullLabel: string,
		bearLabel: string,
	): PatternFlag | null => {
		for (let i = v.length - 1; i >= 1; i--) {
			if ((v[i] > 0 && v[i - 1] <= 0) || (v[i] < 0 && v[i - 1] >= 0))
				return {
					label: v[i] > 0 ? bullLabel : bearLabel,
					dir: v[i] > 0 ? "bullish" : "bearish",
					ago: v.length - 1 - i,
				};
		}
		return null;
	};

	// A single SMA against the close: price moving above the average is bullish,
	// below it bearish. (A golden/death cross is a short SMA crossing a long one;
	// the series here has only one SMA, so it is not named that.)
	const sma = series.find((s) => s.name.toUpperCase().includes("SMA"));
	if (sma) {
		const f = flipVsPrice(byT(sma.points), "SMA", true);
		if (f) {
			f.label = f.dir === "bullish" ? "Price crossed above SMA" : "Price crossed below SMA";
			flags.push(f);
		}
	}
	const macd = series.find((s) => s.name.toUpperCase().includes("MACD"));
	if (macd) {
		const v = macd.points
			.filter((p) => p.v != null)
			.map((p) => p.v as number);
		const f = signFlip(v, "MACD histogram turned positive", "MACD histogram turned negative");
		if (f) flags.push(f);
	}
	const psar = series.find((s) => /(^|[^A-Z])SAR/i.test(s.name));
	if (psar) {
		const f = flipVsPrice(byT(psar.points), "PSAR", true);
		if (f) flags.push(f);
	}
	// Direction follows the backend's RSI verdict (indicator_engine._rsi_verdict),
	// which is contrarian: below 30 strong buy, below 40 buy, 60-70 sell, 70+ strong
	// sell. Both 30 crossings stay in the buy zone (<40), both 70 crossings in the
	// sell zone (>=60).
	const rsi = series.find((s) => s.name.toUpperCase().includes("RSI"));
	if (rsi) {
		const v = rsi.points
			.filter((p) => p.v != null)
			.map((p) => p.v as number);
		for (let i = v.length - 1; i >= 1; i--) {
			const cur = v[i];
			const prev = v[i - 1];
			if (prev < 30 && cur >= 30) {
				flags.push({ label: "RSI crossed above 30, leaving oversold", dir: "bullish", ago: v.length - 1 - i });
				break;
			}
			if (prev > 70 && cur <= 70) {
				flags.push({ label: "RSI crossed below 70, leaving overbought", dir: "bearish", ago: v.length - 1 - i });
				break;
			}
			if (prev > 30 && cur <= 30) {
				flags.push({ label: "RSI crossed below 30 into oversold", dir: "bullish", ago: v.length - 1 - i });
				break;
			}
			if (prev < 70 && cur >= 70) {
				flags.push({ label: "RSI crossed above 70 into overbought", dir: "bearish", ago: v.length - 1 - i });
				break;
			}
		}
	}
	const co = analysis?.company;
	const price = analysis?.current_price ?? closes[closes.length - 1];
	if (co && price) {
		if (co.high_52w && co.high_52w > 0 && (co.high_52w - price) / co.high_52w <= 0.03)
			flags.push({
				label: `Near 52-week high (${(((co.high_52w - price) / co.high_52w) * 100).toFixed(1)}% below)`,
				dir: "bullish",
				ago: 0,
			});
		else if (co.low_52w && co.low_52w > 0 && (price - co.low_52w) / co.low_52w <= 0.03)
			flags.push({
				label: `Near 52-week low (${(((price - co.low_52w) / co.low_52w) * 100).toFixed(1)}% above)`,
				dir: "bearish",
				ago: 0,
			});
	}
	return flags;
}

// ---- key statistics (P5) --------------------------------------------------
export function computeStatsRows(analysis: AnalysisResponse | null): StatRow[] {
	if (!analysis) return [];
	const co = analysis.company;
	const cur = analysis.current_price;
	const curSym = co?.currency ?? null;
	const rows: { k: string; v: string; color?: string }[] = [];
	const fmtBig = (v: number) =>
		Math.abs(v) >= 1e12
			? `$${(v / 1e12).toFixed(2)}T`
			: Math.abs(v) >= 1e9
				? `$${(v / 1e9).toFixed(2)}B`
				: Math.abs(v) >= 1e6
					? `$${(v / 1e6).toFixed(1)}M`
					: `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
	const dirColor = (v: number) => (v >= 0 ? "#34d399" : "#f87171");
	const fmtPriceNoCur = (v: number) =>
		formatPrice(v, curSym).replace(/^[^\d-]+/, "");
	if (co?.market_cap != null)
		rows.push({ k: "Market cap", v: fmtBig(co.market_cap) });
	if (co?.pe_ratio != null) rows.push({ k: "P/E", v: `${co.pe_ratio.toFixed(1)}x` });
	if (co?.ps_ratio != null) rows.push({ k: "P/S", v: `${co.ps_ratio.toFixed(1)}x` });
	if (co?.dividend_yield != null)
		rows.push({ k: "Dividend yield", v: `${(co.dividend_yield * 100).toFixed(1)}%` });
	if (co?.high_52w && co.high_52w > 0 && cur != null) {
		const off = (cur / co.high_52w - 1) * 100;
		rows.push({ k: "% off 52-week high", v: `${off.toFixed(1)}%`, color: dirColor(off) });
	}
	if (analysis.ytd_change_pct != null)
		rows.push({
			k: "YTD change",
			v: `${analysis.ytd_change_pct >= 0 ? "+" : ""}${analysis.ytd_change_pct.toFixed(1)}%`,
			color: dirColor(analysis.ytd_change_pct),
		});
	if (co?.low_52w != null && co?.high_52w != null)
		rows.push({
			k: "52-week range",
			v: `${fmtPriceNoCur(co.low_52w)}–${fmtPriceNoCur(co.high_52w)}`,
		});
	if (co?.shares_outstanding != null) {
		const s = co.shares_outstanding;
		rows.push({
			k: "Shares outstanding",
			v:
				Math.abs(s) >= 1e9
					? `${(s / 1e9).toFixed(2)}B`
					: Math.abs(s) >= 1e6
						? `${(s / 1e6).toFixed(1)}M`
						: s.toLocaleString(),
		});
	}
	return rows;
}

// ---- vitals ---------------------------------------------------------------
export function computeVitals(
	analysis: AnalysisResponse | null,
	symbol: string,
	indicatorTf: string,
): Vital[] {
	if (!analysis) return [];
	const co = analysis.company;
	const cur = co?.currency ?? null;
	const tf = analysis.timeframe ?? indicatorTf;
	const out: { k: string; v: string; d: string }[] = [
		{
			k: "Price",
			v: formatPrice(analysis.current_price, cur),
			d: `${symbol} · ${analysis.asset_type?.toUpperCase() ?? "STOCK"}`,
		},
	];
	if (co && co.low_52w != null && co.high_52w != null) {
		out.push({
			k: "52-week range",
			v: `${formatPrice(co.low_52w, cur).replace(/^[^\d-]+/, "")}–${formatPrice(co.high_52w, cur).replace(/^[^\d-]+/, "")}`,
			d: "yearly low–high",
		});
	}
	const atr = analysis.indicators.find((i) =>
		i.name.toUpperCase().includes("ATR"),
	);
	if (atr) {
		const atrVal =
			typeof atr.value === "number"
				? atr.value
				: (atr.value as Record<string, number> | null | undefined)?.atr;
		if (typeof atrVal === "number") {
			const atrUnit =
				tf === "1w"
					? "avg weekly move"
					: tf === "1mo"
						? "avg monthly move"
						: tf === "1d"
							? "avg daily move"
							: "avg move per bar";
			out.push({
				k: `Volatility - ${tf}`,
				v: `ATR ${atrVal.toFixed(1)}`,
				d: atrUnit,
			});
		}
	}
	const rsi = analysis.indicators.find((i) =>
		i.name.toUpperCase().includes("RSI"),
	);
	if (rsi && typeof rsi.value === "number") {
		out.push({
			k: `Momentum - ${tf}`,
			v: `RSI ${rsi.value.toFixed(0)}`,
			d:
				rsi.value > 70
					? "overbought"
					: rsi.value < 30
						? "oversold"
						: "neutral",
		});
	}
	return out;
}
