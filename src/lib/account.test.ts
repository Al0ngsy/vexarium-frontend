import { describe, expect, it } from 'vitest';
import { canManageBilling, formatPeriodEnd, subscriptionLabel } from './account';

describe('subscriptionLabel', () => {
	it('maps Stripe statuses and tolerates unknown ones', () => {
		expect(subscriptionLabel(null)).toBe('No subscription');
		expect(subscriptionLabel('active')).toBe('Active');
		expect(subscriptionLabel('past_due')).toBe('Payment overdue');
		expect(subscriptionLabel('some_new_state')).toBe('Some new state');
	});
});

describe('canManageBilling', () => {
	it('needs a subscription or the pro tier', () => {
		expect(canManageBilling({ tier: 'free', subscription_status: null })).toBe(false);
		expect(canManageBilling({ tier: 'free', subscription_status: 'canceled' })).toBe(true);
		expect(canManageBilling({ tier: 'pro', subscription_status: null })).toBe(true);
	});
});

describe('formatPeriodEnd', () => {
	it('formats ISO dates in UTC and rejects junk', () => {
		expect(formatPeriodEnd('2026-11-12T23:30:00Z')).toBe('12 Nov 2026');
		expect(formatPeriodEnd(null)).toBeNull();
		expect(formatPeriodEnd('not a date')).toBeNull();
	});
});
