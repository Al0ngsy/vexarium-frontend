import type {
	AnalysisResponse,
	OptionsPayoffResponse,
	OptionsChainResponse,
	StanceResponse,
	StrategiesResponse,
	SavedTrade,
	AssetType,
	AIAnalysisResponse,
	AssetInfo,
	AssetSearchResponse,
	OptionValueAtPrice,
	OptionsMatrixResponse,
	WarrantsResponse,
	WarrantValue
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// --- Auth ---------------------------------------------------------------

export interface AuthResponse {
	access_token: string;
	token_type: string;
	tier: string;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
	const resp = await fetch(`${BASE_URL}/api/v1/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	if (!resp.ok) throw new Error(`Registration failed: ${resp.status}`);
	return resp.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
	const resp = await fetch(`${BASE_URL}/api/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	if (!resp.ok) throw new Error('Invalid credentials');
	return resp.json();
}

export async function getMe(token: string): Promise<{ id: number; email: string; tier: string }> {
	const resp = await fetch(`${BASE_URL}/api/v1/auth/me?token=${encodeURIComponent(token)}`);
	if (!resp.ok) throw new Error('Session expired');
	return resp.json();
}

export async function createCheckoutSession(token: string): Promise<{ checkout_url: string }> {
	const resp = await fetch(`${BASE_URL}/api/v1/billing/checkout?token=${encodeURIComponent(token)}`, {
		method: 'POST'
	});
	if (!resp.ok) throw new Error(`Checkout failed: ${resp.status}`);
	return resp.json();
}

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

export async function analyzeExtended(
	symbol: string,
	assetType: AssetType = 'stock'
): Promise<AnalysisResponse> {
	const resp = await fetch(`${BASE_URL}/api/v1/analysis/extended`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ symbol, asset_type: assetType })
	});
	if (!resp.ok) throw new Error(`Pro analysis failed: ${resp.status}`);
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

export async function getOptionValueAtPrice(
	symbol: string,
	contractSymbol: string,
	targetPrice: number,
	targetDate?: string
): Promise<OptionValueAtPrice> {
	let url = `${BASE_URL}/api/v1/options/${symbol}/value?contract_symbol=${contractSymbol}&target_price=${targetPrice}`;
	if (targetDate) url += `&target_date=${targetDate}`;
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`Options value failed: ${resp.status}`);
	return resp.json();
}

export async function getOptionsMatrix(
	symbol: string,
	contractSymbol: string,
	rangePct = 0.05,
	quantity = 100
): Promise<OptionsMatrixResponse> {
	const resp = await fetch(`${BASE_URL}/api/v1/options/${symbol}/matrix`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ contract_symbol: contractSymbol, range_pct: rangePct, quantity })
	});
	if (!resp.ok) throw new Error(`Options matrix failed: ${resp.status}`);
	return resp.json();
}

export async function getWarrants(
	underlying?: string,
	exerciseRight?: string,
	limit = 200
): Promise<WarrantsResponse> {
	let url = `${BASE_URL}/api/v1/warrants?limit=${limit}`;
	if (underlying) url += `&underlying=${encodeURIComponent(underlying)}`;
	if (exerciseRight) url += `&exercise_right=${exerciseRight}`;
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`Warrants failed: ${resp.status}`);
	return resp.json();
}

export async function getWarrantValue(
	wkn: string,
	targetPrice: number,
	strike: number,
	premium: number,
	coverRatio: number,
	exerciseRight: string
): Promise<WarrantValue> {
	const url = `${BASE_URL}/api/v1/warrants/${wkn}/value?target_price=${targetPrice}&strike=${strike}&premium=${premium}&cover_ratio=${coverRatio}&exercise_right=${exerciseRight}`;
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`Warrant value failed: ${resp.status}`);
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

export async function getAIAnalysis(
	symbol: string,
	assetType: AssetType = 'stock',
	token?: string
): Promise<AIAnalysisResponse> {
	const url = token
		? `${BASE_URL}/api/v1/analysis/ai?token=${encodeURIComponent(token)}`
		: `${BASE_URL}/api/v1/analysis/ai`;
	const resp = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ symbol, asset_type: assetType })
	});
	if (!resp.ok) throw new Error(`AI analysis failed: ${resp.status}`);
	return resp.json();
}

export async function searchAssets(q: string): Promise<AssetInfo[]> {
	const resp = await fetch(`${BASE_URL}/api/v1/assets/search?q=${encodeURIComponent(q)}`);
	if (!resp.ok) return [];
	const data = (await resp.json()) as AssetSearchResponse;
	return data.assets || [];
}
