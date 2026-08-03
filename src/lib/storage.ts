import type { SavedTrade } from './types';

const KEY = 'vexarium_trades';

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
