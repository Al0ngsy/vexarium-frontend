<script lang="ts">
	import { onMount } from 'svelte';
	import { createCheckoutSession } from '$lib/api';
	import { initAuth, getToken, getUser } from '$lib/auth.svelte';
	import DisclaimerBanner from '../../components/DisclaimerBanner.svelte';

	let authed = $state(false);
	let tier = $state('free');
	let checkingOut = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		initAuth();
		authed = !!getToken();
		tier = getUser()?.tier ?? 'free';
	});

	async function upgrade() {
		const token = getToken();
		if (!token) {
			error = 'Log in to upgrade to Pro.';
			return;
		}
		checkingOut = true;
		error = null;
		try {
			const { checkout_url } = await createCheckoutSession(token);
			window.location.href = checkout_url;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Checkout failed';
		} finally {
			checkingOut = false;
		}
	}
</script>

<svelte:head>
	<title>VEXARIUM — PRICING</title>
</svelte:head>

<div class="mx-auto max-w-5xl">
	<DisclaimerBanner />

	<div class="mb-10 text-center">
		<h1 class="brand mb-2" style="font-size: 2rem; border-bottom: 2px solid var(--accent-primary); display: inline-block">
			PRICING
		</h1>
		<p class="label mt-3" style="color: var(--foreground-muted)">
			Unlock the full technical + AI analysis experience.
		</p>
	</div>

	{#if tier === 'pro'}
		<div class="panel mb-6 p-6 text-center" style="border-top: 2px solid var(--verdict-buy, #16a34a)">
			<p class="brand" style="color: #16a34a">YOU'RE ON PRO</p>
			<p class="label mt-2" style="color: var(--foreground-muted); text-transform: none">
				All indicators + unlimited AI analysis are unlocked. Thank you for subscribing.
			</p>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Free -->
		<div class="panel flex flex-col gap-4 p-6" style="border-top: 2px solid var(--panel-border)">
			<div>
				<h2 class="brand">FREE</h2>
				<p class="data mt-1" style="color: var(--foreground); font-size: 1.5rem">$0</p>
			</div>
			<ul class="flex flex-col gap-2 label" style="color: var(--foreground-muted); text-transform: none; font-weight: 400">
				<li>✓ All 10 technical indicators</li>
				<li>✓ Price charts & news sentiment</li>
				<li>✓ Options strategies (limited)</li>
				<li>✕ No AI analysis</li>
			</ul>
			<div class="mt-auto">
				<button class="btn-outline w-full" disabled>CURRENT PLAN</button>
			</div>
		</div>

		<!-- Pro -->
		<div class="panel flex flex-col gap-4 p-6" style="border-top: 2px solid var(--accent-primary); border-color: var(--panel-border-active)">
			<div>
				<h2 class="brand" style="color: var(--accent-primary)">PRO</h2>
				<p class="data mt-1" style="color: var(--foreground); font-size: 1.5rem">$9<span style="color: var(--foreground-muted); font-size: 0.9rem"> /month</span></p>
			</div>
			<ul class="flex flex-col gap-2 label" style="color: var(--foreground-muted); text-transform: none; font-weight: 400">
				<li>✓ Everything in Free</li>
				<li>✓ Unlimited AI analysis (indicators + news + market context)</li>
				<li>✓ Full options strategy suggestions</li>
				<li>✓ 52-week range & YTD context in every report</li>
			</ul>
			<div class="mt-auto">
				{#if authed && tier !== 'pro'}
					<button class="btn-primary w-full" onclick={upgrade} disabled={checkingOut} style="opacity: {checkingOut ? 0.5 : 1}">
						{checkingOut ? 'REDIRECTING…' : 'UPGRADE TO PRO'}
					</button>
				{:else if !authed}
					<button class="btn-primary w-full" onclick={() => (window.location.href = '/')}>LOG IN TO UPGRADE</button>
				{:else}
					<button class="btn-outline w-full" disabled>ACTIVE</button>
				{/if}
			</div>
		</div>
	</div>

	{#if error}
		<p class="label mt-4 text-center" style="color: var(--accent-primary)">{error}</p>
	{/if}

	<p class="label mt-10 text-center" style="color: var(--foreground-subtle)">
		CANCEL ANYTIME. ⚠ INFORMATIONAL ONLY — NOT FINANCIAL ADVICE.
	</p>
</div>
