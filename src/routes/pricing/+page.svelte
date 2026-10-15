<script lang="ts">
	import { onMount } from 'svelte';
	import { createCheckoutSession } from '$lib/api';
	import { getToken, getUser, initAuth, refreshUser } from '$lib/auth.svelte';
	import { authErrorMessage } from '$lib/auth-flow';
	import { pollUntil } from '$lib/poll';
	import DisclaimerBanner from '../../components/DisclaimerBanner.svelte';

	/** After Stripe sends the customer back, the webhook that flips the tier can lag. */
	const ACTIVATION_POLL_MS = 2_000;
	const ACTIVATION_TIMEOUT_MS = 30_000;

	const authed = $derived(getToken() !== null);
	const tier = $derived(getUser()?.tier ?? 'free');

	let checkingOut = $state(false);
	let error = $state<string | null>(null);
	// null: not returning from checkout, or Pro has arrived. waiting: polling /me. slow: gave up.
	let activation = $state<'waiting' | 'slow' | null>(null);

	onMount(() => {
		initAuth();
		// Read the query here, not via page.url: this page is prerendered, where
		// SvelteKit forbids reading url.searchParams.
		if (new URLSearchParams(window.location.search).get('success') !== '1') return;
		const ctrl = new AbortController();
		void awaitActivation(ctrl.signal);
		return () => ctrl.abort();
	});

	async function awaitActivation(signal: AbortSignal) {
		activation = 'waiting';
		const activated = await pollUntil(
			async () => {
				await refreshUser();
				// No session left (expired or rejected): nothing to wait for.
				return getToken() === null || getUser()?.tier === 'pro';
			},
			{ intervalMs: ACTIVATION_POLL_MS, timeoutMs: ACTIVATION_TIMEOUT_MS, signal }
		);
		if (signal.aborted) return;
		activation = activated && getUser()?.tier === 'pro' ? null : 'slow';
	}

	async function upgrade() {
		checkingOut = true;
		error = null;
		try {
			const { checkout_url } = await createCheckoutSession();
			window.location.href = checkout_url;
		} catch (e) {
			error = authErrorMessage(e, 'Checkout failed.');
			checkingOut = false;
		}
	}
</script>

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

	<div aria-live="polite">
		{#if activation === 'waiting'}
			<div class="panel mb-6 p-4 text-center" style="border-top: 2px solid var(--accent-primary)">
				<p class="label" style="text-transform: none">
					Thank you! Activating your Pro plan. This can take a few seconds…
				</p>
			</div>
		{:else if activation === 'slow'}
			<div class="panel mb-6 p-4 text-center" style="border-top: 2px solid var(--verdict-hold)">
				<p class="label" style="text-transform: none">
					Your payment went through, but activation is taking longer than usual. Reload this page in a minute or check
					your <a class="text-link" href="/account">account</a>.
				</p>
			</div>
		{/if}
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
					<button class="btn-primary w-full justify-center" onclick={upgrade} disabled={checkingOut}>
						{checkingOut ? 'REDIRECTING…' : 'UPGRADE TO PRO'}
					</button>
				{:else if !authed}
					<a class="btn-primary w-full justify-center" href="/register?next=%2Fpricing">CREATE ACCOUNT TO UPGRADE</a>
					<p class="label mt-3 text-center" style="font-weight: 400">
						Already have an account? <a class="text-link" href="/login?next=%2Fpricing">Log in</a>
					</p>
				{:else}
					<button class="btn-outline w-full" disabled>ACTIVE</button>
				{/if}
			</div>
		</div>
	</div>

	<div aria-live="polite">
		{#if error}<p class="form-error mt-4 text-center">{error}</p>{/if}
	</div>

	<p class="label mt-10 text-center" style="color: var(--foreground-subtle)">
		CANCEL ANYTIME. ⚠ INFORMATIONAL ONLY — NOT FINANCIAL ADVICE.
	</p>
</div>
