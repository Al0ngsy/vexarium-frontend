// ---------------------------------------------------------------------------
// Tiny markdown renderer for the AI ANALYSIS output.
//
// The LLM produces a structured briefing: ## headings, **bold**, - bullets,
// numbered lists, inline `code`/numbers. We render that subset to HTML with
// proper escaping (the AI text is untrusted — never inject raw).
//
// Explicitly NOT a full markdown parser: only the constructs the prompt
// asks the model to emit. Everything else falls through as plain text.
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render inline markdown (**bold**, `code`) inside an escaped line. */
function renderInline(raw: string): string {
  // Escape first, then apply inline constructs on the escaped text.
  let s = escapeHtml(raw);
  // **bold** -> <strong>
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // `code` -> <code>
  s = s.replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>');
  return s;
}

function renderBlock(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  // List-nesting stack: { tag: "ul"|"ol", depth } entries for open lists.
  const stack: { tag: "ul" | "ol"; depth: number }[] = [];
  // Depths of currently open <li> elements (innermost last). Lets nested
  // <ul>/<ol> live INSIDE their parent <li> while still closing siblings.
  const liDepths: number[] = [];
  let lastItemDepth = -1; // depth of the most recently opened (unclosed) <li>

  const closeLi = () => {
    if (liDepths.length) {
      out.push("</li>");
      liDepths.pop();
      lastItemDepth = liDepths.length ? liDepths[liDepths.length - 1] : -1;
    }
  };
  const closeAllLists = () => {
    closeLi();
    while (stack.length) {
      const top = stack.pop()!;
      out.push(`</${top.tag}>`);
      closeLi(); // the parent <li> that contained this list ends here
    }
  };
  const openList = (tag: "ul" | "ol", depth: number) => {
    if (depth > 0 && !liDepths.length) {
      // Malformed input (nested list without a parent item) — synthesize one.
      out.push("<li>");
      liDepths.push(Math.max(depth - 1, 0));
    }
    out.push(`<${tag}>`);
    stack.push({ tag, depth });
  };
  // openItem(html, depth, isFirstInNested): isFirstInNested=true when the item
  // is the FIRST of a nested list — the parent <li> must stay open.
  const openItem = (html: string, depth: number, isFirstInNested = false) => {
    if (!isFirstInNested && lastItemDepth === depth) closeLi();
    out.push(`<li>${html}`);
    liDepths.push(depth);
    lastItemDepth = depth;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeAllLists();
      continue;
    }
    // Headings: ## -> h3, ### -> h4 (the prompt uses ## and ###).
    const h = line.match(/^(#{2,4})\s+(.+)$/);
    if (h) {
      closeAllLists();
      const level = Math.min(h[1].length, 4);
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      continue;
    }
    // Bullet list: "- item", "* item", or indented "  - nested item".
    // Indentation depth is measured in 2-space units (the LLM's nesting).
    const indentMatch = line.match(/^(\s*)([-*])\s+(.+)$/);
    if (indentMatch) {
      const depth = Math.floor(indentMatch[1].length / 2);
      let isFirstInNested = false;
      if (!stack.length) {
        openList("ul", depth);
      } else {
        const top = stack[stack.length - 1];
        if (depth > top.depth) {
          openList("ul", depth); // nested <ul> inside the open parent <li>
          isFirstInNested = true;
        } else if (depth < top.depth) {
          closeLi(); // close the innermost item
          while (stack.length && stack[stack.length - 1].depth > depth) {
            const closed = stack.pop()!;
            out.push(`</${closed.tag}>`);
            closeLi(); // the item that contained this list ends here
          }
          if (stack.length && stack[stack.length - 1].depth < depth) {
            openList("ul", depth);
            isFirstInNested = true;
          }
        }
      }
      openItem(renderInline(indentMatch[3]), depth, isFirstInNested);
      continue;
    }
    // Numbered list: "1. item" (also allows indented nesting).
    const ol = line.match(/^(\s*)\d+[.)]\s+(.+)$/);
    if (ol) {
      const depth = Math.floor(ol[1].length / 2);
      let isFirstInNested = false;
      if (!stack.length) {
        openList("ol", depth);
      } else {
        const top = stack[stack.length - 1];
        if (depth > top.depth) {
          openList("ol", depth);
          isFirstInNested = true;
        } else if (depth < top.depth) {
          closeLi();
          while (stack.length && stack[stack.length - 1].depth > depth) {
            const closed = stack.pop()!;
            out.push(`</${closed.tag}>`);
            closeLi();
          }
          if (stack.length && stack[stack.length - 1].depth < depth) {
            openList("ol", depth);
            isFirstInNested = true;
          }
        }
      }
      openItem(renderInline(ol[2]), depth, isFirstInNested);
      continue;
    }
    closeAllLists();
    out.push(`<p>${renderInline(line)}</p>`);
  }
  closeAllLists();
  return out.join("\n");
}

/**
 * Convert the AI analysis markdown into safe HTML.
 * Returns '' for empty input.
 */
export function renderAIMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return renderBlock(text);
}
