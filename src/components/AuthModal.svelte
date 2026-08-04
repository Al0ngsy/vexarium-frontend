<script lang="ts">
	import { login, register } from '$lib/api';

	let { open, onClose, onSuccess } = $props<{
		open: boolean;
		onClose: () => void;
		onSuccess?: (tier: string) => void;
	}>();

	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let submitting = $state(false);

	$effect(() => {
		if (open) {
			error = null;
			submitting = false;
		}
	});

	async function submit() {
		if (!email.trim() || !password) {
			error = 'Enter email and password';
			return;
		}
		submitting = true;
		error = null;
		try {
			const res = mode === 'login' ? await login(email, password) : await register(email, password);
			onSuccess?.(res.tier);
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Auth failed';
		} finally {
			submitting = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
	>
		<div class="panel w-full max-w-md p-6" style="border-top: 2px solid var(--accent-primary)">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">
					{mode === 'login' ? 'LOGIN' : 'REGISTER'}
				</h2>
				<button class="label" style="color: var(--foreground-muted)" onclick={onClose}>✕</button>
			</div>

			<p class="label mb-4" style="color: var(--foreground-muted); text-transform: none">
				{mode === 'login' ? 'Sign in to access your account.' : 'Create an account to access AI analysis.'}
			</p>

			<label class="label block mb-1">EMAIL</label>
			<input
				type="email"
				bind:value={email}
				placeholder="you@example.com"
				class="mb-3 w-full rounded border px-3 py-2"
				style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground);"
			/>

			<label class="label block mb-1">PASSWORD</label>
			<input
				type="password"
				bind:value={password}
				placeholder="••••••••"
				onkeydown={(e) => e.key === 'Enter' && submit()}
				class="mb-3 w-full rounded border px-3 py-2"
				style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground);"
			/>

			{#if error}
				<p class="label mb-3" style="color: var(--accent-primary)">{error}</p>
			{/if}

			<button class="btn-primary w-full" onclick={submit} disabled={submitting} style="opacity: {submitting ? 0.5 : 1}">
				{submitting ? 'WAIT…' : mode === 'login' ? 'LOGIN' : 'REGISTER'}
			</button>

			<button
				class="link-crimson mt-4 block"
				onclick={() => (mode = mode === 'login' ? 'register' : 'login')}
			>
				{mode === 'login' ? 'NO ACCOUNT? REGISTER' : 'HAVE AN ACCOUNT? LOGIN'}
			</button>
		</div>
	</div>
{/if}
