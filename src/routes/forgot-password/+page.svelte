<script lang="ts">
	import { requestPasswordReset } from '$lib/api';
	import { authErrorMessage } from '$lib/auth-flow';
	import AuthForm from '../../components/auth/AuthForm.svelte';
	import TextField from '../../components/auth/TextField.svelte';

	let email = $state('');
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	async function submit() {
		error = null;
		notice = null;
		try {
			await requestPasswordReset(email.trim());
			// The server answers 202 whether or not the address is registered.
			notice = 'If an account exists for this address, a reset link is on its way. Check your inbox.';
		} catch (e) {
			error = authErrorMessage(e, 'Could not send the reset link.');
		}
	}
</script>

<AuthForm
	title="Forgot password"
	intro="Enter your email and we will send you a link to choose a new password."
	submitLabel="Send reset link"
	busyLabel="Sending…"
	{error}
	{notice}
	onsubmit={submit}
>
	<TextField id="email" label="Email" type="email" autocomplete="email" bind:value={email} />

	{#snippet footer()}
		<a class="text-link" href="/login">Back to log in</a>
	{/snippet}
</AuthForm>
