<script lang="ts">
	import { page } from '$app/state';
	import { ApiError, confirmPasswordReset } from '$lib/api';
	import { MIN_PASSWORD_LENGTH, authErrorMessage } from '$lib/auth-flow';
	import AuthForm from '../../components/auth/AuthForm.svelte';
	import TextField from '../../components/auth/TextField.svelte';

	const token = $derived(page.url.searchParams.get('token') ?? '');

	let password = $state('');
	let error = $state<string | null>(null);
	let done = $state(false);

	async function submit() {
		error = null;
		try {
			await confirmPasswordReset(token, password);
			done = true;
		} catch (e) {
			error =
				e instanceof ApiError && e.status === 400
					? 'This reset link is invalid or has expired. Request a new one.'
					: authErrorMessage(e, 'Could not reset the password.');
		}
	}
</script>

<svelte:head>
	<!-- The link carries a secret token: do not leak it through the Referer header. -->
	<meta name="referrer" content="no-referrer" />
</svelte:head>

{#if !token}
	<div class="mx-auto w-full max-w-md py-8">
		<div class="panel p-6" style="border-top: 2px solid var(--accent-primary)">
			<h1 class="brand mb-2" style="font-size: 1.4rem">Reset password</h1>
			<p class="form-error">This reset link is incomplete. Request a new one.</p>
			<a class="text-link label mt-4 inline-block" href="/forgot-password">Request a reset link</a>
		</div>
	</div>
{:else if done}
	<div class="mx-auto w-full max-w-md py-8">
		<div class="panel p-6" style="border-top: 2px solid var(--accent-primary)" aria-live="polite">
			<h1 class="brand mb-2" style="font-size: 1.4rem">Password updated</h1>
			<p class="form-ok">You can now log in with your new password.</p>
			<a class="btn-primary mt-4 inline-flex" href="/login">Log in</a>
		</div>
	</div>
{:else}
	<AuthForm
		title="Reset password"
		intro="Choose a new password for your account."
		submitLabel="Set new password"
		busyLabel="Saving…"
		{error}
		onsubmit={submit}
	>
		<TextField
			id="new-password"
			label="New password"
			type="password"
			autocomplete="new-password"
			minlength={MIN_PASSWORD_LENGTH}
			hint="At least {MIN_PASSWORD_LENGTH} characters."
			bind:value={password}
		/>

		{#snippet footer()}
			<a class="text-link" href="/forgot-password">Request a new link</a>
		{/snippet}
	</AuthForm>
{/if}
