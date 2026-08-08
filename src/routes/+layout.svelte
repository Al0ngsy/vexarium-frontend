<script lang="ts">
	import { onMount } from "svelte";
	import favicon from "$lib/assets/favicon.svg";
	import { wakeUp } from "$lib/api";
	import "../app.css";
	import TopBar from "../components/TopBar.svelte";
	import ConsentBanner from "../components/ConsentBanner.svelte";

	let { children } = $props();

	// Render free tier sleeps after ~15 min of inactivity and cold-starts on the
	// first request. Ping /health on load and whenever the tab regains focus so
	// the backend is warm by the time the user searches.
	onMount(() => {
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
	<title>VEXARIUM</title>
	<meta
		name="description"
		content="VEXARIUM — check before you buy or sell. Technical indicator and options analysis. Informational only, not financial advice."
	/>
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
		<span>VEXARIUM — INFORMATIONAL ONLY, NOT FINANCIAL ADVICE</span>
		<nav>
			<a href="/legal/impressum">Impressum</a>
			<a href="/legal/disclaimer">Disclaimer</a>
			<a href="/legal/terms">Terms</a>
			<a href="/legal/privacy">Privacy</a>
		</nav>
	</footer>
</div>

<ConsentBanner />
