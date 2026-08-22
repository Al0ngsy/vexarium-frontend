// Shared tooltip helpers: anchor the `.tooltip` child of a hover element to
// the anchor itself (absolute), so the popup scrolls WITH the page instead of
// sticking to the viewport. Clamped horizontally inside the nearest
// scrollable ancestor, flips above when there is no room below. Show/hide
// stays CSS-driven (`.indicator-tip:hover`).
//
// Pin-on-hold: hovering an anchor for PIN_MS (2.5s) pins the tooltip open
// (`.pinned` class) with a close button; the top-edge progress bar shows
// how much hold time remains. The progress bar + close button are injected
// here, so no component markup needs to change.

const PIN_MS = 2500;
const pinTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function scrollContainer(el: HTMLElement): HTMLElement {
	let p = el.parentElement;
	while (p && p !== document.body && p !== document.documentElement) {
		const oy = getComputedStyle(p).overflowY;
		if (oy === "auto" || oy === "scroll" || oy === "hidden" || oy === "clip") return p;
		p = p.parentElement;
	}
	return document.documentElement;
}

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
		btn.addEventListener("click", (e) => {
			// Never let closing the popup reach the indicator chip underneath —
			// the chip's toggle is double-click only, but keep the guard anyway.
			e.stopPropagation();
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
		// Absolute coordinates are relative to the anchor (it is the
		// positioned ancestor), so the tip rides along when the page scrolls.
		let top = anchor.offsetHeight + gap;
		let left = 0;
		// Flip above when there is no room below in the viewport.
		if (a.bottom + t.height + gap > window.innerHeight - 8) {
			top = -t.height - gap;
		}
		// Clamp horizontally inside the nearest scrollable ancestor so the
		// tip is never cut off by an overflow container.
		const sc = scrollContainer(anchor);
		const sr =
			sc === document.documentElement
				? { left: 0, right: window.innerWidth }
				: sc.getBoundingClientRect();
		const tipRight = a.left + left + t.width;
		if (tipRight > sr.right - 8) {
			left -= tipRight - (sr.right - 8);
		}
		const tipLeft = a.left + left;
		if (tipLeft < sr.left + 8) {
			left += sr.left + 8 - tipLeft;
		}
		tip.style.position = "absolute";
		tip.style.left = `${left}px`;
		tip.style.top = `${top}px`;
	});
	// Pin-on-hold: restart the hold timer + progress bar on every entry,
	// unless already pinned — a pinned tooltip keeps its full bar and close
	// button; re-hovering only refreshes the position.
	if (tip.classList.contains("pinned")) return;
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
