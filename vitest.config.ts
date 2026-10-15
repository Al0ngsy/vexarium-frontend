import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Unit tests run in plain Node; the SvelteKit plugin supplies the $lib / $app
// aliases and compiles .svelte.ts rune modules. Component tests opt into a DOM
// per file with `// @vitest-environment jsdom`.
export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		// Resolve Svelte's client runtime so mount() works in jsdom tests.
		conditions: ['browser']
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
