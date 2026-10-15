import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisStore } from './analysis.svelte';
import { ApiError, analyze, getBars, getFearGreed, getFinnhub, getMarketNews, streamAIAnalysis } from './api';
import { addRecentAnalysis } from './storage';
import type { AnalysisResponse, PricePoint, Verdict } from './types';

vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	analyze: vi.fn(),
	getBars: vi.fn(),
	getFinnhub: vi.fn(),
	getMarketNews: vi.fn(),
	getFearGreed: vi.fn(),
	streamAIAnalysis: vi.fn()
}));
vi.mock('./storage', () => ({ addRecentAnalysis: vi.fn() }));

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

function makeAnalysis(symbol: string, timeframe: string, verdict: Verdict = 'buy'): AnalysisResponse {
	return {
		symbol,
		asset_type: 'stock',
		timeframe,
		current_price: 10,
		overall: { overall_verdict: verdict, score: 1, indicator_count: 0, breakdown: [] },
		indicators: []
	};
}

interface AnalyzeCall {
	symbol: string;
	tf: string;
	signal: AbortSignal | undefined;
	d: ReturnType<typeof deferred<AnalysisResponse>>;
}
let calls: AnalyzeCall[] = [];
const callsFor = (symbol: string, tf?: string) =>
	calls.filter((c) => c.symbol === symbol && (tf === undefined || c.tf === tf));

/** analyze() whose responses the test settles by hand; abort rejects like fetch does. */
function manualAnalyze({ rejectOnAbort = true } = {}) {
	vi.mocked(analyze).mockImplementation((symbol, _assetType, _opts, tf = '1d', signal) => {
		const d = deferred<AnalysisResponse>();
		calls.push({ symbol, tf, signal, d });
		if (rejectOnAbort) {
			signal?.addEventListener('abort', () => d.reject(new DOMException('aborted', 'AbortError')));
		}
		return d.promise;
	});
}

const bar = (t: string, close: number): PricePoint => ({ t, open: close, high: close, low: close, close });

beforeEach(() => {
	calls = [];
	vi.mocked(getBars).mockResolvedValue([]);
	vi.mocked(getFinnhub).mockResolvedValue({ insider: [], earnings: [], peers: [] });
	vi.mocked(getMarketNews).mockResolvedValue({
		sentiment: { sentiment_score: 0, article_count: 0, summary: '' },
		articles: []
	});
	vi.mocked(getFearGreed).mockResolvedValue({ score: 50 });
	vi.mocked(streamAIAnalysis).mockResolvedValue('');
	manualAnalyze();
});
afterEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
});

describe('AnalysisStore: request count', () => {
	it('requests /analysis once per timeframe (1d, 1w, 1mo) when a symbol loads', () => {
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		expect(calls.map((c) => c.tf).sort()).toEqual(['1d', '1mo', '1w']);
		expect(callsFor('AAPL', '1d')).toHaveLength(1);
		store.dispose();
	});

	it('ignores a repeated setSymbol for the active symbol', () => {
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		store.setSymbol('AAPL');
		expect(calls).toHaveLength(3);
		expect(getBars).toHaveBeenCalledTimes(2); // symbol bars + SPY comparator
		store.dispose();
	});

	it('serves a timeframe switch from the already requested data', async () => {
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		for (const c of calls) c.d.resolve(makeAnalysis('AAPL', c.tf));
		await flush();
		store.indicatorTf = '1w';
		await flush();
		expect(calls).toHaveLength(3);
		expect(store.analysis?.timeframe).toBe('1w');
		store.dispose();
	});

	it('does not cache a failed request', async () => {
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		callsFor('AAPL', '1d')[0].d.reject(new ApiError('Analysis failed: 500', 500));
		await flush();
		expect(store.error).toBe('Analysis failed: 500');
		expect(store.analysis).toBeNull();
		store.retry();
		expect(callsFor('AAPL', '1d')).toHaveLength(2);
		callsFor('AAPL', '1d')[1].d.resolve(makeAnalysis('AAPL', '1d'));
		await flush();
		expect(store.error).toBeNull();
		expect(store.analysis?.symbol).toBe('AAPL');
		store.dispose();
	});
});

