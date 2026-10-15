<script lang="ts">
	import { deleteAccount } from '$lib/api';
	import { authErrorMessage } from '$lib/auth-flow';
	import TextField from './TextField.svelte';

	let { onClose, onDeleted }: { onClose: () => void; onDeleted: () => void } = $props();

	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let passwordInput = $state<HTMLInputElement>();

	$effect(() => {
		passwordInput?.focus();
	});

	function close() {
		if (!busy) onClose();
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		error = null;
		try {
			await deleteAccount(password);
			onDeleted();
		} catch (err) {
			error = authErrorMessage(err, 'Could not delete the account.');
			busy = false;
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	style="background-color: rgba(0, 0, 0, 0.6)"
	onclick={close}
	role="presentation"
>
	<div
		class="panel w-full max-w-md p-6"
		style="border-color: var(--verdict-strong-sell)"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-title"
		aria-describedby="delete-desc"
		tabindex="-1"
	>
		<h2 id="delete-title" class="brand mb-2">Delete account</h2>
		<p id="delete-desc" class="label mb-4" style="font-weight: 400">
			This permanently deletes your account and all saved trades, and cancels an active subscription. It cannot be
			undone. Enter your password to confirm.
		</p>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<TextField
				id="delete-password"
				label="Password"
				type="password"
				autocomplete="current-password"
				bind:value={password}
				bind:inputRef={passwordInput}
			/>
			<div aria-live="polite">
				{#if error}<p class="form-error">{error}</p>{/if}
			</div>
			<div class="flex justify-end gap-2">
				<button class="btn-outline" type="button" onclick={close} disabled={busy}>Cancel</button>
				<button class="btn-danger" type="submit" disabled={busy}>{busy ? 'Deleting…' : 'Delete my account'}</button>
			</div>
		</form>
	</div>
</div>
