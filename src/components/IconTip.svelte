<script lang="ts">
  import { positionTip, clearTip } from "$lib/tooltip";

  // Icon-style hover explanation popup for the options workspace: the "i"
  // button triggers the same pin-on-hold tooltip as the stock/etf side
  // (progress bar fills while hovering, then the popup stays open with a
  // close button, and it scrolls with the page).
  let { title, content }: { title: string; content: string } = $props();
</script>

<span
  class="indicator-tip"
  onmouseenter={(e) => positionTip(e.currentTarget)}
  onmouseleave={(e) => clearTip(e.currentTarget)}
  onclick={(e) => e.stopPropagation()}
>
  <button
    type="button"
    class="inline-flex h-4 w-4 items-center justify-center rounded-full"
    style="border: 1px solid var(--panel-border-active); color: var(--accent-primary); font-size: 0.625rem; line-height: 1; cursor: help; background-color: transparent;"
    aria-label={`Info: ${title}`}
  >i</button>
  <span class="tooltip">
    <span class="label block mb-1" style="color: var(--foreground)">{title}</span>
    <span class="label block" style="color: var(--foreground-muted); line-height: 1.5; text-transform: none">{content}</span>
  </span>
</span>
