import { ApiError } from './api';

export const MIN_PASSWORD_LENGTH = 8;

/** Post-login redirect target from a `?next=` value. Only same-origin paths
 * are accepted (`/pricing`, `/s/AAPL?x=1`); anything that could leave the site
 * (`//evil.com`, `/\evil.com`, `https://…`, `javascript:…`) yields null. */
export function safeNext(raw: string | null | undefined): string | null {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
	// Backslashes and control characters are treated like slashes / stripped by browsers.
	if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
	try {
		const url = new URL(raw, 'http://placeholder.invalid');
		if (url.origin !== 'http://placeholder.invalid') return null;
	} catch {
		return null;
	}
	return raw;
}

/** `/login?next=/pricing` style link that keeps a valid redirect target. */
export function withNext(path: string, next: string | null): string {
	return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/** Plain-language message for a failed auth/account request. `fallback` is
 * used when the server sent no detail. */
export function authErrorMessage(e: unknown, fallback: string): string {
	if (e instanceof ApiError) {
		if (e.status === 429) return 'Too many attempts. Please wait a minute and try again.';
		if (e.status >= 500) return 'The server had a problem. Please try again in a moment.';
		return e.detail ?? fallback;
	}
	return 'Could not reach the server. Check your connection and try again.';
}
