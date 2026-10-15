import { describe, expect, it } from 'vitest';
import { DEFAULT_SEO, normalizeSymbol, optionsSeo, privateSeo, stockSeo } from './seo';

describe('seo', () => {
	it('normalises symbols from the URL', () => {
		expect(normalizeSymbol(' aapl ')).toBe('AAPL');
		expect(normalizeSymbol('brk.b')).toBe('BRK.B');
	});

	it('names the symbol in the stock title and description', () => {
		const s = stockSeo('msft');
		expect(s.title).toContain('MSFT');
		expect(s.title).toContain('VEXARIUM');
		expect(s.description).toContain('MSFT');
		expect(s.description).toMatch(/not financial advice/i);
	});

	it('gives the options page its own wording', () => {
		const o = optionsSeo('msft');
		expect(o.title).toContain('MSFT');
		expect(o.title).toMatch(/options/i);
		expect(o.title).not.toBe(stockSeo('msft').title);
		expect(o.description).toContain('MSFT');
	});

	it('keeps titles short enough for search results and descriptions informative', () => {
		for (const s of [stockSeo('AAPL'), optionsSeo('AAPL'), DEFAULT_SEO]) {
			expect(s.title.length).toBeLessThanOrEqual(70);
			expect(s.description.length).toBeGreaterThan(60);
			expect(s.description.length).toBeLessThanOrEqual(320);
		}
	});
});

describe('privateSeo', () => {
  it('titles the page and marks it noindex', () => {
    const s = privateSeo('Log in');
    expect(s.title).toBe('Log in | VEXARIUM');
    expect(s.noindex).toBe(true);
    expect(DEFAULT_SEO.noindex).toBeUndefined();
  });
});
