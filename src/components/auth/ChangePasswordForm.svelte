<script lang="ts">
	import { changePassword } from '$lib/api';
	import { MIN_PASSWORD_LENGTH, authErrorMessage } from '$lib/auth-flow';
	import TextField from './TextField.svelte';

	let current = $state('');
	let next = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		error = null;
		notice = null;
		try {
			await changePassword(current, next);
			current = '';
			next = '';
			notice = 'Password changed.';
		} catch (err) {
			error = authErrorMessage(err, 'Could not change the password.');
		} finally {
			busy = false;
		}
	}
</script>

<form class="flex max-w-md flex-col gap-4" onsubmit={submit}>
	<TextField id="current-password" label="Current password" type="password" autocomplete="current-password" bind:value={current} />
	<TextField
		id="change-new-password"
		label="New password"
		type="password"
		autocomplete="new-password"
		minlength={MIN_PASSWORD_LENGTH}
		hint="At least {MIN_PASSWORD_LENGTH} characters."
		bind:value={next}
	/>
	<div aria-live="polite">
		{#if error}<p class="form-error">{error}</p>{/if}
		{#if notice}<p class="form-ok">{notice}</p>{/if}
	</div>
	<div>
		<button class="btn-outline" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
	</div>
</form>
