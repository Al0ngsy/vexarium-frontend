<script lang="ts">
	// Lightweight consent/notice banner covering client-side storage (localStorage)
	// under TTDSG §25 / ePrivacy. VEXARIUM uses no cookies — only strictly-necessary
	// localStorage (auth token, saved trades, recent analyses). This banner informs
	// the user and records that they acknowledged the disclosure.
	import { onMount } from 'svelte';

	const KEY = 'vexarium_consent_v1';

	let visible = $state(false);

	onMount(() => {
		if (typeof localStorage === 'undefined') return;
		try {
			if (!localStorage.getItem(KEY)) visible = true;
		} catch {
			visible = true;
		}
	});

	function acknowledge() {
		try {
			localStorage.setItem(KEY, 'accepted');
		} catch {
			// ignore storage errors
		}
		visible = false;
	}
</script>

{#if visible}
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t px-6 py-4"
		style="background-color: var(--surface); border-color: var(--panel-border); box-shadow: 0 -4px 20px rgba(0,0,0,0.5);"
	>
		<div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p class="label" style="color: var(--foreground-muted); text-transform: none; line-height: 1.6; flex: 1;">
				VEXARIUM uses no cookies. It stores only strictly-necessary data in your
				browser (session token, saved trades, recent analyses) so the service works.
				See our <a href="/legal/privacy" class="link-crimson">Privacy Policy</a>.
			</p>
			<div class="flex gap-2">
				<a href="/legal/privacy" class="btn-outline">LEARN MORE</a>
				<button class="btn-primary" onclick={acknowledge}>GOT IT</button>
			</div>
		</div>
	</div>
{/if}
