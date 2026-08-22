<script lang="ts">
  import { browser } from '$app/environment';

  // Daily disclaimer toast: bottom-right, small, dismissed with ✕. Reappears
  // once per day (localStorage date key). The permanent short version lives in
  // the topbar ("Not financial advice" link).
  const KEY = 'vexarium:disclaimer-seen';
  let dismissed = $state(true);

  function today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  if (browser) {
    try {
      dismissed = localStorage.getItem(KEY) === today();
    } catch {
      dismissed = true;
    }
  }

  function close() {
    dismissed = true;
    if (browser) {
      try {
        localStorage.setItem(KEY, today());
      } catch {
        // storage unavailable, toast just reappears
      }
    }
  }
</script>

{#if !dismissed}
  <div
    class="fixed bottom-4 right-4 z-50 rounded-lg px-3 py-2"
    style="background: var(--surface-3); border: 1px solid var(--panel-border-active); box-shadow: 0 8px 24px #0008; max-width: 280px;"
  >
    <div class="flex items-start gap-2">
      <span
        class="label"
        style="color: var(--foreground-muted); font-size: 11px; line-height: 1.5; text-transform: none;"
      >
        Not financial advice. Signals and data are for information only.
        <a href="/legal/disclaimer" style="color: var(--accent-primary)">Disclaimer</a>
      </span>
      <button
        type="button"
        onclick={close}
        class="label"
        style="border: none; background: transparent; color: var(--foreground-muted); cursor: pointer; font-size: 12px; line-height: 1; padding: 2px;"
        aria-label="Dismiss disclaimer"
        >✕</button
      >
    </div>
  </div>
{/if}
