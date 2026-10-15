<script lang="ts">
  import { page } from "$app/state";
  import { getToken, getUser, logout } from "$lib/auth.svelte";
  import { withNext } from "$lib/auth-flow";
  import { goto } from "$app/navigation";
  import SymbolSearch from "./SymbolSearch.svelte";

  // US market hours (ET) — 9:30–16:00 weekdays. ponytail: no holiday calendar.
  function marketStatus(now: Date): { open: boolean; label: string } {
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
  // $derived only recomputes when a dependency changes — `new Date()` never
  // is one, so drive it from a $state timestamp refreshed by an interval.
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(id);
  });
  const market = $derived(marketStatus(new Date(now)));

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

  // Auth: a "Log in" link, or the user menu once signed in. The login link
  // remembers the current page so the user lands back here afterwards.
  const authed = $derived(getToken() !== null);
  const user = $derived(getUser());
  const onAuthPage = $derived(
    ["/login", "/register", "/forgot-password", "/reset-password"].includes(path),
  );
  // pathname only: url.search is off-limits while prerendering.
  const loginHref = $derived(
    withNext("/login", onAuthPage ? null : page.url.pathname),
  );
  let menuOpen = $state(false);
  // Close the menu on navigation.
  $effect(() => {
    void page.url.href;
    menuOpen = false;
  });

  function onLogout() {
    menuOpen = false;
    logout();
    void goto("/");
  }
</script>

<svelte:window
  onclick={(e) => {
    if (menuOpen && !(e.target as Element).closest(".user-menu")) menuOpen = false;
  }}
  onkeydown={(e) => e.key === "Escape" && (menuOpen = false)}
/>

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

  {#if path !== "/"}
    <div class="search">
      <SymbolSearch scope={searchScope} />
    </div>
  {/if}

  <div class="topbar-right">
    <a href="/legal/disclaimer" class="disc-link" title="Informational only"
      >Not financial advice</a
    >
    <span class="market-chip" title="US equities, New York">
      <span
        class="dot"
        style="background: {market.open
          ? '#10b981'
          : 'var(--foreground-subtle)'};"
      ></span>
      {market.label}
    </span>
    <span class="conn-chip"><span class="dot"></span>LIVE · IEX</span>
    {#if authed}
      <div class="user-menu">
        <button
          type="button"
          class="avatar"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Account menu"
          onclick={() => (menuOpen = !menuOpen)}
        >
          {(user?.email || "?").charAt(0).toUpperCase()}
        </button>
        {#if menuOpen}
          <div class="menu" role="menu">
            <span class="menu-email" title={user?.email}>{user?.email ?? "Signed in"}</span>
            <a href="/account" role="menuitem">Account</a>
            <button type="button" role="menuitem" onclick={onLogout}>Log out</button>
          </div>
        {/if}
      </div>
    {:else if !onAuthPage}
      <a href={loginHref} class="login-link">Log in</a>
    {/if}
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

  .login-link {
    color: var(--foreground);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    border: 1px solid var(--accent-primary);
    border-radius: 8px;
    padding: 5px 12px;
  }
  .login-link:hover {
    color: var(--accent-primary-hover);
    border-color: var(--accent-primary-hover);
  }
  .user-menu {
    position: relative;
  }
  .user-menu .avatar {
    border: none;
    cursor: pointer;
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 60;
    min-width: 200px;
    max-width: min(280px, 90vw);
    display: flex;
    flex-direction: column;
    background: var(--surface-2);
    border: 1px solid var(--panel-border-active);
    border-radius: 8px;
    box-shadow: 0 8px 24px #0008;
    padding: 6px;
  }
  .menu-email {
    padding: 6px 10px 8px;
    font-size: 12px;
    color: var(--foreground-muted);
    border-bottom: 1px solid var(--panel-border);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .menu a,
  .menu button {
    background: none;
    border: none;
    text-align: left;
    padding: 7px 10px;
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    color: var(--foreground);
    text-decoration: none;
    cursor: pointer;
  }
  .menu a:hover,
  .menu button:hover {
    background: var(--surface-active);
  }

  @media (max-width: 1080px) {
    .market-chip {
      display: none;
    }
  }

  .disc-link {
    color: var(--foreground-subtle);
    font-size: 11px;
    text-decoration: none;
    white-space: nowrap;
  }
  .disc-link:hover {
    color: var(--accent-primary);
  }
</style>
