<script lang="ts">
	// 3-zone sticky topbar: logo | centered search | right cluster.
	// Search scope is local state for now; notify parent when it changes so the
	// parent can lift the state / drive the URL. Task 3 wires real autocomplete.

	let {
		onScopeChange
	}: { onScopeChange?: (scope: 'stock' | 'options') => void } = $props();

	type Scope = 'stock' | 'options';
	let scope = $state<Scope>('stock');

	function select(next: Scope) {
		if (next === scope) return;
		scope = next;
		onScopeChange?.(scope);
	}

	// US market hours (ET) — 9:30–16:00 weekdays. ponytail: no holiday calendar.
	function marketStatus(): { open: boolean; label: string } {
		const now = new Date();
		const et = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			weekday: 'short',
			hour: 'numeric',
			minute: '2-digit',
			hour12: false
		}).formatToParts(now);
		const weekday = et.find((p) => p.type === 'weekday')?.value ?? '';
		const hour = parseInt(et.find((p) => p.type === 'hour')?.value ?? '0', 10);
		const minute = parseInt(et.find((p) => p.type === 'minute')?.value ?? '0', 10);
		const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ET`;
		const isWeekday = !['Sat', 'Sun'].includes(weekday);
		const isOpen = isWeekday && (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;
		return { open: isOpen, label: `${isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'} · ${time}` };
	}
	const market = $derived(marketStatus());
</script>

<header class="topbar">
	<a href="/" class="logo" title="VEXARIUM">
		<span class="mark"></span>
		<span>VEXARIUM</span>
	</a>

	<div class="search">
		<span class="magnify">⌕</span>
		<input type="text" placeholder="Search symbol — AAPL, SPY, NVDA…" aria-label="Search symbol" />
		<div class="scope-toggle" role="group" aria-label="Search scope">
			<button class:active={scope === 'stock'} onclick={() => select('stock')}>
				STOCK/ETF
			</button>
			<button class:active={scope === 'options'} onclick={() => select('options')}>
				OPTIONS
			</button>
		</div>
		<span class="kbd">⌘K</span>
	</div>

	<div class="topbar-right">
		<span class="market-chip" title="US equities — New York">
			<span
				class="dot"
				style="background: {market.open ? '#10b981' : 'var(--foreground-subtle)'};"
			></span>
			{market.label}
		</span>
		<span class="conn-chip"><span class="dot"></span>LIVE · IEX</span>
		<div class="avatar" title="Guest">LT</div>
	</div>
</header>

<style>
	/* 3-zone grid: logo | centered search | right cluster */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 24px;
		padding: 0 20px;
		height: 56px;
		background: var(--surface);
		border-bottom: 1px solid var(--panel-border);
	}
	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 16px;
		letter-spacing: -0.01em;
		color: var(--foreground);
		text-decoration: none;
		white-space: nowrap;
	}
	.logo .mark {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		background: var(--accent-primary);
	}
	.search {
		width: 640px;
		max-width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 5px 8px 5px 14px;
		background: var(--surface-2);
		border: 1px solid var(--panel-border);
		border-radius: 8px;
		color: var(--foreground-subtle);
		font-size: 13px;
	}
	.search .magnify {
		line-height: 1;
	}
	.search input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--foreground);
		font-size: 13px;
		font-family: var(--font-body);
	}
	.search input::placeholder {
		color: var(--foreground-subtle);
	}
	.search .kbd {
		padding: 2px 6px;
		font-size: 11px;
		font-family: var(--font-mono);
		color: var(--foreground-subtle);
		border: 1px solid var(--surface-3);
		border-radius: 4px;
		white-space: nowrap;
	}
	/* segmented scope toggle INSIDE the search bar */
	.scope-toggle {
		display: flex;
		gap: 2px;
		background: var(--background);
		border-radius: 5px;
		padding: 2px;
		flex-shrink: 0;
	}
	.scope-toggle button {
		padding: 3px 10px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
		border: none;
		background: transparent;
		color: var(--foreground-subtle);
		cursor: pointer;
		font-family: var(--font-body);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}
	.scope-toggle button.active {
		background: var(--accent-primary);
		color: #fff;
	}
	.topbar-right {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 18px;
		font-size: 13px;
		color: var(--foreground-muted);
	}
	.market-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 12px;
		white-space: nowrap;
	}
	.market-chip .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
	}
	.conn-chip {
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 3px 8px;
		border: 1px solid var(--surface-3);
		border-radius: 4px;
		color: var(--foreground-muted);
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
	}
	.conn-chip .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #10b981;
	}
	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: #fff;
	}

	@media (max-width: 1080px) {
		.topbar {
			grid-template-columns: auto 1fr auto;
			gap: 16px;
		}
		.search {
			width: 100%;
		}
		.market-chip {
			display: none;
		}
	}
</style>
