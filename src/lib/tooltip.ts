// Shared fixed-position tooltip helpers: anchor the `.tooltip` child of a
// hover element to the viewport (fixed), so it overlays scroll containers
// instead of expanding them. Flips above when there is no room below;
// clamps to the viewport. Show/hide stays CSS-driven (`.indicator-tip:hover`).
//
// Pin-on-hold: hovering an anchor for PIN_MS (5s) pins the tooltip open
// (`.pinned` class) with a close button; the top-edge progress bar shows
// how much hold time remains. The progress bar + close button are injected
// here, so no component markup needs to change.

const PIN_MS = 5000;
const pinTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function ensureProgressBar(tip: HTMLElement): void {
  let bar = tip.querySelector<HTMLElement>(".tip-progress");
  if (!bar) {
    bar = document.createElement("span");
    bar.className = "tip-progress";
    tip.prepend(bar);
  }
  // Restart the fill: reset, force reflow, then animate to full over PIN_MS.
  bar.style.transition = "none";
  bar.style.transform = "scaleX(0)";
  void bar.offsetWidth;
  bar.style.transition = `transform ${PIN_MS}ms linear`;
  bar.style.transform = "scaleX(1)";
}

function pinTip(anchor: HTMLElement, tip: HTMLElement): void {
  tip.classList.add("pinned");
  let close = tip.querySelector<HTMLButtonElement>(".tip-close");
  if (!close) {
    close = document.createElement("button");
    close.className = "tip-close";
    close.title = "Close";
    close.setAttribute("aria-label", "Close popup");
    close.textContent = "✕";
    const btn = close;
    btn.addEventListener("click", () => {
      tip.classList.remove("pinned");
      btn.remove();
      clearTip(anchor);
    });
    tip.append(btn);
  }
}

export function positionTip(anchor: HTMLElement): void {
  const tip = anchor.querySelector<HTMLElement>(".tooltip");
  if (!tip) return;
  requestAnimationFrame(() => {
    const a = anchor.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 6;
    let top = a.bottom + gap;
    let left = Math.min(a.left, window.innerWidth - t.width - 8);
    left = Math.max(8, left);
    if (top + t.height > window.innerHeight - 8) {
      top = Math.max(8, a.top - t.height - gap);
    }
    tip.style.position = "fixed";
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
  // Pin-on-hold: restart the hold timer + progress bar on every entry.
  const prev = pinTimers.get(anchor);
  if (prev) clearTimeout(prev);
  ensureProgressBar(tip);
  pinTimers.set(
    anchor,
    setTimeout(() => pinTip(anchor, tip), PIN_MS),
  );
}

export function clearTip(anchor: HTMLElement): void {
  const tip = anchor.querySelector<HTMLElement>(".tooltip");
  if (!tip) return;
  if (tip.classList.contains("pinned")) return; // stays open until closed
  const prev = pinTimers.get(anchor);
  if (prev) clearTimeout(prev);
  pinTimers.delete(anchor);
  tip.style.position = "";
  tip.style.left = "";
  tip.style.top = "";
}
