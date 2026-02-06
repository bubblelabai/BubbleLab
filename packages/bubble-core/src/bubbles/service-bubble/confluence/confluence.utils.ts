/**
 * Confluence Bubble Utilities
 *
 * Helper functions for the Confluence service integration.
 */

/**
 * Escapes HTML special characters to prevent invalid XHTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts markdown text to Confluence storage format (XHTML-based).
 *
 * Confluence uses an XHTML-based storage format for page bodies.
 * This function converts common markdown into the appropriate format.
 * Works for both page bodies and comment bodies.
 *
 * Supported markdown:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - `inline code`
 * - [links](url)
 * - # Headings (h1-h6)
 * - - Bullet lists
 * - 1. Numbered lists
 * - > Blockquotes
 * - ``` Code blocks ```
 * - --- Horizontal rules
 * - ~~strikethrough~~
 * - | Tables |
 *
 * @param text - Markdown or plain text to convert
 * @returns Confluence storage format XHTML string
 */
export function markdownToConfluenceStorage(text: string): string {
  if (!text) return '';

  const lines = text.split(/\r?\n/);
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (```)
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // Skip closing ``` if found
      if (i < lines.length) {
        i++;
      }
      // Use <pre> which works in both page bodies and comment bodies
      // (ac:structured-macro is not supported in comments)
      output.push(`<pre>${escapeHtml(codeLines.join('\n'))}</pre>`);
      continue;
    }

    // Horizontal rule (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      output.push('<hr />');
      i++;
      continue;
    }

    // Headings (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = processInlineMarkdown(headingMatch[2]);
      output.push(`<h${level}>${headingText}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote (>)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const quoteContent = quoteLines
        .map((ql) => `<p>${processInlineMarkdown(ql)}</p>`)
        .join('');
      output.push(`<blockquote>${quoteContent}</blockquote>`);
      continue;
    }

    // Markdown table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[] = [];
      while (
        i < lines.length &&
        lines[i].includes('|') &&
        lines[i].trim().startsWith('|')
      ) {
        tableRows.push(lines[i]);
        i++;
      }
      const tableHtml = convertMarkdownTable(tableRows);
      if (tableHtml) {
        output.push(tableHtml);
      } else {
        // Fallback: render as plain paragraphs if table parsing fails
        for (const row of tableRows) {
          output.push(`<p>${processInlineMarkdown(row)}</p>`);
        }
      }
      continue;
    }

    // Bullet list (- or *)
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s+/, '');
        items.push(`<li>${processInlineMarkdown(itemText)}</li>`);
        i++;
      }
      output.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list (1. 2. etc)
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '');
        items.push(`<li>${processInlineMarkdown(itemText)}</li>`);
        i++;
      }
      output.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Empty line - skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    output.push(`<p>${processInlineMarkdown(line)}</p>`);
    i++;
  }

  return output.join('');
}

/**
 * Converts markdown table rows into an HTML table.
 * Returns null if the rows don't form a valid table.
 */
function convertMarkdownTable(rows: string[]): string | null {
  if (rows.length < 2) return null;

  // Parse cells from a row: | cell1 | cell2 | → ['cell1', 'cell2']
  const parseCells = (row: string): string[] => {
    return row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  };

  const headerCells = parseCells(rows[0]);
  if (headerCells.length === 0) return null;

  // Check if row 2 is a separator (|---|---|)
  const separatorRow = rows[1].trim();
  const isSeparator = /^\|?[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|?$/.test(
    separatorRow
  );

  const html: string[] = ['<table>'];

  if (isSeparator) {
    // Has header row
    html.push('<thead><tr>');
    for (const cell of headerCells) {
      html.push(`<th>${processInlineMarkdown(cell)}</th>`);
    }
    html.push('</tr></thead>');

    // Body rows start after separator
    if (rows.length > 2) {
      html.push('<tbody>');
      for (let r = 2; r < rows.length; r++) {
        const cells = parseCells(rows[r]);
        html.push('<tr>');
        for (let c = 0; c < headerCells.length; c++) {
          html.push(`<td>${processInlineMarkdown(cells[c] || '')}</td>`);
        }
        html.push('</tr>');
      }
      html.push('</tbody>');
    }
  } else {
    // No separator — treat all rows as body
    html.push('<tbody>');
    for (const row of rows) {
      const cells = parseCells(row);
      html.push('<tr>');
      for (const cell of cells) {
        html.push(`<td>${processInlineMarkdown(cell)}</td>`);
      }
      html.push('</tr>');
    }
    html.push('</tbody>');
  }

  html.push('</table>');
  return html.join('');
}

/**
 * Process inline markdown formatting and return XHTML.
 * Escapes raw HTML characters first, then applies markdown transformations.
 */
function processInlineMarkdown(text: string): string {
  if (!text) return '';

  let result = text;

  // Extract inline code spans first to protect them from further processing
  const codeSpans: string[] = [];
  result = result.replace(/`([^`]+)`/g, (_match, code: string) => {
    const placeholder = `\x00CODE${codeSpans.length}\x00`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Escape HTML entities in the remaining text
  result = escapeHtml(result);

  // Links [text](url) — restore angle brackets in URLs
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, linkText: string, url: string) => {
      const decodedUrl = url
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      return `<a href="${decodedUrl}">${linkText}</a>`;
    }
  );

  // Bold **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Strikethrough ~~text~~
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Italic *text* or _text_ (but not inside words for _)
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g, '<em>$1</em>');

  // Restore inline code spans
  for (let idx = 0; idx < codeSpans.length; idx++) {
    result = result.replace(`\x00CODE${idx}\x00`, codeSpans[idx]);
  }

  return result;
}

