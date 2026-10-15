import { vi } from 'vitest';
import { analysisFixture, bars, fearGreed, finnhub, marketNews } from './fixtures';

export interface RecordedCall {
	method: string;
	url: string;
	authorization: string | null;
	body: string | null;
}

export const calls: RecordedCall[] = [];

/** Analysis POST bodies' timeframes, in request order. */
export const analysisTimeframes = () =>
	calls
		.filter((c) => c.method === 'POST' && new URL(c.url).pathname === '/api/v1/analysis')
		.map((c) => JSON.parse(c.body!).timeframe as string);

/** Stub fetch + EventSource with canned responses for the analysis page. */
export function installBackend() {
	calls.length = 0;
	const json = (data: unknown) =>
		new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

	vi.stubGlobal('fetch', async (input: string | URL, init: RequestInit = {}) => {
		const url = String(input);
		calls.push({
			method: init.method ?? 'GET',
			url,
			authorization: new Headers(init.headers).get('Authorization'),
			body: (init.body as string | undefined) ?? null
		});
		await new Promise((r) => setTimeout(r, 5));
		if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
		const { pathname } = new URL(url);
		if (pathname === '/api/v1/analysis') return json(analysisFixture(JSON.parse(init.body as string).timeframe));
		if (pathname.startsWith('/api/v1/analysis/bars/')) {
			const sym = decodeURIComponent(pathname.split('/').pop()!);
			return json(bars(40, sym === 'SPY' ? 400 : 100, sym === 'SPY' ? 1 : 0.4));
		}
		if (pathname.startsWith('/api/v1/analysis/finnhub/')) return json(finnhub);
		if (pathname === '/api/v1/analysis/market-news') return json(marketNews);
		if (pathname === '/api/v1/analysis/fear-greed') return json(fearGreed);
		if (pathname === '/api/v1/analysis/ai/stream') {
			const enc = new TextEncoder();
			return new Response(
				new ReadableStream({
					start(c) {
						c.enqueue(enc.encode('data: {"chunk":"## Headline\\n- point one"}\n\n'));
						c.enqueue(enc.encode('data: {"chunk":"\\n- point **two** <script>x</script>"}\n\n'));
						c.close();
					}
				}),
				{ status: 200 }
			);
		}
		return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
	});

	vi.stubGlobal(
		'EventSource',
		class {
			onopen = null;
			onmessage = null;
			onerror = null;
			close() {}
		}
	);
}

/** Let timers and promise chains run (the mocked backend answers after 5 ms). */
export const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** Serialise rendered HTML: drop svelte scoping classes/comments and locale-dependent dates. */
export function normalizeHtml(html: string): string {
	return html
		.replace(/ class="svelte-[a-z0-9]+"/g, '')
		.replace(/ svelte-[a-z0-9]+/g, '')
		.replace(/<!--.*?-->/g, '')
		.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, 'DATE')
		.replace(/>\s+</g, '>\n<')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s*/g, '\n');
}
