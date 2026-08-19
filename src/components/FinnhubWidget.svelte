<script lang="ts">
  import type { FinnhubBundle, EarningsEntry } from "$lib/types";

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

  // '2025-03-31' → "Q1 '25"
  function fmtQ(p: string): string {
    const m = /^(\d{4})-(\d{2})/.exec(p ?? "");
    if (!m) return p ?? "";
    const q = Math.floor((+m[2] - 1) / 3) + 1;
    return `Q${q} '${m[1].slice(2)}`;
  }

  function fmtEps(v: number): string {
    return v.toFixed(2);
  }

  function fmtSurprise(s: number | null): string {
    if (s == null) return "n/a";
    return `${s >= 0 ? "+" : ""}${s.toFixed(1)}%`;
  }

  interface ERow {
    period: string;
    label: string;
    estimate: number | null;
    actual: number | null;
    surprise: number | null;
    beat: boolean | null;
  }

  // Earnings chart rows: oldest quarter first, dropping entries with no
  // figures at all so empty quarters don't create phantom gaps.
  const rows = $derived.by((): ERow[] => {
    if (kind !== "earnings" || !bundle) return [];
    return [...bundle.earnings]
      .sort((a, b) => a.period.localeCompare(b.period))
      .filter((e) => e.estimate != null || e.actual != null)
      .map((e: EarningsEntry) => ({
        period: e.period,
        label: fmtQ(e.period),
        estimate: e.estimate,
        actual: e.actual,
        surprise: e.surprise_pct,
        beat:
          e.actual != null && e.estimate != null ? e.actual >= e.estimate : null,
      }));
  });

  const maxAbs = $derived(
    Math.max(1, ...rows.flatMap((r) => [Math.abs(r.estimate ?? 0), Math.abs(r.actual ?? 0)]))
  );

  // Bar height as % of the chart body. ponytail: magnitude-only scaling;
  // negative EPS (a loss) still renders as an upward bar but the value
  // label carries the sign, so direction stays explicit.
  function barH(v: number | null): string {
    return `${Math.max(2, (Math.abs(v ?? 0) / maxAbs) * 100)}%`;
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
  {#if !bundle || rows.length === 0}
    <p style={empty}>No earnings data</p>
  {:else}
    <div>
      <div style="display: flex; justify-content: flex-end; gap: 12px; padding: 2px 4px 8px;">
        <span class="legend"><i class="sw est"></i>estimate</span>
        <span class="legend"><i class="sw act"></i>actual</span>
      </div>
      <div class="echart">
        {#each rows as r}
          <div
            class="ecol"
            title="{r.period}: est {r.estimate != null ? fmtEps(r.estimate) : 'n/a'} · act {r.actual != null ? fmtEps(r.actual) : 'n/a'} · surprise {fmtSurprise(r.surprise)}"
          >
            <span
              class="eval"
              style="color: {r.beat === null
                ? 'var(--foreground-muted)'
                : r.beat
                  ? BUY
                  : SELL};"
            >
              {r.actual != null ? fmtEps(r.actual) : "—"}
              {#if r.beat !== null && r.surprise != null}<span class="esur">{fmtSurprise(r.surprise)}</span>{/if}
            </span>
            <div class="ebars">
              <div class="ebar est" style="height: {barH(r.estimate)};"></div>
              <div
                class="ebar act"
                style="height: {barH(r.actual)}; {r.beat !== null ? `background: ${r.beat ? BUY : SELL};` : ''}"
              ></div>
            </div>
            <span class="eq">{r.label}</span>
          </div>
        {/each}
      </div>
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

<style>
  .legend {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.62rem;
    color: var(--foreground-subtle);
  }
  .sw {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    display: inline-block;
  }
  /* neutral legend: estimate = hollow, actual = filled */
  .sw.est {
    background: transparent;
    border: 1px solid var(--panel-border);
  }
  .sw.act {
    background: var(--surface-3);
    border: 1px solid var(--panel-border);
  }
  .echart {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    height: 118px;
    padding: 0 4px;
  }
  .ecol {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
  }
  .eval {
    font-size: 0.6rem;
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .esur {
    color: var(--foreground-subtle);
  }
  .ebars {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 2px;
    width: 100%;
    flex: 1;
  }
  .ebar {
    width: 36%;
    border-radius: 2px 2px 0 0;
    transition: height 0.2s;
  }
  .ebar.est {
    background: var(--surface-3);
    border: 1px solid var(--panel-border);
    border-bottom: none;
  }
  .ebar.act {
    background: var(--surface-3);
  }
  .eq {
    font-size: 0.58rem;
    font-family: var(--font-mono);
    color: var(--foreground-subtle);
    white-space: nowrap;
  }
</style>
