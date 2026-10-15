<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createPortalSession } from '$lib/api';
	import { getToken, getUser, initAuth, logout, refreshUser } from '$lib/auth.svelte';
	import { authErrorMessage } from '$lib/auth-flow';
	import { canManageBilling, formatPeriodEnd, subscriptionLabel } from '$lib/account';
	import ChangePasswordForm from '../../components/auth/ChangePasswordForm.svelte';
	import DeleteAccountDialog from '../../components/auth/DeleteAccountDialog.svelte';

	const user = $derived(getUser());
	const periodEnd = $derived(user ? formatPeriodEnd(user.current_period_end) : null);

	let mounted = $state(false);
	let loadFailed = $state(false);
	let leaving = false;
	let portalBusy = $state(false);
	let portalError = $state<string | null>(null);
	let confirmingDelete = $state(false);

	onMount(() => {
		initAuth();
		mounted = true;
		void refreshUser().then((me) => (loadFailed = me === null && getUser() === null));
	});

	// No session (never logged in, expired, or rejected by the server): sign in first.
	$effect(() => {
		if (mounted && !getToken() && !leaving) void goto('/login?next=%2Faccount', { replaceState: true });
	});

	function leave() {
		leaving = true;
		logout();
		void goto('/');
	}

	async function openPortal() {
		portalBusy = true;
		portalError = null;
		try {
			const { portal_url } = await createPortalSession();
			window.location.href = portal_url;
		} catch (e) {
			portalError = authErrorMessage(e, 'Could not open the billing portal.');
			portalBusy = false;
		}
	}
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
	<h1 class="brand" style="font-size: 1.4rem">Account</h1>

	{#if user}
		<section class="panel p-6" aria-labelledby="profile-title">
			<h2 id="profile-title" class="brand mb-4">Profile</h2>
			<dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3">
				<dt class="label">Email</dt>
				<dd class="data" style="overflow-wrap: anywhere">{user.email}</dd>
				<dt class="label">Plan</dt>
				<dd class="data">{user.tier === 'pro' ? 'Pro' : 'Free'}</dd>
				<dt class="label">Subscription</dt>
				<dd class="data">
					{subscriptionLabel(user.subscription_status)}{#if periodEnd}<span style="color: var(--foreground-muted)">
							· current period ends {periodEnd}</span
						>{/if}
				</dd>
			</dl>

			<div class="mt-5 flex flex-wrap items-center gap-3">
				{#if canManageBilling(user)}
					<button class="btn-primary" onclick={openPortal} disabled={portalBusy}>
						{portalBusy ? 'Opening…' : 'Manage subscription'}
					</button>
				{:else}
					<a class="btn-primary" href="/pricing">Upgrade to Pro</a>
				{/if}
				<button class="btn-outline" onclick={leave}>Log out</button>
			</div>
			<div aria-live="polite">
				{#if portalError}<p class="form-error mt-3">{portalError}</p>{/if}
			</div>
		</section>

		<section class="panel p-6" aria-labelledby="password-title">
			<h2 id="password-title" class="brand mb-4">Change password</h2>
			<ChangePasswordForm />
		</section>

		<section class="panel p-6" style="border-color: color-mix(in srgb, var(--verdict-strong-sell) 40%, var(--panel-border))" aria-labelledby="delete-section-title">
			<h2 id="delete-section-title" class="brand mb-2">Delete account</h2>
			<p class="label mb-4" style="font-weight: 400">
				Removes your account and saved trades for good and cancels an active subscription.
			</p>
			<button class="btn-danger" onclick={() => (confirmingDelete = true)}>Delete account…</button>
		</section>
	{:else if loadFailed}
		<p class="form-error" role="alert">Could not load your account. Check your connection and reload the page.</p>
	{:else if mounted && getToken()}
		<p class="label" role="status">Loading your account…</p>
	{/if}
</div>

{#if confirmingDelete}
	<DeleteAccountDialog onClose={() => (confirmingDelete = false)} onDeleted={leave} />
{/if}
