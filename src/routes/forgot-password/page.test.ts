// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch, submit, type } from '../../test/dom';
import Page from './+page.svelte';

let target: HTMLElement;
let app: ReturnType<typeof mount>;
const live = () => target.querySelector('[aria-live]')?.textContent?.trim();

beforeEach(() => {
	target = document.body.appendChild(document.createElement('div'));
	app = mount(Page, { target });
	flushSync();
});
afterEach(() => {
	unmount(app);
	target.remove();
	vi.unstubAllGlobals();
});

describe('/forgot-password', () => {
	it('asks for an email with the right autocomplete', () => {
		const email = target.querySelector<HTMLInputElement>('#email')!;
		expect(email.autocomplete).toBe('email');
		expect(target.querySelector('label[for="email"]')).not.toBeNull();
	});

	it('shows the same neutral confirmation after a 202', async () => {
		const calls = stubFetch(() => jsonResponse({}, 202));
		type(target, '#email', ' someone@example.com ');
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(live()).toMatch(/if an account exists/i));
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/password-reset/request', authorization: null });
		expect(calls[0].body).toEqual({ email: 'someone@example.com' });
	});

	it('explains a 429 instead of confirming', async () => {
		stubFetch(() => jsonResponse({ detail: 'Rate limit exceeded' }, 429));
		type(target, '#email', 'a@b.c');
		submit(target.querySelector('form'));
		await vi.waitFor(() => expect(live()).toMatch(/too many attempts/i));
		expect(live()).not.toMatch(/if an account exists/i);
	});
});
