<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { WidgetDef } from '$lib/layout.svelte';
	import { liveSizes } from '$lib/layout.svelte';
	import InfoPopover from './InfoPopover.svelte';

	// One gridstack item: drag handle head + toggle + body slot.
	let {
		def,
		enabled,
		onToggle,
		children,
		info = null
	}: {
		def: WidgetDef;
		enabled: boolean;
		onToggle: (id: string) => void;
		children: Snippet;
		info?: { title: string; content: string } | null;
	} = $props();

	// Current grid footprint (w×h in grid units); live-updates on drag/resize
	// via the gridstack 'change' event → liveSizes. Falls back to the def.
	const size = $derived(liveSizes[def.id] ?? { w: def.w, h: def.h });
</script>

<div
	class="grid-stack-item"
	data-wid={def.id}
	data-gs-x={def.x}
	data-gs-y={def.y}
	data-gs-w={def.w}
	data-gs-h={def.h}
	data-gs-min-w={def.minW ?? 3}
	data-gs-min-h={def.minH ?? 1}
>
	<div class="grid-stack-item-content">
		<div class="widget-card">
			<div class="w-head" title="Drag to move">
				<span class="w-drag">⋮⋮</span>
				<span class="w-title"
					>{def.title}{#if def.sub}<span class="sub">{def.sub}</span>{/if}</span
				>
				<div class="w-menu">
					{#if info}
						<span class="w-info" title="How to use this widget">
							<InfoPopover title={info.title} content={info.content} />
						</span>
					{/if}
					<span class="w-size" title="Grid size (columns × rows)">{size.w}×{size.h}</span>
					<button
						class="widget-toggle {enabled ? '' : 'off'}"
						title={enabled ? 'Disable widget' : 'Enable widget'}
						onclick={(e) => {
							e.stopPropagation();
							onToggle(def.id);
						}}
					>
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path>
							<circle cx="12" cy="12" r="3"></circle>
							{#if !enabled}<line x1="3" y1="3" x2="21" y2="21"></line>{/if}
						</svg>
					</button>
				</div>
			</div>
			<div class="w-body">
				{@render children()}
			</div>
		</div>
	</div>
</div>
