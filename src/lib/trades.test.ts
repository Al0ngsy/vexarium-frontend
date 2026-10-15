// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionToken, setSessionToken } from './session';
import { getTrades } from './storage';
import { addTrade, loadTrades, localTrades, removeTrade, uploadLocalTrades, usesServerTrades } from './trades';
import type { SavedTrade } from './types';
import { jsonResponse, stubFetch, type FetchCall } from '../test/dom';

const local = (over: Partial<SavedTrade> = {}): SavedTrade => ({
	id: 'u-1',
	symbol: 'AAPL',
	type: 'stock',
	entryDate: '2026-03-01T10:00:00.000Z',
	entryPrice: 150,
	quantity: 2,
	...over
});

const serverTrade = (over: Record<string, unknown> = {}) => ({
	id: 7,
	user_id: 1,
	symbol: 'MSFT',
	trade_type: 'option',
	entry_date: '2026-04-02T00:00:00Z',
	entry_price: 3.5,
	quantity: 1,
	contract: 'MSFT260116C00400000',
	notes: null,
	created_at: '2026-04-02T00:00:00Z',
	...over
});

beforeEach(() => {
	localStorage.clear();
	clearSessionToken();
});
afterEach(() => {
	vi.unstubAllGlobals();
	clearSessionToken();
});

describe('signed out: trades stay on this device', () => {
	it('adds, loads and removes through localStorage without any request', async () => {
		const calls = stubFetch(() => jsonResponse({}));
		expect(usesServerTrades()).toBe(false);
		const saved = await addTrade({ symbol: 'AAPL', type: 'stock', entryDate: '2026-03-01', entryPrice: 10, quantity: 1 });
		expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
		expect((await loadTrades()).map((t) => t.symbol)).toEqual(['AAPL']);
		await removeTrade(saved.id);
		expect(await loadTrades()).toEqual([]);
		expect(calls).toHaveLength(0);
	});
});

describe('signed in: trades live on the server', () => {
	beforeEach(() => setSessionToken('tok'));

	it('loads and maps server trades, ids become strings', async () => {
		const calls = stubFetch(() => jsonResponse([serverTrade(), serverTrade({ id: 8, symbol: 'KO', trade_type: 'stock', contract: null })]));
		const trades = await loadTrades();
		expect(calls[0]).toMatchObject({ method: 'GET', path: '/api/v1/trades', authorization: 'Bearer tok' });
		expect(trades[0]).toEqual({
			id: '7',
			symbol: 'MSFT',
			type: 'option',
			entryDate: '2026-04-02T00:00:00Z',
			entryPrice: 3.5,
			quantity: 1,
			contract: 'MSFT260116C00400000'
		});
		expect(trades[1]).toMatchObject({ id: '8', type: 'stock', contract: undefined });
	});

	it('creates a trade on the server in the TradeCreate shape and does not touch localStorage', async () => {
		const calls = stubFetch(() => jsonResponse(serverTrade({ id: 9, symbol: 'AAPL', trade_type: 'stock', contract: null }), 201));
		const saved = await addTrade({ symbol: 'AAPL', type: 'stock', entryDate: '2026-03-01', entryPrice: 10, quantity: 2 });
		expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/trades', authorization: 'Bearer tok' });
		expect(calls[0].body).toEqual({ symbol: 'AAPL', trade_type: 'stock', entry_date: '2026-03-01', entry_price: 10, quantity: 2 });
		expect(saved.id).toBe('9');
		expect(getTrades()).toEqual([]);
	});

	it('sends the contract for options', async () => {
		const calls = stubFetch(() => jsonResponse(serverTrade(), 201));
		await addTrade({ symbol: 'MSFT', type: 'option', entryDate: '2026-04-02', entryPrice: 3.5, quantity: 1, contract: 'MSFT260116C00400000' });
		expect(calls[0].body).toMatchObject({ trade_type: 'option', contract: 'MSFT260116C00400000' });
	});

	it('deletes by numeric id', async () => {
		const calls = stubFetch(() => jsonResponse(null, 204));
		await removeTrade('7');
		expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/api/v1/trades/7', authorization: 'Bearer tok' });
	});

	it('surfaces server errors', async () => {
		stubFetch(() => jsonResponse({ detail: 'Trade not found' }, 404));
		await expect(removeTrade('7')).rejects.toMatchObject({ status: 404, detail: 'Trade not found' });
	});
});

describe('uploadLocalTrades', () => {
	beforeEach(() => setSessionToken('tok'));
	const seed = (...trades: SavedTrade[]) => localStorage.setItem('vexarium_trades', JSON.stringify(trades));

	it('uploads every local trade and empties the local list', async () => {
		seed(local({ id: 'a' }), local({ id: 'b', symbol: 'KO', type: 'option', contract: '2026-06-19' }));
		const calls = stubFetch(() => jsonResponse(serverTrade(), 201));
		expect(await uploadLocalTrades()).toEqual({ uploaded: 2, failed: 0 });
		expect(calls.map((c) => c.path)).toEqual(['/api/v1/trades', '/api/v1/trades']);
		expect(calls[0].body).toEqual({
			symbol: 'AAPL',
			trade_type: 'stock',
			entry_date: '2026-03-01T10:00:00.000Z',
			entry_price: 150,
			quantity: 2
		});
		expect(calls[1].body).toMatchObject({ symbol: 'KO', trade_type: 'option', contract: '2026-06-19' });
		expect(localTrades()).toEqual([]);
	});

	it('keeps exactly the trades the server rejected, so a retry cannot duplicate', async () => {
		seed(local({ id: 'a' }), local({ id: 'b', symbol: 'BAD' }), local({ id: 'c', symbol: 'KO' }));
		stubFetch((c: FetchCall) =>
			(c.body as { symbol: string }).symbol === 'BAD' ? jsonResponse({ detail: 'Invalid symbol' }, 422) : jsonResponse(serverTrade(), 201)
		);
		expect(await uploadLocalTrades()).toEqual({ uploaded: 2, failed: 1 });
		expect(localTrades().map((t) => t.id)).toEqual(['b']);

		const calls = stubFetch(() => jsonResponse(serverTrade(), 201));
		expect(await uploadLocalTrades()).toEqual({ uploaded: 1, failed: 0 });
		expect(calls).toHaveLength(1);
	});

	it('counts network failures as failed and keeps the trade', async () => {
		seed(local());
		vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
		expect(await uploadLocalTrades()).toEqual({ uploaded: 0, failed: 1 });
		expect(localTrades()).toHaveLength(1);
	});

	it('does nothing when there are no local trades', async () => {
		const calls = stubFetch(() => jsonResponse({}));
		expect(await uploadLocalTrades()).toEqual({ uploaded: 0, failed: 0 });
		expect(calls).toHaveLength(0);
	});
});
