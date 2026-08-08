<script lang="ts">
	import type { WidgetDef } from '$lib/layout.svelte';
	import { resetLayout } from '$lib/layout.svelte';

	// Bottom bar: add disabled widgets back + reset layout.
	let {
		view,
		defs,
		enabled,
		onEnable
	}: {
		view: 'analysis' | 'options';
		defs: WidgetDef[];
		enabled: Record<string, boolean>;
		onEnable: (id: string) => void;
	} = $props();

	const disabled = $derived(defs.filter((d) => enabled[d.id] === false));

	function reset() {
		resetLayout(view);
		// Re-enable everything locally; WidgetGrid re-inits from defaults.
		for (const d of defs) onEnable(d.id);
		window.location.reload();
	}
</script>

<div class="widget-library">
	<span class="lib-title">Available widgets</span>
	<span class="lib-hint">Toggle widgets in their headers · drag to move · resize from the corner</span>
	<div style="margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
		{#each disabled as def}
			<button class="btn-outline" style="padding: 6px 12px;" onclick={() => onEnable(def.id)}>
				+ {def.title}
			</button>
		{/each}
		<button class="btn-outline" style="padding: 6px 12px;" onclick={reset}>Reset layout</button>
	</div>
</div>
