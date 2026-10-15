import { createTrade, deleteTradeById, listTrades, type TradeCreate, type TradeOut } from './api';
import { getSessionToken } from './session';
import { deleteTrade as deleteLocalTrade, getTrades as getLocalTrades, saveTrade as saveLocalTrade } from './storage';
import type { SavedTrade } from './types';

// Where trades live depends on the session: signed in, the backend is the
// source of truth (GET/POST/DELETE /api/v1/trades); signed out, they stay in
// localStorage on this device. Callers get the same SavedTrade shape either way.

export type NewTrade = Omit<SavedTrade, 'id'>;

/** Signed in: trades come from and go to the server. */
export function usesServerTrades(): boolean {
	return getSessionToken() !== null;
}

function fromServer(t: TradeOut): SavedTrade {
	return {
		id: String(t.id),
		symbol: t.symbol,
		type: t.trade_type,
		entryDate: t.entry_date,
		entryPrice: t.entry_price,
		quantity: t.quantity,
		contract: t.contract ?? undefined
	};
}

function toServer(t: NewTrade): TradeCreate {
	return {
		symbol: t.symbol,
		trade_type: t.type,
		entry_date: t.entryDate,
		entry_price: t.entryPrice,
		quantity: t.quantity,
		...(t.contract ? { contract: t.contract } : {})
	};
}

export async function loadTrades(signal?: AbortSignal): Promise<SavedTrade[]> {
	if (!usesServerTrades()) return getLocalTrades();
	return (await listTrades(signal)).map(fromServer);
}

export async function addTrade(trade: NewTrade): Promise<SavedTrade> {
	if (!usesServerTrades()) {
		const saved = { ...trade, id: crypto.randomUUID() };
		saveLocalTrade(saved);
		return saved;
	}
	return fromServer(await createTrade(toServer(trade)));
}

export async function removeTrade(id: string): Promise<void> {
	if (!usesServerTrades()) return deleteLocalTrade(id);
	await deleteTradeById(Number(id));
}

/** Trades saved on this device while signed out. */
export function localTrades(): SavedTrade[] {
	return getLocalTrades();
}

export interface UploadResult {
	uploaded: number;
	failed: number;
}

/** Copy the device's local trades to the account, one by one. A trade leaves
 * localStorage only after the server accepted it, so a failure part-way never
 * loses or duplicates anything: retrying uploads exactly what is left. */
export async function uploadLocalTrades(): Promise<UploadResult> {
	let uploaded = 0;
	let failed = 0;
	for (const trade of getLocalTrades()) {
		try {
			await createTrade(toServer(trade));
			deleteLocalTrade(trade.id);
			uploaded++;
		} catch {
			failed++;
		}
	}
	return { uploaded, failed };
}
