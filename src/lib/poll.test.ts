import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollUntil } from './poll';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('pollUntil', () => {
	it('checks immediately and resolves true without waiting', async () => {
		const check = vi.fn().mockResolvedValue(true);
		await expect(pollUntil(check, { intervalMs: 2000, timeoutMs: 30_000 })).resolves.toBe(true);
		expect(check).toHaveBeenCalledOnce();
	});

	it('retries every interval until the check succeeds', async () => {
		const check = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const p = pollUntil(check, { intervalMs: 2000, timeoutMs: 30_000 });
		await vi.advanceTimersByTimeAsync(0);
		expect(check).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(2000);
		expect(check).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(2000);
		await expect(p).resolves.toBe(true);
		expect(check).toHaveBeenCalledTimes(3);
	});

	it('gives up after the timeout and resolves false', async () => {
		const check = vi.fn().mockResolvedValue(false);
		const p = pollUntil(check, { intervalMs: 2000, timeoutMs: 30_000 });
		await vi.advanceTimersByTimeAsync(60_000);
		await expect(p).resolves.toBe(false);
		expect(check.mock.calls.length).toBeGreaterThanOrEqual(15);
		expect(check.mock.calls.length).toBeLessThanOrEqual(17);
		const calls = check.mock.calls.length;
		await vi.advanceTimersByTimeAsync(10_000);
		expect(check).toHaveBeenCalledTimes(calls);
	});

	it('never overlaps a slow check', async () => {
		let running = 0;
		let maxRunning = 0;
		const check = vi.fn(async () => {
			running++;
			maxRunning = Math.max(maxRunning, running);
			await new Promise((r) => setTimeout(r, 5000));
			running--;
			return false;
		});
		const p = pollUntil(check, { intervalMs: 1000, timeoutMs: 20_000 });
		await vi.advanceTimersByTimeAsync(40_000);
		await p;
		expect(maxRunning).toBe(1);
	});

	it('stops when aborted, also while waiting', async () => {
		const ctrl = new AbortController();
		const check = vi.fn().mockResolvedValue(false);
		const p = pollUntil(check, { intervalMs: 2000, timeoutMs: 30_000, signal: ctrl.signal });
		await vi.advanceTimersByTimeAsync(2500);
		const calls = check.mock.calls.length;
		ctrl.abort();
		await expect(p).resolves.toBe(false);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(check).toHaveBeenCalledTimes(calls);
	});
});
