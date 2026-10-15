import { getMe } from './api';
import { clearSessionToken, getSessionToken, onSessionCleared, setSessionToken } from './session';

// Svelte 5 runes module store for the current user's auth session. The token
// itself lives in session.ts (the api client reads it from there); this store
// adds the reactive token/user state on top. Persisted to localStorage so the
// session survives reloads.

const USER_KEY = 'vexarium_user';

let token = $state<string | null>(null);
let user = $state<{ id: number; email: string; tier: string } | null>(null);

function load() {
	if (typeof localStorage === 'undefined') return;
	try {
		token = getSessionToken();
		const u = localStorage.getItem(USER_KEY);
		user = u ? JSON.parse(u) : null;
	} catch {
		// ignore corrupt storage
	}
}

function reset() {
	token = null;
	user = null;
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.removeItem(USER_KEY);
		} catch {
			// nothing to clean up
		}
	}
}

// A 401 from the api client clears the session token; mirror it here.
onSessionCleared(reset);

export function initAuth() {
	if (token === null) load();
}

export function getToken(): string | null {
	return token;
}

export function getUser() {
	return user;
}

export function isPro(): boolean {
	// DEV_FORCE_PRO on the backend makes /ai return 200 even for anonymous users,
	// but we still need a token to send. A dev user must log in / register.
	return user?.tier === 'pro';
}

export async function setSession(newToken: string, tier: string) {
	token = newToken;
	setSessionToken(newToken);
	// Fetch full user info (id, email) from /me so the store stays authoritative.
	try {
		const me = await getMe(newToken);
		user = { ...me, tier: me.tier || tier };
	} catch {
		user = { id: 0, email: '', tier };
	}
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(USER_KEY, JSON.stringify(user));
	}
}

export function logout() {
	clearSessionToken();
}
