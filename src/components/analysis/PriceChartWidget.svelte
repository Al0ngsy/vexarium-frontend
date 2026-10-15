<script lang="ts">
  import { TIMEFRAMES, type AnalysisStore } from "$lib/analysis.svelte";
  import IndicatorChart from "../IndicatorChart.svelte";

  let { store }: { store: AnalysisStore } = $props();
</script>

<div
  style="height: 100%; display: flex; flex-direction: column; gap: 6px;"
>
  <div class="flex items-center gap-1" style="flex-wrap: wrap;">
    <select
      class="tf-select"
      aria-label="Chart timeframe"
      bind:value={store.chartTf}
    >
      {#each TIMEFRAMES as tf}
        <option value={tf}>{tf}</option>
      {/each}
    </select>
    <select
      class="tf-select"
      aria-label="Compare against"
      bind:value={store.compareSymbol}
    >
      <option value="">None</option>
      {#each store.compareOptions as p}
        <option value={p}>{p}</option>
      {/each}
    </select>
    {#if store.chartHint}
      <span
        style="background: var(--surface-3); color: var(--foreground-muted); border: 1px solid var(--panel-border); border-radius: 10px; padding: 2px 10px; font-size: 0.68rem;"
        >{store.chartHint}</span
      >
    {/if}
  </div>
  {#if store.compareLegend}
    <div
      class="flex items-center justify-end gap-3"
      style="font-size: 0.66rem; color: var(--foreground-muted);"
    >
      <span style="font-family: var(--font-mono);">{store.symbol}
        <span
          style="color: {store.compareLegend.symPct >= 0
            ? '#34d399'
            : '#f87171'};"
          >{store.compareLegend.symPct >= 0
            ? "+"
            : ""}{store.compareLegend.symPct.toFixed(1)}%</span
        ></span
      >
      <span style="font-family: var(--font-mono);">{store.compareSymbol}
        <span
          style="color: {store.compareLegend.cmpPct >= 0
            ? '#34d399'
            : '#f87171'};"
          >{store.compareLegend.cmpPct >= 0
            ? "+"
            : ""}{store.compareLegend.cmpPct.toFixed(1)}%</span
        ></span
      >
    </div>
  {/if}
  <div style="position: relative; flex: 1; min-height: 0;">
    {#if store.barsLoading && (store.chartBars?.length ?? 0) > 0}
      <span
        style="position: absolute; top: 6px; right: 6px; z-index: 5; background: var(--surface-3); color: var(--foreground-muted); border: 1px solid var(--panel-border); border-radius: 10px; padding: 2px 10px; font-size: 0.68rem;"
        >Updating…</span
      >
    {/if}
    {#if (store.chartBars?.length ?? 0) > 0}
      <IndicatorChart
        series={{
          name: store.compareSymbol ? `vs ${store.compareSymbol}` : "PRICE",
          kind: "overlay",
          points: store.comparePoints,
        }}
        priceSeries={store.chartPriceSeries}
        dataKey={`${store.symbol}:${store.chartTf}:${store.compareSymbol || "none"}`}
        height={260}
      />
    {:else if store.barsLoading}
      <div
        class="flex h-44 items-center justify-center rounded-lg border border-dashed"
        style="border-color: var(--panel-border)"
      >
        <span class="label" style="color: var(--foreground-muted)"
          >Loading…</span
        >
      </div>
    {:else if (store.analysis?.price_series?.length ?? 0) > 0}
      <IndicatorChart
        series={{
          name: store.compareSymbol ? `vs ${store.compareSymbol}` : "PRICE",
          kind: "overlay",
          points: store.comparePoints,
        }}
        priceSeries={store.chartPriceSeries}
        dataKey={`${store.symbol}:${store.chartTf}:${store.compareSymbol || "none"}`}
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
