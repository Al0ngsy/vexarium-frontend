// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import { getToken, setSession } from '$lib/auth.svelte';
import { clearSessionToken } from '$lib/session';
import { jsonResponse, meBody, stubFetch, submit, tick, type, type FetchCall } from '../../test/dom';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

let target: HTMLElement;
let app: ReturnType<typeof mount>;
let me: Record<string, unknown>;
let extra: (c: FetchCall) => Response | undefined;
let calls: FetchCall[];

async function open(user: Record<string, unknown> | null) {
	me = meBody(user ?? {});
	calls = stubFetch((c) => (c.path === '/api/v1/auth/me' && c.method === 'GET' ? jsonResponse(me) : (extra(c) ?? jsonResponse({}))));
	if (user) await setSession('tok', String(me.tier));
	app = mount(Page, { target });
	flushSync();
	await tick();
}
const text = () => target.textContent!.replace(/\s+/g, ' ');
const buttonByText = (re: RegExp, root: ParentNode = document.body) =>
	[...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => re.test(b.textContent ?? ''))!;

beforeEach(() => {
	localStorage.clear();
	extra = () => undefined;
	vi.mocked(goto).mockReset();
	target = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
	unmount(app);
	target.remove();
	document.body.querySelectorAll('[role="dialog"]').forEach((d) => d.remove());
	clearSessionToken();
	vi.unstubAllGlobals();
});

describe('/account', () => {
	it('sends visitors without a session to the login page and back', async () => {
		await open(null);
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/login?next=%2Faccount', { replaceState: true }));
		expect(target.querySelector('h2')).toBeNull();
	});

	it('shows email, plan and subscription for a free user, with an upgrade link and no billing button', async () => {
		await open({ email: 'free@example.com' });
		expect(text()).toContain('free@example.com');
		expect(text()).toContain('Free');
		expect(text()).toContain('No subscription');
		expect(buttonByText(/manage subscription/i, target)).toBeUndefined();
		expect(target.querySelector('a[href="/pricing"]')).not.toBeNull();
		expect(calls.find((c) => c.path === '/api/v1/auth/me' && c.authorization === 'Bearer tok')).toBeDefined();
	});

	it('shows status and period end and opens the billing portal for a subscriber', async () => {
		const location = { href: 'http://localhost/account' };
		vi.stubGlobal('location', location);
		extra = (c) => (c.path === '/api/v1/billing/portal' ? jsonResponse({ portal_url: 'https://billing.stripe.test/p/1' }) : undefined);
		await open({ tier: 'pro', subscription_status: 'active', current_period_end: '2026-11-12T10:00:00Z' });
		expect(text()).toContain('Pro');
		expect(text()).toContain('Active');
		expect(text()).toContain('12 Nov 2026');
		buttonByText(/manage subscription/i, target).click();
		await vi.waitFor(() => expect(location.href).toBe('https://billing.stripe.test/p/1'));
		expect(calls.find((c) => c.path === '/api/v1/billing/portal')).toMatchObject({ method: 'POST', authorization: 'Bearer tok' });
	});

	it('shows the billing button for a pro user without subscription data and explains a portal 400', async () => {
		extra = (c) => (c.path === '/api/v1/billing/portal' ? jsonResponse({ detail: 'No billing account yet' }, 400) : undefined);
		await open({ tier: 'pro' });
		buttonByText(/manage subscription/i, target).click();
		await vi.waitFor(() => expect(text()).toContain('No billing account yet'));
		expect(buttonByText(/manage subscription/i, target).disabled).toBe(false);
	});

	it('changes the password with autocomplete hints and clears the fields', async () => {
		extra = (c) => (c.path === '/api/v1/auth/change-password' ? jsonResponse(null, 204) : undefined);
		await open({});
		expect(target.querySelector<HTMLInputElement>('#current-password')!.autocomplete).toBe('current-password');
		expect(target.querySelector<HTMLInputElement>('#change-new-password')!.autocomplete).toBe('new-password');
		type(target, '#current-password', 'old-password');
		type(target, '#change-new-password', 'new-password-1');
		submit(target.querySelectorAll('form')[0]);
		await vi.waitFor(() => expect(text()).toContain('Password changed.'));
		const call = calls.find((c) => c.path === '/api/v1/auth/change-password')!;
		expect(call).toMatchObject({ method: 'POST', authorization: 'Bearer tok' });
		expect(call.body).toEqual({ current_password: 'old-password', new_password: 'new-password-1' });
		expect(target.querySelector<HTMLInputElement>('#current-password')!.value).toBe('');
	});

	it('shows the server message for a wrong current password and stays logged in', async () => {
		extra = (c) => (c.path === '/api/v1/auth/change-password' ? jsonResponse({ detail: 'Current password is incorrect' }, 400) : undefined);
		await open({});
		type(target, '#current-password', 'wrong');
		type(target, '#change-new-password', 'new-password-1');
		submit(target.querySelectorAll('form')[0]);
		await vi.waitFor(() => expect(text()).toContain('Current password is incorrect'));
		expect(getToken()).toBe('tok');
	});

	it('logs out and returns to the start page', async () => {
		await open({});
		buttonByText(/log out/i, target).click();
		expect(getToken()).toBeNull();
		expect(goto).toHaveBeenCalledWith('/');
		expect(goto).not.toHaveBeenCalledWith('/login?next=%2Faccount', expect.anything());
	});

	describe('delete account', () => {
		const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

		it('asks for confirmation, a password, and can be cancelled with Escape without a request', async () => {
			await open({});
			expect(dialog()).toBeNull();
			buttonByText(/delete account…/i, target).click();
			flushSync();
			expect(dialog()?.getAttribute('aria-modal')).toBe('true');
			expect(dialog()!.textContent).toMatch(/cannot be\s+undone/i);
			expect(dialog()!.querySelector<HTMLInputElement>('input')!.autocomplete).toBe('current-password');
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			flushSync();
			expect(dialog()).toBeNull();
			expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
		});

		it('keeps the dialog and the session after a wrong password', async () => {
			extra = (c) => (c.method === 'DELETE' ? jsonResponse({ detail: 'Incorrect password' }, 401) : undefined);
			await open({});
			buttonByText(/delete account…/i, target).click();
			flushSync();
			type(dialog()!, 'input', 'nope');
			submit(dialog()!.querySelector('form'));
			await vi.waitFor(() => expect(dialog()!.textContent).toContain('Incorrect password'));
			expect(getToken()).toBe('tok');
			expect(goto).not.toHaveBeenCalled();
		});

		it('deletes the account with the password, logs out and leaves', async () => {
			extra = (c) => (c.method === 'DELETE' ? jsonResponse(null, 204) : undefined);
			await open({});
			buttonByText(/delete account…/i, target).click();
			flushSync();
			type(dialog()!, 'input', 'my-password');
			submit(dialog()!.querySelector('form'));
			await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
			const del = calls.find((c) => c.method === 'DELETE')!;
			expect(del).toMatchObject({ path: '/api/v1/auth/me', authorization: 'Bearer tok' });
			expect(del.body).toEqual({ password: 'my-password' });
			expect(getToken()).toBeNull();
			expect(localStorage.getItem('vexarium_token')).toBeNull();
		});
	});
});
