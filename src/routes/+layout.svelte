<script lang="ts">
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import favicon from "$lib/assets/favicon.svg";
	import { wakeUp } from "$lib/api";
	import { initAuth } from "$lib/auth.svelte";
	import { DEFAULT_SEO } from "$lib/seo";
	import "../app.css";
	import TopBar from "../components/TopBar.svelte";
	import ConsentBanner from "../components/ConsentBanner.svelte";

	let { children } = $props();

	// Pages provide `seo` from their load function; everything else gets the default.
	const seo = $derived(page.data.seo ?? DEFAULT_SEO);

	// Render free tier sleeps after ~15 min of inactivity and cold-starts on the
	// first request. Ping /health on load and whenever the tab regains focus so
	// the backend is warm by the time the user searches.
	onMount(() => {
		initAuth();
		wakeUp();
		const onVisibility = () => {
			if (document.visibilityState === "visible") wakeUp();
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	{#if seo.noindex}
		<meta name="robots" content="noindex" />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="VEXARIUM" />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- Full-width sticky topbar -->
	<TopBar />

	<!-- Full-width main (no max-width container on dashboard views) -->
	<main class="flex-1 px-5 py-4">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="app-footer">
		<span>VEXARIUM: informational only, not financial advice</span>
		<nav>
			<a href="/glossary">Glossary</a>
			<a href="/legal/impressum">Impressum</a>
			<a href="/legal/disclaimer">Disclaimer</a>
			<a href="/legal/terms">Terms</a>
			<a href="/legal/privacy">Privacy</a>
		</nav>
	</footer>
</div>

<ConsentBanner />
