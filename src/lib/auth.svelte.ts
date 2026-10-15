import { getMe, type Me } from './api';
import { isExpired, jwtExpiryMs } from './jwt';
import { clearSessionToken, getSessionToken, onSessionCleared, setSessionToken } from './session';

// Svelte 5 runes module store for the current user's auth session. The token
// itself lives in session.ts (the api client reads it from there); this store
// adds the reactive token/user state on top. The token is persisted to
// localStorage so the session survives reloads; the user is cached there too
// and re-validated against /auth/me once per app start.

const USER_KEY = 'vexarium_user';
/** setTimeout stores its delay in a signed 32-bit int. */
const MAX_TIMEOUT_MS = 2_147_483_647;

let token = $state<string | null>(null);
let user = $state<Me | null>(null);
let started = false;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function loadCachedUser(): Me | null {
	try {
		const u = localStorage.getItem(USER_KEY);
		return u ? (JSON.parse(u) as Me) : null;
	} catch {
		return null;
	}
}

function cacheUser(next: Me | null) {
	try {
		if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
		else localStorage.removeItem(USER_KEY);
	} catch {
		// storage unavailable: the cache is only a convenience
	}
}

function stopExpiryTimer() {
	if (expiryTimer !== null) clearTimeout(expiryTimer);
	expiryTimer = null;
}

/** Log out when the token has expired; otherwise wake up again at its `exp`. */
function checkExpiry() {
	stopExpiryTimer();
	if (!token) return;
	if (isExpired(token)) {
		clearSessionToken();
		return;
	}
	const exp = jwtExpiryMs(token);
	if (exp !== null) {
		expiryTimer = setTimeout(checkExpiry, Math.min(exp - Date.now(), MAX_TIMEOUT_MS));
	}
}

function reset() {
	stopExpiryTimer();
	token = null;
	user = null;
	cacheUser(null);
}

// A 401 from the api client (or logout()) clears the session token; mirror it here.
onSessionCleared(reset);

/** Load the stored session once per app start and validate it with /auth/me.
 * An expired or rejected token means logout; a network error keeps the cached
 * user so a flaky connection does not sign anyone out. */
export function initAuth() {
	if (started || typeof localStorage === 'undefined') return;
	started = true;
	const stored = getSessionToken();
	if (!stored) return;
	token = stored;
	user = loadCachedUser();
	checkExpiry();
	if (!token) return;
	void refreshUser();
	// Timers are throttled while a tab sleeps: re-check when it wakes up.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') checkExpiry();
	});
}

/** Reload the user from /auth/me. Resolves with the fresh user, or null when
 * there is no session or the request failed. A 401 logs out (api client). */
export async function refreshUser(): Promise<Me | null> {
	if (!token) return null;
	const sent = token;
	try {
		const me = await getMe();
		if (token !== sent) return null; // logged out or switched account meanwhile
		user = me;
		cacheUser(me);
		return me;
	} catch {
		return null;
	}
}

export function getToken(): string | null {
	return token;
}

export function getUser(): Me | null {
	return user;
}

export function isPro(): boolean {
	return user?.tier === 'pro';
}

/** Store a fresh login/registration and load the user behind it. */
export async function setSession(newToken: string, tier: string) {
	token = newToken;
	setSessionToken(newToken);
	checkExpiry();
	try {
		user = await getMe(newToken);
	} catch {
		// /me unreachable: fall back to what the login response told us
		user = { id: 0, email: '', tier, subscription_status: null, current_period_end: null, created_at: '' };
	}
	cacheUser(user);
}

export function logout() {
	clearSessionToken();
}
