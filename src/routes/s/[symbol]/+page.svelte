<script lang="ts">
  import { page } from "$app/state";
  import { analyze, getBars, streamAIAnalysis } from "$lib/api";
  import { getToken } from "$lib/auth.svelte";
  import { formatPrice } from "$lib/format";
  import {
    explainIndicator,
    STATUS_ICON,
    verdictToStatus,
  } from "$lib/indicator-explain";
  import { renderAIMarkdown } from "$lib/markdown";
  import { addRecentAnalysis } from "$lib/storage";
  import type { AnalysisResponse, PricePoint } from "$lib/types";
  import { VERDICT_COLORS, VERDICT_LABELS } from "$lib/verdict";

  import {
    ANALYSIS_WIDGETS,
    loadEnabled,
    type WidgetDef,
  } from "$lib/layout.svelte";
  import CompanyProfile from "../../../components/CompanyProfile.svelte";
  import DisclaimerBanner from "../../../components/DisclaimerBanner.svelte";
  import IndicatorChart from "../../../components/IndicatorChart.svelte";
  import SaveTradeModal from "../../../components/SaveTradeModal.svelte";
  import SymbolStrip from "../../../components/SymbolStrip.svelte";
  import WatchlistWidget from "../../../components/WatchlistWidget.svelte";
  import WidgetCard from "../../../components/WidgetCard.svelte";
  import WidgetGrid from "../../../components/WidgetGrid.svelte";
  import WidgetLibrary from "../../../components/WidgetLibrary.svelte";

  const symbol = $derived(String(page.params.symbol || "").toUpperCase());

  const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo"];
  let timeframe = $state("1d");
  let timeframeVerdicts = $state<Record<string, string>>({});
  let chartBars = $state<PricePoint[] | null>(null);
  let barsLoading = $state(false);

  // Fetch bars whenever the symbol or resolution changes (debounced lightly).
  $effect(() => {
    const sym = symbol;
    const tf = timeframe;
    if (!sym) return;
    barsLoading = true;
    chartBars = null;
    getBars(sym, tf, 300)
      .then((points) => {
        if (symbol === sym && timeframe === tf) chartBars = points;
      })
      .catch(() => {
        if (symbol === sym && timeframe === tf) chartBars = null;
      })
      .finally(() => {
        if (symbol === sym && timeframe === tf) barsLoading = false;
      });
  });

  // ---- analysis state -----------------------------------------------------
  let analysis = $state<AnalysisResponse | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showSave = $state(false);
  let aiLoading = $state(false);
  let aiMessage = $state<string | null>(null);
  let aboutOpen = $state(true);
  let checksOpen = $state(true);
  let aiOpen = $state(true);
  let newsOpen = $state(false);

  const assetType = $derived(
    (analysis?.asset_type as "stock" | "etf" | "index") ?? "stock",
  );

  async function runAnalysis() {
    loading = true;
    error = null;
    aiMessage = null;
    try {
      analysis = await analyze(symbol, assetType, false, timeframe);
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
    } finally {
      loading = false;
    }
  }

  async function runAI() {
    aiLoading = true;
    aiMessage = null;
    try {
      await streamAIAnalysis(
        symbol,
        assetType,
        (chunk) => {
          aiMessage = (aiMessage ?? "") + chunk;
        },
        getToken() ?? undefined,
      );
    } catch (e) {
      aiMessage = `AI analysis failed: ${e instanceof Error ? e.message : "unknown error"}`;
    } finally {
      aiLoading = false;
    }
  }

  $effect(() => {
    // (Re)load analysis when the symbol changes — covers the initial mount
    // AND client-side navigation from the search bar (same route, so onMount
    // alone would never re-fire and the page would keep showing the old symbol).
    symbol;
    runAnalysis();
  });

  // Keep the compact multi-timeframe verdict strip independent from the
  // selected detail timeframe.
  $effect(() => {
    const sym = symbol;
    if (!sym) return;
    Promise.all(["1d", "1w", "1mo"].map((tf) => analyze(sym, assetType, false, tf)))
      .then((items) => {
        if (symbol !== sym) return;
        timeframeVerdicts = Object.fromEntries(items.map((item) => [item.timeframe ?? "1d", item.overall.overall_verdict]));
      })
      .catch(() => {});
  });

  // ---- derivations (ported from the old home page) ------------------------

  const bullCount = $derived(
    (analysis?.overall?.breakdown || []).filter((i) =>
      ["buy", "strong_buy"].includes(i.verdict),
    ).length,
  );
  const bearCount = $derived(
    (analysis?.overall?.breakdown || []).filter((i) =>
      ["sell", "strong_sell"].includes(i.verdict),
    ).length,
  );
  const neutralCount = $derived(
    (analysis?.overall?.breakdown || []).length - bullCount - bearCount,
  );
  const passCount = $derived(
    (analysis?.overall?.breakdown || []).filter(
      (i) => verdictToStatus(i.verdict) === "pass",
    ).length,
  );
  const watchCount = $derived(
    (analysis?.overall?.breakdown || []).filter(
      (i) => verdictToStatus(i.verdict) === "watch",
    ).length,
  );
  const failCount = $derived(
    (analysis?.overall?.breakdown || []).filter(
      (i) => verdictToStatus(i.verdict) === "fail",
    ).length,
  );
  const totalChecks = $derived((analysis?.overall?.breakdown || []).length);

  const plainSummary = $derived.by(() => {
    if (!analysis?.overall) return "";
    const v = analysis.overall.overall_verdict;
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
        out.push({
          k: "Volatility",
          v: `ATR ${atrVal.toFixed(1)}`,
          d: "avg daily move",
        });
      }
    }
    const rsi = analysis.indicators.find((i) =>
      i.name.toUpperCase().includes("RSI"),
    );
    if (rsi && typeof rsi.value === "number") {
      out.push({
        k: "Momentum",
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

  const verdict = $derived(analysis?.overall?.overall_verdict ?? "hold");
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
  <title>VEXARIUM — {symbol} ANALYSIS</title>
</svelte:head>

<div>
  <DisclaimerBanner />

  {#if loading}
    <div class="panel mb-6 p-6">
      <div
        class="mb-4 h-6 w-40 rounded"
        style="background-color: var(--surface-3)"
      ></div>
      <div
        class="mb-2 h-4 w-64 rounded"
        style="background-color: var(--surface-3)"
      ></div>
      <div
        class="h-4 w-32 rounded"
        style="background-color: var(--surface-3)"
      ></div>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <div class="panel p-4">
          <div
            class="mb-3 h-3 w-20 rounded"
            style="background-color: var(--surface-3)"
          ></div>
          <div
            class="h-4 w-28 rounded"
            style="background-color: var(--surface-3)"
          ></div>
        </div>
      {/each}
    </div>
  {:else if error}
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
  {:else if analysis}
    {@const an = analysis}
    <SymbolStrip analysis={an} {symbol} onSave={() => (showSave = true)} />

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
                  bind:value={timeframe}
                >
                  {#each TIMEFRAMES as tf}
                    <option value={tf}>{tf}</option>
                  {/each}
                </select>
              </div>
              {#if (chartBars?.length ?? 0) > 0}
                {#key chartBars}
                  <IndicatorChart
                    series={{ name: "PRICE", kind: "overlay", points: [] }}
                    priceSeries={chartBars ?? []}
                    height={260}
                  />
                {/key}
              {:else if barsLoading}
                <div
                  class="flex h-44 items-center justify-center rounded-lg border border-dashed"
                  style="border-color: var(--panel-border)"
                >
                  <span class="label" style="color: var(--foreground-muted)"
                    >Loading…</span
                  >
                </div>
              {:else if (an.price_series?.length ?? 0) > 0}
                {#key an.price_series}
                  <IndicatorChart
                    series={{ name: "PRICE", kind: "overlay", points: [] }}
                    priceSeries={an.price_series}
                    height={260}
                  />
                {/key}
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
          {:else if def.id === "vitals"}
            <div class="grid grid-cols-2 gap-3">
              {#each vitals as v}
                <div class="vital">
                  <div class="k">{v.k}</div>
                  <div class="v">{v.v}</div>
                  <div class="d">{v.d}</div>
                </div>
              {/each}
            </div>
          {:else if def.id === "indicator-checks"}
            <div class="flex flex-col gap-2">
              <div class="tf-summary" aria-label="Overall verdict by timeframe">
                {#each [["1d", "1 day"], ["1w", "1 week"], ["1mo", "1 month"]] as item}
                  {@const tf = item[0]}
                  {@const tfVerdict = timeframeVerdicts[tf]}
                  {@const tfColor = tfVerdict ? (VERDICT_COLORS as Record<string, string>)[tfVerdict] : 'var(--foreground-muted)'}
                  <div class="tf-summary-card" class:active={tf === timeframe}>
                    <span class="label">{item[1]}</span>
                    <strong style="color: {tfColor}">
                      {tfVerdict ? (VERDICT_LABELS as Record<string, string>)[tfVerdict] : "Loading…"}
                    </strong>
                  </div>
                {/each}
              </div>
              <div class="indicator-toolbar">
                <span class="label">Indicators calculated from</span>
                <select aria-label="Indicator candle timeframe" bind:value={timeframe}>
                  {#each TIMEFRAMES.filter((tf) => ["30m", "1h", "4h", "1d", "1w", "1mo"].includes(tf)) as tf}
                    <option value={tf}>{tf} candles</option>
                  {/each}
                </select>
              </div>
              <div class="plainbox">
                <div class="k">What this means for you</div>
                <p>
                  {VERDICT_LABELS[verdict]} — {bullCount} of {totalChecks}
                  checks are bullish, {neutralCount} neutral, {bearCount} bearish.
                  {an.overall.score > 0
                    ? "The overall bias is positive."
                    : an.overall.score < 0
                      ? "The overall bias is negative."
                      : "The overall bias is neutral."}
                </p>
              </div>
              <div
                style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px;"
              >
                {#each an.indicators as indicator}
                  {@const ex = explainIndicator(indicator)}
                  {@const vc =
                    VERDICT_COLORS[indicator.verdict] ||
                    "var(--foreground-subtle)"}
                  <div
                    class="check"
                    style="display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: var(--surface-2); border: 1px solid var(--panel-border); border-radius: 6px; min-width: 0;"
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
                        style="flex: 1 1 auto; min-width: 0; font-size: 0.75rem; font-weight: 500; color: var(--foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                      >
                        {indicator.name}
                        <span class="tooltip tooltip-name">{ex.what}</span>
                      </span>
                    </div>
                    <span class="indicator-tip data"
                      style="padding-left: 30px; font-size: 0.68rem; color: {vc}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;"
                    >
                      {ex.reading}
                      <span class="tooltip tooltip-value">
                        <b>{ex.reading}</b>
                        <small>{ex.reason}</small>
                        {#if an.indicator_series?.find((s) => s.name === indicator.name)?.points?.length}
                          <IndicatorChart series={an.indicator_series.find((s) => s.name === indicator.name)!} height={90} />
                        {/if}
                      </span>
                    </span>
                  </div>
                {/each}
              </div>
            </div>
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
            {#if an.news_sentiment}
              {@const ns = an.news_sentiment}
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
              {#if an.news_articles && an.news_articles.length > 0}
                <div
                  class="flex flex-col"
                  style="border-top: 1px solid var(--panel-border); padding-top: 8px; gap: 8px;"
                >
                  {#each an.news_articles.slice(0, 5) as article}
                    <a
                      href={article.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style="display: flex; gap: 10px; text-decoration: none; color: var(--foreground); font-size: 0.75rem; line-height: 1.4;"
                    >
                      <span
                        style="color: var(--accent-primary); flex-shrink: 0;"
                        >●</span
                      >
                      <div>
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
                    </a>
                  {/each}
                </div>
              {/if}
            {:else}
              <p class="label" style="color: var(--foreground-muted)">
                No news data
              </p>
            {/if}
          {:else if def.id === "company"}
            {#if an.company && (an.company.name || an.company.description || an.company.market_cap !== null)}
              {@const co = an.company}
              {@const range = (co.high_52w ?? 0) - (co.low_52w ?? 0)}
              {@const pos =
                range > 0 && an.current_price
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((an.current_price - (co.low_52w ?? 0)) / range) * 100,
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
