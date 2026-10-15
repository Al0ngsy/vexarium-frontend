// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { getToken, setSession } from '$lib/auth.svelte';
import { clearSessionToken } from '$lib/session';
import { jsonResponse, meBody, stubFetch, submit, tick, type } from '../../test/dom';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/login') } }));

let target: HTMLElement;
let app: ReturnType<typeof mount>;

function open(search = '') {
	(page as { url: URL }).url = new URL(`http://localhost/login${search}`);
	app = mount(Page, { target });
	flushSync();
}
const fill = () => {
	type(target, '#email', ' me@example.com ');
	type(target, '#password', 'secret-pw');
};
const alertText = () => target.querySelector('[aria-live]')?.textContent?.trim();

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

describe('/login', () => {
	it('has labelled fields with the right autocomplete hints', () => {
		open();
		const email = target.querySelector<HTMLInputElement>('#email')!;
		const pw = target.querySelector<HTMLInputElement>('#password')!;
		expect(target.querySelector('label[for="email"]')?.textContent).toBe('Email');
		expect(target.querySelector('label[for="password"]')?.textContent).toBe('Password');
		expect(email.type).toBe('email');
		expect(email.autocomplete).toBe('email');
		expect(pw.type).toBe('password');
		expect(pw.autocomplete).toBe('current-password');
		expect(target.querySelector('a[href="/forgot-password"]')).not.toBeNull();
		expect(target.querySelector('a[href="/register"]')).not.toBeNull();
	});

	it('logs in, stores the session and goes to the start page', async () => {
		const calls = stubFetch((c) =>
			c.path === '/api/v1/auth/login'
				? jsonResponse({ access_token: 'tok', token_type: 'bearer', tier: 'free' })
				: jsonResponse(meBody())
		);
		open();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
		expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/login', authorization: null });
		expect(calls[0].body).toEqual({ email: 'me@example.com', password: 'secret-pw' });
		expect(calls[1]).toMatchObject({ path: '/api/v1/auth/me', authorization: 'Bearer tok' });
		expect(getToken()).toBe('tok');
	});

	it('redirects to a valid ?next= and links register with it', async () => {
		stubFetch((c) =>
			c.path === '/api/v1/auth/login'
				? jsonResponse({ access_token: 'tok', token_type: 'bearer', tier: 'free' })
				: jsonResponse(meBody())
		);
		open('?next=/pricing');
		expect(target.querySelector('a[href="/register?next=%2Fpricing"]')).not.toBeNull();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/pricing'));
	});

	it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)'])(
		'ignores the unsafe ?next=%s',
		async (next) => {
			stubFetch((c) =>
				c.path === '/api/v1/auth/login'
					? jsonResponse({ access_token: 'tok', token_type: 'bearer', tier: 'free' })
					: jsonResponse(meBody())
			);
			open(`?next=${encodeURIComponent(next)}`);
			fill();
			submit(target.querySelector('form'));
			await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
			expect(goto).not.toHaveBeenCalledWith(next);
		}
	);

	it('shows a plain message for wrong credentials and keeps the user here', async () => {
		stubFetch(() => jsonResponse({ detail: 'Invalid credentials' }, 401));
		open();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(alertText()).toBe('Invalid email or password.'));
		expect(goto).not.toHaveBeenCalled();
		expect(getToken()).toBeNull();
	});

	it('explains a 429 rate limit', async () => {
		stubFetch(() => jsonResponse({ detail: 'Rate limit exceeded' }, 429));
		open();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(alertText()).toMatch(/too many attempts/i));
	});

	it('reports an unreachable server', async () => {
		vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
		open();
		fill();
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(alertText()).toMatch(/could not reach the server/i));
	});

	it('disables submit while the request runs and sends it only once', async () => {
		let release!: (r: Response) => void;
		const calls = stubFetch(() => new Promise<Response>((r) => (release = r)));
		open();
		fill();
		const button = target.querySelector<HTMLButtonElement>('button[type="submit"]')!;
		submit(target.querySelector('form'));
		submit(target.querySelector('form'));
		await tick();
		expect(button.disabled).toBe(true);
		expect(button.textContent?.trim()).toBe('Logging in…');
		expect(calls).toHaveLength(1);
		release(jsonResponse({ detail: 'Invalid credentials' }, 401));
		await vi.waitFor(() => expect(button.disabled).toBe(false));
	});

	it('sends a signed-in visitor straight on', async () => {
		stubFetch(() => jsonResponse(meBody()));
		await setSession('tok', 'free');
		open('?next=/portfolio');
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/portfolio', { replaceState: true }));
	});
});
