import { stockSeo } from '$lib/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({ seo: stockSeo(params.symbol) });
