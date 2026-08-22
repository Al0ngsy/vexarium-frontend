export type Verdict =
  | "strong_buy"
  | "buy"
  | "hold"
  | "sell"
  | "strong_sell"
  | "none";
export type Stance = "HOLD" | "TAKE_PROFIT" | "CUT_LOSS";
export type AssetType = "stock" | "etf" | "index";
export type TradeType = "stock" | "etf" | "index" | "option";

export interface IndicatorResult {
  name: string;
  value: number | Record<string, number> | null;
  verdict: Verdict;
}

export interface OverallVerdict {
  overall_verdict: Verdict;
  score: number;
  indicator_count: number;
  breakdown: IndicatorResult[];
}

export interface AnalysisResponse {
  symbol: string;
  asset_type: string;
  timeframe?: string;
  current_price: number | null;
  day_change_pct?: number | null;
  overall: OverallVerdict;
  indicators: IndicatorResult[];
  analyzed_at?: string | null;
  price_series?: PricePoint[];
  indicator_series?: IndicatorSeries[];
  news_sentiment?: NewsSentiment | null;
  news_articles?: NewsArticle[];
  company?: CompanyInfo | null;
}

export interface NewsSentiment {
  sentiment_score: number;
  article_count: number;
  summary: string;
}

export interface PricePoint {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** "twelvedata" = real-time bars; "alpaca" = IEX bars, 15 min delayed by Alpaca's historical-data rule; "yahoo" = ~15 min delayed; "" = unknown */
  source?: string;
}

export interface InsiderTrade {
  name: string;
  shares: number;
  change: number;
  filing_date: string;
}

export interface EarningsEntry {
  period: string;
  estimate: number | null;
  actual: number | null;
  surprise_pct: number | null;
}

export interface FinnhubBundle {
  insider: InsiderTrade[];
  earnings: EarningsEntry[];
  peers: string[];
}

export interface IndicatorPoint {
  t: string;
  v: number;
}

export interface IndicatorSeries {
  name: string;
  kind: "overlay" | "oscillator";
  points: IndicatorPoint[];
}

export interface AssetInfo {
  symbol: string;
  name: string;
  exchange: string;
  asset_type: AssetType;
}

export interface AIAnalysisResponse {
  symbol: string;
  analysis: string;
  model: string;
  analyzed_at: string;
  news_sentiment?: NewsSentiment | null;
  news_articles?: NewsArticle[];
  market?: {
    price?: number | null;
    day_change_pct?: number | null;
    bid?: number | null;
    ask?: number | null;
    prev_close?: number | null;
    high_52w?: number | null;
    low_52w?: number | null;
    ytd_change_pct?: number | null;
  };
}

export interface NewsArticle {
  id?: string | number | null;
  headline: string;
  source?: string | null;
  url?: string | null;
  summary?: string | null;
  created_at?: string | null;
  author?: string | null;
  symbols?: string[];
  sentiment?: number | null; // per-article headline sentiment score
}

export interface MarketNews {
  sentiment: { sentiment_score: number; article_count: number; summary: string };
  articles: NewsArticle[];
}

export interface FearGreed {
  score: number | null;
  rating?: string | null;
  timestamp?: string | null;
  previous_close?: number | null;
  previous_1_week?: number | null;
  previous_1_month?: number | null;
  history?: { t: string; v: number }[]; // last ~90 daily scores for the sparkline
}

export interface MainListing {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
}

export interface CompanyInfo {
  symbol: string;
  name?: string | null;
  short_name?: string | null;
  exchange?: string | null;
  currency?: string | null;
  description?: string | null;
  main_listing?: MainListing | null;
  sector?: string | null;
  industry?: string | null;
  website?: string | null;
  headquarters?: string | null;
  employees?: number | null;
  founded?: number | null;
  ceo?: string | null;
  ceo_title?: string | null;
  ceo_pay?: number | null;
  market_cap?: number | null;
  shares_outstanding?: number | null;
  pe_ratio?: number | null;
  forward_pe?: number | null;
  ps_ratio?: number | null;
  pb_ratio?: number | null;
  high_52w?: number | null;
  low_52w?: number | null;
  dividend_yield?: number | null;
  payout_ratio?: number | null;
  revenue_growth?: number | null;
  earnings_growth?: number | null;
  profit_margin?: number | null;
  gross_margin?: number | null;
  roe?: number | null;
  roa?: number | null;
  next_earnings_date?: string | null;
}

export interface AssetSearchResponse {
  assets: AssetInfo[];
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface OptionContract {
  symbol: string;
  strike_price: number;
  expiration_date: string;
  type: string; // 'call' | 'put'
  bid: number;
  ask: number;
  last_price: number;
  implied_volatility: number;
  greeks: Greeks;
  days_to_expiry: number;
  intrinsic_value: number;
  time_value: number;
  theoretical_value: number;
  spread: number;
  distance_pct: number;
}

export interface OptionsChainResponse {
  symbol: string;
  current_price: number | null;
  day_change_pct: number | null;
  delayed: boolean;
  contracts: OptionContract[];
}

export interface OptionChanceResponse {
  symbol: string;
  contract_symbol: string;
  is_call: boolean;
  strike: number;
  premium: number;
  current_price: number;
  days_to_expiry: number;
  implied_volatility: number;
  prob_profit: number; // 0..1
  prob_itm: number; // 0..1
  expected_value: number;
  breakeven: number;
}

export interface PayoffRow {
  date: string;
  day: number;
  estimated_option_price: number;
  estimated_pl: number;
  pl_pct: number;
}

export interface PayoffPoint {
  price: number;
  pl: number;
}

export interface OptionsPayoffResponse {
  symbol: string;
  greeks: Greeks;
  implied_volatility: number;
  premium: number;
  breakeven: number;
  payoff_timeline: PayoffRow[];
}

export interface OptionValueAtPrice {
  symbol: string;
  contract_symbol: string;
  strike: number;
  premium: number;
  is_call: boolean;
  target_price: number;
  target_date: string;
  days_to_expiry: number;
  estimated_option_price: number;
  estimated_pl: number;
  pl_pct: number;
}

export interface MatrixCell {
  expiry: string;
  days_to_expiry: number;
  option_value: number;
  pl: number;
  pl_pct: number;
}

export interface MatrixRow {
  strike: number;
  move_pct: number;
  cells: MatrixCell[];
}

export interface OptionsMatrixResponse {
  symbol: string;
  contract_symbol: string;
  current_price: number;
  range_pct: number;
  premium: number;
  breakeven: number;
  expiries: string[];
  strikes: MatrixRow[];
}

export interface StanceResponse {
  stance: Stance;
  reason: string;
  pnl_pct: number;
  take_profit_at: number;
  cut_loss_at: number;
}

export interface StrategyCard {
  name: string;
  subtitle: string;
  is_bullish: boolean;
  max_profit: number | null;
  max_loss: number | null;
  breakeven: number;
  return_on_risk: number | null;
  payoff_curve: PayoffPoint[];
}

export interface StrategiesResponse {
  symbol: string;
  sentiment: string;
  strategies: StrategyCard[];
}

export interface SavedTrade {
  id: string;
  symbol: string;
  type: TradeType;
  entryDate: string;
  entryPrice: number;
  quantity: number;
  contract?: string;
}
