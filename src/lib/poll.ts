/** Call `check` now and then every `intervalMs` until it resolves true, the
 * `timeoutMs` budget is used up, or `signal` aborts. Resolves with whether
 * `check` ever succeeded. Calls never overlap: the next one is scheduled only
 * after the previous one has finished. */
export async function pollUntil(
	check: () => Promise<boolean>,
	{ intervalMs, timeoutMs, signal }: { intervalMs: number; timeoutMs: number; signal?: AbortSignal }
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (signal?.aborted) return false;
		if (await check()) return true;
		const wait = Math.min(intervalMs, deadline - Date.now());
		if (wait <= 0 || signal?.aborted) return false;
		await new Promise<void>((resolve) => {
			const done = () => {
				clearTimeout(timer);
				signal?.removeEventListener('abort', done);
				resolve();
			};
			const timer = setTimeout(done, wait);
			signal?.addEventListener('abort', done);
		});
	}
}
