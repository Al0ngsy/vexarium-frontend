<script lang="ts">
	let {
		title,
		content
	}: {
		title: string;
		content: string;
	} = $props();

	let open = $state(false);
	let hoverTimer: ReturnType<typeof setTimeout> | undefined;

	let btn = $state<HTMLButtonElement | undefined>();
	let panel = $state<HTMLDivElement | undefined>();

	// Hover opens after a short delay; once open it stays (permanent) until
	// dismissed with an outside click or the button. Click also toggles.
	function onEnter() {
		clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => (open = true), 500);
	}
	function onLeave() {
		clearTimeout(hoverTimer);
		// do NOT close: an opened popover persists while the pointer leaves.
	}

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

	// Fixed viewport positioning computed from the button rect on open, so the
	// panel overlays scroll containers instead of expanding them. Flip above
	// when it would overflow the bottom edge; clamp to the viewport.
	$effect(() => {
		if (open && btn && panel) {
			const anchor = btn;
			const tip = panel;
			requestAnimationFrame(() => {
				const b = anchor.getBoundingClientRect();
				const p = tip.getBoundingClientRect();
				const gap = 6;
				let top = b.bottom + gap;
				let left = Math.min(b.left, window.innerWidth - p.width - 8);
				left = Math.max(8, left);
				if (top + p.height > window.innerHeight - 8) {
					top = Math.max(8, b.top - p.height - gap);
				}
				tip.style.position = 'fixed';
				tip.style.left = `${left}px`;
				tip.style.top = `${top}px`;
			});
		}
	});
</script>

<span
	class="relative inline-block align-middle"
	data-popover
	onmouseenter={onEnter}
	onmouseleave={onLeave}
>
	<button
		bind:this={btn}
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
			bind:this={panel}
			class="panel z-30 w-64 p-3"
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
