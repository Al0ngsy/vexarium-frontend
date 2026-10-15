import { describe, expect, it } from 'vitest';
import { makeJwt } from '../test/jwt';
import { isExpired, jwtExpiryMs } from './jwt';

describe('jwtExpiryMs', () => {
	it('reads exp in milliseconds', () => {
		expect(jwtExpiryMs(makeJwt({ exp: 1_800_000_000, sub: '1' }))).toBe(1_800_000_000_000);
	});

	it('handles base64url payloads with non-ASCII claims', () => {
		expect(jwtExpiryMs(makeJwt({ exp: 10, note: 'ä?>>' }))).toBe(10_000);
	});

	it('returns null for missing exp, non-numeric exp and garbage', () => {
		expect(jwtExpiryMs(makeJwt({ sub: '1' }))).toBeNull();
		expect(jwtExpiryMs(makeJwt({ exp: 'soon' }))).toBeNull();
		expect(jwtExpiryMs('not-a-jwt')).toBeNull();
		expect(jwtExpiryMs('a.%%%.c')).toBeNull();
		expect(jwtExpiryMs('')).toBeNull();
	});
});

describe('isExpired', () => {
	const now = 1_000_000;
	it('is true at and after exp, false before', () => {
		expect(isExpired(makeJwt({ exp: now / 1000 - 1 }), now)).toBe(true);
		expect(isExpired(makeJwt({ exp: now / 1000 }), now)).toBe(true);
		expect(isExpired(makeJwt({ exp: now / 1000 + 1 }), now)).toBe(false);
	});
	it('treats a token without exp as not expired', () => {
		expect(isExpired(makeJwt({}), now)).toBe(false);
	});
});
