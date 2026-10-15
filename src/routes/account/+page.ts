import type { PageLoad } from './$types';
import { privateSeo } from '$lib/seo';

// Not prerendered: the page depends on the session and on the URL's query string.
export const load: PageLoad = () => ({ seo: privateSeo('Account') });
