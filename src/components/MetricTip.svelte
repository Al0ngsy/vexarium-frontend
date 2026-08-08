<script lang="ts">
  import { positionTip, clearTip } from "$lib/tooltip";

  // Hover-anchored explanation popup: `text` is the visible label, `tip` the
  // plain-English explanation shown on hover. Reuses the .indicator-tip /
  // .tooltip CSS machinery (fixed viewport positioning via $lib/tooltip).
  let { text, tip }: { text: string; tip: string } = $props();
</script>

<span
  class="indicator-tip"
  onmouseenter={(e) => positionTip(e.currentTarget)}
  onmouseleave={(e) => clearTip(e.currentTarget)}
>
  <span class="tip-label">{text}</span>
  <span class="tooltip">{tip}</span>
</span>
