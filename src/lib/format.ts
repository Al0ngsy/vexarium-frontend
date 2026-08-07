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

// Currency -> formatting locale. Position and decimals are a locale convention:
// "163,10 €" (de-DE) vs "$163.10" (en-US). Default USD/en-US for US listings.
const CURRENCY_LOCALES: Record<string, string> = {
	EUR: 'de-DE',
	USD: 'en-US',
	GBP: 'en-GB',
	JPY: 'ja-JP',
	CHF: 'de-CH',
	CAD: 'en-CA',
	AUD: 'en-AU',
	HKD: 'en-HK'
};

/** Format a price with locale-correct currency (symbol position, decimals). */
export function formatPrice(v: number | null | undefined, currency?: string | null): string {
	if (v === null || v === undefined) return '—';
	const code = (currency || 'USD').toUpperCase();
	try {
		return new Intl.NumberFormat(CURRENCY_LOCALES[code] ?? 'en-US', {
			style: 'currency',
			currency: code,
			maximumFractionDigits: 2
		}).format(v);
	} catch {
		return `$${v.toFixed(2)}`; // unknown/invalid currency code
	}
}
