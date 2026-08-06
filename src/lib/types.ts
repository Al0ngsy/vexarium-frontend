export type Verdict = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
export type Stance = 'HOLD' | 'TAKE_PROFIT' | 'CUT_LOSS';
export type AssetType = 'stock' | 'etf' | 'index';
export type TradeType = 'stock' | 'etf' | 'index' | 'option';

export interface IndicatorResult {
  name: string;
  value: number | Record<string, number> | null;
  verdict: Verdict;
  tier: string;
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
  current_price: number | null;
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
}

export interface IndicatorPoint {
  t: string;
  v: number;
}

export interface IndicatorSeries {
  name: string;
  kind: 'overlay' | 'oscillator';
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
  is_preview?: boolean;
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
}

export interface CompanyInfo {
  symbol: string;
  name?: string | null;
  short_name?: string | null;
  exchange?: string | null;
  high_52w?: number | null;
  low_52w?: number | null;
  currency?: string | null;
  description?: string | null;
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
  volume: number | null;
  open_interest: number | null;
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
  is_estimate: boolean;
}

export interface PayoffRow {
  date: string;
  day: number;
  estimated_option_price: number;
  estimated_pl: number;
  pl_pct: number;
}

export interface OptionsPayoffResponse {
	symbol: string;
	greeks: Greeks;
	implied_volatility: number;
	premium: number;
	breakeven: number;
	payoff_timeline: PayoffRow[];
	is_estimate: boolean;
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
	payoff_curve: PayoffRow[];
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
