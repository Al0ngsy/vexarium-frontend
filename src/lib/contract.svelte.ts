import { getOptionChain, getOptionPayoff, getOptionChance, getStrategies } from './api';
import { getToken, isPro } from './auth.svelte';
import type {
	OptionChanceResponse,
	OptionContract,
	OptionsPayoffResponse,
	StrategiesResponse
} from './types';

// Shared selected-contract store for the options workspace. The chain widget
// loads the chain and selects a contract; payoff / greeks / probability /
// matrix / strategies all react to the same selection.
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
		store.symbol = s.toUpperCase();
		store.contractsLoading = true;
		store.contractsError = null;
		try {
			const gte = new Date().toISOString().slice(0, 10);
			const lte = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
			const resp = await getOptionChain(store.symbol, gte, lte, 10);
			store.contracts = resp.contracts || [];
			store.currentPrice = resp.current_price ?? null;
			store.dayChangePct = resp.day_change_pct ?? null;
			store.delayed = resp.delayed ?? true;
			const exps = store.getExpiries();
			if (exps.length > 0 && !exps.includes(store.activeExpiry)) store.activeExpiry = exps[0];
			// Auto-select the ATM contract so every widget renders immediately.
			await store.selectContract(atmContract()?.symbol ?? '');
		} catch (e) {
			store.contracts = [];
			store.contractsError = e instanceof Error ? e.message : 'Options chain failed';
		} finally {
			store.contractsLoading = false;
		}
	},

	async selectContract(sym: string) {
		store.selectedSymbol = sym;
		if (!sym) {
			store.payoff = null;
			store.strategies = null;
			store.chance = null;
			return;
		}
		store.payoff = null;
		store.payoffError = null;
		store.strategies = null;
		store.strategiesError = null;
		store.strategiesLoading = true;
		store.chance = null;
		store.chanceError = null;
		try {
			store.payoff = await getOptionPayoff(store.symbol, sym);
		} catch (e) {
			store.payoffError = e instanceof Error ? e.message : 'Payoff failed';
		} finally {
			store.payoffLoading = false;
		}
		try {
			const strike = parseStrike(sym);
			const exp = parseExpiration(sym);
			store.strategies = await getStrategies(store.symbol, 'hold', strike, exp.gte, exp.lte);
		} catch (e) {
			store.strategiesError = e instanceof Error ? e.message : 'Strategies failed';
		} finally {
			store.strategiesLoading = false;
		}
		if (isPro()) {
			try {
				store.chance = await getOptionChance(store.symbol, sym, getToken() ?? undefined);
			} catch (e) {
				store.chance = null;
				store.chanceError = e instanceof Error ? e.message : null;
			}
		} else {
			store.chanceError = 'PRO_FEATURE';
		}
	}
});

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
