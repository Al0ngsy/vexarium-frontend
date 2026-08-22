<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { analyze, getBars, getFinnhub, getMarketNews, getFearGreed, streamAIAnalysis } from "$lib/api";
  import { getToken } from "$lib/auth.svelte";
  import { formatPrice } from "$lib/format";
  import {
    explainIndicator,
    STATUS_ICON,
    verdictToStatus,
  } from "$lib/indicator-explain";
  import { renderAIMarkdown } from "$lib/markdown";
  import { addRecentAnalysis } from "$lib/storage";
  import type { AnalysisResponse, PricePoint, Verdict } from "$lib/types";
  import { VERDICT_COLORS, VERDICT_LABELS } from "$lib/verdict";
  import { untrack } from "svelte";

  import {
    ANALYSIS_WIDGETS,
    loadEnabled,
    type WidgetDef,
  } from "$lib/layout.svelte";
  import { quotes } from "$lib/quotes.svelte";
  import { clearTip, positionTip } from "$lib/tooltip";
  import CompanyProfile from "../../../components/CompanyProfile.svelte";
  import DisclaimerBanner from "../../../components/DisclaimerBanner.svelte";
  import FinnhubWidget from "../../../components/FinnhubWidget.svelte";
  import IndicatorChart from "../../../components/IndicatorChart.svelte";
  import SaveTradeModal from "../../../components/SaveTradeModal.svelte";
  import SymbolStrip from "../../../components/SymbolStrip.svelte";
  import WatchlistWidget from "../../../components/WatchlistWidget.svelte";
  import WidgetCard from "../../../components/WidgetCard.svelte";
  import WidgetGrid from "../../../components/WidgetGrid.svelte";
  import WidgetLibrary from "../../../components/WidgetLibrary.svelte";

  const symbol = $derived(String(page.params.symbol || "").toUpperCase());

  const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo"];
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

  // Append only NEW candles from a poll instead of replacing the whole series,
  // so the visible window's first bar stays put and the chart's zoom/scroll
  // is preserved (setData renders the additions in place). Cap growth at 2×
  // the limit; when the cap rolls, the window shifts and the chart refits.
  function mergeBars(old: PricePoint[], fresh: PricePoint[]): PricePoint[] {
    const freshT = new Set(fresh.map((p) => p.t));
    const kept = old.filter((p) => !freshT.has(p.t));
    const merged = [...kept, ...fresh];
    return merged.length > 600 ? merged.slice(merged.length - 600) : merged;
  }
  let chartTf = $state("1d");
  let indicatorTf = $state("1d");
  let timeframeVerdicts = $state<Record<string, string>>({});
  let chartBars = $state<PricePoint[] | null>(null);
  let barsLoading = $state(false);

  // Fetch bars whenever the symbol or resolution changes (debounced lightly).
  // Only clear bars on symbol change — on timeframe change keep the old bars
  // visible so IndicatorChart updates in place instead of being destroyed.
  let barsSymbol = $state("");
  $effect(() => {
    const sym = symbol;
    const tf = chartTf;
    if (!sym) return;
    barsLoading = true;
    if (barsSymbol !== sym) chartBars = null;
    barsSymbol = sym;
    const load = (initial: boolean) =>
      getBars(sym, tf, 300)
        .then((points) => {
          if (symbol !== sym || chartTf !== tf) return;
          chartBars =
            initial || !chartBars || chartBars.length === 0
              ? points
              : mergeBars(chartBars, points);
        })
        .catch(() => {
          // transient poll failure keeps the last bars; only the first load blanks
          if (initial && symbol === sym && chartTf === tf) chartBars = null;
        })
        .finally(() => {
          if (symbol === sym && chartTf === tf) barsLoading = false;
        });
    load(true);
    // Intraday bars change every bar: re-fetch at the bar duration so new
    // candles appear without shifting the window (viewport stays put).
    if (!INTRADAY_TFS.has(tf)) return;
    const minutes = TF_MINUTES[tf] ?? 1;
    const timer = setInterval(() => load(false), minutes * 60_000);
    return () => clearInterval(timer);
  });

  // Live tick extends the last candle of the price chart. The quote stream is
  // already subscribed via SymbolStrip; the same-day guard keeps a completed
  // bar untouched. ponytail: last-bar update for every timeframe — correct
  // while the current period is open, fine for 1d..1mo.
  $effect(() => {
    const q = quotes[symbol];
    const bars = chartBars;
    if (!q || !bars || bars.length === 0) return;
    const last = bars[bars.length - 1];
    if (new Date(q.ts).toDateString() !== new Date(last.t).toDateString())
      return;
    bars[bars.length - 1] = {
      ...last,
      close: q.price,
      high: Math.max(last.high, q.price),
      low: Math.min(last.low, q.price),
    };
  });

  // Data-freshness hint for intraday charts. Alpaca's historical bars API
  // excludes the last ~15 min by design (only quotes/trades are real-time),
  // so bars lag 15 min for BOTH sources; the SSE quote stream keeps the last
  // candle's price live. Unknown source (cached/analysis fallback) shows nothing.
  const chartHint = $derived(
    INTRADAY_TFS.has(chartTf)
      ? chartBars?.[chartBars.length - 1]?.source === "twelvedata"
        ? "Live bars"
        : chartBars?.[chartBars.length - 1]?.source === "yahoo"
          ? "~15 min delay"
          : chartBars?.[chartBars.length - 1]?.source === "alpaca"
            ? "Live price · bars ~15m"
            : ""
      : ""
  );

  // ---- analysis state -----------------------------------------------------
  let analysis = $state<AnalysisResponse | null>(null);
  let error = $state<string | null>(null);
  let showSave = $state(false);
  let aiLoading = $state(false);
  let aiMessage = $state<string | null>(null);
  let aiAbort: AbortController | null = null;

  // Finnhub enrichment (insider / earnings / peers) — symbol-scoped, not
  // timeframe-scoped; 12h server cache. Failure just leaves widgets empty.
  let finnhub = $state<import("$lib/types").FinnhubBundle | null>(null);
  let finnhubDone = $state(false);
  $effect(() => {
    const sym = symbol;
    if (!sym) return;
    finnhub = null;
    finnhubDone = false;
    getFinnhub(sym)
      .then((b) => {
        if (symbol === sym) {
          finnhub = b;
          finnhubDone = true;
        }
      })
      .catch(() => {
        if (symbol === sym) finnhubDone = true;
      });
  });

  const assetType = $derived(
    (analysis?.asset_type as "stock" | "etf" | "index") ?? "stock",
  );

