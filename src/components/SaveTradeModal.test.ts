// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSession } from '$lib/auth.svelte';
import { clearSessionToken } from '$lib/session';
import { jsonResponse, meBody, stubFetch, tick, type, type FetchCall } from '../test/dom';
import SaveTradeModal from './SaveTradeModal.svelte';

let target: HTMLElement;
let app: ReturnType<typeof mount>;
let calls: FetchCall[];
let extra: (c: FetchCall) => Response | undefined;
const onClose = vi.fn();

async function open({ signedIn, contract = null }: { signedIn: boolean; contract?: string | null }) {
	calls = stubFetch((c) => extra(c) ?? (c.path === '/api/v1/auth/me' ? jsonResponse(meBody()) : jsonResponse({ id: 5, user_id: 1, symbol: 'AAPL', trade_type: 'stock', entry_date: '2026-01-01', entry_price: 1, quantity: 1 }, 201)));
	if (signedIn) await setSession('tok', 'free');
	app = mount(SaveTradeModal, { target, props: { open: true, symbol: 'AAPL', entryPrice: 123.45, contract, onClose } });
	flushSync();
}
const save = () => [...target.querySelectorAll<HTMLButtonElement>('button')].find((b) => /^(SAVE|SAVING…)$/.test(b.textContent!.trim()))!;

beforeEach(() => {
	localStorage.clear();
	onClose.mockReset();
	extra = () => undefined;
	target = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
	unmount(app);
	target.remove();
	clearSessionToken();
	vi.unstubAllGlobals();
});

describe('SaveTradeModal', () => {
	it('signed out: saves to this device, says so, makes no request', async () => {
		await open({ signedIn: false });
		expect(target.textContent).toMatch(/saved on this device only/i);
		save().click();
		await tick();
		const stored = JSON.parse(localStorage.getItem('vexarium_trades')!);
		expect(stored).toHaveLength(1);
		expect(stored[0]).toMatchObject({ symbol: 'AAPL', type: 'stock', entryPrice: 123.45, quantity: 1 });
		expect(calls).toHaveLength(0);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('signed in: posts the trade to the account and keeps localStorage empty', async () => {
		await open({ signedIn: true });
		expect(target.textContent).toMatch(/saved to your account/i);
		save().click();
		await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		const post = calls.find((c) => c.method === 'POST' && c.path === '/api/v1/trades')!;
		expect(post.authorization).toBe('Bearer tok');
		expect(post.body).toMatchObject({ symbol: 'AAPL', trade_type: 'stock', entry_price: 123.45, quantity: 1 });
		expect(localStorage.getItem('vexarium_trades')).toBeNull();
	});

	it('sends the option contract as trade_type option', async () => {
		await open({ signedIn: true, contract: 'AAPL260116C00200000' });
		save().click();
		await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ trade_type: 'option', contract: 'AAPL260116C00200000' });
	});

	it('disables SAVE while the request runs so a double click saves once', async () => {
		let release!: (r: Response) => void;
		await open({ signedIn: true });
		stubFetch(() => new Promise<Response>((r) => (release = r)));
		save().click();
		save().click();
		flushSync();
		expect(save().disabled).toBe(true);
		release(jsonResponse({ id: 5, user_id: 1, symbol: 'AAPL', trade_type: 'stock', entry_date: '2026-01-01', entry_price: 1, quantity: 1 }, 201));
		await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
	});

	it('keeps the dialog open and shows the reason when the server refuses', async () => {
		extra = (c) => (c.method === 'POST' ? jsonResponse({ detail: 'Invalid symbol format: AAPL' }, 422) : undefined);
		await open({ signedIn: true });
		save().click();
		await vi.waitFor(() => expect(target.textContent).toContain('Invalid symbol format: AAPL'));
		expect(onClose).not.toHaveBeenCalled();
		expect(save().disabled).toBe(false);
	});

	it('does nothing for an invalid price', async () => {
		await open({ signedIn: true });
		type(target, 'input[placeholder="0.00"]', '0');
		save().click();
		await tick();
		expect(calls.some((c) => c.method === 'POST')).toBe(false);
		expect(onClose).not.toHaveBeenCalled();
	});
});
