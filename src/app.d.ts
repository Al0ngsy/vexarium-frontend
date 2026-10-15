// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Seo } from '$lib/seo';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// Pages set `seo` in their load function; the root layout renders it.
		interface PageData {
			seo?: Seo;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
