<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import LoadingNotice from "./LoadingNotice.svelte";

  let { store }: { store: AnalysisStore } = $props();
</script>

{#if !store.analysis}
  <LoadingNotice />
{:else if store.statsRows.length === 0}
  <p class="label" style="color: var(--foreground-muted);">
    No statistics available
  </p>
{:else}
  <div class="grid grid-cols-2 gap-3">
    {#each store.statsRows as row}
      <div class="vital">
        <div class="k">{row.k}</div>
        <div class="v" style="color: {row.color ?? 'var(--foreground)'};">
          {row.v}
        </div>
      </div>
    {/each}
  </div>
{/if}
