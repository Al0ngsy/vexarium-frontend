<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ApiError, login } from '$lib/api';
	import { getToken, setSession } from '$lib/auth.svelte';
	import { authErrorMessage, safeNext, withNext } from '$lib/auth-flow';
	import AuthForm from '../../components/auth/AuthForm.svelte';
	import TextField from '../../components/auth/TextField.svelte';

	const next = $derived(safeNext(page.url.searchParams.get('next')));

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);

	// Someone who is already signed in has no use for this page.
	onMount(() => {
		if (getToken()) void goto(next ?? '/', { replaceState: true });
	});

	async function submit() {
		error = null;
		try {
			const res = await login(email.trim(), password);
			await setSession(res.access_token, res.tier);
			await goto(next ?? '/');
		} catch (e) {
			error =
				e instanceof ApiError && e.status === 401
					? 'Invalid email or password.'
					: authErrorMessage(e, 'Login failed.');
		}
	}
</script>

<AuthForm
	title="Log in"
	intro="Welcome back."
	submitLabel="Log in"
	busyLabel="Logging in…"
	{error}
	onsubmit={submit}
>
	<TextField id="email" label="Email" type="email" autocomplete="email" bind:value={email} />
	<TextField id="password" label="Password" type="password" autocomplete="current-password" bind:value={password} />

	{#snippet footer()}
		<a class="text-link" href="/forgot-password">Forgot password?</a>
		<a class="text-link" href={withNext('/register', next)}>Create account</a>
	{/snippet}
</AuthForm>
