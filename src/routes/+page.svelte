<script lang="ts">
	import { goto } from '$app/navigation';
	import type { AssetType } from '$lib/types';

	let symbol = $state('');
	let assetType = $state<AssetType>('stock');
	let optionsMode = $state(false);

	const assetTypes: { value: AssetType; label: string }[] = [
		{ value: 'stock', label: 'STOCK' },
		{ value: 'etf', label: 'ETF' },
		{ value: 'index', label: 'INDEX' }
	];

	function onAnalyze() {
		if (!symbol.trim()) return;
		const sym = symbol.trim().toUpperCase();
		if (optionsMode) {
			goto(`/options/${sym}`);
		} else {
			goto(`/analysis/${sym}`);
		}
	}
</script>

<div class="flex flex-col items-center justify-center py-24">
	<!-- Brand -->
	<h1
		class="brand mb-2 text-3xl"
		style="font-size: 2rem; border-bottom: 2px solid var(--accent-primary)"
	>
		VEXARIUM
	</h1>
	<p class="label mb-12">ENTER SYMBOL — TECHNICAL &amp; OPTIONS ANALYSIS</p>

	<!-- Symbol input -->
	<div class="panel flex w-full max-w-xl flex-col gap-6 p-6">
		<label class="label" for="symbol">SYMBOL</label>
		<input
			id="symbol"
			autocomplete="off"
			placeholder="ENTER SYMBOL"
			bind:value={symbol}
			onkeydown={(e) => e.key === 'Enter' && onAnalyze()}
			class="w-full rounded border px-4 py-3 text-lg font-mono uppercase"
			style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground); text-transform: uppercase;"
		/>

		<!-- Asset type selector -->
		<div>
			<span class="label block mb-2">ASSET TYPE</span>
			<div class="flex gap-2">
				{#each assetTypes as at}
					<button
						onclick={() => (assetType = at.value)}
						class="flex-1 rounded px-3 py-2 label"
						style="border: 1px solid {assetType === at.value ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {assetType === at.value ? 'var(--surface-active)' : 'var(--surface)'}; color: {assetType === at.value ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
					>
						{at.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Mode toggle -->
		<div>
			<span class="label block mb-2">MODE</span>
			<div class="flex gap-2">
				<button
					onclick={() => (optionsMode = false)}
					class="flex-1 rounded px-3 py-2 label"
					style="border: 1px solid {!optionsMode ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {!optionsMode ? 'var(--surface-active)' : 'var(--surface)'}; color: {!optionsMode ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
				>
					STANDARD
				</button>
				<button
					onclick={() => (optionsMode = true)}
					class="flex-1 rounded px-3 py-2 label"
					style="border: 1px solid {optionsMode ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {optionsMode ? 'var(--surface-active)' : 'var(--surface)'}; color: {optionsMode ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
				>
					OPTIONS
				</button>
			</div>
		</div>

		<!-- Analyze button -->
		<button class="btn-primary w-full" onclick={onAnalyze}>ANALYZE</button>
	</div>
</div>