describe('AnalysisStore: stale responses', () => {
	it('aborts every request of the previous symbol and never applies its response', async () => {
		manualAnalyze({ rejectOnAbort: false }); // even a response that slips through must be dropped
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		const old = [...calls];
		store.setSymbol('MSFT');
		expect(old.every((c) => c.signal?.aborted)).toBe(true);
		expect(callsFor('MSFT')).toHaveLength(3);

		for (const c of old) c.d.resolve(makeAnalysis('AAPL', c.tf, 'strong_buy'));
		await flush();
		expect(store.analysis).toBeNull();
		expect(store.timeframeVerdicts).toEqual({});
		expect(addRecentAnalysis).not.toHaveBeenCalled();

		callsFor('MSFT', '1d')[0].d.resolve(makeAnalysis('MSFT', '1d'));
		await flush();
		expect(store.analysis?.symbol).toBe('MSFT');
		expect(store.timeframeVerdicts).toEqual({ '1d': 'buy' });
		store.dispose();
	});

	it('aborts the symbol-scoped side requests too', () => {
		const signals: (AbortSignal | undefined)[] = [];
		vi.mocked(getBars).mockImplementation((_s, _t, _l, signal) => {
			signals.push(signal);
			return new Promise(() => {});
		});
		vi.mocked(getFinnhub).mockImplementation((_s, signal) => {
			signals.push(signal);
			return new Promise(() => {});
		});
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		expect(signals.length).toBeGreaterThanOrEqual(3);
		store.setSymbol('MSFT');
		expect(signals.slice(0, 3).every((s) => s?.aborted)).toBe(true);
		store.dispose();
	});

	it('drops a late finnhub response of the previous symbol', async () => {
		const d = deferred<{ insider: []; earnings: []; peers: string[] }>();
		vi.mocked(getFinnhub).mockReturnValueOnce(d.promise);
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		store.setSymbol('MSFT');
		d.resolve({ insider: [], earnings: [], peers: ['OLD'] });
		await flush();
		expect(store.finnhub?.peers).not.toContain('OLD');
		store.dispose();
	});

	it('timeframe switch: the newest selection wins, even when answers arrive out of order', async () => {
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		for (const c of calls) c.d.resolve(makeAnalysis('AAPL', c.tf));
		await flush();

		store.indicatorTf = '15m';
		store.indicatorTf = '30m';
		const c15 = callsFor('AAPL', '15m')[0];
		const c30 = callsFor('AAPL', '30m')[0];
		c30.d.resolve(makeAnalysis('AAPL', '30m'));
		await flush();
		c15.d.resolve(makeAnalysis('AAPL', '15m'));
		await flush();
		expect(store.analysis?.timeframe).toBe('30m');
		store.dispose();
	});

	it('timeframe switch keeps the current content visible while loading', async () => {
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		for (const c of calls) c.d.resolve(makeAnalysis('AAPL', c.tf));
		await flush();
		store.indicatorTf = '15m';
		expect(store.analysis?.timeframe).toBe('1d');
		expect(store.aiMessage).toBeNull();
		expect(streamAIAnalysis).toHaveBeenCalledTimes(1); // no AI restart
		callsFor('AAPL', '15m')[0].d.reject(new ApiError('Analysis failed: 500', 500));
		await flush();
		expect(store.analysis?.timeframe).toBe('1d'); // a failed quiet reload keeps the old result
		expect(store.error).toBeNull();
		store.dispose();
	});
});

