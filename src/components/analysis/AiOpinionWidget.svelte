<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import { renderAIMarkdown } from "$lib/markdown";

  let { store }: { store: AnalysisStore } = $props();
</script>

<div class="flex h-full flex-col">
  <div class="flex items-center justify-end">
    <button class="btn-outline" onclick={() => store.runAI()} disabled={store.aiLoading}
      >Run AI analysis</button
    >
  </div>
  {#if store.aiLoading && !store.aiMessage}
    <p class="mt-4 font-mono" style="color: var(--accent-primary)">
      Analyzing…
    </p>
  {:else if store.aiMessage}
    <div class="mt-4 ai-body" style="flex: 1; overflow: auto;">
      {@html renderAIMarkdown(store.aiMessage)}
    </div>
  {:else}
    <p
      class="mt-4 label"
      style="color: var(--foreground-muted); text-transform: none"
    >
      Run AI to get a natural-language interpretation of the
      indicators, news and fundamentals.
    </p>
  {/if}
</div>
