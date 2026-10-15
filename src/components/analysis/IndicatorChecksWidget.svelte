<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import { explainIndicator, STATUS_ICON } from "$lib/indicator-explain";
  import { clearTip, positionTip } from "$lib/tooltip";
  import { VERDICT_COLORS, VERDICT_LABELS } from "$lib/verdict";
  import IndicatorChart from "../IndicatorChart.svelte";
  import LoadingNotice from "./LoadingNotice.svelte";

  let { store }: { store: AnalysisStore } = $props();
</script>

{#if !store.analysis}
  <LoadingNotice />
{:else}
<div class="flex flex-col gap-2">
  <div class="tf-summary" aria-label="Overall verdict by timeframe">
    {#each [["1d", "1 day"], ["1w", "1 week"], ["1mo", "1 month"]] as item}
      {@const tf = item[0]}
      {@const tfVerdict = store.timeframeVerdicts[tf]}
      {@const tfColor = tfVerdict
        ? (VERDICT_COLORS as Record<string, string>)[tfVerdict]
        : "var(--foreground-muted)"}
      <div
        class="tf-summary-card"
        class:active={tf === store.indicatorTf}
        role="button"
        tabindex="0"
        title="Show indicators for {item[1]}"
        onclick={() => (store.indicatorTf = tf)}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            store.indicatorTf = tf;
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
      {VERDICT_LABELS[store.client.verdict].toLowerCase()}, {store.client.bull} of {store.client.count}
      checks are bullish, {store.client.neutral} neutral, {store.client.bear} bearish.
      {store.client.score > 0
        ? "The overall bias is positive."
        : store.client.score < 0
          ? "The overall bias is negative."
          : "The overall bias is neutral."}
    </p>
  </div>
  <div
    style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px;"
  >
    {#each store.analysis.indicators as indicator}
      {@const ex = explainIndicator(indicator)}
      {@const vc =
        VERDICT_COLORS[indicator.verdict] ||
        "var(--foreground-subtle)"}
      {@const off = store.excludedInd[indicator.name] === true}
      <div
        class="check"
        role="button"
        tabindex="0"
        ondblclick={() => store.toggleIndicator(indicator.name)}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            store.toggleIndicator(indicator.name);
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
            {#if store.analysis.indicator_series?.find((s) => s.name === indicator.name)?.points?.length}
              <IndicatorChart
                series={store.analysis.indicator_series.find(
                  (s) => s.name === indicator.name,
                )!}
                dataKey={`${store.symbol}:${store.indicatorTf}:${indicator.name}`}
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
