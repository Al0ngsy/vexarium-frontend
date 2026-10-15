<script lang="ts">
  import type { IndicatorSeries, PricePoint } from "$lib/types";

  // Stand-in for IndicatorChart in jsdom tests (lightweight-charts needs a
  // canvas). Exposes what the real chart receives as data attributes.
  let {
    series,
    priceSeries,
    height = 0,
    dataKey = "",
  }: { series: IndicatorSeries; priceSeries?: PricePoint[]; height?: number; dataKey?: string } = $props();
</script>

<div
  class="chart-stub"
  data-key={dataKey}
  data-h={height}
  data-name={series.name}
  data-n={priceSeries ? priceSeries.length : series.points.length}
  data-first={priceSeries ? priceSeries[0]?.close?.toFixed(3) : series.points[0]?.v}
  data-last={priceSeries
    ? priceSeries[priceSeries.length - 1]?.close?.toFixed(3)
    : series.points[series.points.length - 1]?.v}
  data-cmp={priceSeries ? series.points.length : ""}
></div>
