/**
 * Lightweight markdown-to-HTML converter for email rendering.
 * Handles the most common markdown patterns without external dependencies.
 */
export function markdownToHtml(text: string): string {
  // Escape HTML entities first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```) — must come before inline processing
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${code.trimEnd()}</code></pre>`;
  });

  // Inline code (`...`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (# to ######)
  html = html.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^[-*_]{3,}\s*$/gm, '<hr>');

  // Bold + italic (***text*** or ___text___)
  html = html.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
  html = html.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');

  // Bold (**text** or __text__)
  html = html.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');
  html = html.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

  // Images ![alt](url) — must come before links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists (- or * at start of line)
  html = html.replace(/(?:^[\t ]*[-*]\s+.+$\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^[\t ]*[-*]\s+/, '')}</li>`)
      .join('\n');
    return `<ul>\n${items}\n</ul>\n`;
  });

  // Ordered lists (1. 2. etc.)
  html = html.replace(/(?:^[\t ]*\d+\.\s+.+$\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^[\t ]*\d+\.\s+/, '')}</li>`)
      .join('\n');
    return `<ol>\n${items}\n</ol>\n`;
  });

  // Blockquotes (> text)
  html = html.replace(/(?:^&gt;\s?.+$\n?)+/gm, (block) => {
    const content = block.replace(/^&gt;\s?/gm, '').trim();
    return `<blockquote>${content}</blockquote>\n`;
  });

  // Paragraphs — wrap remaining loose text blocks in <p> tags
  html = html.replace(
    /^(?!<(?:h[1-6]|ul|ol|li|pre|code|blockquote|hr|\/))(.+)$/gm,
    '<p>$1</p>'
  );

  // Clean up double line breaks between block elements
  html = html.replace(/\n{2,}/g, '\n');

  return html.trim();
}
