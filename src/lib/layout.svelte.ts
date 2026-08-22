// Widget layout persistence — per-view, localStorage-backed.
import { browser } from "$app/environment";

export interface WidgetDef {
  id: string;
  title: string;
  sub?: string;
  x: number;
  y: number;
  w: number; // columns (1–12)
  h: number; // rows
  minW?: number;
  minH?: number;
}

export interface WidgetPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Versioned layout keys: bump a view's version to invalidate stale saved
// positions when the default arrangement changes (options went to v2 when
// the default grid was rearranged).
const LAYOUT_VERSION: Record<string, number> = { analysis: 1, options: 2 };
const KEY = (view: string) => `vexarium:layout:${view}:v${LAYOUT_VERSION[view] ?? 1}`;
const ON_KEY = (view: string) => `vexarium:layout:${view}:v${LAYOUT_VERSION[view] ?? 1}:on`;

// Default layouts per view (mock §4.1 / §4.2).
export const ANALYSIS_WIDGETS: WidgetDef[] = [
  {
    id: "price-chart",
    title: "Price · OHLC",
    sub: "1D · 1y",
    x: 0,
    y: 0,
    w: 8,
    h: 4,
    minW: 3,
    minH: 4,
  },
  { id: "vitals", title: "Vitals", x: 8, y: 0, w: 4, h: 3, minW: 3, minH: 3 },
  {
    id: "indicator-checks",
    title: "Indicator checks",
    sub: "pass / watch / fail",
    x: 0,
    y: 4,
    w: 4,
    h: 5,
    minW: 2,
    minH: 4,
  },
  {
    id: "ai-opinion",
    title: "AI second opinion",
    sub: "1D daily data",
    x: 4,
    y: 4,
    w: 4,
    h: 6,
    minW: 3,
    minH: 3,
  },
  { id: "company", title: "About", x: 8, y: 3, w: 4, h: 7, minW: 3, minH: 3 },
  {
    id: "watchlist",
    title: "Watchlist",
    sub: "saved symbols",
    x: 0,
    y: 9,
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
  {
    id: "news",
    title: "News & sentiment",
    x: 4,
    y: 10,
    w: 8,
    h: 3,
    minW: 3,
    minH: 3,
  },
  {
    id: "fear-greed",
    title: "Fear & Greed",
    sub: "market mood",
    x: 0,
    y: 17,
    w: 3,
    h: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: "insider",
    title: "Insider trading",
    sub: "recent filings",
    x: 0,
    y: 13,
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
  {
    id: "earnings",
    title: "Earnings",
    sub: "estimates vs actuals",
    x: 4,
    y: 13,
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
  {
    id: "peers",
    title: "Peers",
    sub: "comparables",
    x: 8,
    y: 13,
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
  },
  {
    id: "patterns",
    title: "Patterns",
    sub: "recent crossovers",
    x: 3,
    y: 17,
    w: 4,
    h: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: "stats",
    title: "Key statistics",
    x: 7,
    y: 17,
    w: 4,
    h: 3,
    minW: 2,
    minH: 2,
  },
];

export const OPTIONS_WIDGETS: WidgetDef[] = [
  {
    id: "options-chain",
    title: "Options chain",
    sub: "expiry · strikes",
    x: 0,
    y: 0,
    w: 12,
    h: 5,
    minW: 8,
    minH: 3,
  },
  {
    id: "payoff-explorer",
    title: "Payoff explorer",
    sub: "curve · timeline",
    x: 0,
    y: 5,
    w: 7,
    h: 5,
    minW: 5,
    minH: 3,
  },
  { id: "greeks", title: "Greeks", x: 7, y: 5, w: 5, h: 2, minW: 3, minH: 2 },
  {
    id: "probability",
    title: "Probability",
    sub: "PRO",
    x: 7,
    y: 7,
    w: 5,
    h: 3,
    minW: 3,
    minH: 2,
  },
  {
    id: "strategies",
    title: "Strategy suggestions",
    sub: "bias-driven",
    x: 0,
    y: 10,
    w: 7,
    h: 3,
    minW: 4,
    minH: 2,
  },
  {
    id: "watchlist",
    title: "Watchlist",
    sub: "saved symbols",
    x: 7,
    y: 10,
    w: 5,
    h: 3,
    minW: 3,
    minH: 2,
  },
  {
    id: "pl-matrix",
    title: "P/L matrix",
    sub: "heatmap",
    x: 0,
    y: 13,
    w: 12,
    h: 4,
    minW: 6,
    minH: 3,
  },
];

export const ALL_WIDGETS: Record<"analysis" | "options", WidgetDef[]> = {
  analysis: ANALYSIS_WIDGETS,
  options: OPTIONS_WIDGETS,
};

export function loadPositions(
  view: "analysis" | "options",
): Record<string, WidgetPos> {
  if (!browser) return {};
  try {
    const raw = localStorage.getItem(KEY(view));
    return raw ? (JSON.parse(raw) as Record<string, WidgetPos>) : {};
  } catch {
    return {};
  }
}

export function savePositions(
  view: "analysis" | "options",
  pos: Record<string, WidgetPos>,
): void {
  if (!browser) return;
  try {
    localStorage.setItem(KEY(view), JSON.stringify(pos));
  } catch {
    // storage full / private mode — layout just won't persist
  }
}

// Live grid sizes (current w×h per widget id), updated by WidgetGrid on
// every gridstack change — drives the "8×2" readout in widget headers.
export const liveSizes = $state<Record<string, { w: number; h: number }>>({});

export function loadEnabled(
  view: "analysis" | "options",
): Record<string, boolean> {
  if (!browser) return {};
  try {
    const raw = localStorage.getItem(ON_KEY(view));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function saveEnabled(
  view: "analysis" | "options",
  on: Record<string, boolean>,
): void {
  if (!browser) return;
  try {
    localStorage.setItem(ON_KEY(view), JSON.stringify(on));
  } catch {
    // ignore
  }
}

export function resetLayout(view: "analysis" | "options"): void {
  if (!browser) return;
  localStorage.removeItem(KEY(view));
  localStorage.removeItem(ON_KEY(view));
}
