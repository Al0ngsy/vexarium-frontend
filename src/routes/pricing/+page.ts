import type { PageLoad } from './$types';

// The plans are static; the signed-in state is resolved on the client in onMount.
export const prerender = true;

export const load: PageLoad = () => ({
	seo: {
		title: 'Pricing — VEXARIUM',
		description:
			'VEXARIUM Free and Pro plans: all technical indicators for free, Pro adds unlimited AI analysis and full options strategy suggestions.'
	}
});
