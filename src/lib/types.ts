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
