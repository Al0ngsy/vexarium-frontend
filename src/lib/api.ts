import { clearSessionToken, getSessionToken } from './session';
import type {
	AnalysisResponse,
	OptionsPayoffResponse,
	OptionsChainResponse,
	StanceResponse,
	StrategiesResponse,
	SavedTrade,
	TradeType,
	AssetType,
	AIAnalysisResponse,
	AssetInfo,
	AssetSearchResponse,
	OptionValueAtPrice,
	OptionsMatrixResponse,
	OptionChanceResponse,
	PricePoint,
	FinnhubBundle,
	MarketNews,
	FearGreed
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// --- Core client ----------------------------------------------------------

/** Non-2xx response. `detail` is FastAPI's `{detail}` (string, or the joined
 * messages of a 422 validation list); `message` is `<label>: <detail|status>`. */
export class ApiError extends Error {
	readonly status: number;
	readonly detail: string | null;

	constructor(message: string, status: number, detail: string | null = null) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.detail = detail;
	}
}

export function isAbortError(e: unknown): boolean {
	return e instanceof DOMException && e.name === 'AbortError';
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	/** JSON-serialised request body. */
	body?: unknown;
	query?: Query;
	signal?: AbortSignal;
	/** false (default): never send credentials. An Authorization header turns a
	 * simple cross-origin GET into a preflighted one, so only endpoints that
	 * read the user opt in. true: send the stored session token as
	 * `Authorization: Bearer` when there is one. string: use exactly this token
	 * (e.g. verifying a fresh login before it is stored). */
	auth?: boolean | string;
	/** Prefix of ApiError.message, e.g. "Analysis failed". */
	label?: string;
	cache?: RequestCache;
}

function buildUrl(path: string, query?: Query): string {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(query ?? {})) {
		if (v !== undefined && v !== null) qs.set(k, String(v));
	}
	const s = qs.toString();
	return `${BASE_URL}${path}${s ? `?${s}` : ''}`;
}

function detailOf(payload: unknown): string | null {
	const d = (payload as { detail?: unknown } | null)?.detail;
	if (typeof d === 'string') return d;
	if (Array.isArray(d)) {
		const msgs = d
			.map((x) => (x && typeof x === 'object' && 'msg' in x ? String((x as { msg: unknown }).msg) : null))
			.filter((m): m is string => !!m);
		return msgs.length ? msgs.join('; ') : null;
	}
	return null;
}

/** Fetch with auth header + error mapping; returns the raw (ok) response. */
async function send(path: string, opts: RequestOptions = {}): Promise<Response> {
	const { method = 'GET', body, query, signal, auth = false, label = 'Request failed', cache } = opts;
	const explicit = typeof auth === 'string' ? auth : null;
	const token = explicit ?? (auth ? getSessionToken() : null);

	const headers: Record<string, string> = { Accept: 'application/json' };
	if (body !== undefined) headers['Content-Type'] = 'application/json';
	if (token) headers.Authorization = `Bearer ${token}`;

	const resp = await fetch(buildUrl(path, query), {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		signal,
		cache
	});
	if (resp.ok) return resp;

	let detail: string | null = null;
	try {
		detail = detailOf(await resp.json());
	} catch {
		// non-JSON error body: fall back to the status code
	}
	// A rejected stored token means the session is gone: log out. An explicit
	// token (fresh login being verified) is the caller's business.
	if (resp.status === 401 && token && explicit === null) clearSessionToken();
	throw new ApiError(`${label}: ${detail ?? resp.status}`, resp.status, detail);
}

/** Typed JSON request against the backend. Throws ApiError on non-2xx. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
	const resp = await send(path, opts);
	if (resp.status === 204) return undefined as T;
	return (await resp.json()) as T;
}

/** 403 on a Pro-gated endpoint is surfaced as the sentinel message PRO_FEATURE. */
function proGate(e: unknown): never {
	if (e instanceof ApiError && e.status === 403) throw new ApiError('PRO_FEATURE', 403, e.detail);
	throw e;
}

