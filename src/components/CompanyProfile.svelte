<script lang="ts">
	import type { CompanyInfo } from '$lib/types';
	import InfoPopover from './InfoPopover.svelte';

	// Beginner-first "About / Fundamentals" company card.
	// Every metric is explained with an InfoPopover in plain English.

	let { company, symbol, pos = 0 }: { company: CompanyInfo; symbol: string; pos?: number } = $props();

	// ---- formatting helpers -------------------------------------------------
	function fmtBig(v: number | null | undefined): string {
		if (v === null || v === undefined || isNaN(v)) return '—';
		const abs = Math.abs(v);
		if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
		if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
		if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
		return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	}
	function fmtShares(v: number | null | undefined): string {
		if (v === null || v === undefined || isNaN(v)) return '—';
		const abs = Math.abs(v);
		if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
		if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
		return v.toLocaleString();
	}
	function fmtPct(v: number | null | undefined): string {
		if (v === null || v === undefined || isNaN(v)) return '—';
		return `${(v * 100).toFixed(1)}%`;
	}
	function fmtMult(v: number | null | undefined): string {
		if (v === null || v === undefined || isNaN(v)) return '—';
		return `${v.toFixed(1)}x`;
	}
	function fmtPrice(v: number | null | undefined): string {
		if (v === null || v === undefined || isNaN(v)) return '—';
		return `$${v.toFixed(2)}`;
	}
	function fmtBigPay(v: number | null | undefined): string {
		if (v === null || v === undefined || isNaN(v)) return '—';
		return `$${(v / 1e6).toFixed(1)}M`;
	}

	const has = (v: unknown) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v) as number);
</script>