describe('AnalysisStore: AI stream', () => {
	function manualAI() {
		const runs: { onChunk: (t: string) => void; signal: AbortSignal | undefined; d: ReturnType<typeof deferred<string>> }[] = [];
		vi.mocked(streamAIAnalysis).mockImplementation((_sym, _type, onChunk, signal) => {
			const d = deferred<string>();
			runs.push({ onChunk, signal, d });
			signal?.addEventListener('abort', () => d.reject(new DOMException('aborted', 'AbortError')));
			return d.promise;
		});
		return runs;
	}

	async function loaded(store: AnalysisStore) {
		store.setSymbol('AAPL');
		for (const c of calls) c.d.resolve(makeAnalysis('AAPL', c.tf));
		await flush();
	}

	it('starts after the analysis, accumulates chunks and clears the loading flag', async () => {
		const runs = manualAI();
		const store = new AnalysisStore();
		await loaded(store);
		expect(runs).toHaveLength(1);
		expect(store.aiLoading).toBe(true);
		runs[0].onChunk('Hello ');
		runs[0].onChunk('world');
		expect(store.aiMessage).toBe('Hello world');
		runs[0].d.resolve('Hello world');
		await flush();
		expect(store.aiLoading).toBe(false);
		expect(store.aiMessage).toBe('Hello world');
		store.dispose();
	});

	it('a newer run aborts the previous one and drops its chunks and its error', async () => {
		const runs = manualAI();
		const store = new AnalysisStore();
		await loaded(store);
		void store.runAI();
		expect(runs[0].signal?.aborted).toBe(true);
		runs[0].onChunk('stale');
		await flush();
		expect(store.aiMessage).toBeNull();
		runs[1].onChunk('fresh');
		runs[1].d.resolve('fresh');
		await flush();
		expect(store.aiMessage).toBe('fresh');
		expect(store.aiLoading).toBe(false);
		store.dispose();
	});

	it('a symbol change aborts the stream', async () => {
		const runs = manualAI();
		const store = new AnalysisStore();
		await loaded(store);
		store.setSymbol('MSFT');
		expect(runs[0].signal?.aborted).toBe(true);
		runs[0].onChunk('stale');
		await flush();
		expect(store.aiMessage).toBeNull();
		expect(store.aiLoading).toBe(false);
		store.dispose();
	});

	it('shows the backend message for a failed stream', async () => {
		const runs = manualAI();
		const store = new AnalysisStore();
		await loaded(store);
		runs[0].d.reject(new ApiError('AI analysis failed: Rate limit exceeded', 429, 'Rate limit exceeded'));
		await flush();
		expect(store.aiMessage).toBe('AI analysis failed: Rate limit exceeded');
		expect(store.aiLoading).toBe(false);
		store.dispose();
	});
});

