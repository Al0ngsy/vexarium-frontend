// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Me } from './api';
import { makeJwt } from '../test/jwt';

const getMe = vi.fn();
vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	getMe: (...args: unknown[]) => getMe(...args)
}));

const NOW = new Date('2026-06-01T12:00:00Z');
const inSeconds = (s: number) => Math.floor(NOW.getTime() / 1000) + s;

const me = (over: Partial<Me> = {}): Me => ({
	id: 1,
	email: 'a@b.c',
	tier: 'free',
	subscription_status: null,
	current_period_end: null,
	created_at: '2026-01-01T00:00:00Z',
	...over
});

/** Fresh module graph per test: the stores keep module-level state. */
async function load() {
	vi.resetModules();
	const session = await import('./session');
	const auth = await import('./auth.svelte');
	return { session, auth };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
	vi.setSystemTime(NOW);
	localStorage.clear();
	getMe.mockReset();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('initAuth', () => {
	it('does nothing without a stored token', async () => {
		const { auth } = await load();
		auth.initAuth();
		expect(auth.getToken()).toBeNull();
		expect(getMe).not.toHaveBeenCalled();
	});

	it('loads /me once with a stored token and caches the user', async () => {
		const token = makeJwt({ exp: inSeconds(3600) });
		localStorage.setItem('vexarium_token', token);
		getMe.mockResolvedValue(me({ tier: 'pro' }));
		const { auth } = await load();
		auth.initAuth();
		auth.initAuth();
		expect(auth.getToken()).toBe(token);
		await vi.waitFor(() => expect(auth.getUser()?.tier).toBe('pro'));
		expect(getMe).toHaveBeenCalledTimes(1);
		expect(auth.isPro()).toBe(true);
		expect(JSON.parse(localStorage.getItem('vexarium_user')!).email).toBe('a@b.c');
	});

	it('shows the cached user immediately, before /me answers', async () => {
		localStorage.setItem('vexarium_token', makeJwt({ exp: inSeconds(3600) }));
		localStorage.setItem('vexarium_user', JSON.stringify(me({ email: 'cached@b.c' })));
		getMe.mockReturnValue(new Promise(() => {}));
		const { auth } = await load();
		auth.initAuth();
		expect(auth.getUser()?.email).toBe('cached@b.c');
	});

	it('logs out when /me rejects the token (the api client clears the session)', async () => {
		localStorage.setItem('vexarium_token', makeJwt({ exp: inSeconds(3600) }));
		localStorage.setItem('vexarium_user', JSON.stringify(me()));
		const { auth, session } = await load();
		getMe.mockImplementation(async () => {
			session.clearSessionToken();
			throw new ApiError('Session expired: 401', 401);
		});
		auth.initAuth();
		await vi.waitFor(() => expect(auth.getToken()).toBeNull());
		expect(auth.getUser()).toBeNull();
		expect(localStorage.getItem('vexarium_token')).toBeNull();
		expect(localStorage.getItem('vexarium_user')).toBeNull();
	});

	it('keeps the cached user when /me fails for another reason', async () => {
		const token = makeJwt({ exp: inSeconds(3600) });
		localStorage.setItem('vexarium_token', token);
		localStorage.setItem('vexarium_user', JSON.stringify(me()));
		getMe.mockRejectedValue(new TypeError('Failed to fetch'));
		const { auth } = await load();
		auth.initAuth();
		await vi.advanceTimersByTimeAsync(0);
		expect(auth.getToken()).toBe(token);
		expect(auth.getUser()?.email).toBe('a@b.c');
	});

	it('drops an already expired token without calling /me', async () => {
		localStorage.setItem('vexarium_token', makeJwt({ exp: inSeconds(-10) }));
		const { auth } = await load();
		auth.initAuth();
		expect(auth.getToken()).toBeNull();
		expect(localStorage.getItem('vexarium_token')).toBeNull();
		expect(getMe).not.toHaveBeenCalled();
	});
});

describe('token expiry', () => {
	it('logs out when exp passes while the app is open', async () => {
		localStorage.setItem('vexarium_token', makeJwt({ exp: inSeconds(60) }));
		getMe.mockResolvedValue(me());
		const { auth } = await load();
		auth.initAuth();
		await vi.advanceTimersByTimeAsync(59_000);
		expect(auth.getToken()).not.toBeNull();
		await vi.advanceTimersByTimeAsync(2_000);
		expect(auth.getToken()).toBeNull();
		expect(auth.getUser()).toBeNull();
		expect(localStorage.getItem('vexarium_token')).toBeNull();
	});

	it('also arms the timer for a fresh login', async () => {
		getMe.mockResolvedValue(me());
		const { auth } = await load();
		await auth.setSession(makeJwt({ exp: inSeconds(30) }), 'free');
		await vi.advanceTimersByTimeAsync(31_000);
		expect(auth.getToken()).toBeNull();
	});

	it('a token without exp never expires client-side', async () => {
		getMe.mockResolvedValue(me());
		const { auth } = await load();
		await auth.setSession(makeJwt({ sub: '1' }), 'free');
		await vi.advanceTimersByTimeAsync(10 * 24 * 3600 * 1000);
		expect(auth.getToken()).not.toBeNull();
	});
});

describe('setSession / logout / refreshUser', () => {
	it('stores token and user from /me', async () => {
		getMe.mockResolvedValue(me({ tier: 'pro' }));
		const { auth, session } = await load();
		await auth.setSession('tok', 'free');
		expect(getMe).toHaveBeenCalledWith('tok');
		expect(session.getSessionToken()).toBe('tok');
		expect(auth.getToken()).toBe('tok');
		expect(auth.getUser()?.tier).toBe('pro');
	});

	it('falls back to the login tier when /me is unreachable', async () => {
		getMe.mockRejectedValue(new TypeError('offline'));
		const { auth } = await load();
		await auth.setSession('tok', 'pro');
		expect(auth.getToken()).toBe('tok');
		expect(auth.isPro()).toBe(true);
	});

	it('logout clears token, user and storage', async () => {
		getMe.mockResolvedValue(me());
		const { auth } = await load();
		await auth.setSession('tok', 'free');
		auth.logout();
		expect(auth.getToken()).toBeNull();
		expect(auth.getUser()).toBeNull();
		expect(localStorage.getItem('vexarium_token')).toBeNull();
		expect(localStorage.getItem('vexarium_user')).toBeNull();
	});

	it('refreshUser updates the user, returns null without a session or on failure', async () => {
		const { auth } = await load();
		expect(await auth.refreshUser()).toBeNull();
		getMe.mockResolvedValueOnce(me());
		await auth.setSession('tok', 'free');
		getMe.mockResolvedValueOnce(me({ tier: 'pro', subscription_status: 'active' }));
		expect((await auth.refreshUser())?.tier).toBe('pro');
		expect(auth.getUser()?.subscription_status).toBe('active');
		getMe.mockRejectedValueOnce(new Error('x'));
		expect(await auth.refreshUser()).toBeNull();
		expect(auth.getUser()?.tier).toBe('pro');
	});

	it('refreshUser ignores an answer that arrives after logout', async () => {
		getMe.mockResolvedValueOnce(me());
		const { auth } = await load();
		await auth.setSession('tok', 'free');
		let resolve!: (m: Me) => void;
		getMe.mockReturnValueOnce(new Promise<Me>((r) => (resolve = r)));
		const pending = auth.refreshUser();
		auth.logout();
		resolve(me({ tier: 'pro' }));
		expect(await pending).toBeNull();
		expect(auth.getUser()).toBeNull();
	});
});
