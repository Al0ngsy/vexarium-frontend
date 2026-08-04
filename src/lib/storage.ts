import type { AssetType, SavedTrade } from './types';

const KEY = 'vexarium_trades';
const RECENT_KEY = 'vexarium_recent';
const RECENT_MAX = 10;

export function getTrades(): SavedTrade[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const data = localStorage.getItem(KEY);
		return data ? JSON.parse(data) : [];
	} catch {
		return [];
	}
}

export function saveTrade(trade: SavedTrade): void {
	const trades = getTrades();
	trades.push(trade);
	localStorage.setItem(KEY, JSON.stringify(trades));
}

export function deleteTrade(id: string): void {
	const trades = getTrades().filter((t) => t.id !== id);
	localStorage.setItem(KEY, JSON.stringify(trades));
}

export interface RecentAnalysis {
	symbol: string;
	assetType: AssetType;
	analyzedAt: string;
	verdict: string;
}

// Local-only recent analyses history (key 'vexarium_recent').
// NOTE: The daily auto-update of these entries is a future Pro feature —
// for now this is purely a client-side convenience history.
export function getRecentAnalyses(): RecentAnalysis[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const data = localStorage.getItem(RECENT_KEY);
		return data ? JSON.parse(data) : [];
	} catch {
		return [];
	}
}

export function addRecentAnalysis(a: RecentAnalysis): void {
	const list = getRecentAnalyses();
	// Dedupe by symbol (case-insensitive), unshift to front, cap at 10.
	const filtered = list.filter(
		(item) => item.symbol.toUpperCase() !== a.symbol.toUpperCase()
	);
	filtered.unshift(a);
	localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, RECENT_MAX)));
}
