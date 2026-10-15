<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import LoadingNotice from "./LoadingNotice.svelte";

  let { store }: { store: AnalysisStore } = $props();
</script>

{#if store.vitals.length === 0}
  <LoadingNotice />
{:else}
  <div class="grid grid-cols-2 gap-3">
    {#each store.vitals as v}
      <div class="vital">
        <div class="k">{v.k}</div>
        <div class="v">{v.v}</div>
        <div class="d">{v.d}</div>
      </div>
    {/each}
  </div>
{/if}
