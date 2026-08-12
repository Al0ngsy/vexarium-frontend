<script lang="ts">
  import type { FinnhubBundle } from "$lib/types";

  let {
    kind,
    bundle,
  }: {
    kind: "insider" | "earnings" | "peers";
    bundle: FinnhubBundle | null;
  } = $props();

  const BUY = "#34d399";
  const SELL = "#f87171";
  const MUTED = "var(--foreground-muted)";

  function fmtShares(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function fmtDate(d: string): string {
    return d ? d.slice(0, 10) : "n/a";
  }

  const row = "display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 0.72rem; border-bottom: 1px solid var(--panel-border);";
  const nameCol = "flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
  const numCol = "text-align: right; font-variant-numeric: tabular-nums;";
  const empty = "color: var(--foreground-muted); font-size: 0.75rem; padding: 8px 0;";
</script>

{#if kind === "insider"}
  {#if !bundle || bundle.insider.length === 0}
    <p style={empty}>No insider filings</p>
  {:else}
    <div>
      {#each bundle.insider as t}
        <div style={row}>
          <span style={nameCol} title={t.name}>{t.name}</span>
          <span style={`color: ${t.change >= 0 ? BUY : SELL}; font-weight: 600;`}>
            {t.change >= 0 ? "Buy" : "Sell"}
          </span>
          <span style={`${numCol} width: 64px;`}>{fmtShares(t.shares)}</span>
          <span style={`${numCol} color: ${MUTED}; width: 84px;`}>{fmtDate(t.filing_date)}</span>
        </div>
      {/each}
    </div>
  {/if}
{:else if kind === "earnings"}
  {#if !bundle || bundle.earnings.length === 0}
    <p style={empty}>No earnings data</p>
  {:else}
    <div>
      {#each bundle.earnings as e}
        {@const sp = e.surprise_pct}
        <div style={row}>
          <span style={`${nameCol} color: ${MUTED};`}>{e.period}</span>
          <span style={`${numCol} width: 64px;`}>est {e.estimate ?? "n/a"}</span>
          <span style={`${numCol} width: 64px;`}>act {e.actual ?? "n/a"}</span>
          <span
            style={`${numCol} width: 76px; color: ${
              sp != null ? (sp >= 0 ? BUY : SELL) : MUTED
            }; font-weight: 600;`}
          >
            {sp != null ? `${sp >= 0 ? "+" : ""}${sp.toFixed(1)}%` : "n/a"}
          </span>
        </div>
      {/each}
    </div>
  {/if}
{:else}
  {#if !bundle || bundle.peers.length === 0}
    <p style={empty}>No peer data</p>
  {:else}
    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
      {#each bundle.peers as p}
        <a
          href={`/s/${p}`}
          style="background: var(--surface-3); color: var(--foreground); border: 1px solid var(--panel-border); border-radius: 10px; padding: 3px 12px; font-size: 0.75rem; text-decoration: none;"
        >
          {p}
        </a>
      {/each}
    </div>
  {/if}
{/if}
