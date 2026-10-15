import { describe, expect, it } from 'vitest';
import { renderAIMarkdown } from './markdown';

// The AI text is untrusted LLM output rendered with {@html}. Whatever it
// contains, the only tags in the result may be the ones the renderer emits.
const ALLOWED_TAG = /<\/?(?:p|h[2-4]|ul|ol|li|strong)>|<code class="ai-code">|<\/code>/g;
// Drop the cosmetic newlines between tags.
const compact = (html: string) => html.replace(/\s*\n\s*/g, '');
function assertOnlyOwnTags(html: string) {
	const rest = html.replace(ALLOWED_TAG, '');
	expect(rest).not.toContain('<');
	expect(rest).not.toContain('>');
}

describe('renderAIMarkdown: structure', () => {
	it('returns an empty string for empty input', () => {
		expect(renderAIMarkdown('')).toBe('');
		expect(renderAIMarkdown(null)).toBe('');
		expect(renderAIMarkdown(undefined)).toBe('');
	});

	it('renders headings, paragraphs, bold and inline code', () => {
		const html = renderAIMarkdown('## Title\n\nSome **bold** and `code` text');
		expect(html).toContain('<h2>Title</h2>');
		expect(html).toContain('<p>Some <strong>bold</strong> and <code class="ai-code">code</code> text</p>');
	});

	it('renders bullet and numbered lists', () => {
		expect(compact(renderAIMarkdown('- one\n- two'))).toBe('<ul><li>one</li><li>two</li></ul>');
		expect(compact(renderAIMarkdown('1. one\n2. two'))).toBe('<ol><li>one</li><li>two</li></ol>');
	});

	it('nests indented lists inside their parent item', () => {
		const html = renderAIMarkdown('- parent\n  - child');
		expect(compact(html)).toBe('<ul><li>parent<ul><li>child</li></ul></li></ul>');
	});

	it('tolerates CRLF line endings', () => {
		expect(renderAIMarkdown('## A\r\n\r\ntext')).toBe('<h2>A</h2>\n<p>text</p>');
	});
});

describe('renderAIMarkdown: XSS escaping', () => {
	it('escapes <script> tags', () => {
		const html = renderAIMarkdown('<script>alert(1)</script>');
		expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
		assertOnlyOwnTags(html);
	});

	it('escapes tags carrying event-handler attributes', () => {
		const html = renderAIMarkdown('<img src=x onerror=alert(1)> and <a href="x" onclick="y()">z</a>');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('<a ');
		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
		assertOnlyOwnTags(html);
	});

	it('escapes quotes so attribute breakout is impossible', () => {
		const html = renderAIMarkdown(`" onmouseover="alert(1)" '`);
		expect(html).toBe('<p>&quot; onmouseover=&quot;alert(1)&quot; &#39;</p>');
		expect(html).not.toMatch(/"[^>]*onmouseover/);
	});

	it('never emits links, so javascript: URLs stay inert text', () => {
		const html = renderAIMarkdown('[click](javascript:alert(1)) and <a href="javascript:alert(1)">x</a>');
		expect(html).not.toMatch(/<a[\s>]/);
		// the markup of the second link survives only as escaped text
		expect(html).toContain('&lt;a href=&quot;javascript:alert(1)&quot;&gt;');
		assertOnlyOwnTags(html);
	});

	it('escapes markup inside bold, code, headings and list items', () => {
		const html = renderAIMarkdown(
			'## <img src=x onerror=1>\n\n**<b>x</b>** `<script>`\n\n- <svg onload=1>\n1. <iframe src=x>'
		);
		expect(html).toContain('<h2>&lt;img src=x onerror=1&gt;</h2>');
		expect(html).toContain('<strong>&lt;b&gt;x&lt;/b&gt;</strong>');
		expect(html).toContain('<code class="ai-code">&lt;script&gt;</code>');
		expect(compact(html)).toContain('<li>&lt;svg onload=1&gt;</li>');
		expect(compact(html)).toContain('<li>&lt;iframe src=x&gt;</li>');
		assertOnlyOwnTags(html);
	});

	it('escapes ampersands before applying inline markup (no entity smuggling)', () => {
		const html = renderAIMarkdown('&lt;script&gt; **&amp;**');
		expect(html).toBe('<p>&amp;lt;script&amp;gt; <strong>&amp;amp;</strong></p>');
	});

	it('produces only renderer-owned tags for a hostile mixed document', () => {
		const hostile = [
			'## <script>1</script>',
			'- <img src=x onerror=alert(1)>',
			'  - **`<iframe srcdoc="<script>1</script>">`**',
			'1) <a href="javascript:1">x</a>',
			'<style>*{display:none}</style>',
			'</p><script>2</script><p>'
		].join('\n');
		assertOnlyOwnTags(renderAIMarkdown(hostile));
	});
});
