import type { PageLoad } from './$types';

// Static content only: rendered to HTML at build time.
export const prerender = true;

export const load: PageLoad = () => ({
	seo: {
		title: 'Glossary — VEXARIUM',
		description:
			'Every technical term VEXARIUM shows, explained in plain English: indicators, greeks, options, strategies, portfolio terms and market metrics.'
	}
});
