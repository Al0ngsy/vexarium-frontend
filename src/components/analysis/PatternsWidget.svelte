<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import LoadingNotice from "./LoadingNotice.svelte";

  let { store }: { store: AnalysisStore } = $props();
</script>

{#if !store.analysis}
  <LoadingNotice />
{:else if store.patternFlags.length === 0}
  <p class="label" style="color: var(--foreground-muted);">
    No recent patterns
  </p>
{:else}
  <div class="flex flex-col" style="gap: 6px;">
    {#each store.patternFlags as f}
      <div
        style="display: flex; align-items: center; gap: 8px; font-size: 0.72rem;"
      >
        <span
          style="flex-shrink: 0; font-size: 0.58rem; padding: 1px 7px; border-radius: 4px; border: 1px solid {f.dir === 'bullish'
            ? '#34d399'
            : '#f87171'}; color: {f.dir === 'bullish'
            ? '#34d399'
            : '#f87171'};"
          >{f.dir === "bullish" ? "Bullish" : "Bearish"}</span
        >
        <span style="color: var(--foreground); min-width: 0;">{f.label}</span>
        {#if f.ago > 0}
          <span
            class="label"
            style="color: var(--foreground-subtle); margin-left: auto; flex-shrink: 0;"
            >{f.ago} bars ago</span
          >
        {/if}
      </div>
    {/each}
  </div>
{/if}
