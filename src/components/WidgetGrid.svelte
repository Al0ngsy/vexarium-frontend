<script lang="ts">
  import type { WidgetDef, WidgetPos } from "$lib/layout.svelte";
  import {
    liveSizes,
    loadPositions,
    saveEnabled,
    savePositions,
  } from "$lib/layout.svelte";
  import type { GridStack, GridStackOptions } from "gridstack";
  import "gridstack/dist/gridstack.min.css";
  import type { Snippet } from "svelte";
  import { onDestroy } from "svelte";

  // Draggable/resizable widget grid backed by gridstack.
  // - drag via widget head (`.w-head`), resize via bottom-right handle
  // - layout persisted per view in localStorage (loadPositions/savePositions)
  // - widget visibility is owned by the parent (`enabled` prop) so the
  //   toggle state is shared with WidgetCard + WidgetLibrary; we only
  //   persist it here.

  let {
    view,
    defs,
    enabled,
    onToggle,
    children,
  }: {
    view: "analysis" | "options";
    defs: WidgetDef[];
    enabled: Record<string, boolean>;
    onToggle: (id: string) => void;
    children: Snippet<[{ def: WidgetDef }]>;
  } = $props();

  let gridEl: HTMLDivElement;
  let grid: GridStack | null = null;
  const shown = $derived(defs.filter((d) => enabled[d.id] !== false));

  // (Re)init gridstack whenever the widget set changes. Positions are
  // re-read fresh from localStorage on every init, never snapshotted, so
  // toggling a widget after a drag restores the latest saved layout instead
  // of snapping back to the mount-time copy. loadPositions is a plain read
  // (not a reactive dep), so drag-driven persistence cannot re-trigger this
  // effect and destroy the grid.
  $effect(() => {
    const visible = shown; // dependency
    if (!gridEl) return;
    const saved = loadPositions(view);
    grid?.destroy(false);
    // Dynamic import: gridstack's ESM dist uses extension-less internal
    // imports that break Node ESM resolution during SSR. Client-only lib.
    void import("gridstack").then(({ GridStack }) => {
      if (!gridEl) return;
      grid = GridStack.init(
        {
          column: 12,
          columnOpts: {
            breakpointForWindow: true,
            breakpoints: [
              { w: 767, c: 8 },
              { w: 479, c: 4 },
            ],
          },
          cellHeight: 96,
          margin: 8,
          float: false,
          handle: ".w-head",
          animate: false,
        } satisfies GridStackOptions,
        gridEl,
      );
      for (const el of Array.from(
        gridEl.querySelectorAll(".grid-stack-item"),
      ) as HTMLElement[]) {
        grid?.makeWidget(el);
      }
      for (const def of visible) {
        const savedPos = saved[def.id];
        const node = gridEl.querySelector(
          `.grid-stack-item[data-wid="${def.id}"]`,
        ) as HTMLElement | null;
        if (!node) continue;
        if (savedPos) {
          node.setAttribute("gs-x", String(savedPos.x));
          node.setAttribute("gs-y", String(savedPos.y));
          node.setAttribute("gs-w", String(savedPos.w));
          node.setAttribute("gs-h", String(savedPos.h));
        }
        grid?.makeWidget(node);
        grid?.update(node, {
          ...(savedPos ?? { x: def.x, y: def.y, w: def.w, h: def.h }),
          minW: def.minW ?? 3,
          minH: def.minH ?? 1,
        });
        liveSizes[def.id] = {
          w: savedPos?.w ?? def.w,
          h: savedPos?.h ?? def.h,
        };
      }
      grid?.on("change", onGridChange);
    });
  });

  function onGridChange() {
    if (!grid) return;
    const next: Record<string, WidgetPos> = {};
    for (const node of grid.engine.nodes) {
      const el = node.el as HTMLElement | null;
      if (!el) continue;
      const id = el.dataset.wid;
      if (!id) continue;
      next[id] = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        w: node.w ?? 1,
        h: node.h ?? 1,
      };
    }
    for (const [id, pos] of Object.entries(next))
      liveSizes[id] = { w: pos.w, h: pos.h };
    savePositions(view, next);
  }

  // Persist visibility when the parent's map changes.
  $effect(() => {
    saveEnabled(view, enabled);
  });

  onDestroy(() => {
    grid?.destroy(false);
    grid = null;
  });
</script>

<div class="grid-stack" bind:this={gridEl}>
  {#each shown as def (def.id)}
    {@render children({ def })}
  {/each}
</div>
