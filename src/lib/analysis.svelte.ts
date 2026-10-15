import { untrack } from "svelte";
import {
	ApiError,
	analyze,
	getBars,
	getFearGreed,
	getFinnhub,
	getMarketNews,
	isAbortError,
	streamAIAnalysis,
} from "./api";
import {
	computePatternFlags,
	computeStatsRows,
	computeVitals,
	mergeBars,
	scoreIndicators,
} from "./analysis-derive";
import { quotes, type Quote } from "./quotes.svelte";
import { addRecentAnalysis } from "./storage";
import type {
	AnalysisResponse,
	AssetType,
	FearGreed,
	FinnhubBundle,
	MarketNews,
	PricePoint,
} from "./types";

export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo"];
const INTRADAY_TFS = new Set(["1m", "5m", "15m", "30m", "1h", "4h"]);
// Poll cadence per intraday timeframe = bar duration (matches backend TTL).
const TF_MINUTES: Record<string, number> = {
	"1m": 1,
	"5m": 5,
	"15m": 15,
	"30m": 30,
	"1h": 60,
	"4h": 240,
};
// Timeframes of the compact multi-timeframe verdict strip.
const VERDICT_TFS = ["1d", "1w", "1mo"];
// Same symbol + timeframe is requested at most once per this window (the main
// analysis, the verdict strip and a timeframe switch all want the same data).
const ANALYSIS_TTL_MS = 5 * 60_000;
const IND_EXCL_KEY = "vexarium:indicators:off";

/**
 * State and loading logic of the stock analysis page.
 *
 * Request discipline:
 *  - everything bound to the current symbol shares one AbortController; a
 *    symbol change aborts it, so no response of an old symbol can write state
 *  - /analysis is requested once per symbol+timeframe (in-flight and recently
 *    resolved requests are shared, see #fetchAnalysis)
 *  - responses of a superseded timeframe / compare symbol / AI run are dropped
 *
 * The class holds no component lifecycle itself: `connect()` (called once from
 * the page) wires it to the symbol param, `setSymbol()` is the imperative entry.
 */
export class AnalysisStore {
	symbol = $state("");
	analysis = $state<AnalysisResponse | null>(null);
	error = $state<string | null>(null);
	timeframeVerdicts = $state<Record<string, string>>({});
	chartBars = $state<PricePoint[] | null>(null);
	barsLoading = $state(false);
	finnhub = $state<FinnhubBundle | null>(null);
	finnhubDone = $state(false);
	marketNews = $state<MarketNews | null>(null);
	fearGreed = $state<FearGreed | null>(null);
	compareBars = $state<PricePoint[] | null>(null);
	aiLoading = $state(false);
	aiMessage = $state<string | null>(null);
	// Double-clicking an indicator excludes it from the verdict. Persisted per
	// indicator NAME (global across symbols/timeframes).
	excludedInd = $state<Record<string, boolean>>({});

	#chartTf = $state("1d");
	#indicatorTf = $state("1d");
	#compareSymbol = $state("SPY");

	#active = ""; // symbol the loaders were started for
	#ctl: AbortController | null = null; // aborted on symbol change
	#aiCtl: AbortController | null = null;
	#barsTimer: ReturnType<typeof setInterval> | null = null;
	#stopVisibilityWatch: (() => void) | null = null;
	#barsCtl: AbortController | null = null;
	#compareCtl: AbortController | null = null;
	#analysisSeq = 0; // newest analysis load wins
	#analysisCache = new Map<string, { at: number; promise: Promise<AnalysisResponse> }>();

	constructor() {
		try {
			const raw = JSON.parse(globalThis.localStorage?.getItem(IND_EXCL_KEY) ?? "{}");
			if (raw && typeof raw === "object") this.excludedInd = raw;
		} catch {
			// corrupt or unavailable storage: start clean
		}
	}

	// ---- timeframe / comparator selection (setters restart their loaders) ----

