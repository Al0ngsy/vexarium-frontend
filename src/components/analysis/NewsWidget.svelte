<script lang="ts">
  import type { AnalysisStore } from "$lib/analysis.svelte";
  import LoadingNotice from "./LoadingNotice.svelte";

  let { store }: { store: AnalysisStore } = $props();
</script>

{#snippet articleRow(article: import("$lib/types").NewsArticle)}
  {@const s = article.sentiment}
  <a
    href={article.url || "#"}
    target="_blank"
    rel="noopener noreferrer"
    style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--foreground); font-size: 0.75rem; line-height: 1.4;"
  >
    <span style="color: var(--accent-primary); flex-shrink: 0;">●</span>
    <div style="flex: 1; min-width: 0;">
      <div>{article.headline}</div>
      <div
        class="label"
        style="color: var(--foreground-subtle); text-transform: none;"
      >
        {article.source || "Source"}{article.created_at
          ? ` · ${new Date(article.created_at).toLocaleDateString()}`
          : ""}
      </div>
    </div>
    <span
      title={s == null ? "No sentiment score" : `Sentiment score ${s}`}
      style="font-family: var(--font-mono); font-size: 0.66rem; font-variant-numeric: tabular-nums; flex-shrink: 0; margin-left: auto; color: {s == null
        ? 'var(--foreground-muted)'
        : s > 0.2
          ? 'var(--verdict-strong-buy)'
          : s < -0.2
            ? 'var(--verdict-strong-sell)'
            : 'var(--verdict-hold)'};"
      >{s == null ? "·" : (s > 0 ? "+" : "") + s.toFixed(2)}</span
    >
  </a>
{/snippet}
{#if !store.analysis}
  <LoadingNotice />
{:else if store.analysis.news_sentiment}
  {@const ns = store.analysis.news_sentiment}
  {@const color =
    ns.sentiment_score > 0.2
      ? "var(--verdict-strong-buy)"
      : ns.sentiment_score < -0.2
        ? "var(--verdict-strong-sell)"
        : "var(--verdict-hold)"}
  <div style="display: flex; gap: 20px; margin-bottom: 12px;">
    <div class="vital" style="flex: 1;">
      <div class="k">Sentiment</div>
      <div class="v" style="color: {color}">{ns.summary}</div>
      <div class="d">
        {ns.article_count} articles · score {ns.sentiment_score}
      </div>
    </div>
  </div>
  {#if store.analysis.news_articles && store.analysis.news_articles.length > 0}
    <div
      class="flex flex-col"
      style="border-top: 1px solid var(--panel-border); padding-top: 8px; gap: 8px;"
    >
      {#each store.analysis.news_articles.slice(0, 5) as article}
        {@render articleRow(article)}
      {/each}
    </div>
  {/if}
  {#if store.marketNews && store.marketNews.articles && store.marketNews.articles.length > 0}
    <div
      style="margin-top: 14px; border-top: 1px solid var(--panel-border); padding-top: 10px;"
    >
      <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px;">
        <span class="k" style="font-size: 0.7rem; margin: 0;">Market</span>
        <span
          class="label"
          style="font-size: 0.64rem; text-transform: none; color: var(--foreground-muted);"
        >
          broad market · score {store.marketNews.sentiment.sentiment_score}
        </span>
      </div>
      <div class="flex flex-col" style="gap: 8px;">
        {#each store.marketNews.articles.slice(0, 5) as article}
          {@render articleRow(article)}
        {/each}
      </div>
    </div>
  {/if}
{:else}
  <p class="label" style="color: var(--foreground-muted)">
    No news data
  </p>
{/if}
