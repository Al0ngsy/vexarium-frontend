import {
	getOptionChain,
	getOptionPayoff,
	getOptionChance,
	getStrategies,
	isAbortError
} from './api';
import type {
	OptionChanceResponse,
	OptionContract,
	OptionsPayoffResponse,
	StrategiesResponse
} from './types';

// Shared selected-contract store for the options workspace. The chain widget
// loads the chain and selects a contract; payoff / greeks / probability /
// matrix / strategies all react to the same selection.
//
// Every load is cancellable: a newer chain load supersedes the previous chain
// AND contract selection, a newer selection supersedes the previous one, and
// a newer strategies load (timeframe override) supersedes the previous
// strategies load. Superseded requests are aborted and can never write state.
let chainCtl: AbortController | null = null;
let selectCtl: AbortController | null = null;
let strategiesCtl: AbortController | null = null;

export const store = $state({
	symbol: '',
	currentPrice: null as number | null,
	dayChangePct: null as number | null,
	delayed: true,
	contracts: [] as OptionContract[],
	contractsLoading: false,
	contractsError: null as string | null,
	selectedSymbol: '',
	activeExpiry: '',
	payoff: null as OptionsPayoffResponse | null,
	payoffLoading: false,
	payoffError: null as string | null,
	strategies: null as StrategiesResponse | null,
	strategiesLoading: false,
	strategiesError: null as string | null,
	strategyTf: 'auto' as string, // user override for the verdict timeframe
	chance: null as OptionChanceResponse | null,
	chanceError: null as string | null,

	getExpiries(): string[] {
		return [...new Set(store.contracts.map((c) => c.expiration_date).filter(Boolean))].sort();
	},
	getSelectedContract(): OptionContract | null {
		return store.contracts.find((c) => c.symbol === store.selectedSymbol) ?? null;
	},
	getSelectedChain(): OptionContract[] {
		return store.activeExpiry
			? store.contracts.filter((c) => c.expiration_date === store.activeExpiry)
			: store.contracts;
	},

	setActiveExpiry(e: string) {
		store.activeExpiry = e;
	},

	async loadChain(s: string) {
		const symbol = s.toUpperCase();
		chainCtl?.abort();
		selectCtl?.abort();
		strategiesCtl?.abort();
		const ctl = (chainCtl = new AbortController());
		if (store.symbol !== symbol) resetForSymbol();
		store.symbol = symbol;
		store.contractsLoading = true;
		store.contractsError = null;
		try {
			const gte = new Date().toISOString().slice(0, 10);
			const lte = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
			const resp = await getOptionChain(symbol, gte, lte, 10, ctl.signal);
			if (ctl.signal.aborted) return;
			store.contracts = resp.contracts || [];
			store.currentPrice = resp.current_price ?? null;
			store.dayChangePct = resp.day_change_pct ?? null;
			store.delayed = resp.delayed ?? true;
			const exps = store.getExpiries();
			if (exps.length > 0 && !exps.includes(store.activeExpiry)) store.activeExpiry = exps[0];
			// Auto-select the ATM contract so every widget renders immediately.
			await store.selectContract(atmContract()?.symbol ?? '');
		} catch (e) {
			if (ctl.signal.aborted || isAbortError(e)) return;
			store.contracts = [];
			store.contractsError = e instanceof Error ? e.message : 'Options chain failed';
		} finally {
			if (chainCtl === ctl) store.contractsLoading = false;
		}
	},

	async selectContract(sym: string) {
		selectCtl?.abort();
		strategiesCtl?.abort();
		const ctl = (selectCtl = new AbortController());
		store.selectedSymbol = sym;
		if (!sym) {
			store.payoff = null;
			store.strategies = null;
			store.strategiesLoading = false;
			store.chance = null;
			return;
		}
		const symbol = store.symbol;
		store.payoff = null;
		store.payoffError = null;
		store.strategies = null;
		store.strategiesError = null;
		store.strategiesLoading = true;
		store.chance = null;
		store.chanceError = null;
		try {
			const payoff = await getOptionPayoff(symbol, sym, ctl.signal);
			if (ctl.signal.aborted) return;
			store.payoff = payoff;
		} catch (e) {
			if (ctl.signal.aborted) return;
			store.payoffError = e instanceof Error ? e.message : 'Payoff failed';
		} finally {
			if (!ctl.signal.aborted) store.payoffLoading = false;
		}
		await refreshStrategies(sym);
		if (ctl.signal.aborted) return;
		// DEV: Pro gate removed during development; re-add the isPro() branch before launch.
		try {
			const chance = await getOptionChance(symbol, sym, ctl.signal);
			if (ctl.signal.aborted) return;
			store.chance = chance;
		} catch (e) {
			if (ctl.signal.aborted) return;
			store.chance = null;
			store.chanceError = e instanceof Error ? e.message : null;
		}
	},

	async setStrategyTf(tf: string) {
		if (tf === store.strategyTf || !store.selectedSymbol) return;
		store.strategyTf = tf;
		await refreshStrategies(store.selectedSymbol);
	}
});

/** A different underlying: drop everything that belongs to the previous one. */
function resetForSymbol() {
	store.contracts = [];
	store.currentPrice = null;
	store.dayChangePct = null;
	store.activeExpiry = '';
	store.selectedSymbol = '';
	store.payoff = null;
	store.payoffError = null;
	store.strategies = null;
	store.strategiesError = null;
	store.strategiesLoading = false;
	store.chance = null;
	store.chanceError = null;
}

// Fetch the strategy suggestions for the selected contract. `store.strategyTf`
// is 'auto' (DTE-matched horizon) or an explicit 1h/1d/1w/1mo override.
async function refreshStrategies(sym: string) {
	strategiesCtl?.abort();
	const ctl = (strategiesCtl = new AbortController());
	store.strategiesLoading = true;
	store.strategiesError = null;
	try {
		const strike = parseStrike(sym);
		const exp = parseExpiration(sym);
		const contract = store.contracts.find((c) => c.symbol === sym);
		const dte = contract?.expiration_date
			? Math.max(0, Math.round((new Date(contract.expiration_date).getTime() - Date.now()) / 86400000))
			: undefined;
		const strategies = await getStrategies(
			store.symbol,
			strike,
			exp.gte,
			exp.lte,
			undefined,
			dte,
			store.strategyTf === 'auto' ? undefined : store.strategyTf,
			ctl.signal
		);
		if (ctl.signal.aborted) return;
		store.strategies = strategies;
	} catch (e) {
		if (ctl.signal.aborted) return;
		store.strategiesError = e instanceof Error ? e.message : 'Strategies failed';
	} finally {
		if (strategiesCtl === ctl) store.strategiesLoading = false;
	}
}

function atmContract(): OptionContract | null {
	if (!store.currentPrice) return store.contracts[0] ?? null;
	let best: OptionContract | null = null;
	let bestDist = Infinity;
	for (const c of store.contracts) {
		const d = Math.abs(c.strike_price - store.currentPrice);
		if (d < bestDist) {
			bestDist = d;
			best = c;
		}
	}
	return best;
}

function parseStrike(contract: string): number {
	const m = contract.match(/[CP](\d{5,8})$/);
	if (m) return parseInt(m[1], 10) / 1000;
	return 0;
}
function parseExpiration(contract: string): { gte: string; lte: string } {
	const m = contract.match(/(\d{6})[CP]/);
	if (m) {
		const d = m[1];
		const formatted = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
		return { gte: formatted, lte: formatted };
	}
	return { gte: '', lte: '' };
}
