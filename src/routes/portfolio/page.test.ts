// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSession } from '$lib/auth.svelte';
import { clearSessionToken } from '$lib/session';
import type { SavedTrade } from '$lib/types';
import { jsonResponse, meBody, stubFetch, tick, type FetchCall } from '../../test/dom';
import Page from './+page.svelte';

let target: HTMLElement;
let app: ReturnType<typeof mount>;
let calls: FetchCall[];
let serverTrades: Record<string, unknown>[];
let extra: (c: FetchCall) => Response | undefined;

const serverTrade = (id: number, symbol: string) => ({
	id,
	user_id: 1,
	symbol,
	trade_type: 'stock',
	entry_date: '2026-04-02T00:00:00Z',
	entry_price: 100,
	quantity: 2,
	contract: null,
	notes: null,
	created_at: null
});
const localTrade = (id: string, symbol: string): SavedTrade => ({
	id,
	symbol,
	type: 'stock',
	entryDate: '2026-03-01T10:00:00.000Z',
	entryPrice: 50,
	quantity: 1
});
const seedLocal = (...t: SavedTrade[]) => localStorage.setItem('vexarium_trades', JSON.stringify(t));

async function open({ signedIn }: { signedIn: boolean }) {
	calls = stubFetch((c) => {
		const custom = extra(c);
		if (custom) return custom;
		if (c.path === '/api/v1/auth/me') return jsonResponse(meBody());
		if (c.path === '/api/v1/portfolio/stance')
			return jsonResponse({ stance: 'hold', reason: 'steady', pnl_pct: 0.05, take_profit_at: 1, cut_loss_at: 1 });
		if (c.path === '/api/v1/trades' && c.method === 'GET') return jsonResponse(serverTrades);
		if (c.path === '/api/v1/trades' && c.method === 'POST') return jsonResponse(serverTrade(99, 'NEW'), 201);
		if (c.path.startsWith('/api/v1/trades/') && c.method === 'DELETE') return jsonResponse(null, 204);
		return jsonResponse({}, 404);
	});
	if (signedIn) await setSession('tok', 'free');
	app = mount(Page, { target });
	flushSync();
	await tick();
	await tick();
}
const symbols = () => [...target.querySelectorAll('.brand')].map((e) => e.textContent!.trim()).filter((t) => /^[A-Z]{2,5}$/.test(t));
const text = () => target.textContent!.replace(/\s+/g, ' ');
const button = (re: RegExp) => [...target.querySelectorAll<HTMLButtonElement>('button')].find((b) => re.test(b.textContent ?? ''))!;
const tradeRequests = () => calls.filter((c) => c.path.startsWith('/api/v1/trades'));

beforeEach(() => {
	localStorage.clear();
	serverTrades = [serverTrade(1, 'AAPL'), serverTrade(2, 'MSFT')];
	extra = () => undefined;
	vi.stubGlobal('confirm', () => true);
	target = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
	unmount(app);
	target.remove();
	clearSessionToken();
	vi.unstubAllGlobals();
});

describe('/portfolio signed out', () => {
	it('shows the trades saved on this device and never calls the trades API', async () => {
		seedLocal(localTrade('a', 'KO'), localTrade('b', 'PEP'));
		await open({ signedIn: false });
		expect(symbols()).toEqual(['KO', 'PEP']);
		expect(tradeRequests()).toHaveLength(0);
		expect(calls.filter((c) => c.path === '/api/v1/portfolio/stance').every((c) => c.authorization === null)).toBe(true);
	});

	it('shows the empty state without trades', async () => {
		await open({ signedIn: false });
		expect(text()).toContain('NO SAVED TRADES.');
	});

	it('removes a local trade without a request or a page reload', async () => {
		seedLocal(localTrade('a', 'KO'), localTrade('b', 'PEP'));
		await open({ signedIn: false });
		button(/remove/i).click();
		await tick();
		expect(symbols()).toEqual(['PEP']);
		expect(JSON.parse(localStorage.getItem('vexarium_trades')!)).toHaveLength(1);
		expect(tradeRequests()).toHaveLength(0);
	});
});