/** Read an SSE body (`data: {"chunk": "..."}` lines) and hand each chunk out. */
async function readChunks(resp: Response, onChunk: (text: string) => void): Promise<string> {
	const reader = resp.body!.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let full = '';

	const processLine = (line: string) => {
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
			// ignore malformed keepalive lines
		}
	};

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) processLine(line.trimEnd());
	}
	for (const line of buffer.split('\n')) processLine(line.trimEnd());
	return full;
}

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

export function register(email: string, password: string): Promise<AuthResponse> {
	return request('/api/v1/auth/register', {
		method: 'POST',
		body: { email, password },
		label: 'Registration failed'
	});
}

export interface Me {
	id: number;
	email: string;
	tier: string;
	subscription_status: string | null;
	current_period_end: string | null;
	created_at: string;
}

export function login(email: string, password: string): Promise<AuthResponse> {
	return request('/api/v1/auth/login', {
		method: 'POST',
		body: { email, password },
		label: 'Login failed'
	});
}

export function getMe(token?: string, signal?: AbortSignal): Promise<Me> {
	return request('/api/v1/auth/me', { auth: token ?? true, signal, label: 'Session expired' });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
	return request('/api/v1/auth/change-password', {
		method: 'POST',
		body: { current_password: currentPassword, new_password: newPassword },
		auth: true,
		label: 'Password change failed'
	});
}

export function deleteAccount(password: string): Promise<void> {
	return request('/api/v1/auth/me', {
		method: 'DELETE',
		body: { password },
		auth: true,
		label: 'Account deletion failed'
	});
}

export function requestPasswordReset(email: string): Promise<void> {
	return request('/api/v1/auth/password-reset/request', {
		method: 'POST',
		body: { email },
		label: 'Password reset failed'
	});
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
	return request('/api/v1/auth/password-reset/confirm', {
		method: 'POST',
		body: { token, new_password: newPassword },
		label: 'Password reset failed'
	});
}

// --- Billing --------------------------------------------------------------

export function createCheckoutSession(): Promise<{ checkout_url: string }> {
	return request('/api/v1/billing/checkout', {
		method: 'POST',
		auth: true,
		label: 'Checkout failed'
	});
}

/** Stripe customer portal. 400 when the user has no Stripe customer yet. */
export function createPortalSession(): Promise<{ portal_url: string }> {
	return request('/api/v1/billing/portal', {
		method: 'POST',
		auth: true,
		label: 'Billing portal failed'
	});
}

// --- Trades ---------------------------------------------------------------

export interface TradeCreate {
	symbol: string;
	trade_type: TradeType;
	entry_date: string;
	entry_price: number;
	quantity: number;
	contract?: string;
	notes?: string;
}

export interface TradeOut extends TradeCreate {
	id: number;
	user_id: number;
	created_at: string | null;
}

export function listTrades(signal?: AbortSignal): Promise<TradeOut[]> {
	return request('/api/v1/trades', { auth: true, signal, label: 'Loading trades failed' });
}

export function createTrade(trade: TradeCreate): Promise<TradeOut> {
	return request('/api/v1/trades', {
		method: 'POST',
		body: trade,
		auth: true,
		label: 'Saving trade failed'
	});
}

export function deleteTradeById(id: number): Promise<void> {
	return request(`/api/v1/trades/${id}`, {
		method: 'DELETE',
		auth: true,
		label: 'Deleting trade failed'
	});
}

// --- Analysis -------------------------------------------------------------

export function analyze(
	symbol: string,
	assetType: AssetType = 'stock',
	optionsEnabled: boolean = false,
	timeframe: string = '1d',
	signal?: AbortSignal
): Promise<AnalysisResponse> {
	return request('/api/v1/analysis', {
		method: 'POST',
		body: { symbol, asset_type: assetType, options_enabled: optionsEnabled, timeframe },
		signal,
		label: 'Analysis failed'
	});
}

