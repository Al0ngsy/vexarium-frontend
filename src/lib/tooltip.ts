// Shared fixed-position tooltip helpers: anchor the `.tooltip` child of a
// hover element to the viewport (fixed), so it overlays scroll containers
// instead of expanding them. Flips above when there is no room below;
// clamps to the viewport. Show/hide stays CSS-driven (`.indicator-tip:hover`).
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
}

export function clearTip(anchor: HTMLElement): void {
  const tip = anchor.querySelector<HTMLElement>(".tooltip");
  if (!tip) return;
  tip.style.position = "";
  tip.style.left = "";
  tip.style.top = "";
}
