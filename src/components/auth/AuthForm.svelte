<script lang="ts">
	import type { Snippet } from 'svelte';

	// Card + <form> shared by login, register, forgot/reset password. While
	// `onsubmit` is pending the submit button is disabled so a double click
	// cannot send the request twice. `error` / `notice` live in an aria-live
	// region that is always in the DOM, so screen readers announce changes.
	let {
		title,
		intro,
		submitLabel,
		busyLabel,
		error = null,
		notice = null,
		onsubmit,
		children,
		footer
	}: {
		title: string;
		intro?: string;
		submitLabel: string;
		busyLabel: string;
		error?: string | null;
		notice?: string | null;
		onsubmit: () => Promise<void>;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let busy = $state(false);

	async function handle(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		try {
			await onsubmit();
		} finally {
			busy = false;
		}
	}
</script>

<div class="mx-auto w-full max-w-md py-8">
	<div class="panel p-6" style="border-top: 2px solid var(--accent-primary)">
		<h1 class="brand mb-1" style="font-size: 1.4rem">{title}</h1>
		{#if intro}
			<p class="label mb-5" style="font-weight: 400">{intro}</p>
		{/if}

		<form class="flex flex-col gap-4" onsubmit={handle}>
			{@render children()}
			<div aria-live="polite">
				{#if error}<p class="form-error">{error}</p>{/if}
				{#if notice}<p class="form-ok">{notice}</p>{/if}
			</div>
			<button class="btn-primary w-full justify-center" type="submit" disabled={busy}>
				{busy ? busyLabel : submitLabel}
			</button>
		</form>

		{#if footer}
			<div class="label mt-5 flex flex-wrap justify-between gap-2" style="font-weight: 400">
				{@render footer()}
			</div>
		{/if}
	</div>
</div>
