<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getToken, initAuth } from "$lib/auth.svelte";
  import { formatTimeAgo } from "$lib/format";
  import type { RecentAnalysis, WatchSymbol } from "$lib/storage";
  import { getRecentAnalyses, getWatchlist } from "$lib/storage";
  import { VERDICT_COLORS, VERDICT_LABELS } from "$lib/verdict";
  import { onMount } from "svelte";
  import SymbolSearch from "../components/SymbolSearch.svelte";

  // Landing: hero + search + watchlist + recent analyses. Deep links
  // (?symbol=X) redirect to the dashboard routes (old bookmark compat).

  let recent = $state<RecentAnalysis[]>([]);
  let watchlist = $state<WatchSymbol[]>([]);
  let authed = $state(false);

  onMount(() => {
    initAuth();
    authed = !!getToken();
    recent = getRecentAnalyses();
    watchlist = getWatchlist();

    // Legacy deep links: /?symbol=X → /s/X, /?symbol=X&mode=options → /options/X
    const q = page.url.searchParams.get("symbol");
    if (q) {
      const sym = q.toUpperCase();
      const m = page.url.searchParams.get("mode");
      goto(m === "options" ? `/options/${sym}` : `/s/${sym}`, {
        replaceState: true,
      });
    }
  });

  // Typewriter hero: types "buy", deletes it, types "sell", deletes it, loops.
  const HERO_WORDS = ["buy", "sell"];
  let heroWordIdx = $state(0);
  let typed = $state("");
  let heroTimer: ReturnType<typeof setTimeout> | null = null;

  function heroType() {
    const word = HERO_WORDS[heroWordIdx];
    if (typed.length < word.length) {
      typed = word.slice(0, typed.length + 1);
      heroTimer = setTimeout(heroType, 120);
    } else {
      heroTimer = setTimeout(heroDelete, 1600);
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

  onMount(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      typed = "buy or sell";
    } else {
      heroTimer = setTimeout(heroType, 400);
    }
  });
</script>

<svelte:head>
  <title>VEXARIUM — Check before you buy or sell</title>
</svelte:head>

<div class="flex flex-col items-center">
  <!-- HERO + SEARCH -->
  <div class="flex w-full flex-col items-center pt-14 text-center">
    <h1
      class="brand"
      style="font-size: 2.6rem; letter-spacing: -0.01em; text-transform: none; line-height: 1.1;"
    >
      Check before you <span
        class="hero-type"
        style="color: {HERO_WORDS[heroWordIdx] === 'buy'
          ? 'var(--verdict-buy)'
          : 'var(--verdict-sell)'}"
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

    <div class="panel flex w-full max-w-xl flex-col gap-4 p-6">
      <label class="label" for="symbol">SYMBOL</label>
      <SymbolSearch scope="stock" />
      <div class="flex gap-2">
        <a
          href="/portfolio"
          class="btn-outline"
          style="flex: 1; text-align: center; text-decoration: none;"
          >PORTFOLIO</a
        >
        <!-- For now no Pro feature - therefore no pricing -->
        <!-- {#if !authed}
          <a
            href="/pricing"
            class="btn-outline"
            style="flex: 1; text-align: center; text-decoration: none;"
            >PRICING</a
          >
        {/if} -->
      </div>
    </div>
  </div>

  <!-- WATCHLIST -->
  <div class="mt-10 w-full max-w-xl">
    <div class="section-title" style="margin-top: 0;">
      WATCHLIST <span class="line"></span>
    </div>
    {#if watchlist.length === 0}
      <p class="label" style="color: var(--foreground-muted)">
        EMPTY — SAVE SYMBOLS FROM ANY ANALYSIS PAGE.
      </p>
    {:else}
      <div class="flex flex-col gap-2">
        {#each watchlist as w}
          <a
            href={`/s/${w.symbol}`}
            class="panel flex items-center justify-between gap-3 p-3 transition-colors"
            style="text-decoration: none;"
          >
            <div class="flex items-center gap-3">
              <span class="data" style="color: var(--foreground)"
                >{w.symbol}</span
              >
              {#if w.name}
                <span class="label" style="text-transform: none;">{w.name}</span
                >
              {/if}
            </div>
            <span class="label" style="color: var(--foreground-muted)"
              >OPEN →</span
            >
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <!-- RECENT ANALYSES -->
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
                "#9ca3af")
              : "#9ca3af"}
          {@const label =
            r.verdict !== "pending"
              ? (VERDICT_LABELS[r.verdict as keyof typeof VERDICT_LABELS] ??
                "PENDING")
              : "PENDING"}
          <a
            href={`/s/${r.symbol}`}
            class="panel flex items-center justify-between gap-3 p-3 transition-colors"
            style="text-decoration: none;"
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
</div>
