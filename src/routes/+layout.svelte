<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AuthModal from '../components/AuthModal.svelte';
	import ConsentBanner from '../components/ConsentBanner.svelte';
	import { initAuth, getUser, getToken, logout } from '$lib/auth.svelte';

	let { children } = $props();

	let authOpen = $state(false);
	let currentUser = $state<{ id: number; email: string; tier: string } | null>(null);
	let authed = $state(false);

	onMount(() => {
		initAuth();
		currentUser = getUser();
		authed = !!getToken();
	});

	async function onAuthed() {
		currentUser = getUser();
		authed = !!getToken();
	}

	function doLogout() {
		logout();
		currentUser = null;
		authed = false;
	}
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
	<!-- Header -->
	<header
		class="border-b px-6 py-4"
		style="border-color: var(--panel-border); background-color: rgba(11, 14, 19, 0.88); backdrop-filter: blur(14px);"
	>
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<a href="/" class="brand" style="border-bottom: 2px solid var(--accent-primary)">
				<span style="color: var(--foreground)">VEX</span><span style="color: var(--accent-primary)">ARIUM</span>
			</a>
			<nav class="flex items-center gap-6">
				<a href="/" class="link-crimson">ANALYZE</a>
				<a href="/portfolio" class="link-crimson">PORTFOLIO</a>
				<a href="/pricing" class="link-crimson">PRICING</a>
				{#if authed}
					<span class="label" style="color: var(--foreground-muted)">
						{currentUser?.tier === 'pro' ? 'PRO' : 'FREE'}
					</span>
					<button class="label link-crimson" onclick={doLogout}>LOGOUT</button>
				{:else}
					<button class="btn-primary px-4 py-2" onclick={() => (authOpen = true)}>LOGIN / SIGN UP</button>
				{/if}
			</nav>
		</div>
	</header>

	<!-- Main -->
	<main class="flex-1 px-6 py-6">
		<div class="mx-auto max-w-7xl">
			{@render children()}
		</div>
	</main>

	<!-- Footer -->
	<footer
		class="border-t px-6 py-4"
		style="border-color: var(--panel-border); background-color: var(--surface)"
	>
		<div class="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<span class="label">VEXARIUM — INFORMATIONAL ONLY, NOT FINANCIAL ADVICE</span>
			<nav class="flex gap-4">
				<a href="/legal/impressum" class="label" style="color: var(--foreground-muted)">IMPRESSUM</a>
				<a href="/legal/disclaimer" class="label" style="color: var(--foreground-muted)">DISCLAIMER</a>
				<a href="/legal/terms" class="label" style="color: var(--foreground-muted)">TERMS</a>
				<a href="/legal/privacy" class="label" style="color: var(--foreground-muted)">PRIVACY</a>
			</nav>
		</div>
	</footer>
</div>

<AuthModal open={authOpen} onClose={() => (authOpen = false)} onSuccess={onAuthed} />
<ConsentBanner />