describe('AnalysisStore: chart bars and comparator', () => {
	it('falls back to SPY when the comparator equals the symbol, and has none for SPY itself', () => {
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		expect(vi.mocked(getBars).mock.calls.map((c) => c[0])).toEqual(['AAPL', 'SPY']);
		store.compareSymbol = 'AAPL';
		expect(store.compareSymbol).toBe('SPY');
		store.setSymbol('SPY');
		const spyCalls = vi.mocked(getBars).mock.calls.filter((c) => c[0] === 'SPY');
		expect(spyCalls).toHaveLength(2); // once as comparator for AAPL, once as the symbol's own bars
		expect(store.compareBars).toBeNull();
		store.dispose();
	});

	it('a comparator change supersedes the previous comparator load', async () => {
		const loads: { cs: string; d: ReturnType<typeof deferred<PricePoint[]>>; signal?: AbortSignal }[] = [];
		vi.mocked(getBars).mockImplementation((s, _tf, _l, signal) => {
			const d = deferred<PricePoint[]>();
			loads.push({ cs: s, d, signal });
			return d.promise;
		});
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		store.compareSymbol = 'MSFT';
		const spy = loads.find((l) => l.cs === 'SPY')!;
		const msft = loads.find((l) => l.cs === 'MSFT')!;
		expect(spy.signal?.aborted).toBe(true);
		msft.d.resolve([bar('2026-06-01', 5)]);
		await flush();
		spy.d.resolve([bar('2026-06-01', 999)]);
		await flush();
		expect(store.compareBars?.[0].close).toBe(5);
		store.dispose();
	});

	it('ignores bars of a superseded chart timeframe', async () => {
		const loads: { tf: string; d: ReturnType<typeof deferred<PricePoint[]>> }[] = [];
		vi.mocked(getBars).mockImplementation((s, tf = '1d') => {
			const d = deferred<PricePoint[]>();
			if (s === 'AAPL') loads.push({ tf, d });
			return s === 'AAPL' ? d.promise : Promise.resolve([]);
		});
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		store.chartTf = '1w';
		const [first, second] = loads;
		second.d.resolve([bar('2026-06-02', 2)]);
		await flush();
		first.d.resolve([bar('2026-06-01', 1)]);
		await flush();
		expect(store.chartBars).toEqual([bar('2026-06-02', 2)]);
		expect(store.barsLoading).toBe(false);
		store.dispose();
	});

	it('polls intraday timeframes at the bar duration, merges new bars, and stops on dispose', async () => {
		vi.useFakeTimers();
		vi.mocked(getBars).mockImplementation(async (s) => (s === 'AAPL' ? [bar('t1', 1), bar('t2', 2)] : []));
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		store.chartTf = '5m';
		await vi.advanceTimersByTimeAsync(0);
		const own = () => vi.mocked(getBars).mock.calls.filter((c) => c[0] === 'AAPL' && c[1] === '5m').length;
		expect(own()).toBe(1);

		vi.mocked(getBars).mockImplementation(async (s) => (s === 'AAPL' ? [bar('t2', 20), bar('t3', 3)] : []));
		await vi.advanceTimersByTimeAsync(5 * 60_000);
		expect(own()).toBe(2);
		expect(store.chartBars?.map((b) => [b.t, b.close])).toEqual([
			['t1', 1],
			['t2', 20],
			['t3', 3]
		]);

		store.dispose();
		await vi.advanceTimersByTimeAsync(60 * 60_000);
		expect(own()).toBe(2);
	});

	describe('with a tab that can be hidden', () => {
		/** Minimal document: a hidden flag and visibilitychange events. */
		function fakeDocument(hidden = false) {
			const doc = Object.assign(new EventTarget(), { hidden });
			vi.stubGlobal('document', doc);
			return {
				setHidden(h: boolean) {
					doc.hidden = h;
					doc.dispatchEvent(new Event('visibilitychange'));
				}
			};
		}
		const own = () => vi.mocked(getBars).mock.calls.filter((c) => c[0] === 'AAPL' && c[1] === '5m').length;
		afterEach(() => vi.unstubAllGlobals());

		it('stops polling while hidden and refreshes once, immediately, when visible again', async () => {
			vi.useFakeTimers();
			const tab = fakeDocument();
			const store = new AnalysisStore();
			store.setSymbol('AAPL');
			store.chartTf = '5m';
			await vi.advanceTimersByTimeAsync(0);
			expect(own()).toBe(1);

			await vi.advanceTimersByTimeAsync(5 * 60_000);
			expect(own()).toBe(2);

			tab.setHidden(true);
			await vi.advanceTimersByTimeAsync(60 * 60_000);
			expect(own()).toBe(2); // nothing while hidden

			tab.setHidden(false);
			await vi.advanceTimersByTimeAsync(0);
			expect(own()).toBe(3); // one refresh right away
			await vi.advanceTimersByTimeAsync(5 * 60_000);
			expect(own()).toBe(4); // cadence resumes from the refresh
			store.dispose();
		});

		it('does not start the cadence for a tab that loads in the background, until it becomes visible', async () => {
			vi.useFakeTimers();
			const tab = fakeDocument(true);
			const store = new AnalysisStore();
			store.setSymbol('AAPL');
			store.chartTf = '5m';
			await vi.advanceTimersByTimeAsync(0);
			expect(own()).toBe(1); // the initial load still happens
			await vi.advanceTimersByTimeAsync(30 * 60_000);
			expect(own()).toBe(1);
			tab.setHidden(false);
			await vi.advanceTimersByTimeAsync(0);
			expect(own()).toBe(2);
			store.dispose();
		});

		it('removes the visibility listener on dispose and on a timeframe change', async () => {
			vi.useFakeTimers();
			const tab = fakeDocument();
			const store = new AnalysisStore();
			store.setSymbol('AAPL');
			store.chartTf = '5m';
			await vi.advanceTimersByTimeAsync(0);
			store.chartTf = '1d'; // not intraday: no polling, no listener
			await vi.advanceTimersByTimeAsync(0);
			const calls = vi.mocked(getBars).mock.calls.length;
			tab.setHidden(true);
			tab.setHidden(false);
			await vi.advanceTimersByTimeAsync(0);
			expect(vi.mocked(getBars).mock.calls.length).toBe(calls);

			store.chartTf = '5m';
			await vi.advanceTimersByTimeAsync(0);
			store.dispose();
			const afterDispose = vi.mocked(getBars).mock.calls.length;
			tab.setHidden(true);
			tab.setHidden(false);
			await vi.advanceTimersByTimeAsync(10 * 60_000);
			expect(vi.mocked(getBars).mock.calls.length).toBe(afterDispose);
		});

		it('keeps a single poller when the tab flips repeatedly', async () => {
			vi.useFakeTimers();
			const tab = fakeDocument();
			const store = new AnalysisStore();
			store.setSymbol('AAPL');
			store.chartTf = '5m';
			await vi.advanceTimersByTimeAsync(0);
			tab.setHidden(true);
			tab.setHidden(false);
			tab.setHidden(true);
			tab.setHidden(false);
			await vi.advanceTimersByTimeAsync(0);
			const before = own();
			await vi.advanceTimersByTimeAsync(5 * 60_000);
			expect(own()).toBe(before + 1);
			store.dispose();
		});
	});

	it('does not poll daily timeframes and clears the timer when the symbol changes', async () => {
		vi.useFakeTimers();
		const store = new AnalysisStore();
		store.setSymbol('AAPL');
		await vi.advanceTimersByTimeAsync(60 * 60_000);
		expect(vi.mocked(getBars).mock.calls.filter((c) => c[0] === 'AAPL')).toHaveLength(1);

		store.chartTf = '1m';
		store.setSymbol('MSFT');
		const before = vi.mocked(getBars).mock.calls.filter((c) => c[0] === 'AAPL').length;
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(vi.mocked(getBars).mock.calls.filter((c) => c[0] === 'AAPL')).toHaveLength(before);
		store.dispose();
	});
});

