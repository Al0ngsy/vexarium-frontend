// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { getToken } from '$lib/auth.svelte';
import { clearSessionToken } from '$lib/session';
import { jsonResponse, meBody, stubFetch, submit, type } from '../../test/dom';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/register') } }));

let target: HTMLElement;
let app: ReturnType<typeof mount>;

function open(search = '') {
	(page as { url: URL }).url = new URL(`http://localhost/register${search}`);
	app = mount(Page, { target });
	flushSync();
}
const fill = (pw = 'long-enough-pw') => {
	type(target, '#email', 'new@example.com');
	type(target, '#password', pw);
};
const alertText = () => target.querySelector('[aria-live]')?.textContent?.trim();
const registered = (c: { path: string }) =>
	c.path === '/api/v1/auth/register'
		? jsonResponse({ access_token: 'tok', token_type: 'bearer', tier: 'free' }, 201)
		: jsonResponse(meBody({ email: 'new@example.com' }));

beforeEach(() => {
	localStorage.clear();
	vi.mocked(goto).mockReset();
	target = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
	unmount(app);
	target.remove();
	clearSessionToken();
	vi.unstubAllGlobals();
});

describe('/register', () => {
	it('uses new-password autocomplete, a minimum length and a hint', () => {
		open();
		const pw = target.querySelector<HTMLInputElement>('#password')!;
		expect(pw.autocomplete).toBe('new-password');
		expect(pw.minLength).toBe(8);
		expect(pw.getAttribute('aria-describedby')).toBe('password-hint');
		expect(target.querySelector('#password-hint')?.textContent).toContain('8');
		expect(target.querySelector<HTMLInputElement>('#email')!.autocomplete).toBe('email');
	});

	it('registers, logs in and goes to the start page', async () => {
		const calls = stubFetch(registered);
		open();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
		expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/register', authorization: null });
		expect(calls[0].body).toEqual({ email: 'new@example.com', password: 'long-enough-pw' });
		expect(getToken()).toBe('tok');
	});

	it('honours ?next=/pricing and rejects an external target', async () => {
		stubFetch(registered);
		open('?next=/pricing');
		expect(target.querySelector('a[href="/login?next=%2Fpricing"]')).not.toBeNull();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/pricing'));

		unmount(app);
		vi.mocked(goto).mockReset();
		clearSessionToken();
		open('?next=//evil.com');
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
	});

	it('shows the server detail for a weak password or a taken email', async () => {
		stubFetch(() => jsonResponse({ detail: 'Password must be at least 8 characters' }, 400));
		open();
		fill('short');
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(alertText()).toBe('Password must be at least 8 characters'));
		expect(goto).not.toHaveBeenCalled();
		expect(getToken()).toBeNull();
	});

	it('explains a 429', async () => {
		stubFetch(() => jsonResponse({ detail: 'Rate limit exceeded' }, 429));
		open();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(alertText()).toMatch(/too many attempts/i));
	});
});
