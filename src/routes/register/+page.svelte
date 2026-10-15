<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { register } from '$lib/api';
	import { getToken, setSession } from '$lib/auth.svelte';
	import { MIN_PASSWORD_LENGTH, authErrorMessage, safeNext, withNext } from '$lib/auth-flow';
	import AuthForm from '../../components/auth/AuthForm.svelte';
	import TextField from '../../components/auth/TextField.svelte';

	const next = $derived(safeNext(page.url.searchParams.get('next')));

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);

	onMount(() => {
		if (getToken()) void goto(next ?? '/', { replaceState: true });
	});

	async function submit() {
		error = null;
		try {
			const res = await register(email.trim(), password);
			await setSession(res.access_token, res.tier);
			await goto(next ?? '/');
		} catch (e) {
			error = authErrorMessage(e, 'Registration failed.');
		}
	}
</script>

<AuthForm
	title="Create account"
	intro="Free to start. Upgrade to Pro any time."
	submitLabel="Create account"
	busyLabel="Creating account…"
	{error}
	onsubmit={submit}
>
	<TextField id="email" label="Email" type="email" autocomplete="email" bind:value={email} />
	<TextField
		id="password"
		label="Password"
		type="password"
		autocomplete="new-password"
		minlength={MIN_PASSWORD_LENGTH}
		hint="At least {MIN_PASSWORD_LENGTH} characters."
		bind:value={password}
	/>

	{#snippet footer()}
		<span>Already registered?</span>
		<a class="text-link" href={withNext('/login', next)}>Log in</a>
	{/snippet}
</AuthForm>
