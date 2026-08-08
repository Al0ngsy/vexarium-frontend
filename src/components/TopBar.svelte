<script lang="ts">
  import { page } from "$app/state";
  import SymbolSearch from "./SymbolSearch.svelte";

  // US market hours (ET) — 9:30–16:00 weekdays. ponytail: no holiday calendar.
  function marketStatus(): { open: boolean; label: string } {
    const now = new Date();
    const et = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const weekday = et.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parseInt(et.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(
      et.find((p) => p.type === "minute")?.value ?? "0",
      10,
    );
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;
    const isWeekday = !["Sat", "Sun"].includes(weekday);
    const isOpen =
      isWeekday && (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;
    return {
      open: isOpen,
      label: `${isOpen ? "MARKET OPEN" : "MARKET CLOSED"} · ${time}`,
    };
  }
  const market = $derived(marketStatus());

  // View tabs — highlight from the current route; links keep the symbol context.
  const path = $derived(page.url.pathname);
  const symbol = $derived(String(page.params.symbol || "").toUpperCase());
  const activeTab = $derived(
    path.startsWith("/s/") || path.startsWith("/analysis")
      ? "analysis"
      : path.startsWith("/options")
        ? "options"
        : path.startsWith("/portfolio")
          ? "portfolio"
          : "",
  );
  const analysisHref = $derived(symbol ? `/s/${symbol}` : "/");
  const optionsHref = $derived(symbol ? `/options/${symbol}` : "/");

  // Search destination follows the current view: options view searches
  // options, everything else searches stocks/ETFs.
  const searchScope = $derived(activeTab === "options" ? "options" : "stock");
</script>

<header class="topbar">
  <a href="/" class="logo" title="VEXARIUM">
    <span class="mark"></span>
    <span>VEXARIUM</span>
  </a>

  {#if activeTab}
    <nav class="view-tabs" aria-label="Dashboard views">
      <a href={analysisHref} class:active={activeTab === "analysis"}>Analysis</a
      >
      <a href={optionsHref} class:active={activeTab === "options"}>Options</a>
      <a href="/portfolio" class:active={activeTab === "portfolio"}>Portfolio</a
      >
    </nav>
  {/if}

  <div class="search">
    <SymbolSearch scope={searchScope} />
  </div>

  <div class="topbar-right">
    <span class="market-chip" title="US equities — New York">
      <span
        class="dot"
        style="background: {market.open
          ? '#10b981'
          : 'var(--foreground-subtle)'};"
      ></span>
      {market.label}
    </span>
    <span class="conn-chip"><span class="dot"></span>LIVE · IEX</span>
    <!-- <div class="avatar" title="Guest">Here User Short</div> -->
  </div>
</header>

<style>
  /* 3-zone flex layout; the rest of the chrome styles live in app.css */
  .search {
    flex: 1;
    max-width: 800px;
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
  }
  .search :global(.symbol-search) {
    flex: 1;
  }
  .topbar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 18px;
    font-size: 13px;
    color: var(--foreground-muted);
  }

  @media (max-width: 1080px) {
    .market-chip {
      display: none;
    }
  }
</style>