/**
 * Converts Confluence storage format (XHTML) back to plain text.
 *
 * Strips HTML tags to produce readable plain text.
 *
 * @param storage - Storage format XHTML string
 * @returns Plain text representation
 */
export function storageToText(storage: string | undefined | null): string {
  if (!storage) return '';

  // Remove CDATA sections, extract content
  let text = storage.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

  // Replace <br> tags with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Replace block elements with newlines
  text = text.replace(/<\/(p|h[1-6]|li|div|blockquote|tr)>/gi, '\n');
  text = text.replace(/<(p|h[1-6]|li|div|blockquote|tr)[^>]*>/gi, '');

  // Replace <hr> with ---
  text = text.replace(/<hr\s*\/?>/gi, '---\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, dec: string) =>
      String.fromCharCode(parseInt(dec, 10))
    );

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Enhances Confluence API error messages with helpful hints.
 *
 * @param errorText - Raw error text from API
 * @param statusCode - HTTP status code
 * @param statusText - HTTP status text
 * @returns Enhanced error message
 */
export function enhanceErrorMessage(
  errorText: string,
  statusCode: number,
  statusText: string
): string {
  let message = `Confluence API Error (${statusCode} ${statusText})`;

  // Try to parse JSON error
  try {
    const errorJson = JSON.parse(errorText);
    if (errorJson.message) {
      message += `: ${errorJson.message}`;
    } else if (errorJson.errors && Array.isArray(errorJson.errors)) {
      const errorMessages = errorJson.errors
        .map((e: { message?: string; title?: string }) => e.message || e.title)
        .filter(Boolean);
      if (errorMessages.length > 0) {
        message += `: ${errorMessages.join(', ')}`;
      }
    }
  } catch {
    if (errorText && errorText.length < 500) {
      message += `: ${errorText}`;
    }
  }

  // Add helpful hints based on status code
  switch (statusCode) {
    case 400:
      message +=
        '\nHint: Check your request parameters. Common issues: invalid CQL syntax, missing required fields, or invalid page/space IDs.';
      break;
    case 401:
      message +=
        '\nHint: Authentication failed. Ensure your OAuth token is valid and has the required Confluence scopes.';
      break;
    case 403:
      message +=
        '\nHint: Permission denied. Ensure your account has access to this space/page.';
      break;
    case 404:
      message +=
        '\nHint: Resource not found. Verify the page ID, space ID, or space key exists.';
      break;
    case 409:
      message +=
        '\nHint: Version conflict. The page may have been updated by another user. Retry the operation.';
      break;
    case 429:
      message += '\nHint: Rate limited. Wait a moment before retrying.';
      break;
  }

  return message;
}
