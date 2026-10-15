import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ApiError,
	analyze,
	changePassword,
	confirmPasswordReset,
	createCheckoutSession,
	createPortalSession,
	createTrade,
	deleteAccount,
	deleteTradeById,
	getAIAnalysis,
	getBars,
	getFearGreed,
	getFinnhub,
	getMarketNews,
	getMe,
	getOptionChain,
	getOptionChance,
	getOptionPayoff,
	getOptionValueAtPrice,
	getOptionsMatrix,
	getStance,
	getStrategies,
	getStrategiesExplanation,
	isAbortError,
	listTrades,
	login,
	register,
	requestPasswordReset,
	request,
	searchAssets,
	streamAIAnalysis,
	streamOptionsStrategiesExplanation
} from './api';
import { clearSessionToken, getSessionToken, onSessionCleared, setSessionToken } from './session';
import type { SavedTrade } from './types';

const BASE = 'http://localhost:8000';
const TOKEN = 'jwt.header.payload';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function mockFetch(handler: Handler = () => json({ ok: true })) {
	const fn = vi.fn(async (input: string | URL, init: RequestInit = {}) => handler(String(input), init));
	vi.stubGlobal('fetch', fn);
	return fn;
}
const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

function lastCall(fn: ReturnType<typeof mockFetch>) {
	const [input, init] = fn.mock.calls[fn.mock.calls.length - 1] as [string, RequestInit];
	return { url: String(input), init, headers: new Headers(init.headers), body: init.body as string | undefined };
}

function sse(chunks: string[]): Response {
	const enc = new TextEncoder();
	return new Response(
		new ReadableStream({
			start(c) {
				for (const x of chunks) c.enqueue(enc.encode(x));
				c.close();
			}
		}),
		{ status: 200, headers: { 'Content-Type': 'text/event-stream' } }
	);
}

beforeEach(() => clearSessionToken());
afterEach(() => {
	vi.unstubAllGlobals();
	clearSessionToken();
});