<div class="flex flex-col gap-4">
	<!-- Identity + description -->
	{#if company.description}
		<p class="label" style="color: var(--foreground-muted); line-height: 1.7; text-transform: none">
			{company.description}
		</p>
	{/if}

	<!-- Identity facts -->
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#if company.industry}
			<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
				<span class="label block" style="font-size: 9px">SECTOR / INDUSTRY <InfoPopover title="SECTOR / INDUSTRY" content="The broad business category (sector) and specific area (industry) the company operates in. Helps compare it to similar businesses." /></span>
				<span class="data" style="font-size: 12px; color: var(--foreground)">{company.sector || ''}{company.sector && company.industry ? ' · ' : ''}{company.industry || ''}</span>
			</div>
		{/if}
		{#if company.headquarters}
			<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
				<span class="label block" style="font-size: 9px">HEADQUARTERS <InfoPopover title="HEADQUARTERS" content="Where the company is based. Useful for a quick sense of size and jurisdiction." /></span>
				<span class="data" style="font-size: 12px; color: var(--foreground)">{company.headquarters}</span>
			</div>
		{/if}
		{#if has(company.employees)}
			<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
				<span class="label block" style="font-size: 9px">EMPLOYEES <InfoPopover title="EMPLOYEES" content="How many people work for the company. A rough proxy for the scale of its operations." /></span>
				<span class="data" style="font-size: 12px; color: var(--foreground)">{fmtShares(company.employees)}</span>
			</div>
		{/if}
		{#if company.ceo}
			<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
				<span class="label block" style="font-size: 9px">CEO <InfoPopover title="CEO" content="The Chief Executive Officer — the top boss responsible for running the company." /></span>
				<span class="data" style="font-size: 12px; color: var(--foreground)">{company.ceo}</span>
			</div>
		{/if}
		{#if has(company.ceo_pay)}
			<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
				<span class="label block" style="font-size: 9px">CEO PAY / YR <InfoPopover title="CEO PAY" content="The CEO's total yearly compensation. Big pay isn't good or bad on its own — it matters whether the CEO's interests align with shareholders'." /></span>
				<span class="data" style="font-size: 12px; color: var(--foreground)">{fmtBigPay(company.ceo_pay)}</span>
			</div>
		{/if}
		{#if company.next_earnings_date}
			<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
				<span class="label block" style="font-size: 9px">NEXT EARNINGS <InfoPopover title="NEXT EARNINGS" content="When the company next reports its quarterly profit (earnings). Stock prices often jump around this date." /></span>
				<span class="data" style="font-size: 12px; color: var(--foreground)">{company.next_earnings_date}</span>
			</div>
		{/if}
	</div>

	<!-- Valuation -->
	<div class="mt-2">
		<span class="label block mb-2" style="color: var(--foreground-subtle)">VALUATION — WHAT YOU PAY FOR THE STOCK</span>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#if has(company.market_cap)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">MARKET CAP <InfoPopover title="MARKET CAP" content="The total dollar value of ALL the company's shares combined (price × shares). Bigger = larger, more established company." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtBig(company.market_cap)}</span>
				</div>
			{/if}
			{#if has(company.pe_ratio)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">P/E RATIO <InfoPopover title="PRICE-TO-EARNINGS (P/E)" content="The price you pay for each $1 of the company's yearly profit. A lower P/E usually means cheaper relative to earnings; a high P/E can mean high expected growth." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtMult(company.pe_ratio)}</span>
				</div>
			{/if}
			{#if has(company.forward_pe)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">FORWARD P/E <InfoPopover title="FORWARD P/E" content="The P/E ratio using expected future earnings instead of the last year's. Gives a sense of whether the price already accounts for growth." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtMult(company.forward_pe)}</span>
				</div>
			{/if}
			{#if has(company.ps_ratio)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">P/S RATIO <InfoPopover title="PRICE-TO-SALES (P/S)" content="Price paid per $1 of sales (revenue). Useful for young companies that aren't profitable yet." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtMult(company.ps_ratio)}</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Profitability & growth -->
	<div class="mt-2">
		<span class="label block mb-2" style="color: var(--foreground-subtle)">PROFITABILITY &amp; GROWTH — HOW WELL IT EARNS</span>
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			{#if has(company.profit_margin)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">NET MARGIN <InfoPopover title="NET PROFIT MARGIN" content="The % of every sales dollar the company keeps as profit after all costs. Higher is better — more of each sale is pure profit." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtPct(company.profit_margin)}</span>
				</div>
			{/if}
			{#if has(company.gross_margin)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">GROSS MARGIN <InfoPopover title="GROSS MARGIN" content="The % of sales left after paying the direct cost of making the product. Shows how strong the underlying business is before overhead." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtPct(company.gross_margin)}</span>
				</div>
			{/if}
			{#if has(company.roe)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">RETURN ON EQUITY <InfoPopover title="RETURN ON EQUITY (ROE)" content="How much profit the company makes for each $1 shareholders own. High ROE = the business efficiently turns owners' money into profit." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtPct(company.roe)}</span>
				</div>
			{/if}
			{#if has(company.roa)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">RETURN ON ASSETS <InfoPopover title="RETURN ON ASSETS (ROA)" content="Profit generated for each $1 of the company's total assets. Higher = uses its resources more efficiently." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtPct(company.roa)}</span>
				</div>
			{/if}
			{#if has(company.revenue_growth)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">REVENUE GROWTH <InfoPopover title="REVENUE GROWTH" content="How fast sales are growing each year. Strong growth is usually a good sign for a company's future." /></span>
					<span class="data" style="font-size: 13px; color: {(company.revenue_growth ?? 0) >= 0 ? '#34d399' : '#f87171'}">{fmtPct(company.revenue_growth)}</span>
				</div>
			{/if}
			{#if has(company.earnings_growth)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">EARNINGS GROWTH <InfoPopover title="EARNINGS GROWTH" content="How fast profit (earnings) is growing. Growing earnings often push the stock price up over time." /></span>
					<span class="data" style="font-size: 13px; color: {(company.earnings_growth ?? 0) >= 0 ? '#34d399' : '#f87171'}">{fmtPct(company.earnings_growth)}</span>
				</div>
			{/if}
			{#if has(company.dividend_yield)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">DIVIDEND YIELD <InfoPopover title="DIVIDEND YIELD" content="The annual cash dividend paid as a % of the share price. Income you get just for holding the stock. 0% means it pays no dividend." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtPct(company.dividend_yield)}</span>
				</div>
			{/if}
			{#if has(company.shares_outstanding)}
				<div class="rounded p-2" style="border: 1px solid var(--panel-border); background: var(--surface)">
					<span class="label block" style="font-size: 9px">SHARES OUT <InfoPopover title="SHARES OUTSTANDING" content="How many total shares of the company exist. Combined with the price, this gives the market cap." /></span>
					<span class="data" style="font-size: 13px; color: var(--foreground)">{fmtShares(company.shares_outstanding)}</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- 52-week range bar -->
	{#if has(company.low_52w) && has(company.high_52w)}
		<div class="mt-2 rounded p-3" style="border: 1px solid var(--panel-border); background: var(--surface)">
			<span class="label block mb-2" style="color: var(--foreground-subtle)">52-WEEK RANGE — WHERE THE PRICE TRADED THIS YEAR <InfoPopover title="52-WEEK RANGE" content="The highest and lowest the stock price has been in the last year. Buying near the low of the range is usually cheaper than near the high." /></span>
			<div class="flex flex-wrap items-center gap-3">
				<span class="data" style="font-size: 12px; color: var(--foreground)">LOW {fmtPrice(company.low_52w)}</span>
				<div class="relative h-1.5 flex-1 rounded" style="background-color: var(--surface-3); min-width: 120px">
					<div class="absolute inset-y-0 left-0 rounded" style="background-color: var(--accent-primary); width: {pos}%"></div>
				</div>
				<span class="data" style="font-size: 12px; color: var(--foreground)">HIGH {fmtPrice(company.high_52w)}</span>
			</div>
		</div>
	{/if}

	{#if company.website}
		<p class="label mt-1" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px">
			WEBSITE: <a href={company.website} target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary)">{company.website}</a>
		</p>
	{/if}

	<p class="label mt-2" style="color: var(--foreground-subtle); text-transform: none; font-size: 10px; line-height: 1.6">
		FUNDAMENTALS FROM YAHOO FINANCE (FREE, DELAYED). NOT FINANCIAL ADVICE.
	</p>
</div>
