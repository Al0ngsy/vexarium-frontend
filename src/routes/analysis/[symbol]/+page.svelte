<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	// Single-page redesign: the health check now lives on the home page.
	// Keep this route as a redirect so old links/bookmarks still work.
	const symbol = $derived(String(page.params.symbol || '').toUpperCase());

	$effect(() => {
		if (symbol) {
			goto(`/?symbol=${symbol}`, { replaceState: true });
		}
	});
</script>

<div class="flex min-h-[50vh] items-center justify-center">
	<p class="label" style="color: var(--foreground-muted)">LOADING {symbol}…</p>
</div>
