import { browser } from '$app/environment';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Quote {
	symbol: string;
	price: number;
	prevClose?: number; // previous trading day close (from the SSE event)
	ts: string;
	dir: 'up' | 'down' | null; // flash direction, cleared 1s after the tick
	at: number; // local tick time (ms epoch) — drives the flash clear
}

// Last known live quote per symbol. `quotes[sym]` is undefined until the
// first tick arrives.
export const quotes = $state<Record<string, Quote>>({});

// 'live' | 'connecting' | 'off' — drives the connection dot in the topbar.
// Object wrapper: Svelte 5 forbids reassigning exported primitive $state.
export const conn = $state<{ state: 'live' | 'connecting' | 'off' }>({ state: 'off' });

let es: EventSource | null = null;
let wanted = new Set<string>();
let retryDelay = 1000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
	if (!browser || wanted.size === 0) return;
	es?.close();
	es = new EventSource(`${BASE_URL}/api/v1/stream/quotes?symbols=${[...wanted].join(',')}`);
	conn.state = 'connecting';
	es.onopen = () => {
		conn.state = 'live';
		retryDelay = 1000;
	};
	es.onmessage = (e) => {
		try {
			const d = JSON.parse(e.data);
			if (!d?.symbol || d.price == null) return;
			const prev = quotes[d.symbol];
			quotes[d.symbol] = {
				symbol: d.symbol,
				price: d.price,
				prevClose: d.prev_close ?? undefined,
				ts: d.ts ?? '',
				at: Date.now(),
				dir: prev ? (d.price > prev.price ? 'up' : d.price < prev.price ? 'down' : null) : null
			};
		} catch {
			// malformed frame — ignore
		}
	};
	es.onerror = () => {
		es?.close();
		es = null;
		conn.state = 'connecting';
		clearTimeout(retryTimer ?? undefined);
		retryTimer = setTimeout(() => {
			if (wanted.size > 0) connect();
			retryDelay = Math.min(retryDelay * 2, 30000);
		}, retryDelay);
	};
}

// Backend SSE fan-out limit (quote_stream.py).
const MAX_WATCH = 20;

/**
 * Subscribe to live quotes for the given symbols. Additive: unions the
 * requested symbols with the current set, so SymbolStrip and the watchlist
 * stay live simultaneously. Capped at MAX_WATCH (backend limit), keeping the
 * most recently requested symbols; nothing removes subscriptions today.
 */
export function setWatch(symbols: string[]) {
	const incoming = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean);
	const next = new Set([...wanted, ...incoming]);
	// Cap at the backend limit, keeping the newest requests.
	if (next.size > MAX_WATCH) {
		const items = [...next];
		next.clear();
		for (const s of items.slice(items.length - MAX_WATCH)) next.add(s);
	}
	if (next.size === wanted.size && [...next].every((s) => wanted.has(s))) return;
	wanted = next;
	if (wanted.size === 0) {
		es?.close();
		es = null;
		conn.state = 'off';
		return;
	}
	connect();
}

// Flash direction clears 1s after the tick that set it.
if (browser) {
	setInterval(() => {
		const now = Date.now();
		for (const sym of Object.keys(quotes)) {
			const q = quotes[sym];
			if (q.dir && now - q.at > 1000) q.dir = null;
		}
	}, 500);
}
