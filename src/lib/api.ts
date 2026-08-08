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
	OptionChanceResponse,
	PricePoint
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Wake the backend (Render free tier sleeps after inactivity). Fire-and-forget;
// `cache: 'no-store'` so the request always reaches the origin instead of the
// browser cache. Cheap GET, never throws.
export function wakeUp(): void {
	fetch(`${BASE_URL}/health`, { cache: 'no-store' }).catch(() => {});
}

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
	optionsEnabled: boolean = false,
	timeframe: string = '1d'
): Promise<AnalysisResponse> {
	const resp = await fetch(`${BASE_URL}/api/v1/analysis`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ symbol, asset_type: assetType, options_enabled: optionsEnabled, timeframe })
	});
	if (!resp.ok) throw new Error(`Analysis failed: ${resp.status}`);
	return resp.json();
}

/** OHLC bars at a selectable resolution (1m/5m/15m/1h/1d/1w/1mo). */
export async function getBars(
	symbol: string,
	timeframe: string = '1d',
	limit: number = 300
): Promise<PricePoint[]> {
	const resp = await fetch(
		`${BASE_URL}/api/v1/analysis/bars/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=${limit}`,
		{ cache: 'no-store' }
	);
	if (!resp.ok) throw new Error(`Bars failed: ${resp.status}`);
	return resp.json();
}

export async function getOptionChain(
	symbol: string,
	expirationGte: string,
	expirationLte: string,
	maxExpiries = 10
): Promise<OptionsChainResponse> {
	const resp = await fetch(
		`${BASE_URL}/api/v1/options/${symbol}/chain?expiration_gte=${expirationGte}&expiration_lte=${expirationLte}&max_expiries=${maxExpiries}`
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

export async function getOptionChance(
	symbol: string,
	contractSymbol: string,
	token?: string
): Promise<OptionChanceResponse> {
	let url = `${BASE_URL}/api/v1/options/${symbol}/chance?contract_symbol=${contractSymbol}`;
	if (token) url += `&token=${encodeURIComponent(token)}`;
	const resp = await fetch(url);
	if (resp.status === 403) throw new Error('PRO_FEATURE');
	if (!resp.ok) throw new Error(`Options chance failed: ${resp.status}`);
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

export async function getStance(trade: SavedTrade, currentPrice = 0): Promise<StanceResponse> {
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
	token?: string,
	signal?: AbortSignal,
	timeframe: string = '1d'
): Promise<AIAnalysisResponse> {
	const url = token
		? `${BASE_URL}/api/v1/analysis/ai?token=${encodeURIComponent(token)}`
		: `${BASE_URL}/api/v1/analysis/ai`;
	const resp = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ symbol, asset_type: assetType, timeframe }),
		signal
	});
	if (!resp.ok) throw new Error(`AI analysis failed: ${resp.status}`);
	return resp.json();
}

/**
 * Stream the AI SECOND OPINION over SSE. `onChunk` is called with each
 * progressive piece of the answer as it arrives (or is replayed from cache);
 * the promise resolves with the full text when the stream completes.
 */
export async function streamAIAnalysis(
	symbol: string,
	assetType: AssetType = 'stock',
	onChunk: (text: string) => void,
	token?: string,
	signal?: AbortSignal,
	timeframe: string = '1d'
): Promise<string> {
	const url = token
		? `${BASE_URL}/api/v1/analysis/ai/stream?token=${encodeURIComponent(token)}`
		: `${BASE_URL}/api/v1/analysis/ai/stream`;
	const resp = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ symbol, asset_type: assetType, timeframe }),
		signal
	});
	if (!resp.ok) throw new Error(`AI analysis failed: ${resp.status}`);
	if (!resp.body) return getAIAnalysis(symbol, assetType, token, undefined, timeframe).then((r) => r.analysis);

	const reader = resp.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let full = '';

	const processEvent = (line: string) => {
		if (!line.startsWith('data: ')) return;
		const payload = line.slice(6).trim();
		if (!payload) return;
		try {
			const ev = JSON.parse(payload);
			if (typeof ev.chunk === 'string' && ev.chunk) {
				full += ev.chunk;
				onChunk(ev.chunk);
			}
		} catch {
			// ignore malformed events
		}
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		// SSE events are separated by a blank line.
		let idx: number;
		while ((idx = buffer.indexOf('\n\n')) !== -1) {
			const raw = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 2);
			for (const line of raw.split('\n')) processEvent(line);
		}
	}
	return full;
}

/**
 * Search assets. Returns `null` when the backend is unreachable (e.g. Render
 * cold start still booting) so the UI can show a "waking server" state instead
 * of silently pretending there are no matches. 60s cap: Render free cold
 * starts usually finish within that; a black-holed connection must not spin
 * forever.
 */
export async function searchAssets(q: string): Promise<AssetInfo[] | null> {
	try {
		const resp = await fetch(`${BASE_URL}/api/v1/assets/search?q=${encodeURIComponent(q)}`, {
			signal: AbortSignal.timeout(60_000)
		});
		if (!resp.ok) return null;
		const data = (await resp.json()) as AssetSearchResponse;
		return data.assets || [];
	} catch {
		return null;
	}
}
