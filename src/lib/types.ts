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

export interface Warrant {
	wkn: string;
	isin: string;
	name: string;
	underlying: string;
	underlying_isin: string;
	underlying_wkn: string;
	exercise_right: string;
	exercise_style: string;
	strike: number | null;
	strike_pct: number | null;
	maturity: string | null;
	cover_ratio: number | null;
	leverage: number | null;
	omega: number | null;
	implied_volatility: number | null;
	spread_pct: number | null;
	issuer: string;
	bid: number | null;
	ask: number | null;
	premium: number | null;
}

export interface WarrantsResponse {
	underlying: string | null;
	total: number;
	warrants: Warrant[];
}

export interface WarrantValue {
	wkn: string;
	isin: string;
	exercise_right: string;
	strike: number;
	cover_ratio: number;
	target_price: number;
	estimated_option_price: number;
	estimated_pl: number;
	pl_pct: number;
}

export interface OptionContract {
  symbol: string;
  strike_price: number;
  expiration_date: string;
  type: string;
  last_price: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
}

export interface OptionsChainResponse {
  symbol: string;
  contracts: OptionContract[];
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
