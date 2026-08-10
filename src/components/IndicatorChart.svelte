<script lang="ts">
  import { CHART_THEME } from "$lib/chart-theme";
  import type { IndicatorSeries, PricePoint } from "$lib/types";
  import type {
    IChartApi,
    ISeriesApi,
    Time,
    UTCTimestamp,
  } from "lightweight-charts";
  import {
    CandlestickSeries,
    ColorType,
    createChart,
    LineSeries,
  } from "lightweight-charts";
  import { onDestroy } from "svelte";

  let {
    series,
    priceSeries,
    height = 140,
  }: {
    series: IndicatorSeries;
    priceSeries?: PricePoint[];
    height?: number;
  } = $props();

  let container: HTMLDivElement = $state()!;

  type Chart = IChartApi;
  let chart: Chart | null = null;
  let candleSeries: ISeriesApi<"Candlestick"> | null = null;
  let lineSeries: ReturnType<Chart["addSeries"]> | null = null;
  let refLines: { s: ReturnType<Chart["addSeries"]>; value: number }[] = [];
  let builtMode: "overlay" | "oscillator" | null = null;
  let observedEl: Element | null = null;
  let fitObserver: ResizeObserver | null = null;
  let tipVisible = $state(false);
  let tipX = $state(0);
  let tipY = $state(0);
  let tipHtml = $state("");
  let lastDataKey = "";

  // Parse a 'YYYY-MM-DD' string into a lightweight-charts unix timestamp (seconds).
  function toTime(t: string): UTCTimestamp {
    return Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp;
  }

  const hasCandles = () => Array.isArray(priceSeries) && priceSeries.length > 0;
  const hasPoints = () =>
    Array.isArray(series.points) && series.points.length > 0;
  const isOverlay = () => series.kind === "overlay" && hasCandles();

  const INDICATOR_COLOR = "#e8edf5";

  function referenceLines(): number[] {
    const name = series.name.toUpperCase();
    if (name.includes("RSI")) return [30, 70];
    if (name.includes("STOCH")) return [20, 80];
    return [];
  }

  function refLineColor(v: number): string {
    return v > 50 ? "#f87171" : "#34d399";
  }

  function fmtPrice(v: number): string {
    const a = Math.abs(v);
    return a >= 1 ? v.toFixed(2) : v.toFixed(4);
  }

  // Most common gap between consecutive bars (seconds) = the candle period.
  // Works for every timeframe without passing the timeframe in; robust to
  // session gaps because it's the mode, not the mean.
  function barPeriodSecs(): number | null {
    const s = candleSeries;
    if (!s) return null;
    const times = (s.data() as { time: Time }[])
      .map((p) => p.time)
      .filter((t): t is UTCTimestamp => typeof t === "number");
    if (times.length < 2) return null;
    const counts = new Map<number, number>();
    for (let i = 1; i < times.length; i++) {
      const d = times[i] - times[i - 1];
      if (d > 0) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    let best = 0;
    let bestN = 0;
    for (const [d, n] of counts) {
      if (n > bestN) {
        best = d;
        bestN = n;
      }
    }
    return best || null;
  }

  function fmtBarTime(t: Time, withTime: boolean): string {
    const d =
      typeof t === "number"
        ? new Date(t * 1000)
        : typeof t === "string"
          ? new Date(t)
          : new Date(Date.UTC(t.year, t.month - 1, t.day));
    const p = (n: number) => String(n).padStart(2, "0");
    const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
    if (!withTime) return date;
    return `${date} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // Candle tooltip content — period start–end + O/H/L/C rows.
  function tipFor(
    d: { open: number; high: number; low: number; close: number },
    t: Time,
    periodSecs: number | null,
  ): string {
    const row = (l: string, v: number, color: string) =>
      `<div style="display:flex;justify-content:space-between;gap:14px;">` +
      `<span style="color:var(--foreground-muted)">${l}</span>` +
      `<span style="color:${color}">${fmtPrice(v)}</span></div>`;
    const intraday = periodSecs !== null && periodSecs < 86400;
    const end: Time =
      typeof t === "number" && periodSecs
        ? ((t + periodSecs) as UTCTimestamp)
        : t;
    const range =
      periodSecs !== null
        ? `${fmtBarTime(t, intraday)} – ${fmtBarTime(end, intraday)}`
        : fmtBarTime(t, intraday);
    return (
      `<div style="font-weight:600;margin-bottom:3px;color:var(--foreground)">${range}</div>` +
      row("O", d.open, "var(--foreground)") +
      row("H", d.high, "#34d399") +
      row("L", d.low, "#f87171") +
      row("C", d.close, "var(--foreground)")
    );
  }

  function candleData() {
    return (priceSeries || []).map((p) => ({
      time: toTime(p.t),
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
    }));
  }

  function lineData() {
    return series.points.map((p) => ({ time: toTime(p.t), value: p.v }));
  }

  // Create the chart — or rebuild it if the display mode (overlay candles vs
  // standalone oscillator line) or container changed — and start the
  // fit-on-resize observer.
  function ensureChart(c: HTMLDivElement) {
    const mode: "overlay" | "oscillator" = isOverlay()
      ? "overlay"
      : "oscillator";
    if (chart && builtMode === mode && observedEl === c) return;

    chart?.remove();
    chart = null;
    candleSeries = null;
    lineSeries = null;
    refLines = [];
    builtMode = mode;
    observedEl = c;

    chart = createChart(c, {
      ...CHART_THEME,
      width: Math.max(c.clientWidth, 1),
      height: Math.max(c.clientHeight, 1),
      layout: {
        ...CHART_THEME.layout,
        background: { type: ColorType.Solid, color: "#151a24" },
      },
      rightPriceScale: {
        ...CHART_THEME.rightPriceScale,
        scaleMargins:
          mode === "overlay"
            ? { top: 0.1, bottom: 0.2 }
            : { top: 0.15, bottom: 0.25 },
      },
      timeScale: {
        timeVisible: true,
      },
      crosshair: {
        mode: 1,
        vertLine: { visible: true, labelVisible: true },
        horzLine: { visible: true, labelVisible: true },
      },
      handleScroll: true,
      handleScale: true,
    });

    if (mode === "overlay") {
      // Candlestick price series + indicator line on the same price scale.
      candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#34d399",
        downColor: "#f87171",
        borderUpColor: "#34d399",
        borderDownColor: "#f87171",
        wickUpColor: "#34d399",
        wickDownColor: "#f87171",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      lineSeries = chart.addSeries(LineSeries, {
        color: INDICATOR_COLOR,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    } else {
      // Oscillator: line chart of just the indicator points.
      lineSeries = chart.addSeries(LineSeries, {
        color: INDICATOR_COLOR,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      // Reference threshold lines (RSI/Stochastic).
      for (const rv of referenceLines()) {
        refLines.push({
          s: chart.addSeries(LineSeries, {
            color: refLineColor(rv),
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          }),
          value: rv,
        });
      }
    }

    // Own the sizing with a permanent ResizeObserver: popup mini charts mount
    // while their tooltip is display:none (0 width), and autoSize never
    // recovers from that — resize + refit whenever the container actually
    // gets a real size (tooltip opens, gridstack layout changes).
    fitObserver?.disconnect();
    fitObserver = new ResizeObserver(() => {
      if (!chart) return;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (w > 0 && h > 0) {
        chart.resize(w, h);
        chart.timeScale().fitContent();
      }
    });
    fitObserver.observe(c);

    // Candle hover tooltip: O/H/L/C + time, clamped to the chart bounds.
    chart.subscribeCrosshairMove((param) => {
      const s = candleSeries;
      if (!s || !param.point || !param.time) {
        tipVisible = false;
        return;
      }
      const d = param.seriesData.get(s) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!d) {
        tipVisible = false;
        return;
      }
      tipHtml = tipFor(d, param.time, barPeriodSecs());
      const TW = 190;
      const TH = 92;
      let x = param.point.x + 14;
      let y = param.point.y + 14;
      if (x + TW > c.clientWidth) x = param.point.x - TW - 10;
      if (y + TH > c.clientHeight) y = param.point.y - TH - 10;
      tipX = Math.max(0, x);
      tipY = Math.max(0, y);
      tipVisible = true;
    });
  }

  // Reactive to prop changes: update series data in place instead of
  // recreating the component (the {#key} workaround is gone).
  $effect(() => {
    const c = container;
    if (!c || (!hasCandles() && !hasPoints())) return;
    ensureChart(c);
    if (isOverlay()) {
      candleSeries?.setData(candleData());
      lineSeries?.setData(lineData());
    } else {
      lineSeries?.setData(lineData());
      for (const r of refLines) {
        r.s.setData(lineData().map((d) => ({ ...d, value: r.value })));
      }
    }
    // Fit only when the dataset actually changed (symbol/timeframe switch).
    // Live last-candle ticks mutate the same bars and must not reset zoom.
    const data = isOverlay() ? candleData() : lineData();
    const key = `${data.length}:${data[0]?.time ?? 0}:${data[data.length - 1]?.time ?? 0}`;
    if (key !== lastDataKey) {
      lastDataKey = key;
      chart?.timeScale().fitContent();
    }
  });

  onDestroy(() => {
    fitObserver?.disconnect();
    fitObserver = null;
    chart?.remove();
    chart = null;
    candleSeries = null;
    lineSeries = null;
    refLines = [];
  });
</script>

{#if hasCandles() || hasPoints()}
  <div style="position: relative; height: {height}px; width: 100%;">
    <div bind:this={container} style="height: 100%; width: 100%;"></div>
    {#if tipVisible}
      <div
        style="position: absolute; z-index: 20; pointer-events: none; left: {tipX}px; top: {tipY}px; background: var(--surface-3); border: 1px solid var(--panel-border); border-radius: 8px; padding: 6px 9px; font-size: 0.7rem; box-shadow: 0 2px 10px rgb(0 0 0 / 0.4); white-space: nowrap;"
      >
        {@html tipHtml}
      </div>
    {/if}
  </div>
{:else}
  <div
    class="flex items-center justify-center"
    style="height: {height}px; width: 100%; border: 1px dashed var(--panel-border); border-radius: 4px;"
  >
    <span class="label" style="color: var(--foreground-muted)"
      >NO CHART DATA</span
    >
  </div>
{/if}