describe('AnalysisStore: indicator exclusion', () => {
	const KEY = 'vexarium:indicators:off';
	let storage: Map<string, string>;
	beforeEach(() => {
		storage = new Map();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => storage.get(k) ?? null,
			setItem: (k: string, v: string) => void storage.set(k, v)
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	const withIndicators = (store: AnalysisStore) => {
		store.analysis = {
			...makeAnalysis('AAPL', '1d'),
			indicators: [
				{ name: 'A', verdict: 'strong_buy', value: null },
				{ name: 'B', verdict: 'buy', value: null },
				{ name: 'C', verdict: 'buy', value: null },
				{ name: 'D', verdict: 'strong_buy', value: null }
			]
		};
	};

	it('recomputes the client verdict and persists the choice', () => {
		const store = new AnalysisStore();
		withIndicators(store);
		expect(store.client).toMatchObject({ score: 6, verdict: 'strong_buy', count: 4 });
		store.toggleIndicator('D');
		expect(store.client).toMatchObject({ score: 4, verdict: 'buy', count: 3 });
		expect(JSON.parse(storage.get(KEY)!)).toEqual({ D: true });
		store.toggleIndicator('D');
		expect(store.client.count).toBe(4);
		expect(JSON.parse(storage.get(KEY)!)).toEqual({ D: false });
	});

	it('restores exclusions from storage and survives corrupt storage', () => {
		storage.set(KEY, JSON.stringify({ A: true }));
		const store = new AnalysisStore();
		withIndicators(store);
		expect(store.client.count).toBe(3);

		storage.set(KEY, '{not json');
		expect(new AnalysisStore().excludedInd).toEqual({});
	});
});
