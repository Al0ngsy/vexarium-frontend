import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from './contract.svelte';
import { ApiError, getOptionChain, getOptionChance, getOptionPayoff, getStrategies } from './api';
import type { OptionContract, OptionsChainResponse, OptionsPayoffResponse, StrategiesResponse } from './types';

vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	getOptionChain: vi.fn(),
	getOptionPayoff: vi.fn(),
	getOptionChance: vi.fn(),
	getStrategies: vi.fn()
}));

function deferred<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

const C1 = 'AAPL260116C00200000';
const C2 = 'AAPL260116C00210000';
const contract = (symbol: string, strike: number) =>
	({ symbol, strike_price: strike, expiration_date: '2026-01-16', type: 'call' }) as unknown as OptionContract;
const chain = (symbol: string, price: number, ...contracts: OptionContract[]) =>
	({ symbol, current_price: price, day_change_pct: 1, delayed: false, contracts }) as unknown as OptionsChainResponse;
const payoff = (id: string) => ({ id }) as unknown as OptionsPayoffResponse;
const strategies = (timeframe: string) => ({ timeframe, strategies: [] }) as unknown as StrategiesResponse;

function reset() {
	Object.assign(store, {
		symbol: '',
		currentPrice: null,
		dayChangePct: null,
		delayed: true,
		contracts: [],
		contractsLoading: false,
		contractsError: null,
		selectedSymbol: '',
		activeExpiry: '',
		payoff: null,
		payoffLoading: false,
		payoffError: null,
		strategies: null,
		strategiesLoading: false,
		strategiesError: null,
		strategyTf: 'auto',
		chance: null,
		chanceError: null
	});
}

beforeEach(() => {
	reset();
	vi.mocked(getOptionChance).mockResolvedValue({ prob_profit: 0.5 } as never);
	vi.mocked(getStrategies).mockResolvedValue(strategies('1d'));
	vi.mocked(getOptionPayoff).mockResolvedValue(payoff('default'));
});
afterEach(() => vi.clearAllMocks());

