// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from '$app/state';
import { jsonResponse, stubFetch, submit, type } from '../../test/dom';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/reset-password') } }));

let target: HTMLElement;
let app: ReturnType<typeof mount>;

function open(search: string) {
	(page as { url: URL }).url = new URL(`http://localhost/reset-password${search}`);
	app = mount(Page, { target });
	flushSync();
}
const live = () => target.querySelector('[aria-live]')?.textContent?.trim();

beforeEach(() => {
	target = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
	unmount(app);
	target.remove();
	vi.unstubAllGlobals();
	document.head.querySelectorAll('meta[name="referrer"]').forEach((m) => m.remove());
});

describe('/reset-password', () => {
	it('without a token it links to a new request and shows no form', () => {
		open('');
		expect(target.querySelector('form')).toBeNull();
		expect(target.textContent).toMatch(/incomplete/i);
		expect(target.querySelector('a[href="/forgot-password"]')).not.toBeNull();
	});

	it('keeps the token out of the Referer header', () => {
		open('?token=abc');
		expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
	});

	it('sends the token from the URL with the new password, then offers login', async () => {
		const calls = stubFetch(() => jsonResponse(null, 204));
		open('?token=tok_123');
		const pw = target.querySelector<HTMLInputElement>('#new-password')!;
		expect(pw.autocomplete).toBe('new-password');
		expect(pw.minLength).toBe(8);
		type(target, '#new-password', 'brand-new-pw');
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(target.textContent).toMatch(/password updated/i));
		expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/password-reset/confirm', authorization: null });
		expect(calls[0].body).toEqual({ token: 'tok_123', new_password: 'brand-new-pw' });
		expect(target.querySelector('a[href="/login"]')).not.toBeNull();
	});

	it('says an invalid or expired link is invalid and keeps the form', async () => {
		stubFetch(() => jsonResponse({ detail: 'Invalid or expired token' }, 400));
		open('?token=old');
		type(target, '#new-password', 'brand-new-pw');
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(live()).toMatch(/invalid or has expired/i));
		expect(target.querySelector('form')).not.toBeNull();
		expect(target.querySelector('a[href="/forgot-password"]')).not.toBeNull();
	});

	it('explains a 429', async () => {
		stubFetch(() => jsonResponse({ detail: 'Rate limit exceeded' }, 429));
		open('?token=t');
		type(target, '#new-password', 'brand-new-pw');
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(live()).toMatch(/too many attempts/i));
	});
});
