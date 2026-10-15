import { optionsSeo } from '$lib/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => ({ seo: optionsSeo(params.symbol) });