// ---- comparison overlay (P1) -------------------------------------------
  // Lazy v1: one comparator at a time (SPY or a Finnhub peer). With a
  // comparator active, both series are normalized to 100 at the window start
  // (the fetched series start) so they share one relative scale.
  let compareSymbol = $state("SPY");
  let compareBars = $state<PricePoint[] | null>(null);
  const compareOptions = $derived.by(() => {
    const opts = new Set<string>();
    if (symbol !== "SPY") opts.add("SPY");
    for (const p of finnhub?.peers ?? []) {
      const s = p.trim().toUpperCase();
      if (s && s !== symbol) opts.add(s);
    }
    return [...opts];
  });
  $effect(() => {
    const sym = symbol;
    const cs = compareSymbol;
    const tf = chartTf;
    if (!sym || !cs || cs === sym) {
      // Comparing against the symbol itself makes no sense; fall back to SPY.
      if (cs === sym) compareSymbol = "SPY";
      compareBars = null;
      return;
    }
    compareBars = null;
    getBars(cs, tf, 300)
      .then((points) => {
        if (symbol === sym && compareSymbol === cs && chartTf === tf)
          compareBars = points;
      })
      .catch(() => {}); // comparator load failure = just no overlay line
  });

  // Bars actually shown in the chart: live bars when present, else the
  // analysis payload's price series (the pre-bars fallback).
  const mainSeries = $derived(
    chartBars && chartBars.length > 0
      ? chartBars
      : analysis?.price_series && analysis.price_series.length > 0
        ? analysis.price_series
        : null
  );
  const chartPriceSeries = $derived.by(() => {
    const base = mainSeries;
    if (!base || base.length === 0 || !compareSymbol) return base ?? [];
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
  const comparePoints = $derived.by(() => {
    if (!compareSymbol || !compareBars || compareBars.length === 0) return [];
    const s0 = compareBars[0].close;
    if (!s0) return [];
    const k = 100 / s0;
    return compareBars.map((p) => ({ t: p.t, v: p.close * k }));
  });
  const compareLegend = $derived.by(() => {
    if (!compareSymbol) return null;
    const base = mainSeries;
    const cb = compareBars;
    if (!base || base.length === 0 || !cb || cb.length === 0) return null;
    return {
      symPct: (base[base.length - 1].close / base[0].close - 1) * 100,
      cmpPct: (cb[cb.length - 1].close / cb[0].close - 1) * 100,
    };
  });

  // ---- pattern flags (P4) -------------------------------------------------
  // Crossovers and sign flips detected client-side from the indicator series
  // already in the /analysis payload; a missing series skips its flag.
  type PatternFlag = {
    label: string;
    dir: "bullish" | "bearish";
    ago: number; // bars since the event (0 = current, not bar-counted)
  };
  const patternFlags = $derived.by((): PatternFlag[] => {
    const flags: PatternFlag[] = [];
    const bars = mainSeries;
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

    const sma = series.find((s) => s.name.toUpperCase().includes("SMA"));
    if (sma) {
      const f = flipVsPrice(byT(sma.points), "SMA vs price", false);
      if (f) {
        f.label = f.dir === "bullish" ? "Golden cross (SMA over price)" : "Death cross (SMA under price)";
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
          flags.push({ label: "RSI crossed below 70, leaving overbought", dir: "bullish", ago: v.length - 1 - i });
          break;
        }
        if (prev > 30 && cur <= 30) {
          flags.push({ label: "RSI crossed below 30 into oversold", dir: "bearish", ago: v.length - 1 - i });
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
  });

  // ---- key statistics (P5) ------------------------------------------------
  // Rendered straight from the /analysis payload; rows for missing fields
  // are hidden, nothing is invented.
  const statsRows = $derived.by(() => {
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
  });

  
  // Broad market headlines (Finnhub general news) — independent of the symbol;
  // 12h server cache. Shown in the news widget next to the stock-specific feed.
  let marketNews = $state<import("$lib/types").MarketNews | null>(null);
  $effect(() => {
    const sym = symbol;
    if (!sym) return;
    marketNews = null;
    getMarketNews()
      .then((m) => {
        if (symbol === sym) marketNews = m;
      })
      .catch(() => {});
  });

  // CNN Fear & Greed index — a fast, symbol-independent gauge, fetched on its
  // own (not part of the slow /analysis round-trip). ~30 min server cache.
  let fearGreed = $state<import("$lib/types").FearGreed | null>(null);
  $effect(() => {
    const sym = symbol;
    if (!sym) return;
    fearGreed = null;
    getFearGreed()
      .then((d) => {
        if (symbol === sym) fearGreed = d;
      })
      .catch(() => {});
  });

  // --- Fear & Greed circular gauge geometry (SVG arcs, clockwise, y-down) ---
  function polarX(cx: number, cy: number, r: number, deg: number): number {
    return cx + r * Math.cos((deg * Math.PI) / 180);
  }
  function polarY(cx: number, cy: number, r: number, deg: number): number {
    return cy + r * Math.sin((deg * Math.PI) / 180);
  }
  function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
    const x0 = polarX(cx, cy, r, a0);
    const y0 = polarY(cx, cy, r, a0);
    const x1 = polarX(cx, cy, r, a1);
    const y1 = polarY(cx, cy, r, a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  async function runAnalysis() {
    const tf = untrack(() => indicatorTf);
    analysis = null;
    error = null;
    aiMessage = null;
    try {
      analysis = await analyze(symbol, assetType, false, tf);
      if (analysis?.overall?.overall_verdict) {
        addRecentAnalysis({
          symbol,
          assetType,
          analyzedAt: analysis.analyzed_at ?? new Date().toISOString(),
          verdict: analysis.overall.overall_verdict,
        });
      }
      runAI();
    } catch (e) {
      analysis = null;
      error = e instanceof Error ? e.message : "Analysis failed";
    }
  }

  async function runAI() {
    aiAbort?.abort();
    const ac = new AbortController();
    aiAbort = ac;
    const sym = symbol;
    aiLoading = true;
    aiMessage = null;
    try {
      await streamAIAnalysis(
        sym,
        assetType,
        (chunk) => {
          // Ignore chunks from a run started for a previous symbol.
          if (symbol !== sym) return;
          aiMessage = (aiMessage ?? "") + chunk;
        },
        getToken() ?? undefined,
        ac.signal,
      );
    } catch (e) {
      // Aborted runs are superseded by a newer run; never surface their error.
      if (ac.signal.aborted) return;
      aiMessage = `AI analysis failed: ${e instanceof Error ? e.message : "unknown error"}`;
    } finally {
      if (ac === aiAbort) aiLoading = false;
    }
  }

  $effect(() => {
    // (Re)load analysis when the symbol changes — covers the initial mount
    // AND client-side navigation from the search bar (same route, so onMount
    // alone would never re-fire and the page would keep showing the old symbol).
    // untrack: runAnalysis reads assetType (derived from analysis); without
    // it, assigning the result re-triggers this effect → infinite reload loop
    // (masked while the 24h analysis cache made each cycle ~50ms).
    const sym = symbol;
    if (!sym) return;
    untrack(() => runAnalysis());
    // Abort any in-flight AI stream when the symbol changes (or on unmount),
    // so chunks from the old symbol never land on the new one.
    return () => aiAbort?.abort();
  });

  // Quietly recompute the analysis when the indicator timeframe changes:
  // keep the current content visible and swap the result in place — no
  // loading skeleton, no AI restart. (Same pattern as the bars effect.)
  // untrack: assetType is derived from analysis, so tracking it here would
  // re-fire on every resolved analysis (same loop as the symbol effect).
  $effect(() => {
    const sym = symbol;
    const tf = indicatorTf;
    if (!sym) return;
    untrack(() =>
      analyze(sym, assetType, false, tf)
        .then((res) => {
          if (symbol === sym && indicatorTf === tf) analysis = res;
        })
        .catch(() => {})
    );
  });

  // Keep the compact multi-timeframe verdict strip independent from the
  // selected detail timeframe. untrack: same analysis-loop rationale as above.
  $effect(() => {
    const sym = symbol;
    if (!sym) return;
    untrack(() =>
      Promise.all(
        ["1d", "1w", "1mo"].map((tf) => analyze(sym, assetType, false, tf)),
      )
        .then((items) => {
          if (symbol !== sym) return;
          timeframeVerdicts = Object.fromEntries(
            items.map((item) => [
              item.timeframe ?? "1d",
              item.overall.overall_verdict,
            ]),
          );
        })
        .catch(() => {})
    );
  });

  // ---- derivations (ported from the old home page) ------------------------

  // ---- indicator exclusion ------------------------------------------------
  // Double-clicking an indicator chip excludes it from the verdict
  // client-side (single click would fire while closing the info popup).
  // Persisted per indicator NAME (global across symbols/timeframes).
  const INDICATOR_SCORES: Record<string, number> = {
    strong_buy: 2,
    buy: 1,
    hold: 0,
    sell: -1,
    strong_sell: -2,
  };
  function bucketScore(s: number): Verdict {
    if (s >= 5) return "strong_buy";
    if (s >= 2) return "buy";
    if (s <= -5) return "strong_sell";
    if (s <= -2) return "sell";
    return "hold";
  }
  const IND_EXCL_KEY = "vexarium:indicators:off";
  let excludedInd = $state<Record<string, boolean>>({});
  if (browser) {
    try {
      const raw = JSON.parse(localStorage.getItem(IND_EXCL_KEY) ?? "{}");
      if (raw && typeof raw === "object") excludedInd = raw;
    } catch {
      // corrupt storage — start clean
    }
  }
  function toggleIndicator(name: string) {
    excludedInd[name] = !excludedInd[name];
    try {
      localStorage.setItem(IND_EXCL_KEY, JSON.stringify(excludedInd));
    } catch {
      // storage unavailable — exclusion just won't persist
    }
  }

  const enabledIndicators = $derived(
    (analysis?.indicators ?? []).filter((i) => !excludedInd[i.name]),
  );
  // Verdict 'none' contributes 0 to the score and is never counted
  // (mirrors the backend).
  const scoredIndicators = $derived(
    enabledIndicators.filter((i) => verdictToStatus(i.verdict) !== "none"),
  );
  const clientScore = $derived(
    scoredIndicators.reduce(
      (sum, i) => sum + (INDICATOR_SCORES[i.verdict] ?? 0),
      0,
    ),
  );
  const clientVerdict = $derived(bucketScore(clientScore));
  const clientCount = $derived(scoredIndicators.length);

  const bullCount = $derived(
    scoredIndicators.filter((i) => ["buy", "strong_buy"].includes(i.verdict))
      .length,
  );
  const bearCount = $derived(
    scoredIndicators.filter((i) => ["sell", "strong_sell"].includes(i.verdict))
      .length,
  );
  const neutralCount = $derived(
    scoredIndicators.filter((i) => verdictToStatus(i.verdict) === "watch")
      .length,
  );
  const passCount = $derived(
    scoredIndicators.filter((i) => verdictToStatus(i.verdict) === "pass")
      .length,
  );
  const watchCount = $derived(
    scoredIndicators.filter((i) => verdictToStatus(i.verdict) === "watch")
      .length,
  );
  const failCount = $derived(
    scoredIndicators.filter((i) => verdictToStatus(i.verdict) === "fail")
      .length,
  );
  const totalChecks = $derived(scoredIndicators.length);

  const plainSummary = $derived.by(() => {
    if (!analysis?.overall) return "";
    const v = clientVerdict;
    if (["strong_buy", "buy"].includes(v)) {
      return `${passCount} of ${totalChecks} checks pass. Trend and momentum are green${watchCount > 0 ? `, with ${watchCount} to watch` : ""}${failCount > 0 ? ` and ${failCount} flagging caution` : ""}.`;
    }
    if (["strong_sell", "sell"].includes(v)) {
      return `${failCount} of ${totalChecks} checks are failing. The picture is bearish${passCount > 0 ? `, though ${passCount} still pass` : ""}.`;
    }
    return `Mixed picture: ${passCount} pass, ${watchCount} watch, ${failCount} fail. No strong edge either way.`;
  });

  const vitals = $derived.by(() => {
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
  });

  const verdict = $derived(clientVerdict);
  const vColor = $derived(VERDICT_COLORS[verdict]);

  // ---- widget toggling ----------------------------------------------------
  // Enabled map owned here so WidgetGrid / WidgetCard / WidgetLibrary all
  // read the same state; persisted by WidgetGrid.
  let enabled = $state<Record<string, boolean>>({});
  function initEnabled() {
    const stored = loadEnabled("analysis");
    if (Object.keys(stored).length > 0) {
      enabled = stored;
    } else {
      enabled = Object.fromEntries(ANALYSIS_WIDGETS.map((d) => [d.id, true]));
    }
  }
  initEnabled();
  function onToggle(id: string) {
    enabled[id] = enabled[id] === false;
  }
  function onEnable(id: string) {
    enabled[id] = true;
  }
</script>

<svelte:head>
  <title>VEXARIUM: {symbol} analysis</title>
</svelte:head>

<div>
  <DisclaimerBanner />

  {#snippet loadingNotice()}
    <div class="flex h-full min-h-24 items-center justify-center">
      <span class="label" style="color: var(--foreground-muted)"
        >Loading data…</span
      >
    </div>
  {/snippet}

  {#if error && !analysis}
    <div
      class="panel flex flex-col items-center gap-4 p-12"
      style="border-top: 2px solid var(--accent-primary)"
    >
      <p class="brand text-2xl" style="color: var(--accent-primary)">
        Data unavailable for {symbol}
      </p>
      <p class="label" style="color: var(--foreground-muted)">{error}</p>
      <button class="btn-outline" onclick={runAnalysis}>Retry</button>
    </div>
  {:else}
    <SymbolStrip
      analysis={analysis}
      {symbol}
      onSave={() => (showSave = true)}
      verdict={clientVerdict}
      score={clientScore}
      count={clientCount}
    />

    <!-- Widget grid -->
    <WidgetGrid view="analysis" defs={ANALYSIS_WIDGETS} {enabled} {onToggle}>
      {#snippet children({ def }: { def: WidgetDef })}
        <WidgetCard {def} enabled={enabled[def.id] !== false} {onToggle}>
          {#if def.id === "price-chart"}
            <div
              style="height: 100%; display: flex; flex-direction: column; gap: 6px;"
            >
              <div class="flex items-center gap-1" style="flex-wrap: wrap;">
                <select
                  class="tf-select"
                  aria-label="Chart timeframe"
                  bind:value={chartTf}
                >
                  {#each TIMEFRAMES as tf}
                    <option value={tf}>{tf}</option>
                  {/each}
                </select>
                <select
                  class="tf-select"
                  aria-label="Compare against"
                  bind:value={compareSymbol}
                >
                  <option value="">None</option>
                  {#each compareOptions as p}
                    <option value={p}>{p}</option>
                  {/each}
                </select>
                {#if chartHint}
                  <span
                    style="background: var(--surface-3); color: var(--foreground-muted); border: 1px solid var(--panel-border); border-radius: 10px; padding: 2px 10px; font-size: 0.68rem;"
                    >{chartHint}</span
                  >
                {/if}
              </div>
              {#if compareLegend}
                <div
                  class="flex items-center justify-end gap-3"
                  style="font-size: 0.66rem; color: var(--foreground-muted);"
                >
                  <span style="font-family: var(--font-mono);">{symbol}
                    <span
                      style="color: {compareLegend.symPct >= 0
                        ? '#34d399'
                        : '#f87171'};"
                      >{compareLegend.symPct >= 0
                        ? "+"
                        : ""}{compareLegend.symPct.toFixed(1)}%</span
                    ></span
                  >
                  <span style="font-family: var(--font-mono);">{compareSymbol}
                    <span
                      style="color: {compareLegend.cmpPct >= 0
                        ? '#34d399'
                        : '#f87171'};"
                      >{compareLegend.cmpPct >= 0
                        ? "+"
                        : ""}{compareLegend.cmpPct.toFixed(1)}%</span
                    ></span
                  >
                </div>
              {/if}
              <div style="position: relative; flex: 1; min-height: 0;">
                {#if barsLoading && (chartBars?.length ?? 0) > 0}
                  <span
                    style="position: absolute; top: 6px; right: 6px; z-index: 5; background: var(--surface-3); color: var(--foreground-muted); border: 1px solid var(--panel-border); border-radius: 10px; padding: 2px 10px; font-size: 0.68rem;"
                    >Updating…</span
                  >
                {/if}
                {#if (chartBars?.length ?? 0) > 0}
                  <IndicatorChart
                    series={{
                      name: compareSymbol ? `vs ${compareSymbol}` : "PRICE",
                      kind: "overlay",
                      points: comparePoints,
                    }}
                    priceSeries={chartPriceSeries}
                    dataKey={`${symbol}:${chartTf}:${compareSymbol || "none"}`}
                    height={260}
                  />
                {:else if barsLoading}
                  <div
                    class="flex h-44 items-center justify-center rounded-lg border border-dashed"
                    style="border-color: var(--panel-border)"
                  >
                    <span class="label" style="color: var(--foreground-muted)"
                      >Loading…</span
                    >
                  </div>
                {:else if (analysis?.price_series?.length ?? 0) > 0}
                  <IndicatorChart
                    series={{
                      name: compareSymbol ? `vs ${compareSymbol}` : "PRICE",
                      kind: "overlay",
                      points: comparePoints,
                    }}
                    priceSeries={chartPriceSeries}
                    dataKey={`${symbol}:${chartTf}:${compareSymbol || "none"}`}
                    height={260}
                  />
                {:else}
                  <div
                    class="flex h-44 items-center justify-center rounded-lg border border-dashed"
                    style="border-color: var(--panel-border)"
                  >
                    <span class="label" style="color: var(--foreground-muted)"
                      >No price data</span
                    >
                  </div>
                {/if}
              </div>
            </div>
          {:else if def.id === "vitals"}
            {#if vitals.length === 0}
              {@render loadingNotice()}
            {:else}
              <div class="grid grid-cols-2 gap-3">
                {#each vitals as v}
                  <div class="vital">
                    <div class="k">{v.k}</div>
                    <div class="v">{v.v}</div>
                    <div class="d">{v.d}</div>
                  </div>
                {/each}
              </div>
            {/if}
          {:else if def.id === "indicator-checks"}
            {#if !analysis}
              {@render loadingNotice()}
            {:else}
            <div class="flex flex-col gap-2">
              <div class="tf-summary" aria-label="Overall verdict by timeframe">
                {#each [["1d", "1 day"], ["1w", "1 week"], ["1mo", "1 month"]] as item}
                  {@const tf = item[0]}
                  {@const tfVerdict = timeframeVerdicts[tf]}
                  {@const tfColor = tfVerdict
                    ? (VERDICT_COLORS as Record<string, string>)[tfVerdict]
                    : "var(--foreground-muted)"}
                  <div
                    class="tf-summary-card"
                    class:active={tf === indicatorTf}
                    role="button"
                    tabindex="0"
                    title="Show indicators for {item[1]}"
                    onclick={() => (indicatorTf = tf)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        indicatorTf = tf;
                      }
                    }}
                  >
                    <span class="label">{item[1]}</span>
                    <strong style="color: {tfColor}">
                      {tfVerdict
                        ? (VERDICT_LABELS as Record<string, string>)[tfVerdict]
                        : "Loading…"}
                    </strong>
                  </div>
                {/each}
              </div>
              <div class="plainbox">
                <div class="k">What this means for you</div>
                <p>
                  {VERDICT_LABELS[verdict].toLowerCase()}, {bullCount} of {totalChecks}
                  checks are bullish, {neutralCount} neutral, {bearCount} bearish.
                  {clientScore > 0
                    ? "The overall bias is positive."
                    : clientScore < 0
                      ? "The overall bias is negative."
                      : "The overall bias is neutral."}
                </p>
              </div>
              <div
                style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px;"
              >
                {#each analysis.indicators as indicator}
                  {@const ex = explainIndicator(indicator)}
                  {@const vc =
                    VERDICT_COLORS[indicator.verdict] ||
                    "var(--foreground-subtle)"}
                  {@const off = excludedInd[indicator.name] === true}
                  <div
                    class="check"
                    role="button"
                    tabindex="0"
                    ondblclick={() => toggleIndicator(indicator.name)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleIndicator(indicator.name);
                      }
                    }}
                    style="display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: var(--surface-2); border: 1px solid var(--panel-border); border-radius: 6px; min-width: 0; cursor: pointer; transition: opacity 0.15s; {off
                      ? 'opacity: 0.45; filter: grayscale(1);'
                      : ''}"
                  >
                    <div
                      style="display: flex; align-items: center; gap: 8px; min-width: 0;"
                    >
                      <span
                        class="icon chip chip-{ex.status}"
                        style="width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; padding: 0; font-size: 0.72rem; flex-shrink: 0;"
                      >
                        {STATUS_ICON[ex.status]}
                      </span>
                      <span
                        class="indicator-tip"
                        onmouseenter={(e) => positionTip(e.currentTarget)}
                        onmouseleave={(e) => clearTip(e.currentTarget)}
                        style="flex: 1 1 auto; min-width: 0; font-size: 0.75rem; font-weight: 500; color: var(--foreground);"
                      >
                        <span class="tip-label">{indicator.name}</span>
                        {#if off}
                          <span
                            class="label"
                            style="color: var(--foreground-subtle); font-size: 0.58rem; border: 1px solid var(--panel-border); border-radius: 3px; padding: 0 3px; flex-shrink: 0;"
                            >OFF</span
                          >
                        {/if}
                        <span class="tooltip tooltip-name">{ex.what}</span>
                      </span>
                    </div>
                    <span
                      class="indicator-tip data"
                      onmouseenter={(e) => positionTip(e.currentTarget)}
                      onmouseleave={(e) => clearTip(e.currentTarget)}
                      style="padding-left: 30px; font-size: 0.68rem; color: {vc}; min-width: 0;"
                    >
                      <span class="tip-label">{ex.reading}</span>
                      <span class="tooltip tooltip-value">
                        <b>{ex.reading}</b>
                        <small>{ex.reason}</small>
                        {#if analysis.indicator_series?.find((s) => s.name === indicator.name)?.points?.length}
                          <IndicatorChart
                            series={analysis.indicator_series.find(
                              (s) => s.name === indicator.name,
                            )!}
                            dataKey={`${symbol}:${indicatorTf}:${indicator.name}`}
                            height={90}
                          />
                        {/if}
                      </span>
                    </span>
                  </div>
                {/each}
              </div>
              <p
                class="label"
                style="color: var(--foreground-muted); font-size: 0.65rem; text-transform: none;"
              >
                Double-click an indicator to exclude it from the verdict.
              </p>
            </div>
            {/if}
          {:else if def.id === "ai-opinion"}
            <div class="flex h-full flex-col">
              <div class="flex items-center justify-end">
                <button class="btn-outline" onclick={runAI} disabled={aiLoading}
                  >Run AI analysis</button
                >
              </div>
              {#if aiLoading && !aiMessage}
                <p class="mt-4 font-mono" style="color: var(--accent-primary)">
                  Analyzing…
                </p>
              {:else if aiMessage}
                <div class="mt-4 ai-body" style="flex: 1; overflow: auto;">
                  {@html renderAIMarkdown(aiMessage)}
                </div>
              {:else}
                <p
                  class="mt-4 label"
                  style="color: var(--foreground-muted); text-transform: none"
                >
                  Run AI to get a natural-language interpretation of the
                  indicators, news and fundamentals.
                </p>
              {/if}
            </div>
          {:else if def.id === "news"}
            {#snippet articleRow(article: import("$lib/types").NewsArticle)}
              {@const s = article.sentiment}
              <a
                href={article.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--foreground); font-size: 0.75rem; line-height: 1.4;"
              >
                <span style="color: var(--accent-primary); flex-shrink: 0;">●</span>
                <div style="flex: 1; min-width: 0;">
                  <div>{article.headline}</div>
                  <div
                    class="label"
                    style="color: var(--foreground-subtle); text-transform: none;"
                  >
                    {article.source || "Source"}{article.created_at
                      ? ` · ${new Date(article.created_at).toLocaleDateString()}`
                      : ""}
                  </div>
                </div>
                <span
                  title={s == null ? "No sentiment score" : `Sentiment score ${s}`}
                  style="font-family: var(--font-mono); font-size: 0.66rem; font-variant-numeric: tabular-nums; flex-shrink: 0; margin-left: auto; color: {s == null
                    ? 'var(--foreground-muted)'
                    : s > 0.2
                      ? 'var(--verdict-strong-buy)'
                      : s < -0.2
                        ? 'var(--verdict-strong-sell)'
                        : 'var(--verdict-hold)'};"
                  >{s == null ? "·" : (s > 0 ? "+" : "") + s.toFixed(2)}</span
                >
              </a>
            {/snippet}
            {#if !analysis}
              {@render loadingNotice()}
            {:else if analysis.news_sentiment}
              {@const ns = analysis.news_sentiment}
              {@const color =
                ns.sentiment_score > 0.2
                  ? "var(--verdict-strong-buy)"
                  : ns.sentiment_score < -0.2
                    ? "var(--verdict-strong-sell)"
                    : "var(--verdict-hold)"}
              <div style="display: flex; gap: 20px; margin-bottom: 12px;">
                <div class="vital" style="flex: 1;">
                  <div class="k">Sentiment</div>
                  <div class="v" style="color: {color}">{ns.summary}</div>
                  <div class="d">
                    {ns.article_count} articles · score {ns.sentiment_score}
                  </div>
                </div>
              </div>
              {#if analysis.news_articles && analysis.news_articles.length > 0}
                <div
                  class="flex flex-col"
                  style="border-top: 1px solid var(--panel-border); padding-top: 8px; gap: 8px;"
                >
                  {#each analysis.news_articles.slice(0, 5) as article}
                    {@render articleRow(article)}
                  {/each}
                </div>
              {/if}
              {#if marketNews && marketNews.articles && marketNews.articles.length > 0}
                <div
                  style="margin-top: 14px; border-top: 1px solid var(--panel-border); padding-top: 10px;"
                >
                  <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px;">
                    <span class="k" style="font-size: 0.7rem; margin: 0;">Market</span>
                    <span
                      class="label"
                      style="font-size: 0.64rem; text-transform: none; color: var(--foreground-muted);"
                    >
                      broad market · score {marketNews.sentiment.sentiment_score}
                    </span>
                  </div>
                  <div class="flex flex-col" style="gap: 8px;">
                    {#each marketNews.articles.slice(0, 5) as article}
                      {@render articleRow(article)}
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="label" style="color: var(--foreground-muted)">
                No news data
              </p>
            {/if}
          {:else if def.id === "insider" || def.id === "earnings" || def.id === "peers"}
            {#if !finnhubDone}
              {@render loadingNotice()}
            {:else}
              <FinnhubWidget kind={def.id} bundle={finnhub} />
            {/if}
          {:else if def.id === "fear-greed"}
            {#if !fearGreed || fearGreed.score == null}
              <p class="label" style="color: var(--foreground-muted);">
                Fear & Greed unavailable
              </p>
            {:else}
              {@const s = fearGreed.score}
              {@const zone =
                s <= 25
                  ? "Extreme fear"
                  : s < 45
                    ? "Fear"
                    : s <= 55
                      ? "Neutral"
                      : s < 75
                        ? "Greed"
                        : "Extreme greed"}
              {@const zc =
                s <= 45
                  ? "var(--verdict-strong-buy)"
                  : s < 75
                    ? "var(--verdict-hold)"
                    : "var(--verdict-strong-sell)"}
              {@const A0 = 135}
              {@const valAngle = A0 + Math.min(100, Math.max(0, s)) * 2.7}
              <div style="display: flex; align-items: center; gap: 18px; padding: 4px 2px 8px;">
                <svg viewBox="0 0 120 120" style="width: 118px; height: 118px; flex-shrink: 0; display: block;">
                  <path d={arcPath(60, 60, 46, A0, A0 + 270)} fill="none" stroke="var(--surface-3)" stroke-width="12" stroke-linecap="round" />
                  <path d={arcPath(60, 60, 46, A0, Math.max(A0 + 2, valAngle))} fill="none" stroke={zc} stroke-width="12" stroke-linecap="round" />
                  {#if valAngle >= A0 + 4}
                    <circle cx={polarX(60, 60, 46, valAngle)} cy={polarY(60, 60, 46, valAngle)} r="4.5" fill={zc} />
                  {/if}
                  <text x="60" y="62" text-anchor="middle" fill="var(--foreground)" font-size="32" font-weight="700" style="font-family: var(--font-mono);">{Math.round(s)}</text>
                  <text x="60" y="79" text-anchor="middle" fill={zc} font-size="10" font-weight="600" style="font-family: var(--font-mono); text-transform: capitalize;">{zone}</text>
                </svg>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;">
                  <div>
                    <div class="label" style="font-size: 0.6rem; color: var(--foreground-muted); text-transform: none;">1 week</div>
                    <div class="data" style="font-size: 0.95rem; font-weight: 600;">{#if fearGreed.previous_1_week != null}{s - fearGreed.previous_1_week >= 0 ? "+" : ""}{Math.round(s - fearGreed.previous_1_week)}{:else}—{/if}</div>
                  </div>
                  <div>
                    <div class="label" style="font-size: 0.6rem; color: var(--foreground-muted); text-transform: none;">1 month</div>
                    <div class="data" style="font-size: 0.95rem; font-weight: 600;">{#if fearGreed.previous_1_month != null}{s - fearGreed.previous_1_month >= 0 ? "+" : ""}{Math.round(s - fearGreed.previous_1_month)}{:else}—{/if}</div>
                  </div>
                  <div class="label" style="font-size: 0.58rem; color: var(--foreground-muted); text-transform: none;">updated {fearGreed.timestamp ? new Date(fearGreed.timestamp).toLocaleDateString() : ""}</div>
                </div>
              </div>
              {#if fearGreed.history && fearGreed.history.length > 1}
                {@const pts = fearGreed.history}
                {@const line = pts
                  .map(
                    (p, i) =>
                      `${(i / Math.max(1, pts.length - 1)) * 100},${100 - Math.min(100, Math.max(0, p.v))}`,
                  )
                  .join(" ")}
                {@const area = `${line} 100,100 0,100`}
                <div style="display: flex; gap: 6px; align-items: stretch; margin-top: 4px;" title="Fear & Greed trend, last 3 months (today {Math.round(s)})">
                  <div style="display: flex; flex-direction: column; justify-content: space-between; height: 40px; font-family: var(--font-mono); font-size: 0.55rem; color: var(--foreground-subtle); text-align: right;">
                    <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 40px; display: block;">
                      <line x1="0" y1="0" x2="100" y2="0" style="stroke: var(--foreground-subtle);" stroke-width="1" vector-effect="non-scaling-stroke" />
                      <line x1="0" y1="25" x2="100" y2="25" style="stroke: var(--panel-border);" stroke-width="1" vector-effect="non-scaling-stroke" />
                      <line x1="0" y1="50" x2="100" y2="50" style="stroke: var(--panel-border);" stroke-width="1" vector-effect="non-scaling-stroke" />
                      <line x1="0" y1="75" x2="100" y2="75" style="stroke: var(--panel-border);" stroke-width="1" vector-effect="non-scaling-stroke" />
                      <line x1="0" y1="100" x2="100" y2="100" style="stroke: var(--foreground-subtle);" stroke-width="1" vector-effect="non-scaling-stroke" />
                      <polygon points={area} style="fill: {zc};" fill-opacity="0.12" />
                      <polyline points={line} style="stroke: {zc};" fill="none" stroke-width="1.5" vector-effect="non-scaling-stroke" />
                    </svg>
                    <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.58rem; color: var(--foreground-subtle); margin-top: 2px;">
                      <span>{pts[0]?.t ?? ""}</span>
                      <span>{pts[pts.length - 1]?.t ?? ""}</span>
                    </div>
                  </div>
                </div>
              {/if}
              <div
                class="label"
                style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--panel-border); font-size: 0.68rem; color: var(--foreground-muted); text-transform: none;"
              >
                Market mood: <span style="color: {zc};">{zone.toLowerCase()}</span> · this stock: <span style="color: {vColor};">{VERDICT_LABELS[verdict].toLowerCase()}</span>
              </div>
            {/if}
          {:else if def.id === "patterns"}
            {#if !analysis}
              {@render loadingNotice()}
            {:else if patternFlags.length === 0}
              <p class="label" style="color: var(--foreground-muted);">
                No recent patterns
              </p>
            {:else}
              <div class="flex flex-col" style="gap: 6px;">
                {#each patternFlags as f}
                  <div
                    style="display: flex; align-items: center; gap: 8px; font-size: 0.72rem;"
                  >
                    <span
                      style="flex-shrink: 0; font-size: 0.58rem; padding: 1px 7px; border-radius: 4px; border: 1px solid {f.dir === 'bullish'
                        ? '#34d399'
                        : '#f87171'}; color: {f.dir === 'bullish'
                        ? '#34d399'
                        : '#f87171'};"
                      >{f.dir === "bullish" ? "Bullish" : "Bearish"}</span
                    >
                    <span style="color: var(--foreground); min-width: 0;">{f.label}</span>
                    {#if f.ago > 0}
                      <span
                        class="label"
                        style="color: var(--foreground-subtle); margin-left: auto; flex-shrink: 0;"
                        >{f.ago} bars ago</span
                      >
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          {:else if def.id === "stats"}
            {#if !analysis}
              {@render loadingNotice()}
            {:else if statsRows.length === 0}
              <p class="label" style="color: var(--foreground-muted);">
                No statistics available
              </p>
            {:else}
              <div class="grid grid-cols-2 gap-3">
                {#each statsRows as row}
                  <div class="vital">
                    <div class="k">{row.k}</div>
                    <div class="v" style="color: {row.color ?? 'var(--foreground)'};">
                      {row.v}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {:else if def.id === "company"}
            {#if !analysis}
              {@render loadingNotice()}
            {:else if analysis.company && (analysis.company.name || analysis.company.description || analysis.company.market_cap !== null)}
              {@const co = analysis.company}
              {@const range = (co.high_52w ?? 0) - (co.low_52w ?? 0)}
              {@const pos =
                range > 0 && analysis.current_price
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((analysis.current_price - (co.low_52w ?? 0)) / range) * 100,
                      ),
                    )
                  : 0}
              <div style="height: 100%; overflow: auto;">
                <CompanyProfile company={co} {symbol} {pos} />
              </div>
            {:else}
              <p class="label" style="color: var(--foreground-muted)">
                No company data
              </p>
            {/if}
          {:else if def.id === "watchlist"}
            <WatchlistWidget />
          {/if}
        </WidgetCard>
      {/snippet}
    </WidgetGrid>

    <WidgetLibrary
      view="analysis"
      defs={ANALYSIS_WIDGETS}
      {enabled}
      {onEnable}
    />
  {/if}

  <SaveTradeModal
    open={showSave}
    {symbol}
    entryPrice={analysis?.current_price ?? null}
    onClose={() => (showSave = false)}
  />
</div>
