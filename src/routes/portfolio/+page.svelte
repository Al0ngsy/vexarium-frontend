<script lang="ts">
	import { onMount, untrack } from 'svelte';

	import type { SavedTrade, StanceResponse } from '$lib/types';
	import { getStance, isAbortError } from '$lib/api';
	import { getToken, initAuth } from '$lib/auth.svelte';
	import { authErrorMessage } from '$lib/auth-flow';
	import { dismissUploadOffer, isUploadOfferDismissed } from '$lib/storage';
	import { loadTrades, localTrades, removeTrade, uploadLocalTrades } from '$lib/trades';

	import TradeCard from '../../components/TradeCard.svelte';
	import DisclaimerBanner from '../../components/DisclaimerBanner.svelte';

	interface StanceState {
		loading: boolean;
		data: StanceResponse | null;
	}

	let trades = $state<SavedTrade[]>([]);
	let loaded = $state(false);
	let loadFailed = $state(false);
	let mounted = $state(false);
	let stances = $state<Record<string, StanceState>>({});
	let problem = $state<string | null>(null);
	let note = $state<string | null>(null);
	// Trades saved on this device that could move to the account (signed in only).
	let offerCount = $state(0);
	let offerBusy = $state(false);
	let loadController: AbortController | null = null;

	async function evaluate(trade: SavedTrade) {
		stances[trade.id] = { loading: true, data: null };
		try {
			// The backend fetches the live quote; the client only stores entry prices.
			const res = await getStance(trade);
			stances[trade.id] = { loading: false, data: res };
		} catch {
			stances[trade.id] = { loading: false, data: null };
		}
	}

	async function evaluateAll() {
		for (const trade of trades) {
			evaluate(trade);
		}
	}

	/** (Re)load from wherever trades live now: the account when signed in, else this device. */
	async function reload() {
		loadController?.abort();
		const ctrl = (loadController = new AbortController());
		loaded = false;
		loadFailed = false;
		problem = null;
		offerCount = getToken() !== null && !isUploadOfferDismissed() ? localTrades().length : 0;
		try {
			const list = await loadTrades(ctrl.signal);
			if (ctrl.signal.aborted) return;
			trades = list;
			stances = {};
			loaded = true;
			await evaluateAll();
		} catch (e) {
			if (isAbortError(e) || ctrl.signal.aborted) return;
			trades = [];
			loadFailed = true;
			problem = authErrorMessage(e, 'Could not load your trades.');
		}
	}

	onMount(() => {
		initAuth();
		mounted = true;
		return () => loadController?.abort();
	});

	// Reload whenever the session changes (login, logout, expiry) while this page is open.
	$effect(() => {
		if (!mounted) return;
		getToken();
		untrack(() => void reload());
	});

	async function refresh() {
		await evaluateAll();
	}

	async function remove(trade: SavedTrade) {
		problem = null;
		note = null;
		try {
			await removeTrade(trade.id);
			trades = trades.filter((t) => t.id !== trade.id);
		} catch (e) {
			problem = authErrorMessage(e, 'Could not remove the trade.');
		}
	}

	async function uploadOffer() {
		offerBusy = true;
		problem = null;
		dismissUploadOffer();
		const { uploaded, failed } = await uploadLocalTrades();
		offerBusy = false;
		note =
			failed === 0
				? `${uploaded} ${uploaded === 1 ? 'trade' : 'trades'} uploaded to your account.`
				: `${uploaded} uploaded. ${failed} could not be uploaded and stay on this device.`;
		await reload();
	}

	function keepLocal() {
		dismissUploadOffer();
		offerCount = 0;
	}

	let totalInvested = $derived(trades.reduce((sum, t) => sum + t.entryPrice * t.quantity, 0));

	function formatMoney(v: number): string {
		return `$${v.toFixed(2)}`;
	}
</script>

<svelte:head>
	<title>VEXARIUM — PORTFOLIO</title>
</svelte:head>

{#if offerCount > 0}
	<div class="panel mb-6 p-5" style="border-top: 2px solid var(--accent-primary)" role="region" aria-label="Upload local trades">
		<p class="brand mb-1">Move your device trades to your account?</p>
		<p class="label mb-4" style="font-weight: 400">
			{offerCount}
			{offerCount === 1 ? 'trade is' : 'trades are'} saved only on this device. Upload {offerCount === 1 ? 'it' : 'them'} to see
			{offerCount === 1 ? 'it' : 'them'} on every device. You will only be asked once.
		</p>
		<div class="flex flex-wrap gap-3">
			<button class="btn-primary" onclick={uploadOffer} disabled={offerBusy}>
				{offerBusy ? 'Uploading…' : 'Upload to my account'}
			</button>
			<button class="btn-outline" onclick={keepLocal} disabled={offerBusy}>Keep on this device</button>
		</div>
	</div>
{/if}

<div aria-live="polite">
	{#if problem}<p class="form-error mb-4">{problem}</p>{/if}
	{#if note}<p class="form-ok mb-4">{note}</p>{/if}
</div>

{#if loadFailed}
	<div class="panel p-8 text-center">
		<button class="btn-outline" onclick={reload}>Try again</button>
	</div>
{:else if loaded && trades.length === 0}
	<div
		class="panel flex flex-col items-center gap-4 p-12 text-center"
		style="border-top: 2px solid var(--accent-primary)"
	>
		<p class="brand" style="font-size: 1.5rem">NO SAVED TRADES.</p>
		<p class="label" style="color: var(--foreground-muted)">ANALYZE A SYMBOL TO BEGIN TRACKING.</p>
		<a href="/" class="link-crimson">GO TO ANALYSIS →</a>
	</div>
{:else if loaded}
	<DisclaimerBanner />

	<!-- Summary -->
	<div class="panel mb-6 p-6" style="border-top: 2px solid var(--accent-primary)">
		<div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
			<div>
				<p class="label mb-1">TRADES</p>
				<p class="data" style="font-size: 1.25rem; color: var(--foreground)">{trades.length}</p>
			</div>
			<div>
				<p class="label mb-1">TOTAL INVESTED</p>
				<p class="data" style="font-size: 1.25rem; color: var(--foreground)">
					{formatMoney(totalInvested)}
				</p>
			</div>
		</div>
	</div>

	<!-- Trade list -->
	<div>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="brand">PORTFOLIO</h2>
			<button
				class="link-crimson"
				style="background: none; border: none; padding: 0"
				onclick={refresh}
			>
				REFRESH
			</button>
		</div>

		<div class="flex flex-col gap-3">
			{#each trades as trade (trade.id)}
				<TradeCard
					{trade}
					stance={stances[trade.id]?.data ?? null}
					loading={stances[trade.id]?.loading ?? true}
					onremove={remove}
				/>
			{/each}
		</div>
	</div>
{/if}
