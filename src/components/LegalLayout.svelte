<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		children
	}: {
		title: string;
		children: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="mx-auto max-w-3xl py-8">
	<a href="/" class="link-crimson mb-6 inline-block">&larr; BACK</a>

	<div class="panel p-6 sm:p-8">
		<h1 class="brand mb-6 text-2xl" style="border-bottom: 2px solid var(--accent-primary)">
			{title}
		</h1>

		<div class="flex flex-col gap-6">{@render children()}</div>
	</div>
</div>
