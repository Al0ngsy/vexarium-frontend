<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import { VERDICT_COLORS, VERDICT_LABELS } from "$lib/verdict";

  let { store }: { store: AnalysisStore } = $props();

  // Circular gauge geometry (SVG arcs, clockwise, y-down).
  function polarX(cx: number, cy: number, r: number, deg: number): number {
    return cx + r * Math.cos((deg * Math.PI) / 180);
  }
  function polarY(cx: number, cy: number, r: number, deg: number): number {
    return cy + r * Math.sin((deg * Math.PI) / 180);
  }
  function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
    const x0 = polarX(cx, cy, r, a0);
    const y0 = polarY(cx, cy, r, a0);
    const x1 = polarX(cx, cy, r, a1);
    const y1 = polarY(cx, cy, r, a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
</script>

{#if !store.fearGreed || store.fearGreed.score == null}
  <p class="label" style="color: var(--foreground-muted);">
    Fear & Greed unavailable
  </p>
{:else}
  {@const s = store.fearGreed.score}
  {@const zone =
    s <= 25
      ? "Extreme fear"
      : s < 45
        ? "Fear"
        : s <= 55
          ? "Neutral"
          : s < 75
            ? "Greed"
            : "Extreme greed"}
  {@const zc =
    s <= 45
      ? "var(--verdict-strong-buy)"
      : s < 75
        ? "var(--verdict-hold)"
        : "var(--verdict-strong-sell)"}
  {@const A0 = 135}
  {@const valAngle = A0 + Math.min(100, Math.max(0, s)) * 2.7}
  <div style="display: flex; align-items: center; gap: 18px; padding: 4px 2px 8px;">
    <svg viewBox="0 0 120 120" style="width: 118px; height: 118px; flex-shrink: 0; display: block;">
      <path d={arcPath(60, 60, 46, A0, A0 + 270)} fill="none" stroke="var(--surface-3)" stroke-width="12" stroke-linecap="round" />
      <path d={arcPath(60, 60, 46, A0, Math.max(A0 + 2, valAngle))} fill="none" stroke={zc} stroke-width="12" stroke-linecap="round" />
      {#if valAngle >= A0 + 4}
        <circle cx={polarX(60, 60, 46, valAngle)} cy={polarY(60, 60, 46, valAngle)} r="4.5" fill={zc} />
      {/if}
      <text x="60" y="62" text-anchor="middle" fill="var(--foreground)" font-size="32" font-weight="700" style="font-family: var(--font-mono);">{Math.round(s)}</text>
      <text x="60" y="79" text-anchor="middle" fill={zc} font-size="10" font-weight="600" style="font-family: var(--font-mono); text-transform: capitalize;">{zone}</text>
    </svg>
    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;">
      <div>
        <div class="label" style="font-size: 0.6rem; color: var(--foreground-muted); text-transform: none;">1 week</div>
        <div class="data" style="font-size: 0.95rem; font-weight: 600;">{#if store.fearGreed.previous_1_week != null}{s - store.fearGreed.previous_1_week >= 0 ? "+" : ""}{Math.round(s - store.fearGreed.previous_1_week)}{:else}—{/if}</div>
      </div>
      <div>
        <div class="label" style="font-size: 0.6rem; color: var(--foreground-muted); text-transform: none;">1 month</div>
        <div class="data" style="font-size: 0.95rem; font-weight: 600;">{#if store.fearGreed.previous_1_month != null}{s - store.fearGreed.previous_1_month >= 0 ? "+" : ""}{Math.round(s - store.fearGreed.previous_1_month)}{:else}—{/if}</div>
      </div>
      <div class="label" style="font-size: 0.58rem; color: var(--foreground-muted); text-transform: none;">updated {store.fearGreed.timestamp ? new Date(store.fearGreed.timestamp).toLocaleDateString() : ""}</div>
    </div>
  </div>
  {#if store.fearGreed.history && store.fearGreed.history.length > 1}
    {@const pts = store.fearGreed.history}
    {@const line = pts
      .map(
        (p, i) =>
          `${(i / Math.max(1, pts.length - 1)) * 100},${100 - Math.min(100, Math.max(0, p.v))}`,
      )
      .join(" ")}
    {@const area = `${line} 100,100 0,100`}
    <div style="display: flex; gap: 6px; align-items: stretch; margin-top: 4px;" title="Fear & Greed trend, last 3 months (today {Math.round(s)})">
      <div style="display: flex; flex-direction: column; justify-content: space-between; height: 40px; font-family: var(--font-mono); font-size: 0.55rem; color: var(--foreground-subtle); text-align: right;">
        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
      </div>
      <div style="flex: 1; min-width: 0;">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 40px; display: block;">
          <line x1="0" y1="0" x2="100" y2="0" style="stroke: var(--foreground-subtle);" stroke-width="1" vector-effect="non-scaling-stroke" />
          <line x1="0" y1="25" x2="100" y2="25" style="stroke: var(--panel-border);" stroke-width="1" vector-effect="non-scaling-stroke" />
          <line x1="0" y1="50" x2="100" y2="50" style="stroke: var(--panel-border);" stroke-width="1" vector-effect="non-scaling-stroke" />
          <line x1="0" y1="75" x2="100" y2="75" style="stroke: var(--panel-border);" stroke-width="1" vector-effect="non-scaling-stroke" />
          <line x1="0" y1="100" x2="100" y2="100" style="stroke: var(--foreground-subtle);" stroke-width="1" vector-effect="non-scaling-stroke" />
          <polygon points={area} style="fill: {zc};" fill-opacity="0.12" />
          <polyline points={line} style="stroke: {zc};" fill="none" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>
        <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.58rem; color: var(--foreground-subtle); margin-top: 2px;">
          <span>{pts[0]?.t ?? ""}</span>
          <span>{pts[pts.length - 1]?.t ?? ""}</span>
        </div>
      </div>
    </div>
  {/if}
  <div
    class="label"
    style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--panel-border); font-size: 0.68rem; color: var(--foreground-muted); text-transform: none;"
  >
    Market mood: <span style="color: {zc};">{zone.toLowerCase()}</span> · this stock: <span style="color: {VERDICT_COLORS[store.client.verdict]};">{VERDICT_LABELS[store.client.verdict].toLowerCase()}</span>
  </div>
{/if}
