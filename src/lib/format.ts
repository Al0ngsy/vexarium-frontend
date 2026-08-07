export function formatTimeAgo(iso: string): string {
	const then = new Date(iso).getTime();
	const now = Date.now();
	const s = Math.max(0, Math.floor((now - then) / 1000));
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	return `${d}d ago`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
	EUR: '€',
	GBP: '£',
	JPY: '¥',
	CHF: 'CHF ',
	CAD: 'C$',
	AUD: 'A$',
	HKD: 'HK$'
};

/** Format a price with the right currency symbol (defaults to $ — US listings
 * are the common case; non-US symbols pass their company currency). */
export function formatPrice(v: number | null | undefined, currency?: string | null): string {
	if (v === null || v === undefined) return '—';
	const sym = currency ? (CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `) : '$';
	return `${sym}${v.toFixed(2)}`;
}
