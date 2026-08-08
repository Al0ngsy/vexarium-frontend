<script lang="ts">
  import { CHART_THEME } from "$lib/chart-theme";
  import type { IndicatorSeries, PricePoint } from "$lib/types";
  import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
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
  let fitTimer: ReturnType<typeof setTimeout> | null = null;

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
      autoSize: true,
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
      crosshair: {
        mode: 0,
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
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

    // Wait until the container has its real size before fitting. On first
    // mount the widget grid is still laying out (width 0/small), and
    // gridstack resizes the container several times — fitting once and
    // disconnecting immediately squeezes all candles into the right side.
    // Re-fit on every resize and only stop after 100ms with no further
    // resize (autoSize already keeps the canvas sized correctly).
    if (fitTimer) clearTimeout(fitTimer);
    fitObserver?.disconnect();
    fitObserver = new ResizeObserver(() => {
      chart?.timeScale().fitContent();
      if (fitTimer) clearTimeout(fitTimer);
      fitTimer = setTimeout(() => {
        fitObserver?.disconnect();
        fitObserver = null;
      }, 100);
    });
    fitObserver.observe(c);
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
    chart?.timeScale().fitContent();
  });

  onDestroy(() => {
    if (fitTimer) clearTimeout(fitTimer);
    fitTimer = null;
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
  <div bind:this={container} style="height: {height}px; width: 100%;"></div>
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
