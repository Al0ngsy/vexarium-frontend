// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSession } from '$lib/auth.svelte';
import { clearSessionToken } from '$lib/session';
import { jsonResponse, meBody, stubFetch, tick, type FetchCall } from '../../test/dom';
import Page from './+page.svelte';

let target: HTMLElement;
let app: ReturnType<typeof mount>;
let tier: string;
let calls: FetchCall[];
let extra: (c: FetchCall) => Response | undefined;

async function open({ loggedIn, search = '' }: { loggedIn: boolean; search?: string }) {
	history.replaceState(null, '', `/pricing${search}`);
	calls = stubFetch((c) => (c.path === '/api/v1/auth/me' ? jsonResponse(meBody({ tier })) : (extra(c) ?? jsonResponse({}))));
	if (loggedIn) await setSession('tok', tier);
	app = mount(Page, { target });
	flushSync();
	if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0);
	else await tick();
}
const text = () => target.textContent!.replace(/\s+/g, ' ');
const meCalls = () => calls.filter((c) => c.path === '/api/v1/auth/me').length;
const upgradeButton = () => target.querySelector<HTMLButtonElement>('button.btn-primary')!;

beforeEach(() => {
	localStorage.clear();
	tier = 'free';
	extra = () => undefined;
	target = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
	unmount(app);
	target.remove();
	clearSessionToken();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	history.replaceState(null, '', '/');
});

describe('/pricing', () => {
	it('sends visitors without a login to registration and back to pricing', async () => {
		await open({ loggedIn: false });
		const cta = target.querySelector<HTMLAnchorElement>('a[href="/register?next=%2Fpricing"]')!;
		expect(cta.textContent).toMatch(/create account to upgrade/i);
		expect(target.querySelector('a[href="/login?next=%2Fpricing"]')).not.toBeNull();
		expect(upgradeButton()).toBeNull();
		expect(calls.some((c) => c.path.includes('/billing/'))).toBe(false);
	});

	it('starts Stripe checkout for a logged-in free user', async () => {
		const location = { href: 'http://localhost/pricing', search: '' };
		vi.stubGlobal('location', location);
		extra = (c) => (c.path === '/api/v1/billing/checkout' ? jsonResponse({ checkout_url: 'https://checkout.stripe.test/c/1' }) : undefined);
		await open({ loggedIn: true });
		upgradeButton().click();
		flushSync();
		expect(upgradeButton().disabled).toBe(true);
		await vi.waitFor(() => expect(location.href).toBe('https://checkout.stripe.test/c/1'));
		expect(calls.filter((c) => c.path === '/api/v1/billing/checkout')).toEqual([
			expect.objectContaining({ method: 'POST', authorization: 'Bearer tok' })
		]);
	});

	it('shows a checkout failure and re-enables the button', async () => {
		extra = (c) => (c.path === '/api/v1/billing/checkout' ? jsonResponse({ detail: 'boom' }, 500) : undefined);
		await open({ loggedIn: true });
		upgradeButton().click();
		await vi.waitFor(() => expect(text()).toMatch(/server had a problem/i));
		expect(upgradeButton().disabled).toBe(false);
	});

	it('shows the Pro state for a pro user', async () => {
		tier = 'pro';
		await open({ loggedIn: true });
		expect(text()).toContain("YOU'RE ON PRO");
		expect(upgradeButton()).toBeNull();
	});

	it('does not poll /me without ?success=1', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		await open({ loggedIn: true });
		const before = meCalls();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(meCalls()).toBe(before);
		expect(text()).not.toMatch(/activating/i);
	});

	describe('returning from checkout (?success=1)', () => {
		it('tells the user activation may take seconds and polls /me until Pro arrives', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
			await open({ loggedIn: true, search: '?success=1' });
			await vi.advanceTimersByTimeAsync(0);
			expect(text()).toMatch(/activating your pro plan/i);
			expect(text()).not.toContain("YOU'RE ON PRO");

			tier = 'pro'; // the webhook has landed
			await vi.advanceTimersByTimeAsync(2_100);
			flushSync();
			expect(text()).toContain("YOU'RE ON PRO");
			expect(text()).not.toMatch(/activating/i);
			const settled = meCalls();
			await vi.advanceTimersByTimeAsync(10_000);
			expect(meCalls()).toBe(settled);
		});

		it('gives up after 30 seconds with a hint instead of spinning forever', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
			await open({ loggedIn: true, search: '?success=1' });
			await vi.advanceTimersByTimeAsync(31_000);
			flushSync();
			expect(text()).toMatch(/taking longer than usual/i);
			expect(target.querySelector('a[href="/account"]')).not.toBeNull();
			const stopped = meCalls();
			await vi.advanceTimersByTimeAsync(20_000);
			expect(meCalls()).toBe(stopped);
			expect(stopped).toBeLessThanOrEqual(18);
		});

		it('stops polling when the page is left', async () => {
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
			await open({ loggedIn: true, search: '?success=1' });
			await vi.advanceTimersByTimeAsync(2_100);
			unmount(app);
			const atLeave = meCalls();
			await vi.advanceTimersByTimeAsync(10_000);
			expect(meCalls()).toBe(atLeave);
			app = mount(Page, { target }); // keep afterEach's unmount valid
		});
	});
});
