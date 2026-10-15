import type { Me } from './api';

const STATUS_LABELS: Record<string, string> = {
	active: 'Active',
	trialing: 'Trial',
	past_due: 'Payment overdue',
	unpaid: 'Unpaid',
	canceled: 'Canceled',
	incomplete: 'Incomplete',
	incomplete_expired: 'Expired',
	paused: 'Paused'
};

/** Human label for a Stripe subscription status ("past_due" -> "Payment overdue"). */
export function subscriptionLabel(status: string | null): string {
	if (!status) return 'No subscription';
	return STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** The billing portal only makes sense for someone who has paid or is paying. */
export function canManageBilling(user: Pick<Me, 'tier' | 'subscription_status'>): boolean {
	return user.subscription_status !== null || user.tier === 'pro';
}

/** "12 Nov 2026" for an ISO timestamp, null for missing or unparsable input. */
export function formatPeriodEnd(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