describe('contract store races', () => {
	it('a newer contract selection wins over a slower earlier one', async () => {
		store.contracts = [contract(C1, 200), contract(C2, 210)];
		store.symbol = 'AAPL';
		const first = deferred<OptionsPayoffResponse>();
		vi.mocked(getOptionPayoff).mockImplementation((_s, c) =>
			c === C1 ? first.promise : Promise.resolve(payoff('B'))
		);

		const a = store.selectContract(C1);
		const b = store.selectContract(C2);
		await b;
		first.resolve(payoff('A (late)'));
		await a;
		await flush();

		expect(store.selectedSymbol).toBe(C2);
		expect(store.payoff).toEqual(payoff('B'));
		expect(getOptionChance).toHaveBeenCalledTimes(1);
		expect(vi.mocked(getOptionChance).mock.calls[0][1]).toBe(C2);
	});

	it('aborts the requests of the superseded selection', async () => {
		store.contracts = [contract(C1, 200), contract(C2, 210)];
		store.symbol = 'AAPL';
		const signals: (AbortSignal | undefined)[] = [];
		vi.mocked(getOptionPayoff).mockImplementation((_s, _c, signal) => {
			signals.push(signal);
			return new Promise(() => {});
		});
		void store.selectContract(C1);
		void store.selectContract(C2);
		expect(signals[0]?.aborted).toBe(true);
		expect(signals[1]?.aborted).toBe(false);
	});

	it('a failure of the superseded selection never shows up as an error', async () => {
		store.contracts = [contract(C1, 200), contract(C2, 210)];
		store.symbol = 'AAPL';
		const first = deferred<OptionsPayoffResponse>();
		vi.mocked(getOptionPayoff).mockImplementation((_s, c) =>
			c === C1 ? first.promise : Promise.resolve(payoff('B'))
		);
		const a = store.selectContract(C1);
		await store.selectContract(C2);
		first.reject(new ApiError('Options payoff failed: 500', 500));
		await a;
		expect(store.payoffError).toBeNull();
		expect(store.payoff).toEqual(payoff('B'));
	});

	it('a chain load for another symbol aborts the previous one and drops its late response', async () => {
		const aapl = deferred<OptionsChainResponse>();
		const signals: (AbortSignal | undefined)[] = [];
		vi.mocked(getOptionChain).mockImplementation((s, _g, _l, _m, signal) => {
			signals.push(signal);
			return s === 'AAPL' ? aapl.promise : Promise.resolve(chain('MSFT', 400, contract('MSFT260116C00400000', 400)));
		});

		const a = store.loadChain('aapl');
		const b = store.loadChain('MSFT');
		expect(signals[0]?.aborted).toBe(true);
		await b;
		aapl.resolve(chain('AAPL', 200, contract(C1, 200)));
		await a;
		await flush();

		expect(store.symbol).toBe('MSFT');
		expect(store.contracts.map((c) => c.symbol)).toEqual(['MSFT260116C00400000']);
		expect(store.currentPrice).toBe(400);
		expect(store.contractsLoading).toBe(false);
		expect(store.contractsError).toBeNull();
	});

	it('drops the previous underlying’s data as soon as another symbol loads', async () => {
		store.symbol = 'AAPL';
		store.contracts = [contract(C1, 200)];
		store.currentPrice = 200;
		store.selectedSymbol = C1;
		store.payoff = payoff('old');
		vi.mocked(getOptionChain).mockImplementation(() => new Promise(() => {}));
		void store.loadChain('MSFT');
		expect(store.contracts).toEqual([]);
		expect(store.selectedSymbol).toBe('');
		expect(store.payoff).toBeNull();
		expect(store.currentPrice).toBeNull();
		expect(store.contractsLoading).toBe(true);
	});

	it('keeps the old chain visible while the same symbol refreshes', async () => {
		store.symbol = 'AAPL';
		store.contracts = [contract(C1, 200)];
		vi.mocked(getOptionChain).mockImplementation(() => new Promise(() => {}));
		void store.loadChain('AAPL');
		expect(store.contracts).toHaveLength(1);
	});

	it('loads the ATM contract, its payoff, strategies and chance after a chain load', async () => {
		vi.mocked(getOptionChain).mockResolvedValue(
			chain('AAPL', 208, contract(C1, 200), contract(C2, 210))
		);
		await store.loadChain('AAPL');
		expect(store.selectedSymbol).toBe(C2);
		expect(store.payoff).toEqual(payoff('default'));
		expect(store.strategies?.timeframe).toBe('1d');
		expect(store.chance).toEqual({ prob_profit: 0.5 });
		expect(store.contractsLoading).toBe(false);
		expect(store.strategiesLoading).toBe(false);
	});

	it('reports a PRO_FEATURE chance error without failing the other widgets', async () => {
		store.contracts = [contract(C1, 200)];
		store.symbol = 'AAPL';
		vi.mocked(getOptionChance).mockRejectedValue(new ApiError('PRO_FEATURE', 403));
		await store.selectContract(C1);
		expect(store.chanceError).toBe('PRO_FEATURE');
		expect(store.chance).toBeNull();
		expect(store.payoff).toEqual(payoff('default'));
		expect(store.strategies).not.toBeNull();
	});

	it('a strategy timeframe override supersedes the previous strategies load', async () => {
		store.contracts = [contract(C1, 200)];
		store.symbol = 'AAPL';
		store.selectedSymbol = C1;
		const slow = deferred<StrategiesResponse>();
		vi.mocked(getStrategies).mockImplementation((_s, _k, _g, _l, _se, _d, tf) =>
			tf === '1w' ? slow.promise : Promise.resolve(strategies(tf ?? 'auto'))
		);
		const a = store.setStrategyTf('1w');
		const b = store.setStrategyTf('1mo');
		await b;
		slow.resolve(strategies('1w (late)'));
		await a;
		await flush();
		expect(store.strategyTf).toBe('1mo');
		expect(store.strategies?.timeframe).toBe('1mo');
		expect(store.strategiesLoading).toBe(false);
	});
});
