// Plain (non-reactive) holder for the auth token. It is the single source of
// truth for the token: the api client reads it for the Authorization header,
// the auth store (auth.svelte.ts) wraps it with reactive user state. Living in
// its own module keeps api.ts and auth.svelte.ts free of an import cycle.

const TOKEN_KEY = 'vexarium_token';

let token: string | null = null;
let loaded = false;
const clearedListeners = new Set<() => void>();

function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function getSessionToken(): string | null {
	if (!loaded) {
		loaded = true;
		try {
			token = storage()?.getItem(TOKEN_KEY) ?? null;
		} catch {
			token = null;
		}
	}
	return token;
}

export function setSessionToken(next: string): void {
	loaded = true;
	token = next;
	try {
		storage()?.setItem(TOKEN_KEY, next);
	} catch {
		// storage unavailable: the session just won't survive a reload
	}
}

/** Drop the token (logout or a 401) and tell the auth store to reset its user. */
export function clearSessionToken(): void {
	loaded = true;
	token = null;
	try {
		storage()?.removeItem(TOKEN_KEY);
	} catch {
		// nothing to clean up
	}
	for (const fn of clearedListeners) fn();
}

export function onSessionCleared(fn: () => void): () => void {
	clearedListeners.add(fn);
	return () => clearedListeners.delete(fn);
}
