<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	// SPA redesign: the options workspace now lives on the home page
	// (/?symbol=X&mode=options). Keep this route as a redirect so old
	// links/bookmarks still work.
	const symbol = $derived(String(page.params.symbol || '').toUpperCase());

	$effect(() => {
		if (symbol) {
			goto(`/?symbol=${symbol}&mode=options`, { replaceState: true });
		}
	});
</script>

<div class="flex min-h-[50vh] items-center justify-center">
	<p class="label" style="color: var(--foreground-muted)">LOADING {symbol} OPTIONS…</p>
</div>
