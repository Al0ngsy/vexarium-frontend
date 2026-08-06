// ---------------------------------------------------------------------------
// Tiny markdown renderer for the AI SECOND OPINION output.
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
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Render inline markdown (**bold**, `code`) inside an escaped line. */
function renderInline(raw: string): string {
	// Escape first, then apply inline constructs on the escaped text.
	let s = escapeHtml(raw);
	// **bold** -> <strong>
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	// `code` -> <code>
	s = s.replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>');
	return s;
}

function renderBlock(text: string): string {
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	const out: string[] = [];
	let inUl = false;
	let inOl = false;

	const closeList = () => {
		if (inUl) {
			out.push('</ul>');
			inUl = false;
		}
		if (inOl) {
			out.push('</ol>');
			inOl = false;
		}
	};

	for (const raw of lines) {
		const line = raw.trimEnd();
		if (!line.trim()) {
			closeList();
			continue;
		}
		// Headings: ## -> h3, ### -> h4 (the prompt uses ## and ###).
		const h = line.match(/^(#{2,4})\s+(.+)$/);
		if (h) {
			closeList();
			const level = Math.min(h[1].length, 4);
			out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
			continue;
		}
		// Bullet list: "- item" or "* item".
		const ul = line.match(/^[-*]\s+(.+)$/);
		if (ul) {
			if (inOl) closeList();
			if (!inUl) {
				out.push('<ul>');
				inUl = true;
			}
			out.push(`<li>${renderInline(ul[1])}</li>`);
			continue;
		}
		// Numbered list: "1. item".
		const ol = line.match(/^\d+[.)]\s+(.+)$/);
		if (ol) {
			if (inUl) closeList();
			if (!inOl) {
				out.push('<ol>');
				inOl = true;
			}
			out.push(`<li>${renderInline(ol[1])}</li>`);
			continue;
		}
		closeList();
		out.push(`<p>${renderInline(line)}</p>`);
	}
	closeList();
	return out.join('\n');
}

/**
 * Convert the AI analysis markdown into safe HTML.
 * Returns '' for empty input.
 */
export function renderAIMarkdown(text: string | null | undefined): string {
	if (!text) return '';
	return renderBlock(text);
}
