// Plain-English interpretation of a company metric's value: "is this good
// or bad, and what does it mean". Bands are rough heuristics for beginners,
// not investment advice. Each entry: [lower threshold (inclusive), label],
// checked in order; first match wins.

const VALUE_BANDS: Record<string, [number, string][]> = {
  market_cap: [
    [2e11, "Mega-cap: one of the biggest companies in the world."],
    [1e10, "Large-cap: an established, widely-held company."],
    [2e9, "Mid-cap: established, with room to grow."],
    [-Infinity, "Small-cap: a smaller company; higher risk, higher potential."],
  ],
  pe_ratio: [
    [25, "Expensive relative to earnings: the market expects strong future growth."],
    [15, "Fairly valued: a typical price for the profit it earns."],
    [-Infinity, "Cheap relative to earnings: the market expects modest growth."],
  ],
  forward_pe: [
    [25, "Expensive based on expected earnings: growth is already priced in."],
    [15, "Fairly valued based on expected earnings."],
    [-Infinity, "Cheap based on expected earnings."],
  ],
  ps_ratio: [
    [5, "Rich relative to sales: buyers expect fast growth."],
    [1, "Fairly valued relative to sales."],
    [-Infinity, "Cheap relative to sales."],
  ],
  profit_margin: [
    [0.2, "Strong: keeps a large share of every sales dollar as profit."],
    [0.05, "Healthy: a reasonable share of sales becomes profit."],
    [0, "Thin: most of each sale goes to costs."],
    [-Infinity, "Loss-making: costs exceed sales."],
  ],
  gross_margin: [
    [0.5, "Strong: the product itself is very profitable before overhead."],
    [0.25, "Healthy: decent cushion over production costs."],
    [-Infinity, "Thin: production eats most of the sale price."],
  ],
  roe: [
    [0.15, "Strong: efficiently turns owners' money into profit."],
    [0.05, "Moderate: reasonable return on owners' money."],
    [0, "Weak: owners' money earns very little."],
    [-Infinity, "Negative: currently destroying shareholder value."],
  ],
  roa: [
    [0.05, "Good: uses its assets efficiently to earn profit."],
    [0.01, "Modest: assets earn a small return."],
    [-Infinity, "Weak or negative: assets earn little or lose money."],
  ],
  revenue_growth: [
    [0.15, "Strong growth: sales are expanding quickly."],
    [0, "Steady: sales are roughly flat to growing."],
    [-Infinity, "Shrinking: sales are falling."],
  ],
  earnings_growth: [
    [0.15, "Strong: profit is growing quickly."],
    [0, "Steady: profit is roughly flat to growing."],
    [-Infinity, "Falling: profit is declining."],
  ],
  dividend_yield: [
    [0.03, "High income: pays a generous dividend."],
    [0.01, "Moderate income: pays a reasonable dividend."],
    [0, "Low: pays a small dividend."],
    [-Infinity, "Pays no dividend."],
  ],
  shares_outstanding: [
    [-Infinity, "Total shares that exist. Price × this = market cap."],
  ],
};

export function explainMetricValue(key: string, value: number | null | undefined): string {
  if (typeof value !== "number" || !isFinite(value)) return "";
  const bands = VALUE_BANDS[key];
  if (!bands) return "";
  for (const [threshold, label] of bands) {
    if (value >= threshold) return label;
  }
  return "";
}
