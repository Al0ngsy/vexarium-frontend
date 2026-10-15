import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPrice, formatTimeAgo } from './format';

// Intl puts no-break spaces between a trailing currency symbol and the number.
const plain = (s: string) => s.replace(/ /g, ' ');

describe('formatPrice', () => {
	it('formats USD by default with two decimals', () => {
		expect(formatPrice(163.1)).toBe('$163.10');
		expect(formatPrice(1234567.891)).toBe('$1,234,567.89');
		expect(formatPrice(0)).toBe('$0.00');
	});

	it('uses the currency convention of the listing (symbol position, separators)', () => {
		expect(plain(formatPrice(163.1, 'EUR'))).toBe('163,10 €');
		expect(formatPrice(163.1, 'GBP')).toBe('£163.10');
		expect(formatPrice(163.1, 'eur')).toBe(formatPrice(163.1, 'EUR'));
	});

	it('formats yen with the ja-JP convention', () => {
		expect(formatPrice(1234, 'JPY')).toMatch(/^[¥￥]1,234$/);
	});

	it('returns a dash for missing values', () => {
		expect(formatPrice(null)).toBe('—');
		expect(formatPrice(undefined)).toBe('—');
		expect(formatPrice(null, 'EUR')).toBe('—');
	});

	it('falls back to a dollar format for an invalid currency code', () => {
		expect(formatPrice(12.3, 'NOT-A-CODE')).toBe('$12.30');
	});

	it('treats an empty currency as USD', () => {
		expect(formatPrice(5, '')).toBe('$5.00');
		expect(formatPrice(5, null)).toBe('$5.00');
	});
});

describe('formatTimeAgo', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	const ago = (ms: number) => formatTimeAgo(new Date(Date.now() - ms).toISOString());

	it('uses seconds, minutes, hours and days', () => {
		expect(ago(5_000)).toBe('5s ago');
		expect(ago(59_000)).toBe('59s ago');
		expect(ago(60_000)).toBe('1m ago');
		expect(ago(59 * 60_000)).toBe('59m ago');
		expect(ago(3 * 3_600_000)).toBe('3h ago');
		expect(ago(23 * 3_600_000)).toBe('23h ago');
		expect(ago(24 * 3_600_000)).toBe('1d ago');
		expect(ago(10 * 86_400_000)).toBe('10d ago');
	});

	it('never goes negative for timestamps slightly in the future', () => {
		expect(formatTimeAgo(new Date(Date.now() + 30_000).toISOString())).toBe('0s ago');
	});
});
