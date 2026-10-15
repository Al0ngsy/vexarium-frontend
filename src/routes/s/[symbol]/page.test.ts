// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionToken, setSessionToken } from '$lib/session';
import { analysisTimeframes, calls, installBackend, normalizeHtml, settle } from '../../../test/fetch-mock';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { params: { symbol: 'AAPL' }, url: new URL('http://localhost/s/AAPL') }
}));
// Gridstack and lightweight-charts need real layout / canvas, neither exists in jsdom.
vi.mock('gridstack', () => ({
	GridStack: { init: () => ({ destroy() {}, makeWidget() {}, update() {}, on() {}, engine: { nodes: [] } }) }
}));
vi.mock('gridstack/dist/gridstack.min.css', () => ({}));
vi.mock('../../../components/IndicatorChart.svelte', async () => import('../../../test/IndicatorChartStub.svelte'));

let target: HTMLElement;
let app: ReturnType<typeof mount>;

beforeEach(() => {
	localStorage.clear();
	installBackend();
	target = document.body.appendChild(document.createElement('div'));
});
afterEach(() => {
	unmount(app);
	target.remove();
	clearSessionToken();
	vi.unstubAllGlobals();
});

const html = () => normalizeHtml(target.innerHTML);

describe('/s/[symbol] page', () => {
	it('requests /analysis exactly once per timeframe on load', async () => {
		app = mount(Page, { target });
		await settle();
		expect(analysisTimeframes().sort()).toEqual(['1d', '1mo', '1w']);
	});

	it('does not refetch when the indicator timeframe tab is switched', async () => {
		app = mount(Page, { target });
		await settle();
		target.querySelectorAll<HTMLElement>('.tf-summary-card')[1].click();
		await settle();
		flushSync();
		expect(analysisTimeframes().sort()).toEqual(['1d', '1mo', '1w']);
		expect(target.querySelector('.tf-summary-card.active .label')?.textContent).toBe('1 week');
	});

	it('streams the AI opinion with the Authorization header, token never in a URL', async () => {
		setSessionToken('test.jwt.token');
		app = mount(Page, { target });
		await settle();
		const ai = calls.find((c) => c.url.endsWith('/api/v1/analysis/ai/stream'))!;
		expect(ai.authorization).toBe('Bearer test.jwt.token');
		expect(calls.every((c) => !c.url.includes('token'))).toBe(true);
		const body = target.querySelector('.ai-body')!;
		expect(body.innerHTML).toContain('<h2>Headline</h2>');
		expect(body.innerHTML).toContain('<strong>two</strong>');
		expect(body.innerHTML).not.toContain('<script>'); // LLM markup stays escaped
	});

	it('renders the loaded page unchanged (structure, classes and widget ids)', async () => {
		app = mount(Page, { target });
		await settle(400);
		flushSync();
		await expect(html()).toMatchFileSnapshot('./__snapshots__/loaded.html');
	});

	it('keeps the structure after switching timeframe, excluding an indicator and changing the comparator', async () => {
		app = mount(Page, { target });
		await settle(400);
		target.querySelectorAll<HTMLElement>('.tf-summary-card')[1].click();
		target.querySelector<HTMLElement>('.check')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const [chartTf, compare] = target.querySelectorAll<HTMLSelectElement>('select.tf-select');
		chartTf.value = '1w';
		chartTf.dispatchEvent(new Event('change', { bubbles: true }));
		compare.value = 'MSFT';
		compare.dispatchEvent(new Event('change', { bubbles: true }));
		await settle(400);
		flushSync();
		await expect(html()).toMatchFileSnapshot('./__snapshots__/after-interaction.html');
	});

	it('exposes every analysis widget id the saved layouts refer to', async () => {
		app = mount(Page, { target });
		await settle();
		const ids = [...target.querySelectorAll<HTMLElement>('.grid-stack-item')].map((el) => el.dataset.wid);
		expect(ids).toEqual([
			'price-chart', 'vitals', 'indicator-checks', 'ai-opinion', 'company', 'watchlist', 'news',
			'fear-greed', 'insider', 'earnings', 'peers', 'patterns', 'stats'
		]);
	});
});
