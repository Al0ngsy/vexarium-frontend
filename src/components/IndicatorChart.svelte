<script lang="ts">
  import { CHART_THEME } from "$lib/chart-theme";
  import type { IndicatorSeries, PricePoint } from "$lib/types";
  import type { IChartApi, UTCTimestamp } from "lightweight-charts";
  import {
    CandlestickSeries,
    ColorType,
    createChart,
    LineSeries,
  } from "lightweight-charts";
  import { onDestroy, onMount } from "svelte";

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
  let lineSeries: ReturnType<Chart["addSeries"]> | null = null;

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

  let fitObserver: ResizeObserver | null = null;

  onMount(() => {
    if (!container) return;

    chart = createChart(container, {
      ...CHART_THEME,
      autoSize: true,
      layout: {
        ...CHART_THEME.layout,
        background: { type: ColorType.Solid, color: "#151a24" },
      },
      rightPriceScale: {
        ...CHART_THEME.rightPriceScale,
        scaleMargins: isOverlay()
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

    if (isOverlay()) {
      // Candlestick price series + indicator line on the same price scale.
      chart
        .addSeries(CandlestickSeries, {
          upColor: "#34d399",
          downColor: "#f87171",
          borderUpColor: "#34d399",
          borderDownColor: "#f87171",
          wickUpColor: "#34d399",
          wickDownColor: "#f87171",
          priceLineVisible: false,
          lastValueVisible: false,
        })
        .setData(
          (priceSeries || []).map((p) => ({
            time: toTime(p.t),
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
          })),
        );
      lineSeries = chart.addSeries(LineSeries, {
        color: INDICATOR_COLOR,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      lineSeries.setData(
        series.points.map((p) => ({ time: toTime(p.t), value: p.v })),
      );
    } else {
      // Oscillator: line chart of just the indicator points.
      lineSeries = chart.addSeries(LineSeries, {
        color: INDICATOR_COLOR,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      lineSeries.setData(
        series.points.map((p) => ({ time: toTime(p.t), value: p.v })),
      );
      // Reference threshold lines (RSI/Stochastic).
      const refs = referenceLines();
      if (refs.length > 0 && series.points.length > 0) {
        for (const rv of refs) {
          chart
            .addSeries(LineSeries, {
              color: refLineColor(rv),
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            })
            .setData(
              series.points.map((p) => ({ time: toTime(p.t), value: rv })),
            );
        }
      }
    }

    // Wait until the container actually has a non-zero width before fitting.
    // On first mount the widget grid may still be laying out, so the
    // container width can be 0/small — fitting immediately would squeeze
    // all candles into the right side of the chart. A ResizeObserver is
    // deterministic: it fires as soon as the container gets its real size,
    // no matter how long layout takes.
    fitObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) {
        chart?.timeScale().fitContent();
        fitObserver?.disconnect();
        fitObserver = null;
      }
    });
    fitObserver.observe(container);
  });

  onDestroy(() => {
    fitObserver?.disconnect();
    fitObserver = null;
    chart?.remove();
    chart = null;
    lineSeries = null;
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
