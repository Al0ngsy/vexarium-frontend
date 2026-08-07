<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { analyze, searchAssets, streamAIAnalysis } from "$lib/api";
  import { getToken, initAuth } from "$lib/auth.svelte";
  import { formatTimeAgo } from "$lib/format";
  import {
    explainIndicator,
    STATUS_ICON,
    STATUS_LABEL,
  } from "$lib/indicator-explain";
  import { renderAIMarkdown } from "$lib/markdown";
  import {
    addRecentAnalysis,
    getRecentAnalyses,
    type RecentAnalysis,
  } from "$lib/storage";
  import type {
    AnalysisResponse,
    AssetInfo,
    AssetType,
    IndicatorSeries,
  } from "$lib/types";
  import { VERDICT_COLORS, VERDICT_ICONS, VERDICT_LABELS } from "$lib/verdict";
  import { onDestroy, onMount } from "svelte";

  import CompanyProfile from "../components/CompanyProfile.svelte";
  import DisclaimerBanner from "../components/DisclaimerBanner.svelte";
  import IndicatorChart from "../components/IndicatorChart.svelte";
  import OptionsWorkspace from "../components/OptionsWorkspace.svelte";
  import SaveTradeModal from "../components/SaveTradeModal.svelte";

  // ---- search state -------------------------------------------------------
  let symbol = $state(""); // search input (user-editable)
  let activeSymbol = $state(""); // symbol of the currently displayed report
  let assetType = $state<AssetType>("stock");
  let mode = $state<"standard" | "options">("standard");

  let suggestions = $state<AssetInfo[]>([]);
  let recent = $state<RecentAnalysis[]>([]);
  let dropdownOpen = $state(false);
  let activeIndex = $state(0);

  let inputEl: HTMLInputElement;
  let containerEl: HTMLDivElement;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- analysis state -----------------------------------------------------
  let analysis = $state<AnalysisResponse | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let showSave = $state(false);
  let aiLoading = $state(false);
  let aiMessage = $state<string | null>(null);
  let newsOpen = $state(false);

  // Collapsible report sections (HEALTH CHECK stays always visible).
  // Default: all open, so first-time users see everything.
  let aboutOpen = $state(true);
  let checksOpen = $state(true);
  let aiOpen = $state(true);

  let authed = $state(false);

  // Typewriter hero: types "buy", deletes it, types "sell", deletes it, loops.
  const HERO_WORDS = ["buy", "sell"];
  let heroWordIdx = 0;
  let typed = $state("");
  let heroTimer: ReturnType<typeof setTimeout> | null = null;

  function heroType() {
    const word = HERO_WORDS[heroWordIdx];
    if (typed.length < word.length) {
      typed = word.slice(0, typed.length + 1);
      heroTimer = setTimeout(heroType, 120);
    } else {
      heroTimer = setTimeout(heroDelete, 1600); // hold the full word
    }
  }

  function heroDelete() {
    if (typed.length > 0) {
      typed = typed.slice(0, -1);
      heroTimer = setTimeout(heroDelete, 60);
    } else {
      heroWordIdx = (heroWordIdx + 1) % HERO_WORDS.length;
      heroTimer = setTimeout(heroType, 400);
    }
  }
  // Group suggestions by asset type, preserving order: stock, etf, index.
  const grouped = $derived.by(() => {
    const order: AssetType[] = ["stock", "etf", "index"];
    const out: { type: AssetType; label: string; items: AssetInfo[] }[] = [];
    for (const t of order) {
      const items = suggestions.filter((s) => s.asset_type === t);
      if (items.length) {
        out.push({ type: t, label: t.toUpperCase(), items });
      }
    }
    return out;
  });

  const flatRows = $derived.by(() => {
    const rows: { label: string; asset: AssetInfo | null }[] = [];
    for (const g of grouped) {
      rows.push({ label: g.label, asset: null });
      for (const a of g.items) rows.push({ label: a.symbol, asset: a });
    }
    return rows;
  });

  const hasSuggestions = $derived(suggestions.length > 0);

  onMount(() => {
    initAuth();
    authed = !!getToken();
    recent = getRecentAnalyses();
    document.addEventListener("click", handleOutsideClick);
    // Typewriter hero: respect reduced motion (static "buy or sell" instead).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      typed = "buy or sell";
    } else {
      heroTimer = setTimeout(heroType, 400);
    }
  });

  // Deep-link: /?symbol=X auto-runs the health check; mode from query.
  // Uses an $effect (not onMount) so client-side navigation — e.g. clicking a
  // recent-analysis link — also triggers the check, not just a fresh page load.
  let lastHandledKey = ""; // "$mode:$symbol" already processed — guards double-runs
  $effect(() => {
    const q = page.url.searchParams.get("symbol");
    if (!q) {
      lastHandledKey = ""; // back to idle: allow re-triggering the same symbol later
      return;
    }
    const sym = q.toUpperCase();
    const m = page.url.searchParams.get("mode");
    const key = `${m === "options" ? "options" : "standard"}:${sym}`;
    if (key === lastHandledKey) return;
    lastHandledKey = key;
    symbol = sym;
    activeSymbol = sym;
    if (m === "options") {
      mode = "options";
    } else {
      mode = "standard";
      runAnalysis();
    }
  });

  onDestroy(() => {
    if (heroTimer) clearTimeout(heroTimer);
  });

  function handleOutsideClick(e: MouseEvent) {
    const el = containerEl as unknown as HTMLElement;
    if (el && !el.contains(e.target as Node)) dropdownOpen = false;
  }

  function onInput() {
    const q = symbol.trim();
    if (!q) {
      suggestions = [];
      dropdownOpen = false;
      return;
    }
    dropdownOpen = true;
    activeIndex = 0;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      let found = await searchAssets(q);
      const qU = symbol.trim().toUpperCase();
      found = found.sort((a, b) => {
        const aExact = a.symbol.toUpperCase() === qU ? 0 : 1;
        const bExact = b.symbol.toUpperCase() === qU ? 0 : 1;
        return aExact - bExact;
      });
      suggestions = found.slice(0, 12);
      deriveAssetType(qU);
      dropdownOpen = suggestions.length > 0;
      activeIndex = 0;
    }, 250);
  }

  function deriveAssetType(sym: string) {
    if (!sym) return;
    const match = suggestions.find(
      (s) => s.symbol.toUpperCase() === sym.toUpperCase(),
    );
    if (match) assetType = match.asset_type;
  }

  function selectAsset(asset: AssetInfo) {
    symbol = asset.symbol;
    assetType = asset.asset_type;
    suggestions = [];
    dropdownOpen = false;
    inputEl?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      if (dropdownOpen && flatRows.length > 0) {
        const row = flatRows[activeIndex];
        if (row.asset) {
          selectAsset(row.asset);
          return;
        }
      }
      onAnalyze();
    } else if (e.key === "ArrowDown" && dropdownOpen) {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, flatRows.length - 1);
    } else if (e.key === "ArrowUp" && dropdownOpen) {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Escape") {
      dropdownOpen = false;
    }
  }

  function onAnalyze() {
    if (!symbol.trim()) return;
    const sym = symbol.trim().toUpperCase();
    dropdownOpen = false;
    // Mark this URL as already handled so the deep-link $effect skips it
    // (onAnalyze runs the analysis itself).
    lastHandledKey = `${mode === "options" ? "options" : "standard"}:${sym}`;
    if (mode === "options") {
      // SPA: options workspace renders below the search on the same page.
      goto(`/?symbol=${sym}&mode=options`, { replaceState: true });
      activeSymbol = sym;
      analysis = null;
      error = null;
    } else {
      // Single-page: run the check and show results below the search.
      goto(`/?symbol=${sym}`, { replaceState: true });
      runAnalysis();
    }
  }

  function switchToMainListing() {
    const ml = analysis?.company?.main_listing;
    if (!ml || !ml.symbol) return;
    // Re-run the health check on the primary home-exchange listing.
    symbol = ml.symbol;
    activeSymbol = ml.symbol;
    analysis = null;
    error = null;
    aiMessage = null;
    lastHandledKey = `standard:${ml.symbol.toUpperCase()}`;
    goto(`/?symbol=${ml.symbol}`, { replaceState: true });
    runAnalysis();
  }

  async function runAnalysis() {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    loading = true;
    error = null;
    aiMessage = null;
    activeSymbol = sym; // freeze the report's symbol — typing in search must not mutate it
    try {
      analysis = await analyze(sym, assetType);
      if (analysis?.overall?.overall_verdict) {
        addRecentAnalysis({
          symbol: sym,
          assetType,
          analyzedAt: analysis.analyzed_at ?? new Date().toISOString(),
          verdict: analysis.overall.overall_verdict,
        });
        recent = getRecentAnalyses();
      }
      // Auto-run the AI analysis for every symbol (free tier).
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
      // Stream the analysis: chunks arrive progressively (live LLM tokens, or
      // the cached answer replayed chunk-by-chunk for the same effect).
      await streamAIAnalysis(
        activeSymbol,
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

  // ---- formatting + health-check helpers ----------------------------------
  function formatPrice(v: number | null): string {
    if (v === null || v === undefined) return "—";
    return `$${v.toFixed(2)}`;
  }

  function seriesFor(name: string): IndicatorSeries | null {
    const found = (analysis?.indicator_series || []).find((s) =>
      s.name.toLowerCase().includes(name.toLowerCase()),
    );
    return found ?? null;
  }

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

  const verdictStatus = (v: string): "pass" | "watch" | "fail" => {
    if (["buy", "strong_buy"].includes(v)) return "pass";
    if (["sell", "strong_sell"].includes(v)) return "fail";
    return "watch";
  };

  const passCount = $derived(
    (analysis?.overall?.breakdown || []).filter(
      (i) => verdictStatus(i.verdict) === "pass",
    ).length,
  );
  const watchCount = $derived(
    (analysis?.overall?.breakdown || []).filter(
      (i) => verdictStatus(i.verdict) === "watch",
    ).length,
  );
  const failCount = $derived(
    (analysis?.overall?.breakdown || []).filter(
      (i) => verdictStatus(i.verdict) === "fail",
    ).length,
  );
  const totalChecks = $derived((analysis?.overall?.breakdown || []).length);

  const gradeLetter = $derived.by(() => {
    const s = analysis?.overall?.score ?? 0;
    if (s >= 7) return "A";
    if (s >= 4) return "B+";
    if (s >= 1) return "B";
    if (s >= -1) return "C";
    if (s >= -4) return "D";
    return "F";
  });

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
    const out: { k: string; v: string; d: string }[] = [
      {
        k: "PRICE",
        v: formatPrice(analysis.current_price),
        d: `${activeSymbol} · ${analysis.asset_type?.toUpperCase() ?? "STOCK"}`,
      },
    ];
    if (co && co.low_52w != null && co.high_52w != null) {
      out.push({
        k: "52-WEEK RANGE",
        v: `$${co.low_52w.toFixed(0)}–$${co.high_52w.toFixed(0)}`,
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
          k: "VOLATILITY",
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
        k: "MOMENTUM",
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
</script>

<svelte:head>
  <title>VEXARIUM — Check before you buy or sell</title>
</svelte:head>

<div class="flex flex-col items-center">
  <!-- ============================ HERO + SEARCH ============================ -->
  <div class="flex w-full flex-col items-center pt-14 text-center">
    <h1
      class="brand"
      style="font-size: 2.6rem; letter-spacing: 0.02em; text-transform: none; line-height: 1.1;"
    >
      Check before you <span
        class="hero-type"
        style="color: var(--accent-primary)"
        >{typed}<span class="hero-caret" aria-hidden="true"></span></span
      >.
    </h1>
    <p
      class="label mt-4 mb-8"
      style="color: var(--foreground-muted); text-transform: none; font-weight: 400; font-size: 1rem; max-width: 560px; line-height: 1.6;"
    >
      A health check for any stock, ETF or option. Built for beginners, deep
      enough for pros.
    </p>

    <!-- Symbol input with grouped autocomplete -->
    <div
      class="panel flex w-full max-w-xl flex-col gap-6 p-6"
      style="box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);"
    >
      <label class="label" for="symbol">SYMBOL</label>
      <div class="relative" bind:this={containerEl}>
        <input
          id="symbol"
          bind:this={inputEl}
          autocomplete="off"
          placeholder="Enter symbol — e.g. AAPL, SPY, NVDA"
          bind:value={symbol}
          oninput={onInput}
          onkeydown={onKeydown}
          onfocus={() => {
            if (hasSuggestions) dropdownOpen = true;
          }}
          class="w-full rounded-lg border px-4 py-3 font-mono"
          style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground); text-transform: uppercase;"
        />

        {#if dropdownOpen && grouped.length > 0}
          <div
            class="absolute z-30 mt-1 w-full overflow-hidden rounded-lg"
            style="background-color: var(--surface); border: 1px solid var(--panel-border); max-height: 320px; overflow-y: auto; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);"
          >
            {#each grouped as group, gi}
              {@const groupOffset = flatRows.findIndex(
                (r) => r.label === group.label,
              )}
              <div
                class="px-3 py-1.5 label"
                style="background-color: var(--surface-3); color: var(--accent-primary); border-bottom: 1px solid var(--panel-border);"
              >
                {group.label} — {group.items.length}
              </div>
              {#each group.items as asset, ai}
                {@const rowIndex = groupOffset + 1 + ai}
                <button
                  type="button"
                  onclick={() => selectAsset(asset)}
                  onmouseenter={() => (activeIndex = rowIndex)}
                  class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  style="background-color: {activeIndex === rowIndex
                    ? 'var(--surface-active)'
                    : 'transparent'}; border-bottom: 1px solid var(--grid-line);"
                >
                  <span class="data" style="color: var(--foreground)"
                    >{asset.symbol}</span
                  >
                  <span
                    class="label truncate"
                    style="color: var(--foreground-muted)"
                    >{asset.name}{asset.exchange ? ` · ${asset.exchange}` : ''}</span
                  >
                </button>
              {/each}
            {/each}
          </div>
        {/if}
      </div>

      <!-- Mode toggle -->
      <div>
        <span class="label block mb-2">MODE</span>
        <div class="flex gap-2">
          <button
            onclick={() => (mode = "standard")}
            class="flex-1 rounded-lg px-3 py-2 label"
            style="border: 1px solid {mode === 'standard'
              ? 'var(--accent-primary)'
              : 'var(--panel-border)'}; background-color: {mode === 'standard'
              ? 'var(--accent-primary)'
              : 'var(--surface)'}; color: {mode === 'standard'
              ? 'var(--accent-white)'
              : 'var(--foreground-muted)'}; font-weight: {mode === 'standard'
              ? 700
              : 600};"
          >
            STOCK / ETF
          </button>
          <button
            onclick={() => (mode = "options")}
            class="flex-1 rounded-lg px-3 py-2 label"
            style="border: 1px solid {mode === 'options'
              ? 'var(--accent-primary)'
              : 'var(--panel-border)'}; background-color: {mode === 'options'
              ? 'var(--accent-primary)'
              : 'var(--surface)'}; color: {mode === 'options'
              ? 'var(--accent-white)'
              : 'var(--foreground-muted)'}; font-weight: {mode === 'options'
              ? 700
              : 600};"
          >
            OPTIONS
          </button>
        </div>
      </div>

      <button class="btn-primary w-full" onclick={onAnalyze}>RUN CHECK</button>
    </div>
  </div>

  <!-- ============================ RESULTS BELOW ============================ -->
  {#if (mode === "options" && activeSymbol) || loading || error || analysis}
    <!-- Disclaimer: only shown when content is displayed, between search and results -->
    <div class="mt-10 w-full max-w-5xl">
      <DisclaimerBanner />
    </div>
  {/if}
  <div class="mt-10 w-full max-w-5xl">
    {#if mode === "options" && activeSymbol}
      <!-- Options SPA: full options workspace below the search -->
      <OptionsWorkspace symbol={activeSymbol} />
    {:else if loading}
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
          DATA UNAVAILABLE FOR {activeSymbol}
        </p>
        <p class="label" style="color: var(--foreground-muted)">{error}</p>
        <button class="btn-outline" onclick={runAnalysis}>RETRY</button>
      </div>
    {:else if analysis}
      <!-- 1. Health-check hero: verdict + grade ring + vitals + plain-language + charts -->
      <div class="panel mb-6 p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="label mb-1">HEALTH CHECK — {activeSymbol}</p>
            {#if analysis.company?.main_listing}
              <p
                class="label mb-1"
                style="color: var(--foreground-muted); text-transform: none;"
              >
                {analysis.company.exchange ?? "OTC ADR"} · ADR of
                {analysis.company.main_listing.name ?? analysis.company.main_listing.symbol}
              </p>
            {/if}
            <p
              class="brand"
              style="font-size: 1.6rem; color: {VERDICT_COLORS[
                analysis.overall.overall_verdict
              ]}"
            >
              {VERDICT_LABELS[analysis.overall.overall_verdict]}
              {VERDICT_ICONS[analysis.overall.overall_verdict]}
            </p>
            <p
              class="label mt-2"
              style="color: var(--foreground-muted); text-transform: none; max-width: 360px; line-height: 1.5;"
            >
              {plainSummary}
            </p>
          </div>
          <div class="flex items-center gap-5">
            <div class="text-right">
              <p class="label mb-1">{activeSymbol}</p>
              <p
                class="data"
                style="color: var(--foreground); font-size: 1.25rem"
              >
                {formatPrice(analysis.current_price)}
              </p>
              <a
                href={`/options/${activeSymbol}`}
                class="btn-outline mt-3 inline-block"
              >
                VIEW OPTIONS →
              </a>
              {#if analysis.company?.main_listing}
                <button
                  class="btn-outline mt-3 inline-block"
                  onclick={switchToMainListing}
                  title="Switch to the primary home-exchange listing"
                >
                  VIEW MAIN LISTING {analysis.company.main_listing.symbol} →
                </button>
              {/if}
            </div>
            <!-- Grade ring -->
            <div class="grade-ring">
              <svg width="92" height="92" viewBox="0 0 92 92">
                <circle
                  cx="46"
                  cy="46"
                  r="38"
                  fill="none"
                  stroke="var(--panel-border)"
                  stroke-width="8"
                />
                <circle
                  cx="46"
                  cy="46"
                  r="38"
                  fill="none"
                  stroke={VERDICT_COLORS[analysis.overall.overall_verdict]}
                  stroke-width="8"
                  stroke-linecap="round"
                  stroke-dasharray="238.8"
                  stroke-dashoffset={238.8 *
                    (1 -
                      Math.max(
                        0,
                        Math.min(1, (analysis.overall.score + 10) / 20),
                      ))}
                />
              </svg>
              <div class="grade">
                <b>{gradeLetter}</b><span>{passCount}/{totalChecks}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Vitals -->
        <div class="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {#each vitals as v}
            <div class="vital">
              <div class="k">{v.k}</div>
              <div class="v">{v.v}</div>
              <div class="d">{v.d}</div>
            </div>
          {/each}
        </div>

        <!-- Plain-language box -->
        <div class="plainbox mt-4">
          <div class="k">What this means for you</div>
          <p>
            {VERDICT_LABELS[analysis.overall.overall_verdict]} — {bullCount} of {totalChecks}
            checks are bullish, {neutralCount} neutral, {bearCount} bearish.
            {analysis.overall.score > 0
              ? "The overall bias is positive."
              : analysis.overall.score < 0
                ? "The overall bias is negative."
                : "The overall bias is neutral."}
            Use the technicals below to understand why, and the AI analysis for a
            plain-language read.
          </p>
        </div>

        <!-- Charts -->
        <div class="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p class="label mb-2">PRICE — LAST 120 DAYS</p>
            {#if (analysis.price_series?.length ?? 0) > 0}
              <IndicatorChart
                series={{ name: "PRICE", kind: "overlay", points: [] }}
                priceSeries={analysis.price_series}
                height={180}
              />
            {:else}
              <div
                class="flex h-44 items-center justify-center rounded-lg border border-dashed"
                style="border-color: var(--panel-border)"
              >
                <span class="label" style="color: var(--foreground-muted)"
                  >NO PRICE DATA</span
                >
              </div>
            {/if}
          </div>
          <div>
            <p class="label mb-2">RSI — MOMENTUM</p>
            {#if seriesFor("RSI") && seriesFor("RSI")!.points.length > 0}
              <IndicatorChart series={seriesFor("RSI")!} height={180} />
            {:else}
              <div
                class="flex h-44 items-center justify-center rounded-lg border border-dashed"
                style="border-color: var(--panel-border)"
              >
                <span class="label" style="color: var(--foreground-muted)"
                  >NO RSI DATA</span
                >
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 1c. Company / ETF profile + fundamentals -->
      {#if analysis.company && (analysis.company.name || analysis.company.description || analysis.company.market_cap !== null)}
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
        <div class="panel mb-6 overflow-hidden">
          <button
            class="flex w-full flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
            style="border-color: var(--panel-border)"
            onclick={() => (aboutOpen = !aboutOpen)}
          >
            <h2
              class="brand"
              style="border-bottom: 2px solid var(--accent-primary)"
            >
              ABOUT {activeSymbol}
            </h2>
            <span class="flex items-center gap-3">
              <span class="label" style="color: var(--foreground-muted)">
                {co.name || activeSymbol}{co.exchange
                  ? ` · ${co.exchange}`
                  : ""}{co.currency ? ` · ${co.currency}` : ""}
              </span>
              <span class="label" style="color: var(--accent-primary)"
                >{aboutOpen ? "▲ HIDE" : "▼ SHOW"}</span
              >
            </span>
          </button>
          {#if aboutOpen}
            <div class="p-4">
              <CompanyProfile company={co} symbol={activeSymbol} {pos} />
            </div>
          {/if}
        </div>
      {/if}

      <!-- 1d. News sentiment + headlines dropdown -->
      {#if analysis.news_sentiment}
        {@const ns = analysis.news_sentiment}
        {@const color =
          ns.sentiment_score > 0.2
            ? "var(--verdict-strong-buy)"
            : ns.sentiment_score < -0.2
              ? "var(--verdict-strong-sell)"
              : "var(--verdict-hold)"}
        <div class="panel mb-6 overflow-hidden">
          <button
            class="flex w-full flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
            style="border-color: var(--panel-border)"
            onclick={() => (newsOpen = !newsOpen)}
          >
            <h2
              class="brand"
              style="border-bottom: 2px solid var(--accent-primary)"
            >
              NEWS SENTIMENT
            </h2>
            <div class="flex items-center gap-4">
              <span class="data" style="color: {color}">{ns.summary}</span>
              <span class="label" style="color: var(--foreground-muted)"
                >{ns.article_count} ARTICLES · SCORE {ns.sentiment_score}</span
              >
              <span class="label" style="color: var(--accent-primary)"
                >{newsOpen ? "▲ HIDE" : "▼ SHOW"}</span
              >
            </div>
          </button>
          {#if newsOpen && (analysis.news_articles?.length ?? 0) > 0}
            <div
              class="flex flex-col border-t"
              style="border-color: var(--panel-border)"
            >
              {#each analysis.news_articles as article}
                <a
                  href={article.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex flex-col gap-1 px-4 py-3 transition-colors"
                  style="border-bottom: 1px solid var(--grid-line); text-decoration: none;"
                >
                  <span
                    class="data"
                    style="color: var(--foreground); line-height: 1.4"
                    >{article.headline}</span
                  >
                  <span class="label" style="color: var(--foreground-muted)">
                    {article.source || "SOURCE"}{article.created_at
                      ? ` · ${new Date(article.created_at).toLocaleDateString()}`
                      : ""}
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- 2. The checks (technicals readout table) -->
      <div class="panel mb-6 overflow-hidden">
        <button
          class="flex w-full items-center justify-between border-b px-4 py-3"
          style="border-color: var(--panel-border)"
          onclick={() => (checksOpen = !checksOpen)}
        >
          <h2
            class="brand"
            style="border-bottom: 2px solid var(--accent-primary)"
          >
            TECHNICALS
          </h2>
          <span class="flex items-center gap-3">
            <span class="label" style="color: var(--foreground-muted)"
              >{analysis.indicators.length} INDICATORS · {passCount} PASS · {watchCount}
              WATCH · {failCount} FAIL</span
            >
            <span class="label" style="color: var(--accent-primary)"
              >{checksOpen ? "▲ HIDE" : "▼ SHOW"}</span
            >
          </span>
        </button>
        {#if checksOpen}
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead>
                <tr
                  class="label"
                  style="border-bottom: 1px solid var(--panel-border); color: var(--foreground-subtle)"
                >
                  <th class="px-4 py-2.5">CHECK</th>
                  <th class="px-4 py-2.5">READING</th>
                  <th class="px-4 py-2.5">STATUS</th>
                  <th class="px-4 py-2.5">WHAT IT TELLS YOU</th>
                </tr>
              </thead>
              <tbody>
                {#each analysis.indicators as indicator}
                  {@const vc = VERDICT_COLORS[indicator.verdict] || "#8b96a8"}
                  {@const ex = explainIndicator(indicator)}
                  <tr
                    class="group transition-colors"
                    style="border-bottom: 1px solid var(--grid-line);"
                  >
                    <td class="px-4 py-3 align-top">
                      <div class="flex items-center gap-2.5">
                        <span
                          class="h-full w-1 self-stretch rounded"
                          style="background-color: {vc};"
                        ></span>
                        <span
                          class="label"
                          style="color: var(--foreground); text-transform: none"
                          >{indicator.name}</span
                        >
                      </div>
                    </td>
                    <td
                      class="px-4 py-3 align-top data"
                      style="color: var(--foreground); white-space: nowrap"
                      >{ex.reading}</td
                    >
                    <td class="px-4 py-3 align-top">
                      <span
                        class="chip chip-{ex.status}"
                        style="white-space: nowrap"
                      >
                        {STATUS_ICON[ex.status]}
                        {STATUS_LABEL[ex.status]}
                      </span>
                    </td>
                    <td class="px-4 py-3 align-top">
                      <div class="max-w-md">
                        <p
                          class="label"
                          style="color: var(--foreground); text-transform: none; line-height: 1.55"
                        >
                          {ex.what}
                        </p>
                        <p
                          class="label mt-1.5"
                          style="color: {vc}; text-transform: none; line-height: 1.5"
                        >
                          {STATUS_LABEL[ex.status]}: {ex.reason}
                        </p>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
      <!-- 3. AI analysis (free for everyone) -->
      <div
        class="panel mt-6 overflow-hidden"
        style="border-top: 2px solid var(--accent-primary)"
      >
        <button
          class="flex w-full items-center justify-between p-6"
          onclick={() => (aiOpen = !aiOpen)}
        >
          <h2
            class="brand"
            style="border-bottom: 2px solid var(--accent-primary)"
          >
            AI ANALYSIS
          </h2>
          <span class="label" style="color: var(--accent-primary)"
            >{aiOpen ? "▲ HIDE" : "▼ SHOW"}</span
          >
        </button>
        {#if aiOpen}
          <div class="px-6 pb-6">
            <div class="flex items-center justify-end">
              <button class="btn-outline" onclick={runAI} disabled={aiLoading}
                >RUN AI ANALYSIS</button
              >
            </div>
            {#if aiLoading && !aiMessage}
              <p
                class="mt-4 font-mono"
                style="color: var(--accent-primary); letter-spacing: 0.15em"
              >
                ANALYZING...
              </p>
            {:else if aiMessage}
              <div class="mt-4 ai-body">
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
        {/if}
      </div>

      <!-- 4. Save to portfolio -->
      <div class="mt-6 flex justify-end">
        <button class="btn-outline" onclick={() => (showSave = true)}
          >SAVE TO PORTFOLIO</button
        >
      </div>

      <SaveTradeModal
        open={showSave}
        symbol={activeSymbol}
        entryPrice={analysis.current_price}
        onClose={() => (showSave = false)}
      />
    {/if}
  </div>

  <!-- ==================== RECENT ANALYSES (idle state) ==================== -->
  {#if !analysis && !loading && !(mode === "options" && activeSymbol)}
    <div class="mt-10 w-full max-w-xl">
      <div class="section-title" style="margin-top: 0;">
        RECENT ANALYSES <span class="line"></span>
      </div>
      {#if recent.length === 0}
        <p class="label" style="color: var(--foreground-muted)">
          NO RECENT ANALYSES.
        </p>
      {:else}
        <div class="flex flex-col gap-2">
          {#each recent as r}
            {@const color =
              r.verdict !== "pending"
                ? (VERDICT_COLORS[r.verdict as keyof typeof VERDICT_COLORS] ??
                  "#8b96a8")
                : "#8b96a8"}
            {@const label =
              r.verdict !== "pending"
                ? (VERDICT_LABELS[r.verdict as keyof typeof VERDICT_LABELS] ??
                  "PENDING")
                : "PENDING"}
            <a
              href={`/?symbol=${r.symbol}`}
              class="panel flex items-center justify-between gap-3 p-3 transition-colors"
              style="border-color: var(--panel-border); text-decoration: none;"
            >
              <div class="flex items-center gap-3">
                <span class="data" style="color: var(--foreground)"
                  >{r.symbol}</span
                >
                <span class="label" style="color: {color}">{label}</span>
              </div>
              <span class="label" style="color: var(--foreground-muted)">
                ANALYZED {formatTimeAgo(r.analyzedAt)}
              </span>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