describe('/portfolio signed in', () => {
	it('lists the account trades from the server with the bearer token', async () => {
		await open({ signedIn: true });
		expect(symbols()).toEqual(['AAPL', 'MSFT']);
		expect(tradeRequests()[0]).toMatchObject({ method: 'GET', path: '/api/v1/trades', authorization: 'Bearer tok' });
		expect(text()).toContain('$400.00'); // 2 trades x 100 x 2
	});

	it('does not offer an upload when nothing is stored locally', async () => {
		await open({ signedIn: true });
		expect(target.querySelector('[aria-label="Upload local trades"]')).toBeNull();
	});

	it('ignores device trades in the list but offers to upload them', async () => {
		seedLocal(localTrade('a', 'KO'));
		await open({ signedIn: true });
		expect(symbols()).toEqual(['AAPL', 'MSFT']);
		expect(target.querySelector('[aria-label="Upload local trades"]')?.textContent?.replace(/\s+/g, ' ')).toContain('1 trade is saved only on this device');
	});

	it('uploads the device trades once, clears them and reloads the list', async () => {
		seedLocal(localTrade('a', 'KO'), localTrade('b', 'PEP'));
		await open({ signedIn: true });
		button(/upload to my account/i).click();
		await vi.waitFor(() => expect(text()).toContain('2 trades uploaded to your account.'));
		const posts = calls.filter((c) => c.method === 'POST' && c.path === '/api/v1/trades');
		expect(posts.map((c) => (c.body as { symbol: string }).symbol)).toEqual(['KO', 'PEP']);
		expect(localStorage.getItem('vexarium_trades')).toBe('[]');
		expect(target.querySelector('[aria-label="Upload local trades"]')).toBeNull();
		expect(tradeRequests().filter((c) => c.method === 'GET')).toHaveLength(2); // initial load + reload

		// answered once: a later device trade is not offered again
		unmount(app);
		seedLocal(localTrade('c', 'T'));
		await open({ signedIn: true });
		expect(target.querySelector('[aria-label="Upload local trades"]')).toBeNull();
	});

	it('reports trades the server rejected and keeps them on the device', async () => {
		seedLocal(localTrade('a', 'KO'), localTrade('b', 'BAD'));
		extra = (c) =>
			c.method === 'POST' && (c.body as { symbol: string }).symbol === 'BAD' ? jsonResponse({ detail: 'Invalid symbol' }, 422) : undefined;
		await open({ signedIn: true });
		button(/upload to my account/i).click();
		await vi.waitFor(() => expect(text()).toContain('1 uploaded. 1 could not be uploaded and stay on this device.'));
		expect(JSON.parse(localStorage.getItem('vexarium_trades')!).map((t: SavedTrade) => t.id)).toEqual(['b']);
	});

	it('"Keep on this device" dismisses the offer for good and uploads nothing', async () => {
		seedLocal(localTrade('a', 'KO'));
		await open({ signedIn: true });
		button(/keep on this device/i).click();
		flushSync();
		expect(target.querySelector('[aria-label="Upload local trades"]')).toBeNull();
		expect(calls.some((c) => c.method === 'POST' && c.path === '/api/v1/trades')).toBe(false);
		expect(localStorage.getItem('vexarium_trades_offer_dismissed')).toBe('1');
		expect(JSON.parse(localStorage.getItem('vexarium_trades')!)).toHaveLength(1);
	});

	it('deletes a server trade by id and drops the card without reloading', async () => {
		await open({ signedIn: true });
		button(/remove/i).click();
		await vi.waitFor(() => expect(symbols()).toEqual(['MSFT']));
		expect(tradeRequests().find((c) => c.method === 'DELETE')).toMatchObject({ path: '/api/v1/trades/1', authorization: 'Bearer tok' });
	});

	it('keeps the trade and says why when the delete fails', async () => {
		extra = (c) => (c.method === 'DELETE' ? jsonResponse({ detail: 'Trade not found' }, 404) : undefined);
		await open({ signedIn: true });
		button(/remove/i).click();
		await vi.waitFor(() => expect(text()).toContain('Trade not found'));
		expect(symbols()).toEqual(['AAPL', 'MSFT']);
	});

	it('does not remove anything when the confirmation is declined', async () => {
		vi.stubGlobal('confirm', () => false);
		await open({ signedIn: true });
		button(/remove/i).click();
		await tick();
		expect(tradeRequests().some((c) => c.method === 'DELETE')).toBe(false);
		expect(symbols()).toEqual(['AAPL', 'MSFT']);
	});

	it('shows a load failure with a retry instead of an empty portfolio', async () => {
		extra = (c) => (c.method === 'GET' && c.path === '/api/v1/trades' ? jsonResponse({ detail: 'x' }, 500) : undefined);
		await open({ signedIn: true });
		expect(text()).toMatch(/server had a problem/i);
		expect(text()).not.toContain('NO SAVED TRADES');
		extra = () => undefined;
		button(/try again/i).click();
		await vi.waitFor(() => expect(symbols()).toEqual(['AAPL', 'MSFT']));
	});

	it('falls back to the device trades when the session ends while the page is open', async () => {
		seedLocal(localTrade('a', 'KO'));
		await open({ signedIn: true });
		expect(symbols()).toEqual(['AAPL', 'MSFT']);
		clearSessionToken();
		await vi.waitFor(() => expect(symbols()).toEqual(['KO']));
	});
});