/** OHLC bars at a selectable resolution (1m/5m/15m/1h/1d/1w/1mo). */
export function getBars(
	symbol: string,
	timeframe: string = '1d',
	limit: number = 300,
	signal?: AbortSignal
): Promise<PricePoint[]> {
	return request(`/api/v1/analysis/bars/${encodeURIComponent(symbol)}`, {
		query: { timeframe, limit },
		cache: 'no-store',
		signal,
		label: 'Bars failed'
	});
}

/** Finnhub enrichment: insider trades, earnings history, peers (12h server cache). */
export function getFinnhub(symbol: string, signal?: AbortSignal): Promise<FinnhubBundle> {
	return request(`/api/v1/analysis/finnhub/${encodeURIComponent(symbol)}`, {
		cache: 'no-store',
		signal,
		label: 'Finnhub failed'
	});
}

/** Broad market headlines (Finnhub general news, 12h server cache, no symbol). */
export function getMarketNews(signal?: AbortSignal): Promise<MarketNews> {
	return request('/api/v1/analysis/market-news', {
		cache: 'no-store',
		signal,
		label: 'Market news failed'
	});
}

/** CNN Fear & Greed index (market-wide mood gauge, ~30 min server cache). */
export function getFearGreed(signal?: AbortSignal): Promise<FearGreed> {
	return request('/api/v1/analysis/fear-greed', {
		cache: 'no-store',
		signal,
		label: 'Fear & Greed failed'
	});
}

// --- Options --------------------------------------------------------------

export function getOptionChain(
	symbol: string,
	expirationGte: string,
	expirationLte: string,
	maxExpiries = 10,
	signal?: AbortSignal
): Promise<OptionsChainResponse> {
	return request(`/api/v1/options/${encodeURIComponent(symbol)}/chain`, {
		query: {
			expiration_gte: expirationGte,
			expiration_lte: expirationLte,
			max_expiries: maxExpiries
		},
		signal,
		label: 'Options chain failed'
	});
}

export function getOptionPayoff(
	symbol: string,
	contractSymbol: string,
	signal?: AbortSignal
): Promise<OptionsPayoffResponse> {
	return request(`/api/v1/options/${encodeURIComponent(symbol)}/payoff`, {
		query: { contract_symbol: contractSymbol },
		signal,
		label: 'Options payoff failed'
	});
}

export function getOptionValueAtPrice(
	symbol: string,
	contractSymbol: string,
	targetPrice: number,
	targetDate?: string,
	signal?: AbortSignal
): Promise<OptionValueAtPrice> {
	return request(`/api/v1/options/${encodeURIComponent(symbol)}/value`, {
		query: { contract_symbol: contractSymbol, target_price: targetPrice, target_date: targetDate },
		signal,
		label: 'Options value failed'
	});
}

export function getOptionsMatrix(
	symbol: string,
	contractSymbol: string,
	rangePct = 0.05,
	quantity = 100,
	dates = 8,
	signal?: AbortSignal
): Promise<OptionsMatrixResponse> {
	return request(`/api/v1/options/${encodeURIComponent(symbol)}/matrix`, {
		method: 'POST',
		body: { contract_symbol: contractSymbol, range_pct: rangePct, quantity, dates },
		signal,
		label: 'Options matrix failed'
	});
}

export function getOptionChance(
	symbol: string,
	contractSymbol: string,
	signal?: AbortSignal
): Promise<OptionChanceResponse> {
	return request<OptionChanceResponse>(`/api/v1/options/${encodeURIComponent(symbol)}/chance`, {
		query: { contract_symbol: contractSymbol },
		signal,
		auth: true,
		label: 'Options chance failed'
	}).catch(proGate);
}

export function getStrategies(
	symbol: string,
	strike: number,
	expirationGte: string,
	expirationLte: string,
	sentiment?: string,
	dte?: number,
	timeframe?: string,
	signal?: AbortSignal
): Promise<StrategiesResponse> {
	// Sentiment is optional: the backend derives direction from indicators
	// (defaults to 'neutral' when omitted). `dte` (days to expiry of the
	// selected contract) lets the backend match the verdict timeframe to the
	// contract horizon instead of always judging on 1d bars. An explicit
	// `timeframe` (1h/1d/1w/1mo) overrides the DTE-matched default.
	return request(`/api/v1/options/${encodeURIComponent(symbol)}/strategies`, {
		query: {
			strike,
			expiration_gte: expirationGte,
			expiration_lte: expirationLte,
			sentiment: sentiment || undefined,
			dte,
			timeframe: timeframe || undefined
		},
		signal,
		label: 'Strategies failed'
	});
}

