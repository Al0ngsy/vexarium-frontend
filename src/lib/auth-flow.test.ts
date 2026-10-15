import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { authErrorMessage, safeNext, withNext } from './auth-flow';

describe('safeNext', () => {
	it('accepts same-origin paths with query and hash', () => {
		expect(safeNext('/pricing')).toBe('/pricing');
		expect(safeNext('/s/AAPL?tf=1w#top')).toBe('/s/AAPL?tf=1w#top');
		expect(safeNext('/')).toBe('/');
	});

	it.each([
		['absolute URL', 'https://evil.com/x'],
		['protocol-relative', '//evil.com'],
		['backslash trick', '/\\evil.com'],
		['backslash anywhere', '/a\\b'],
		['javascript scheme', 'javascript:alert(1)'],
		['relative without slash', 'pricing'],
		['tab/newline smuggling', '/\t/evil.com'],
		['newline', '/a\nb'],
		['empty', ''],
		['null', null],
		['undefined', undefined]
	])('rejects %s', (_name, raw) => {
		expect(safeNext(raw as string | null)).toBeNull();
	});
});

describe('withNext', () => {
	it('appends an encoded next, or nothing', () => {
		expect(withNext('/login', '/s/AAPL?a=1&b=2')).toBe('/login?next=%2Fs%2FAAPL%3Fa%3D1%26b%3D2');
		expect(withNext('/login', null)).toBe('/login');
	});
});

describe('authErrorMessage', () => {
	it('explains a rate limit', () => {
		expect(authErrorMessage(new ApiError('x', 429, 'Rate limit exceeded: 5 per 1 minute'), 'f')).toMatch(/too many attempts/i);
	});
	it('uses the server detail for 4xx, the fallback without one', () => {
		expect(authErrorMessage(new ApiError('x', 401, 'Invalid credentials'), 'f')).toBe('Invalid credentials');
		expect(authErrorMessage(new ApiError('x', 400), 'Fallback')).toBe('Fallback');
	});
	it('does not leak 5xx details, and handles network failures', () => {
		expect(authErrorMessage(new ApiError('x', 500, 'Traceback...'), 'f')).toMatch(/server had a problem/i);
		expect(authErrorMessage(new TypeError('Failed to fetch'), 'f')).toMatch(/could not reach the server/i);
	});
});
