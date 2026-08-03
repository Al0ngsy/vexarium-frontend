import type {
	AnalysisResponse,
	OptionsPayoffResponse,
	OptionsChainResponse,
	StanceResponse,
	StrategiesResponse,
	SavedTrade,
	AssetType
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function analyze(
	symbol: string,
	assetType: AssetType = 'stock',
	optionsEnabled: boolean = false
): Promise<AnalysisResponse> {
	const resp = await fetch(`${BASE_URL}/api/v1/analysis`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ symbol, asset_type: assetType, options_enabled: optionsEnabled })
	});
	if (!resp.ok) throw new Error(`Analysis failed: ${resp.status}`);
	return resp.json();
}

export async function getOptionChain(
	symbol: string,
	expirationGte: string,
	expirationLte: string
): Promise<OptionsChainResponse> {
	const resp = await fetch(
		`${BASE_URL}/api/v1/options/${symbol}/chain?expiration_gte=${expirationGte}&expiration_lte=${expirationLte}`
	);
	if (!resp.ok) throw new Error(`Options chain failed: ${resp.status}`);
	return resp.json();
}

export async function getOptionPayoff(
	symbol: string,
	contractSymbol: string
): Promise<OptionsPayoffResponse> {
	const resp = await fetch(
		`${BASE_URL}/api/v1/options/${symbol}/payoff?contract_symbol=${contractSymbol}`
	);
	if (!resp.ok) throw new Error(`Options payoff failed: ${resp.status}`);
	return resp.json();
}

export async function getStrategies(
	symbol: string,
	sentiment: string,
	strike: number,
	expirationGte: string,
	expirationLte: string
): Promise<StrategiesResponse> {
	const resp = await fetch(
		`${BASE_URL}/api/v1/options/${symbol}/strategies?sentiment=${sentiment}&strike=${strike}&expiration_gte=${expirationGte}&expiration_lte=${expirationLte}`
	);
	if (!resp.ok) throw new Error(`Strategies failed: ${resp.status}`);
	return resp.json();
}

export async function getStance(trade: SavedTrade, currentPrice: number): Promise<StanceResponse> {
	const resp = await fetch(`${BASE_URL}/api/v1/portfolio/stance`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			symbol: trade.symbol,
			entry_price: trade.entryPrice,
			current_price: currentPrice,
			trade_type: trade.type,
			contract: trade.contract ? { expiration_date: trade.contract } : null
		})
	});
	if (!resp.ok) throw new Error(`Stance failed: ${resp.status}`);
	return resp.json();
}