describe('request(): headers and URL', () => {
	it('auth: true sends the stored token as Authorization: Bearer and never in the URL', async () => {
		setSessionToken(TOKEN);
		const fetchMock = mockFetch();
		await request('/api/v1/thing', { query: { a: 1 }, auth: true });
		const { url, headers } = lastCall(fetchMock);
		expect(headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
		expect(url).toBe(`${BASE}/api/v1/thing?a=1`);
		expect(url).not.toContain(TOKEN);
		expect(url).not.toContain('token');
	});

	it('sends no Authorization header with auth: true but no session', async () => {
		const fetchMock = mockFetch();
		await request('/api/v1/thing', { auth: true });
		expect(lastCall(fetchMock).headers.has('Authorization')).toBe(false);
	});

	it('is anonymous by default, even with a stored token (no CORS preflight)', async () => {
		setSessionToken(TOKEN);
		const fetchMock = mockFetch();
		await request('/api/v1/public');
		expect(lastCall(fetchMock).headers.has('Authorization')).toBe(false);
		await request('/api/v1/public', { auth: false });
		expect(lastCall(fetchMock).headers.has('Authorization')).toBe(false);
	});

	it('auth: <string> sends exactly that token', async () => {
		setSessionToken(TOKEN);
		const fetchMock = mockFetch();
		await request('/api/v1/x', { auth: 'fresh-token' });
		expect(lastCall(fetchMock).headers.get('Authorization')).toBe('Bearer fresh-token');
	});

	it('serialises JSON bodies with a Content-Type, and omits both for GET', async () => {
		const fetchMock = mockFetch();
		await request('/api/v1/p', { method: 'POST', body: { symbol: 'AAPL', n: 2 } });
		let c = lastCall(fetchMock);
		expect(c.init.method).toBe('POST');
		expect(c.headers.get('Content-Type')).toBe('application/json');
		expect(JSON.parse(c.body!)).toEqual({ symbol: 'AAPL', n: 2 });

		await request('/api/v1/g');
		c = lastCall(fetchMock);
		expect(c.init.method).toBe('GET');
		expect(c.headers.has('Content-Type')).toBe(false);
		expect(c.body).toBeUndefined();
	});

	it('skips undefined/null query values and encodes the rest', async () => {
		const fetchMock = mockFetch();
		await request('/api/v1/q', { query: { a: 'x y&z', b: undefined, c: null, d: 0, e: false } });
		expect(lastCall(fetchMock).url).toBe(`${BASE}/api/v1/q?a=x+y%26z&d=0&e=false`);
	});

	it('returns undefined for 204 and parsed JSON otherwise', async () => {
		mockFetch(() => new Response(null, { status: 204 }));
		await expect(request('/x')).resolves.toBeUndefined();
		mockFetch(() => json({ a: 1 }));
		await expect(request<{ a: number }>('/x')).resolves.toEqual({ a: 1 });
	});
});

describe('request(): errors', () => {
	it('throws ApiError with status and the FastAPI detail string', async () => {
		mockFetch(() => json({ detail: 'No data found for symbol: ZZZ' }, 404));
		const err = await analyze('ZZZ').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err).toBeInstanceOf(Error);
		expect(err.status).toBe(404);
		expect(err.detail).toBe('No data found for symbol: ZZZ');
		expect(err.message).toBe('Analysis failed: No data found for symbol: ZZZ');
	});

	it('joins the messages of a 422 validation list', async () => {
		mockFetch(() => json({ detail: [{ loc: ['body', 'symbol'], msg: 'field required' }, { msg: 'bad tf' }] }, 422));
		const err = (await request('/x', { method: 'POST', body: {}, label: 'Nope' }).catch((e) => e)) as ApiError;
		expect(err.status).toBe(422);
		expect(err.detail).toBe('field required; bad tf');
		expect(err.message).toBe('Nope: field required; bad tf');
	});

	it('falls back to the status code for a non-JSON error body', async () => {
		mockFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
		const err = (await request('/x', { label: 'Bars failed' }).catch((e) => e)) as ApiError;
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(502);
		expect(err.detail).toBeNull();
		expect(err.message).toBe('Bars failed: 502');
	});

	it('logs the session out on 401 when a stored token was sent', async () => {
		setSessionToken(TOKEN);
		const cleared = vi.fn();
		const off = onSessionCleared(cleared);
		mockFetch(() => json({ detail: 'Invalid or expired token' }, 401));
		await expect(request('/x', { auth: true })).rejects.toMatchObject({ status: 401 });
		expect(getSessionToken()).toBeNull();
		expect(cleared).toHaveBeenCalledOnce();
		off();
	});

	it('does not log out on 401 without a token, anonymously or with an explicit token', async () => {
		const cleared = vi.fn();
		const off = onSessionCleared(cleared);
		mockFetch(() => json({ detail: 'no' }, 401));

		await expect(request('/x', { auth: true })).rejects.toBeInstanceOf(ApiError);

		setSessionToken(TOKEN);
		await expect(request('/x', { auth: false })).rejects.toBeInstanceOf(ApiError);
		await expect(getMe('other-token')).rejects.toBeInstanceOf(ApiError);
		expect(getSessionToken()).toBe(TOKEN);
		expect(cleared).not.toHaveBeenCalled();
		off();
	});

	it('does not log out on other errors (403, 500)', async () => {
		setSessionToken(TOKEN);
		mockFetch(() => json({ detail: 'x' }, 500));
		await expect(request('/x', { auth: true })).rejects.toBeInstanceOf(ApiError);
		mockFetch(() => json({ detail: 'x' }, 403));
		await expect(request('/x', { auth: true })).rejects.toBeInstanceOf(ApiError);
		expect(getSessionToken()).toBe(TOKEN);
	});

	it('maps 403 on Pro-gated endpoints to the PRO_FEATURE sentinel', async () => {
		mockFetch(() => json({ detail: 'Pro only' }, 403));
		const err = await getOptionChance('AAPL', 'AAPL260116C00200000').catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.message).toBe('PRO_FEATURE');
		expect(err.status).toBe(403);
		const err2 = await getStrategiesExplanation('AAPL', 200).catch((e) => e);
		expect(err2.message).toBe('PRO_FEATURE');
		const err3 = await streamOptionsStrategiesExplanation('AAPL', 200, () => {}).catch((e) => e);
		expect(err3.message).toBe('PRO_FEATURE');
	});
});

