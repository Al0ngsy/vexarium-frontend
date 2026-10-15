<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import CompanyProfile from "../CompanyProfile.svelte";
  import LoadingNotice from "./LoadingNotice.svelte";

  let { store }: { store: AnalysisStore } = $props();
</script>

{#if !store.analysis}
  <LoadingNotice />
{:else if store.analysis.company && (store.analysis.company.name || store.analysis.company.description || store.analysis.company.market_cap !== null)}
  {@const co = store.analysis.company}
  {@const range = (co.high_52w ?? 0) - (co.low_52w ?? 0)}
  {@const pos =
    range > 0 && store.analysis.current_price
      ? Math.min(
          100,
          Math.max(
            0,
            ((store.analysis.current_price - (co.low_52w ?? 0)) / range) * 100,
          ),
        )
      : 0}
  <div style="height: 100%; overflow: auto;">
    <CompanyProfile company={co} symbol={store.symbol} {pos} />
  </div>
{:else}
  <p class="label" style="color: var(--foreground-muted)">
    No company data
  </p>
{/if}