	get chartTf() {
		return this.#chartTf;
	}
	set chartTf(tf: string) {
		if (tf === this.#chartTf) return;
		this.#chartTf = tf;
		if (!this.#active) return;
		this.#startBars();
		this.#startCompare();
	}

	get indicatorTf() {
		return this.#indicatorTf;
	}
	/** Quietly recompute: current content stays visible, no AI restart. */
	set indicatorTf(tf: string) {
		if (tf === this.#indicatorTf) return;
		this.#indicatorTf = tf;
		if (this.#active) void this.#loadAnalysis(true);
	}

	get compareSymbol() {
		return this.#compareSymbol;
	}
	set compareSymbol(cs: string) {
		// Comparing against the symbol itself makes no sense; fall back to SPY.
		if (cs === this.symbol) cs = "SPY";
		if (cs === this.#compareSymbol) return;
		this.#compareSymbol = cs;
		if (this.#active) this.#startCompare();
	}

	// ---- derived view state --------------------------------------------------

	assetType = $derived((this.analysis?.asset_type as AssetType) ?? "stock");

	/** Verdict recomputed over the non-excluded indicators. */
	client = $derived(scoreIndicators(this.analysis?.indicators ?? [], this.excludedInd));

	// Bars actually shown in the chart: live bars when present, else the
	// analysis payload's price series (the pre-bars fallback).
	mainSeries = $derived(
		this.chartBars && this.chartBars.length > 0
			? this.chartBars
			: this.analysis?.price_series && this.analysis.price_series.length > 0
				? this.analysis.price_series
				: null,
	);

	// Data-freshness hint for intraday charts. Alpaca's historical bars API
	// excludes the last ~15 min by design (only quotes/trades are real-time),
	// so bars lag 15 min for BOTH sources; the SSE quote stream keeps the last
	// candle's price live. Unknown source (cached/analysis fallback) shows nothing.
	chartHint = $derived(
		INTRADAY_TFS.has(this.#chartTf)
			? this.chartBars?.[this.chartBars.length - 1]?.source === "twelvedata"
				? "Live bars"
				: this.chartBars?.[this.chartBars.length - 1]?.source === "yahoo"
					? "~15 min delay"
					: this.chartBars?.[this.chartBars.length - 1]?.source === "alpaca"
						? "Live price · bars ~15m"
						: ""
			: "",
	);

	// Comparison overlay: one comparator at a time (SPY or a Finnhub peer). With
	// a comparator active, both series are normalized to 100 at the window start
	// so they share one relative scale.
	compareOptions = $derived.by(() => {
		const opts = new Set<string>();
		if (this.symbol !== "SPY") opts.add("SPY");
		for (const p of this.finnhub?.peers ?? []) {
			const s = p.trim().toUpperCase();
			if (s && s !== this.symbol) opts.add(s);
		}
		return [...opts];
	});
	chartPriceSeries = $derived.by(() => {
		const base = this.mainSeries;
		if (!base || base.length === 0 || !this.#compareSymbol) return base ?? [];
		const s0 = base[0].close;
		if (!s0) return base;
		const k = 100 / s0;
		return base.map((p) => ({
			...p,
			open: p.open * k,
			high: p.high * k,
			low: p.low * k,
			close: p.close * k,
		}));
	});
	comparePoints = $derived.by(() => {
		if (!this.#compareSymbol || !this.compareBars || this.compareBars.length === 0) return [];
		const s0 = this.compareBars[0].close;
		if (!s0) return [];
		const k = 100 / s0;
		return this.compareBars.map((p) => ({ t: p.t, v: p.close * k }));
	});
	compareLegend = $derived.by(() => {
		if (!this.#compareSymbol) return null;
		const base = this.mainSeries;
		const cb = this.compareBars;
		if (!base || base.length === 0 || !cb || cb.length === 0) return null;
		return {
			symPct: (base[base.length - 1].close / base[0].close - 1) * 100,
			cmpPct: (cb[cb.length - 1].close / cb[0].close - 1) * 100,
		};
	});

	patternFlags = $derived(computePatternFlags(this.mainSeries, this.analysis));
	statsRows = $derived(computeStatsRows(this.analysis));
	vitals = $derived(computeVitals(this.analysis, this.symbol, this.#indicatorTf));

	// ---- lifecycle -----------------------------------------------------------

	/**
	 * Bind the store to a reactive symbol source. Call once while the page
	 * component initialises (registers effects). Loads on mount and on every
	 * client-side symbol change; aborts everything on destroy.
	 */
	connect(getSymbol: () => string) {
		// Known synchronously so server-rendered markup already names the symbol.
		this.symbol = getSymbol();
		$effect(() => {
			const sym = getSymbol();
			untrack(() => this.setSymbol(sym));
			return () => this.dispose();
		});
		// Live tick extends the last candle of the price chart. The quote stream
		// is already subscribed via SymbolStrip; the same-day guard keeps a
		// completed bar untouched.
		$effect(() => this.#applyQuote(quotes[this.symbol]));
	}

	/** Start loading everything for `sym` (no-op while it is already active). */
	setSymbol(sym: string) {
		if (!sym || sym === this.#active) return;
		this.dispose();
		this.#active = sym;
		this.symbol = sym;
		this.#ctl = new AbortController();

		this.analysis = null;
		this.error = null;
		this.aiMessage = null;
		this.aiLoading = false;
		this.timeframeVerdicts = {};
		this.finnhub = null;
		this.finnhubDone = false;
		this.marketNews = null;
		this.fearGreed = null;
		this.chartBars = null;
		this.compareBars = null;

		void this.#loadAnalysis(false);
		this.#loadVerdictStrip();
		this.#loadFinnhub();
		this.#loadMarketNews();
		this.#loadFearGreed();
		this.#startBars();
		this.#startCompare();
	}

	/** Abort everything in flight and stop polling (symbol change / unmount). */
	dispose() {
		this.#ctl?.abort();
		this.#ctl = null;
		this.#aiCtl?.abort();
		this.#aiCtl = null;
		this.#compareCtl?.abort();
		this.#compareCtl = null;
		this.#barsCtl?.abort();
		this.#barsCtl = null;
		this.#stopBarsPolling();
		this.#analysisCache.clear();
		this.#analysisSeq++;
		this.#active = "";
	}

	retry() {
		void this.#loadAnalysis(false);
	}

	toggleIndicator(name: string) {
		this.excludedInd[name] = !this.excludedInd[name];
		try {
			localStorage.setItem(IND_EXCL_KEY, JSON.stringify(this.excludedInd));
		} catch {
			// storage unavailable: exclusion just won't persist
		}
	}

	// ---- analysis ------------------------------------------------------------

	/** /analysis once per symbol+timeframe: in-flight and recent requests are shared. */
	#fetchAnalysis(tf: string): Promise<AnalysisResponse> {
		const key = `${this.symbol}|${tf}`;
		const hit = this.#analysisCache.get(key);
		if (hit && Date.now() - hit.at < ANALYSIS_TTL_MS) return hit.promise;
		const promise = analyze(this.symbol, this.assetType, false, tf, this.#ctl?.signal);
		this.#analysisCache.set(key, { at: Date.now(), promise });
		// A failed request must not be served from the cache.
		promise.catch(() => {
			if (this.#analysisCache.get(key)?.promise === promise) this.#analysisCache.delete(key);
		});
		return promise;
	}

	/**
	 * Load the analysis for the current indicator timeframe. `quiet` keeps the
	 * visible content and swaps the result in place (timeframe switch); with
	 * nothing to keep it behaves like a full load. Only the newest load writes.
	 */
	async #loadAnalysis(quiet: boolean) {
		const ctl = this.#ctl;
		if (!ctl) return;
		const seq = ++this.#analysisSeq;
		const inPlace = quiet && this.analysis !== null;
		if (!inPlace) {
			this.analysis = null;
			this.error = null;
			this.aiMessage = null;
		}
		try {
			const res = await this.#fetchAnalysis(this.#indicatorTf);
			if (ctl.signal.aborted || seq !== this.#analysisSeq) return;
			this.analysis = res;
			if (inPlace) return;
			if (res.overall?.overall_verdict) {
				try {
					addRecentAnalysis({
						symbol: this.symbol,
						assetType: this.assetType,
						analyzedAt: res.analyzed_at ?? new Date().toISOString(),
						verdict: res.overall.overall_verdict,
					});
				} catch {
					// history is a convenience; storage trouble must not drop the analysis
				}
			}
			void this.runAI();
		} catch (e) {
			if (ctl.signal.aborted || seq !== this.#analysisSeq || isAbortError(e)) return;
			if (!inPlace) {
				this.analysis = null;
				this.error = e instanceof Error ? e.message : "Analysis failed";
			}
		}
	}

	/** The compact multi-timeframe verdict strip, independent of the detail timeframe. */
	#loadVerdictStrip() {
		const ctl = this.#ctl;
		if (!ctl) return;
		for (const tf of VERDICT_TFS) {
			this.#fetchAnalysis(tf)
				.then((item) => {
					if (ctl.signal.aborted) return;
					this.timeframeVerdicts = {
						...this.timeframeVerdicts,
						[tf]: item.overall.overall_verdict,
					};
				})
				.catch(() => {});
		}
	}

	/** Stream the AI second opinion; a newer run aborts the previous one. */
	async runAI() {
		if (!this.#ctl) return;
		this.#aiCtl?.abort();
		const ctl = (this.#aiCtl = new AbortController());
		this.aiLoading = true;
		this.aiMessage = null;
		try {
			await streamAIAnalysis(
				this.symbol,
				this.assetType,
				(chunk) => {
					if (ctl.signal.aborted) return;
					this.aiMessage = (this.aiMessage ?? "") + chunk;
				},
				ctl.signal,
			);
		} catch (e) {
			// Aborted runs are superseded by a newer run (or a symbol change);
			// never surface their error.
			if (ctl.signal.aborted) return;
			this.aiMessage =
				e instanceof ApiError
					? e.message
					: `AI analysis failed: ${e instanceof Error ? e.message : "unknown error"}`;
		} finally {
			if (this.#aiCtl === ctl) this.aiLoading = false;
		}
	}

	// ---- symbol-scoped side data ---------------------------------------------

	// Finnhub enrichment (insider / earnings / peers): symbol-scoped, not
	// timeframe-scoped; 12h server cache. Failure just leaves widgets empty.
	#loadFinnhub() {
		const ctl = this.#ctl;
		if (!ctl) return;
		getFinnhub(this.symbol, ctl.signal)
			.then((b) => {
				if (ctl.signal.aborted) return;
				this.finnhub = b;
				this.finnhubDone = true;
			})
			.catch(() => {
				if (!ctl.signal.aborted) this.finnhubDone = true;
			});
	}

	// Broad market headlines: independent of the symbol, 12h server cache.
	#loadMarketNews() {
		const ctl = this.#ctl;
		if (!ctl) return;
		getMarketNews(ctl.signal)
			.then((m) => {
				if (!ctl.signal.aborted) this.marketNews = m;
			})
			.catch(() => {});
	}

	// CNN Fear & Greed: fast, symbol-independent gauge fetched on its own (not
	// part of the slow /analysis round-trip). ~30 min server cache.
	#loadFearGreed() {
		const ctl = this.#ctl;
		if (!ctl) return;
		getFearGreed(ctl.signal)
			.then((d) => {
				if (!ctl.signal.aborted) this.fearGreed = d;
			})
			.catch(() => {});
	}

	// ---- chart bars ----------------------------------------------------------

	/**
	 * (Re)start the bars load for the current symbol + chart timeframe. Bars are
	 * only cleared on symbol change (see setSymbol): on a timeframe change the old
	 * bars stay visible so the chart updates in place instead of being destroyed.
	 */
	#startBars() {
		if (!this.#ctl) return;
		this.#stopBarsPolling();
		const sym = this.symbol;
		const tf = this.#chartTf;
		// Every restart supersedes the previous load (dispose() aborts it on symbol change).
		this.#barsCtl?.abort();
		const bars = (this.#barsCtl = new AbortController());
		const stale = () => bars.signal.aborted;

		this.barsLoading = true;
		const load = (initial: boolean) =>
			getBars(sym, tf, 300, bars.signal)
				.then((points) => {
					if (stale()) return;
					this.chartBars =
						initial || !this.chartBars || this.chartBars.length === 0
							? points
							: mergeBars(this.chartBars, points);
				})
				.catch(() => {
					// transient poll failure keeps the last bars; only the first load blanks
					if (initial && !stale()) this.chartBars = null;
				})
				.finally(() => {
					if (!stale()) this.barsLoading = false;
				});
		void load(true);
		// Intraday bars change every bar: re-fetch at the bar duration so new
		// candles appear without shifting the window (viewport stays put).
		if (!INTRADAY_TFS.has(tf)) return;
		const periodMs = (TF_MINUTES[tf] ?? 1) * 60_000;
		const arm = () => {
			this.#barsTimer = setInterval(() => void load(false), periodMs);
		};
		const disarm = () => {
			if (this.#barsTimer) clearInterval(this.#barsTimer);
			this.#barsTimer = null;
		};
		// A hidden tab polls nothing; coming back refreshes at once (the bars
		// are stale by then) and restarts the cadence from that moment.
		const onVisibilityChange = () => {
			disarm();
			if (document.hidden) return;
			void load(false);
			arm();
		};
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", onVisibilityChange);
			this.#stopVisibilityWatch = () => document.removeEventListener("visibilitychange", onVisibilityChange);
			if (document.hidden) return;
		}
		arm();
	}

	#stopBarsPolling() {
		if (this.#barsTimer) clearInterval(this.#barsTimer);
		this.#barsTimer = null;
		this.#stopVisibilityWatch?.();
		this.#stopVisibilityWatch = null;
	}

	#startCompare() {
		if (!this.#ctl) return;
		this.#compareCtl?.abort();
		const sym = this.symbol;
		const tf = this.#chartTf;
		// Comparing against the symbol itself makes no sense; fall back to SPY.
		if (this.#compareSymbol === sym) this.#compareSymbol = "SPY";
		const cs = this.#compareSymbol;
		this.compareBars = null;
		if (!sym || !cs || cs === sym) return;
		const cmp = (this.#compareCtl = new AbortController());
		const stale = () => cmp.signal.aborted;
		getBars(cs, tf, 300, cmp.signal)
			.then((points) => {
				if (!stale()) this.compareBars = points;
			})
			.catch(() => {}); // comparator load failure = just no overlay line
	}

	#applyQuote(q: Quote | undefined) {
		const bars = this.chartBars;
		if (!q || !bars || bars.length === 0) return;
		const last = bars[bars.length - 1];
		if (new Date(q.ts).toDateString() !== new Date(last.t).toDateString()) return;
		bars[bars.length - 1] = {
			...last,
			close: q.price,
			high: Math.max(last.high, q.price),
			low: Math.min(last.low, q.price),
		};
	}
}
