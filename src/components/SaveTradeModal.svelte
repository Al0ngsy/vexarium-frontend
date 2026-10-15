<script lang="ts">
	import type { TradeType } from '$lib/types';
	import { getToken } from '$lib/auth.svelte';
	import { authErrorMessage } from '$lib/auth-flow';
	import { addTrade } from '$lib/trades';

	let {
		open,
		symbol,
		entryPrice,
		contract,
		onClose
	}: {
		open: boolean;
		symbol: string;
		entryPrice?: number | null;
		contract?: string | null;
		onClose?: () => void;
	} = $props();

	let entry = $state('');
	let quantity = $state('1');
	let type = $state<TradeType>(contract ? 'option' : 'stock');
	let busy = $state(false);
	let error = $state<string | null>(null);
	// Signed in: the trade goes to the account; otherwise it stays on this device.
	const toAccount = $derived(getToken() !== null);

	// The modal is always mounted with a null entryPrice on first render, so
	// a mount-time init never prefills. Refill whenever the modal opens or
	// the price prop changes (also clears a price typed for a previous symbol).
	$effect(() => {
		if (!open) return;
		entry = entryPrice ? String(entryPrice) : '';
		error = null;
	});

	const types: TradeType[] = ['stock', 'etf', 'index', 'option'];

	async function doSave() {
		const price = parseFloat(entry);
		const qty = parseFloat(quantity);
		if (busy || isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) return;

		busy = true;
		error = null;
		try {
			await addTrade({
				symbol,
				type,
				entryDate: new Date().toISOString(),
				entryPrice: price,
				quantity: qty,
				contract: contract ?? undefined
			});
			reset();
			onClose?.();
		} catch (e) {
			error = authErrorMessage(e, 'Could not save the trade.');
		} finally {
			busy = false;
		}
	}

	function reset() {
		entry = entryPrice ? String(entryPrice) : '';
		quantity = '1';
		type = contract ? 'option' : 'stock';
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose?.();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background-color: rgba(0, 0, 0, 0.6)"
		onclick={onClose}
		onkeydown={onKeydown}
		role="presentation"
	>
		<div
			class="panel w-full max-w-md p-6"
			style="border-radius: 4px; border-color: var(--panel-border-active)"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="Save trade"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="brand" style="border-bottom: 2px solid var(--accent-primary)">SAVE TRADE</h2>
				<button class="btn-outline px-2 py-1" onclick={onClose} aria-label="Close">✕</button>
			</div>

			<p class="label mb-3" style="font-weight: 400">
				{toAccount ? 'Saved to your account.' : 'Saved on this device only. Log in to keep trades across devices.'}
			</p>

			<div class="mb-3">
				<span class="label mb-1 block">SYMBOL</span>
				<div class="data uppercase" style="color: var(--foreground)">{symbol}</div>
			</div>

			<div class="mb-3">
				<span class="label mb-1 block">TYPE</span>
				<div class="flex flex-wrap gap-2">
					{#each types as t}
						<button
							onclick={() => (type = t)}
							class="label rounded px-3 py-1"
							style="border: 1px solid {type === t ? 'var(--panel-border-active)' : 'var(--panel-border)'}; background-color: {type === t ? 'var(--surface-active)' : 'var(--surface)'}; color: {type === t ? 'var(--accent-white)' : 'var(--foreground-muted)'};"
						>
							{t.toUpperCase()}
						</button>
					{/each}
				</div>
			</div>

			<div class="mb-3">
				<span class="label mb-1 block">ENTRY PRICE</span>
				<input
					type="number"
					step="any"
					bind:value={entry}
					placeholder="0.00"
					class="w-full rounded border px-3 py-2 font-mono"
					style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground);"
				/>
			</div>

			<div class="mb-6">
				<span class="label mb-1 block">QUANTITY</span>
				<input
					type="number"
					step="any"
					bind:value={quantity}
					placeholder="1"
					class="w-full rounded border px-3 py-2 font-mono"
					style="border-color: var(--panel-border); background-color: var(--surface-2); color: var(--foreground);"
				/>
			</div>

			<div aria-live="polite">
				{#if error}<p class="form-error mb-3">{error}</p>{/if}
			</div>

			<div class="flex justify-end gap-2">
				<button class="btn-outline" onclick={onClose}>CANCEL</button>
				<button class="btn-primary" onclick={doSave} disabled={busy}>{busy ? 'SAVING…' : 'SAVE'}</button>
			</div>
		</div>
	</div>
{/if}