/** Pro-gated LLM explanation of why the recommended strategies fit this symbol/strike.
 * Pass `strategy` to explore a specific strategy instead of the recommendations. */
export function getStrategiesExplanation(
	symbol: string,
	strike: number,
	strategy?: string,
	signal?: AbortSignal
): Promise<{ symbol: string; strategies: unknown[]; analysis: string; model: string }> {
	const body: Record<string, unknown> = { symbol, strike };
	if (strategy) body.strategy = strategy;
	return request<{ symbol: string; strategies: unknown[]; analysis: string; model: string }>(
		'/api/v1/analysis/options-strategies',
		{ method: 'POST', body, signal, auth: true, label: 'Strategy explanation failed' }
	).catch(proGate);
}

/** Stream the options-strategy explanation over SSE (same event shape as
 * streamAIAnalysis): onChunk gets each progressive piece, resolves with the
 * full text when the stream completes. Streamed with fetch (not EventSource)
 * so the Authorization header can be sent. */
export async function streamOptionsStrategiesExplanation(
	symbol: string,
	strike: number,
	onChunk: (text: string) => void,
	strategy?: string,
	signal?: AbortSignal,
	timeframe?: string
): Promise<string> {
	const body: Record<string, unknown> = { symbol, strike };
	if (strategy) body.strategy = strategy;
	if (timeframe) body.timeframe = timeframe;
	const resp = await send('/api/v1/analysis/options-strategies/stream', {
		method: 'POST',
		body,
		signal,
		auth: true,
		label: 'Strategy explanation failed'
	}).catch(proGate);
	if (!resp.body) throw new Error('Streaming not supported');
	return readChunks(resp, onChunk);
}

// --- Portfolio ------------------------------------------------------------

export function getStance(trade: SavedTrade, currentPrice = 0): Promise<StanceResponse> {
	return request('/api/v1/portfolio/stance', {
		method: 'POST',
		body: {
			symbol: trade.symbol,
			entry_price: trade.entryPrice,
			current_price: currentPrice,
			trade_type: trade.type,
			contract: trade.contract ? { expiration_date: trade.contract } : null
		},
		label: 'Stance failed'
	});
}

// --- AI -------------------------------------------------------------------

export function getAIAnalysis(
	symbol: string,
	assetType: AssetType = 'stock',
	signal?: AbortSignal,
	timeframe: string = '1d'
): Promise<AIAnalysisResponse> {
	return request('/api/v1/analysis/ai', {
		method: 'POST',
		body: { symbol, asset_type: assetType, timeframe },
		signal,
		auth: true,
		label: 'AI analysis failed'
	});
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
	signal?: AbortSignal,
	timeframe: string = '1d'
): Promise<string> {
	const resp = await send('/api/v1/analysis/ai/stream', {
		method: 'POST',
		body: { symbol, asset_type: assetType, timeframe },
		signal,
		auth: true,
		label: 'AI analysis failed'
	});
	if (!resp.body) return getAIAnalysis(symbol, assetType, signal, timeframe).then((r) => r.analysis);
	return readChunks(resp, onChunk);
}

// --- Assets ---------------------------------------------------------------

/**
 * Search assets. Returns `null` when the backend is unreachable (e.g. Render
 * cold start still booting) so the UI can show a "waking server" state instead
 * of silently pretending there are no matches. 60s cap: Render free cold
 * starts usually finish within that; a black-holed connection must not spin
 * forever.
 */
export async function searchAssets(q: string): Promise<AssetInfo[] | null> {
	try {
		const data = await request<AssetSearchResponse>('/api/v1/assets/search', {
			query: { q },
			signal: AbortSignal.timeout(60_000)
		});
		return data.assets || [];
	} catch {
		return null;
	}
}