describe('request(): abort', () => {
	it('passes the AbortSignal to fetch and rejects with an AbortError when aborted', async () => {
		const fetchMock = mockFetch(
			(_url, init) =>
				new Promise<Response>((_res, rej) => {
					init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
				})
		);
		const ac = new AbortController();
		const p = getBars('AAPL', '1d', 300, ac.signal);
		expect(lastCall(fetchMock).init.signal).toBe(ac.signal);
		ac.abort();
		const err = await p.catch((e) => e);
		expect(isAbortError(err)).toBe(true);
		expect(err).not.toBeInstanceOf(ApiError);
	});

	it('rejects immediately for an already aborted signal', async () => {
		mockFetch((_u, init) => {
			if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
			return json({});
		});
		const ac = new AbortController();
		ac.abort();
		const err = await analyze('AAPL', 'stock', false, '1d', ac.signal).catch((e) => e);
		expect(isAbortError(err)).toBe(true);
	});

	it('does not treat ApiError or generic errors as aborts', () => {
		expect(isAbortError(new ApiError('x', 500))).toBe(false);
		expect(isAbortError(new Error('x'))).toBe(false);
		expect(isAbortError(null)).toBe(false);
	});
});

describe('endpoint functions', () => {
	const trade: SavedTrade = {
		id: '1',
		symbol: 'AAPL',
		type: 'stock',
		entryPrice: 100,
		entryDate: '2026-01-01',
		quantity: 1
	} as SavedTrade;

	it('only the user-aware endpoints send the bearer header; no token in any URL', async () => {
		setSessionToken(TOKEN);
		const fetchMock = mockFetch(() => json({}));
		const authed: [string, () => Promise<unknown>][] = [
			['getOptionChance', () => getOptionChance('AAPL', 'AAPL260116C00200000')],
			['getStrategiesExplanation', () => getStrategiesExplanation('AAPL', 200, 'LONG CALL')],
			['getAIAnalysis', () => getAIAnalysis('AAPL')],
			['getMe', () => getMe()],
			['changePassword', () => changePassword('old', 'newpassword')],
			['deleteAccount', () => deleteAccount('pw')],
			['createCheckoutSession', () => createCheckoutSession()],
			['createPortalSession', () => createPortalSession()],
			['listTrades', () => listTrades()],
			['createTrade', () => createTrade({ symbol: 'AAPL', trade_type: 'stock', entry_date: '2026-01-01', entry_price: 1, quantity: 1 })],
			['deleteTradeById', () => deleteTradeById(7)]
		];
		const anonymous: [string, () => Promise<unknown>][] = [
			['analyze', () => analyze('AAPL', 'stock', false, '1w')],
			['getBars', () => getBars('AAPL', '1h', 100)],
			['getFinnhub', () => getFinnhub('AAPL')],
			['getMarketNews', () => getMarketNews()],
			['getFearGreed', () => getFearGreed()],
			['getOptionChain', () => getOptionChain('AAPL', '2026-01-01', '2026-04-01')],
			['getOptionPayoff', () => getOptionPayoff('AAPL', 'AAPL260116C00200000')],
			['getOptionValueAtPrice', () => getOptionValueAtPrice('AAPL', 'AAPL260116C00200000', 210, '2026-01-10')],
			['getOptionsMatrix', () => getOptionsMatrix('AAPL', 'AAPL260116C00200000')],
			['getStrategies', () => getStrategies('AAPL', 200, '2026-01-16', '2026-01-16', undefined, 30, '1w')],
			['getStance', () => getStance(trade, 110)],
			['register', () => register('a@b.c', 'password1')],
			['login', () => login('a@b.c', 'password1')],
			['requestPasswordReset', () => requestPasswordReset('a@b.c')],
			['confirmPasswordReset', () => confirmPasswordReset('tok', 'newpassword')]
		];
		for (const [name, call] of [...authed, ...anonymous]) {
			fetchMock.mockClear();
			await call();
			const { url, headers } = lastCall(fetchMock);
			const expected = authed.some(([n]) => n === name);
			expect(headers.get('Authorization'), name).toBe(expected ? `Bearer ${TOKEN}` : null);
			expect(url, name).not.toMatch(/token/i);
			expect(url, name).not.toContain(TOKEN);
			expect(url.startsWith(`${BASE}/api/v1/`), name).toBe(true);
		}
	});

	it('sends the new auth, billing and trades requests in the shape the backend expects', async () => {
		const fetchMock = mockFetch(() => json({}));
		const expectCall = (url: string, method: string, body?: unknown) => {
			const c = lastCall(fetchMock);
			expect(c.url).toBe(`${BASE}${url}`);
			expect(c.init.method).toBe(method);
			if (body !== undefined) expect(JSON.parse(c.body!)).toEqual(body);
		};
		await login('a@b.c', 'pw');
		expectCall('/api/v1/auth/login', 'POST', { email: 'a@b.c', password: 'pw' });
		await changePassword('old', 'new');
		expectCall('/api/v1/auth/change-password', 'POST', { current_password: 'old', new_password: 'new' });
		await deleteAccount('pw');
		expectCall('/api/v1/auth/me', 'DELETE', { password: 'pw' });
		await requestPasswordReset('a@b.c');
		expectCall('/api/v1/auth/password-reset/request', 'POST', { email: 'a@b.c' });
		await confirmPasswordReset('tok', 'new');
		expectCall('/api/v1/auth/password-reset/confirm', 'POST', { token: 'tok', new_password: 'new' });
		await createPortalSession();
		expectCall('/api/v1/billing/portal', 'POST');
		await listTrades();
		expectCall('/api/v1/trades', 'GET');
		await deleteTradeById(7);
		expectCall('/api/v1/trades/7', 'DELETE');
	});

	it('a wrong password (400) keeps the session; an invalid or expired token (401) logs out', async () => {
		setSessionToken(TOKEN);
		mockFetch(() => json({ detail: 'Current password is incorrect' }, 400));
		await expect(changePassword('x', 'y')).rejects.toMatchObject({ status: 400 });
		await expect(deleteAccount('x')).rejects.toMatchObject({ status: 400 });
		expect(getSessionToken()).toBe(TOKEN);

		mockFetch(() => json({ detail: 'Invalid or expired token' }, 401));
		await expect(changePassword('x', 'y')).rejects.toMatchObject({ status: 401 });
		expect(getSessionToken()).toBeNull();

		setSessionToken(TOKEN);
		await expect(deleteAccount('x')).rejects.toMatchObject({ status: 401 });
		expect(getSessionToken()).toBeNull();
	});

	it('streams send the bearer header and put no token in the URL', async () => {
		setSessionToken(TOKEN);
		const fetchMock = mockFetch(() => sse(['data: {"chunk":"x"}\n\n']));
		await streamAIAnalysis('AAPL', 'stock', () => {});
		let c = lastCall(fetchMock);
		expect(c.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
		expect(c.url).toBe(`${BASE}/api/v1/analysis/ai/stream`);
		await streamOptionsStrategiesExplanation('AAPL', 200, () => {}, 'LONG CALL', undefined, '1w');
		c = lastCall(fetchMock);
		expect(c.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
		expect(c.url).toBe(`${BASE}/api/v1/analysis/options-strategies/stream`);
		expect(JSON.parse(c.body!)).toEqual({ symbol: 'AAPL', strike: 200, strategy: 'LONG CALL', timeframe: '1w' });
	});

	it('register and searchAssets are anonymous', async () => {
		setSessionToken(TOKEN);
		const fetchMock = mockFetch(() => json({ assets: [] }));
		await register('a@b.c', 'pw');
		expect(lastCall(fetchMock).headers.has('Authorization')).toBe(false);
		await searchAssets('app');
		expect(lastCall(fetchMock).headers.has('Authorization')).toBe(false);
	});

	it('keep the request shapes the backend expects', async () => {
		const fetchMock = mockFetch(() => json({}));
		await analyze('AAPL', 'etf', true, '1mo');
		let c = lastCall(fetchMock);
		expect(c.url).toBe(`${BASE}/api/v1/analysis`);
		expect(JSON.parse(c.body!)).toEqual({ symbol: 'AAPL', asset_type: 'etf', options_enabled: true, timeframe: '1mo' });

		await getBars('BRK.B', '1h', 50);
		c = lastCall(fetchMock);
		expect(c.url).toBe(`${BASE}/api/v1/analysis/bars/BRK.B?timeframe=1h&limit=50`);
		expect(c.init.cache).toBe('no-store');

		await getStrategies('AAPL', 200, '2026-01-16', '2026-01-16', undefined, 0, undefined);
		expect(lastCall(fetchMock).url).toBe(
			`${BASE}/api/v1/options/AAPL/strategies?strike=200&expiration_gte=2026-01-16&expiration_lte=2026-01-16&dte=0`
		);

		await getOptionValueAtPrice('AAPL', 'C1', 12.5);
		expect(lastCall(fetchMock).url).toBe(`${BASE}/api/v1/options/AAPL/value?contract_symbol=C1&target_price=12.5`);

		await getOptionsMatrix('AAPL', 'C1', 0.1, 50, 4);
		c = lastCall(fetchMock);
		expect(c.url).toBe(`${BASE}/api/v1/options/AAPL/matrix`);
		expect(JSON.parse(c.body!)).toEqual({ contract_symbol: 'C1', range_pct: 0.1, quantity: 50, dates: 4 });
	});

	it('searchAssets returns the assets, [] for none, and null on any failure', async () => {
		mockFetch(() => json({ assets: [{ symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', asset_type: 'stock' }] }));
		await expect(searchAssets('app')).resolves.toHaveLength(1);
		mockFetch(() => json({}));
		await expect(searchAssets('zz')).resolves.toEqual([]);
		mockFetch(() => json({ detail: 'x' }, 500));
		await expect(searchAssets('zz')).resolves.toBeNull();
		mockFetch(() => {
			throw new TypeError('network down');
		});
		await expect(searchAssets('zz')).resolves.toBeNull();
	});
});

describe('SSE streams over fetch', () => {
	it('delivers chunks in order and resolves with the full text', async () => {
		mockFetch(() =>
			sse([
				'data: {"chunk":"Hel"}\n\n',
				'data: {"chunk":"lo"}\r\n\r\n',
				': keepalive\n\n',
				'data: not json\n\n',
				'data: {"chunk":""}\n\n',
				'data: {"chunk":"!"}\n\n'
			])
		);
		const got: string[] = [];
		const full = await streamAIAnalysis('AAPL', 'stock', (c) => got.push(c));
		expect(got).toEqual(['Hel', 'lo', '!']);
		expect(full).toBe('Hello!');
	});

	it('reassembles events split across network chunks, including the unterminated tail', async () => {
		mockFetch(() => sse(['data: {"chu', 'nk":"ab"}\n', '\ndata: {"chunk":"cd"}']));
		const got: string[] = [];
		const full = await streamAIAnalysis('AAPL', 'stock', (c) => got.push(c));
		expect(got).toEqual(['ab', 'cd']);
		expect(full).toBe('abcd');
	});

	it('rejects with ApiError on a non-2xx stream response', async () => {
		mockFetch(() => json({ detail: 'Rate limit exceeded' }, 429));
		const err = await streamAIAnalysis('AAPL', 'stock', () => {}).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err.status).toBe(429);
		expect(err.message).toBe('AI analysis failed: Rate limit exceeded');
	});

	it('aborts the stream via the signal', async () => {
		mockFetch((_u, init) => {
			const body = new ReadableStream({
				start(c) {
					init.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
				}
			});
			return new Response(body, { status: 200 });
		});
		const ac = new AbortController();
		const p = streamAIAnalysis('AAPL', 'stock', () => {}, ac.signal);
		await new Promise((r) => setTimeout(r, 0));
		ac.abort();
		expect(isAbortError(await p.catch((e) => e))).toBe(true);
	});
});
