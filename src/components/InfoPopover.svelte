<script lang="ts">
	let {
		title,
		content
	}: {
		title: string;
		content: string;
	} = $props();

	let open = $state(false);

	// Click-to-toggle popover (mobile friendly). Close on outside click.
	function onClickOutside(e: MouseEvent) {
		const el = e.target as HTMLElement;
		if (!el.closest('[data-popover]')) open = false;
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', onClickOutside);
			return () => document.removeEventListener('click', onClickOutside);
		}
	});
</script>

<span class="relative inline-block align-middle" data-popover>
	<button
		class="inline-flex h-4 w-4 items-center justify-center rounded-full"
		style="border: 1px solid var(--panel-border-active); color: var(--accent-primary); font-size: 0.625rem; line-height: 1; cursor: pointer; background-color: transparent;"
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
		aria-label={`Info: ${title}`}
	>i</button>

	{#if open}
		<div
			class="panel absolute left-0 top-full z-30 mt-1 w-64 p-3"
			style="border-color: var(--panel-border-active)"
			role="tooltip"
		>
			<p class="label mb-1" style="color: var(--foreground)">{title}</p>
			<p class="label" style="color: var(--foreground-muted); line-height: 1.5; text-transform: none">
				{content}
			</p>
		</div>
	{/if}
</span>
