<script lang="ts">
  import { goto } from "$app/navigation";
  import { searchAssets } from "$lib/api";
  import type { AssetInfo, AssetType } from "$lib/types";
  import { createEventDispatcher, onMount } from "svelte";

  // Reusable symbol search with grouped autocomplete + keyboard nav.
  // Extracted from the old home page; used in the topbar and the hero.

  const dispatch = createEventDispatcher();

  let {
    placeholder = "Search",
    scope = "stock", // 'stock' | 'options'
    compact = false,
    autofocus = false,
    value = $bindable(""),
  }: {
    placeholder?: string;
    scope?: "stock" | "options";
    compact?: boolean;
    autofocus?: boolean;
    value?: string;
  } = $props();

  let symbol = $state(value);
  let suggestions = $state<AssetInfo[]>([]);
  let dropdownOpen = $state(false);
  let activeIndex = $state(0);
  let searching = $state(false);
  let searchFailed = $state(false);
  let inputEl: HTMLInputElement;
  let containerEl: HTMLDivElement;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Mirror external bindable value into internal state.
  $effect(() => {
    symbol = value;
  });

  const grouped = $derived.by(() => {
    const order: AssetType[] = ["stock", "etf", "index"];
    const out: { type: AssetType; label: string; items: AssetInfo[] }[] = [];
    for (const t of order) {
      const items = suggestions.filter((s) => s.asset_type === t);
      if (items.length) out.push({ type: t, label: t.toUpperCase(), items });
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
    document.addEventListener("click", handleOutsideClick);
    // ⌘K / Ctrl+K: focus this search box. Must preventDefault() or the
    // browser's native ⌘K (focus browser search) wins.
    window.addEventListener("keydown", handleGlobalKeydown);
    if (autofocus) inputEl?.focus();
    return () => {
      document.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleGlobalKeydown);
    };
  });

  function handleGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      inputEl?.focus();
      inputEl?.select();
    }
  }

  function handleOutsideClick(e: MouseEvent) {
    const el = containerEl as unknown as HTMLElement;
    if (el && !el.contains(e.target as Node)) dropdownOpen = false;
  }

  function onInput() {
    const q = symbol.trim();
    if (!q) {
      suggestions = [];
      dropdownOpen = false;
      searching = false;
      searchFailed = false;
      return;
    }
    dropdownOpen = true;
    activeIndex = 0;
    searchFailed = false;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const qSent = symbol.trim();
      searching = true;
      let found = await searchAssets(qSent);
      searching = false;
      if (qSent.trim().toUpperCase() !== symbol.trim().toUpperCase()) return;
      if (found === null) {
        searchFailed = true;
        suggestions = [];
        if (document.activeElement === inputEl) dropdownOpen = true;
        activeIndex = 0;
        return;
      }
      const qU = symbol.trim().toUpperCase();
      found = found.sort((a, b) => {
        const aExact = a.symbol.toUpperCase() === qU ? 0 : 1;
        const bExact = b.symbol.toUpperCase() === qU ? 0 : 1;
        return aExact - bExact;
      });
      suggestions = found.slice(0, 12);
      dropdownOpen = suggestions.length > 0;
      activeIndex = 0;
    }, 250);
  }

  function selectAsset(asset: AssetInfo) {
    symbol = asset.symbol;
    value = asset.symbol;
    suggestions = [];
    dropdownOpen = false;
    dispatch("select", asset);
    submit(asset.symbol);
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
      submit(symbol.trim().toUpperCase());
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

  function submit(sym: string) {
    if (!sym) return;
    const target = scope === "options" ? `/options/${sym}` : `/s/${sym}`;
    goto(target);
  }
</script>

<div class="relative" bind:this={containerEl}>
  <div class="symbol-search {compact ? 'w-64' : 'w-full'}">
    <span style="color: var(--foreground-subtle);">⌕</span>
    <input
      bind:this={inputEl}
      bind:value={symbol}
      {placeholder}
      autocomplete="off"
      oninput={onInput}
      onkeydown={onKeydown}
      onfocus={() => {
        if (hasSuggestions) dropdownOpen = true;
      }}
    />
    {#if !compact}<span class="kbd">⌘K</span>{/if}
  </div>

  {#if dropdownOpen && (grouped.length > 0 || searching || searchFailed)}
    <div
      class="suggestions"
      style="left: 0; right: 0; max-height: 320px; overflow-y: auto;"
    >
      {#if searching && grouped.length === 0}
        <div class="flex items-center gap-2.5 px-3 py-2.5">
          <span
            class="inline-block h-3.5 w-3.5 animate-spin rounded-full"
            style="border: 2px solid var(--panel-border); border-top-color: var(--accent-primary);"
          ></span>
          <span class="label" style="color: var(--foreground-muted)"
            >WAKING SERVER — FETCHING DATA…</span
          >
        </div>
      {:else if searchFailed && grouped.length === 0}
        <div class="px-3 py-2.5 label" style="color: var(--accent-primary)">
          SERVER UNREACHABLE — IT'S STILL WAKING UP. TRY AGAIN IN A MOMENT.
        </div>
      {:else}
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
                >{asset.name}{asset.exchange
                  ? ` · ${asset.exchange}`
                  : ""}</span
              >
            </button>
          {/each}
        {/each}
      {/if}
    </div>
  {/if}
</div>
