// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { getToken, setSession } from '$lib/auth.svelte';
import { clearSessionToken } from '$lib/session';
import { jsonResponse, meBody, stubFetch, tick } from '../test/dom';
import TopBar from './TopBar.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/state', () => ({ page: { params: {}, url: new URL('http://localhost/') } }));
vi.mock('./SymbolSearch.svelte', async () => import('../test/EmptyStub.svelte'));

let target: HTMLElement;
let app: ReturnType<typeof mount>;

function open(path: string) {
	(page as { url: URL }).url = new URL(`http://localhost${path}`);
	app = mount(TopBar, { target });
	flushSync();
}

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

describe('TopBar auth area', () => {
	it('shows a Log in link that returns to the current page', () => {
		open('/s/AAPL');
		const link = target.querySelector<HTMLAnchorElement>('a.login-link')!;
		expect(link.textContent).toBe('Log in');
		expect(link.getAttribute('href')).toBe('/login?next=%2Fs%2FAAPL');
		expect(target.querySelector('.user-menu')).toBeNull();
	});

	it('hides the Log in link on the auth pages themselves', () => {
		open('/login');
		expect(target.querySelector('a.login-link')).toBeNull();
	});

	describe('signed in', () => {
		beforeEach(async () => {
			stubFetch(() => jsonResponse(meBody({ email: 'zed@example.com' })));
			await setSession('tok', 'free');
		});

		it('shows the user menu instead of the link, closed by default', () => {
			open('/');
			expect(target.querySelector('a.login-link')).toBeNull();
			const btn = target.querySelector<HTMLButtonElement>('.user-menu button')!;
			expect(btn.textContent?.trim()).toBe('Z');
			expect(btn.getAttribute('aria-expanded')).toBe('false');
			expect(target.querySelector('.menu')).toBeNull();
		});

		it('opens with email, Account and Log out; closes on Escape and outside click', async () => {
			open('/');
			const btn = target.querySelector<HTMLButtonElement>('.user-menu button')!;
			btn.click();
			flushSync();
			expect(btn.getAttribute('aria-expanded')).toBe('true');
			expect(target.querySelector('.menu-email')?.textContent).toBe('zed@example.com');
			expect(target.querySelector('.menu a[href="/account"]')?.textContent).toBe('Account');

			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
			flushSync();
			expect(target.querySelector('.menu')).toBeNull();

			btn.click();
			flushSync();
			document.body.click();
			flushSync();
			await tick();
			expect(target.querySelector('.menu')).toBeNull();
		});

		it('logs out from the menu and goes to the start page', () => {
			open('/portfolio');
			target.querySelector<HTMLButtonElement>('.user-menu button')!.click();
			flushSync();
			target.querySelector<HTMLButtonElement>('.menu button')!.click();
			flushSync();
			expect(getToken()).toBeNull();
			expect(goto).toHaveBeenCalledWith('/');
			expect(target.querySelector('a.login-link')).not.toBeNull();
			expect(target.querySelector('.user-menu')).toBeNull();
		});
	});
});
