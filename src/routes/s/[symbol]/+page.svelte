<script lang="ts">
  import { page } from "$app/state";
  import { AnalysisStore } from "$lib/analysis.svelte";
  import {
    ANALYSIS_WIDGETS,
    loadEnabled,
    type WidgetDef,
  } from "$lib/layout.svelte";
  import AiOpinionWidget from "../../../components/analysis/AiOpinionWidget.svelte";
  import CompanyWidget from "../../../components/analysis/CompanyWidget.svelte";
  import FearGreedWidget from "../../../components/analysis/FearGreedWidget.svelte";
  import IndicatorChecksWidget from "../../../components/analysis/IndicatorChecksWidget.svelte";
  import LoadingNotice from "../../../components/analysis/LoadingNotice.svelte";
  import NewsWidget from "../../../components/analysis/NewsWidget.svelte";
  import PatternsWidget from "../../../components/analysis/PatternsWidget.svelte";
  import PriceChartWidget from "../../../components/analysis/PriceChartWidget.svelte";
  import StatsWidget from "../../../components/analysis/StatsWidget.svelte";
  import VitalsWidget from "../../../components/analysis/VitalsWidget.svelte";
  import DisclaimerBanner from "../../../components/DisclaimerBanner.svelte";
  import FinnhubWidget from "../../../components/FinnhubWidget.svelte";
  import SaveTradeModal from "../../../components/SaveTradeModal.svelte";
  import SymbolStrip from "../../../components/SymbolStrip.svelte";
  import WatchlistWidget from "../../../components/WatchlistWidget.svelte";
  import WidgetCard from "../../../components/WidgetCard.svelte";
  import WidgetGrid from "../../../components/WidgetGrid.svelte";
  import WidgetLibrary from "../../../components/WidgetLibrary.svelte";

  const symbol = $derived(String(page.params.symbol || "").toUpperCase());

  // All loading (analysis, bars, AI stream, side data) lives in the store; it
  // reloads on client-side symbol changes and aborts everything on destroy.
  const store = new AnalysisStore();
  store.connect(() => symbol);

  let showSave = $state(false);

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

  {#if store.error && !store.analysis}
    <div
      class="panel flex flex-col items-center gap-4 p-12"
      style="border-top: 2px solid var(--accent-primary)"
    >
      <p class="brand text-2xl" style="color: var(--accent-primary)">
        Data unavailable for {symbol}
      </p>
      <p class="label" style="color: var(--foreground-muted)">{store.error}</p>
      <button class="btn-outline" onclick={() => store.retry()}>Retry</button>
    </div>
  {:else}
    <SymbolStrip
      analysis={store.analysis}
      {symbol}
      onSave={() => (showSave = true)}
      verdict={store.client.verdict}
      score={store.client.score}
      count={store.client.count}
    />

    <!-- Widget grid -->
    <WidgetGrid view="analysis" defs={ANALYSIS_WIDGETS} {enabled} {onToggle}>
      {#snippet children({ def }: { def: WidgetDef })}
        <WidgetCard {def} enabled={enabled[def.id] !== false} {onToggle}>
          {#if def.id === "price-chart"}
            <PriceChartWidget {store} />
          {:else if def.id === "vitals"}
            <VitalsWidget {store} />
          {:else if def.id === "indicator-checks"}
            <IndicatorChecksWidget {store} />
          {:else if def.id === "ai-opinion"}
            <AiOpinionWidget {store} />
          {:else if def.id === "news"}
            <NewsWidget {store} />
          {:else if def.id === "insider" || def.id === "earnings" || def.id === "peers"}
            {#if !store.finnhubDone}
              <LoadingNotice />
            {:else}
              <FinnhubWidget kind={def.id} bundle={store.finnhub} />
            {/if}
          {:else if def.id === "fear-greed"}
            <FearGreedWidget {store} />
          {:else if def.id === "patterns"}
            <PatternsWidget {store} />
          {:else if def.id === "stats"}
            <StatsWidget {store} />
          {:else if def.id === "company"}
            <CompanyWidget {store} />
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
    entryPrice={store.analysis?.current_price ?? null}
    onClose={() => (showSave = false)}
  />
</div>
