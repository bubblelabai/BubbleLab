/**
 * Jira Bubble Utilities
 *
 * Helper functions for the Jira service integration.
 */

/**
 * Atlassian Document Format (ADF) types
 */
interface ADFMark {
  type: 'strong' | 'em' | 'code' | 'link' | 'strike';
  attrs?: {
    href?: string;
    title?: string;
  };
}

interface ADFTextNode {
  type: 'text';
  text: string;
  marks?: ADFMark[];
}

interface ADFInlineNode {
  type: 'hardBreak';
}

type ADFInlineContent = ADFTextNode | ADFInlineNode;

interface ADFParagraphNode {
  type: 'paragraph';
  content?: ADFInlineContent[];
}

interface ADFHeadingNode {
  type: 'heading';
  attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 };
  content?: ADFInlineContent[];
}

interface ADFCodeBlockNode {
  type: 'codeBlock';
  attrs?: { language?: string };
  content?: ADFTextNode[];
}

interface ADFListItemNode {
  type: 'listItem';
  content: (ADFParagraphNode | ADFBulletListNode | ADFOrderedListNode)[];
}

interface ADFBulletListNode {
  type: 'bulletList';
  content: ADFListItemNode[];
}

interface ADFOrderedListNode {
  type: 'orderedList';
  content: ADFListItemNode[];
}

interface ADFBlockquoteNode {
  type: 'blockquote';
  content: ADFParagraphNode[];
}

interface ADFRuleNode {
  type: 'rule';
}

type ADFBlockNode =
  | ADFParagraphNode
  | ADFHeadingNode
  | ADFCodeBlockNode
  | ADFBulletListNode
  | ADFOrderedListNode
  | ADFBlockquoteNode
  | ADFRuleNode;

interface ADFDocument {
  type: 'doc';
  version: 1;
  content: ADFBlockNode[];
}

/**
 * Converts markdown or plain text to Atlassian Document Format (ADF).
 *
 * Jira's API requires descriptions and comments in ADF format.
 * This function converts markdown/plain text into proper ADF structure.
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
 *
 * @param text - Markdown or plain text to convert
 * @returns ADF document object
 *
 * @example
 * const adf = textToADF('**Bold** and *italic*');
 * const adf = textToADF('# Heading\n\nParagraph text');
 */
export function textToADF(text: string): ADFDocument {
  const lines = text.split(/\r?\n/);
  const content: ADFBlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (```)
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      content.push({
        type: 'codeBlock',
        attrs: language ? { language } : undefined,
        content:
          codeLines.length > 0
            ? [{ type: 'text', text: codeLines.join('\n') }]
            : undefined,
      });
      i++; // Skip closing ```
      continue;
    }

    // Horizontal rule (---, ***, ___)
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      content.push({ type: 'rule' });
      i++;
      continue;
    }

    // Headings (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const headingText = headingMatch[2];
      content.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineMarkdown(headingText),
      });
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
      content.push({
        type: 'blockquote',
        content: quoteLines.map((ql) => ({
          type: 'paragraph',
          content: parseInlineMarkdown(ql),
        })),
      });
      continue;
    }

    // Bullet list (- or *)
    if (/^[-*]\s+/.test(line)) {
      const listItems: ADFListItemNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s+/, '');
        listItems.push({
          type: 'listItem',
          content: [
            { type: 'paragraph', content: parseInlineMarkdown(itemText) },
          ],
        });
        i++;
      }
      content.push({ type: 'bulletList', content: listItems });
      continue;
    }

    // Ordered list (1. 2. etc)
    if (/^\d+\.\s+/.test(line)) {
      const listItems: ADFListItemNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '');
        listItems.push({
          type: 'listItem',
          content: [
            { type: 'paragraph', content: parseInlineMarkdown(itemText) },
          ],
        });
        i++;
      }
      content.push({ type: 'orderedList', content: listItems });
      continue;
    }

    // Empty line - skip but don't create empty paragraph
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    content.push({
      type: 'paragraph',
      content: parseInlineMarkdown(line),
    });
    i++;
  }

  // Ensure at least one node
  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [] });
  }

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Parses inline markdown formatting and returns ADF inline content.
 */
function parseInlineMarkdown(text: string): ADFInlineContent[] {
  if (!text) return [];

  const result: ADFInlineContent[] = [];

  // Regex patterns for inline formatting
  // Order matters: more specific patterns first
  const patterns = [
    // Code (must be first to avoid conflicts with other patterns inside code)
    { regex: /`([^`]+)`/g, mark: 'code' as const },
    // Links [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, mark: 'link' as const },
    // Bold **text** or __text__
    { regex: /\*\*([^*]+)\*\*|__([^_]+)__/g, mark: 'strong' as const },
    // Strikethrough ~~text~~
    { regex: /~~([^~]+)~~/g, mark: 'strike' as const },
    // Italic *text* or _text_ (but not inside words for _)
    {
      regex: /\*([^*]+)\*|(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g,
      mark: 'em' as const,
    },
  ];

  // Simple approach: process text sequentially
  let lastIndex = 0;

  // Find all matches and their positions
  interface Match {
    start: number;
    end: number;
    text: string;
    mark: ADFMark['type'];
    href?: string;
  }

  const matches: Match[] = [];

  for (const { regex, mark } of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[1] || match[2] || '';
      const matchObj: Match = {
        start: match.index,
        end: match.index + match[0].length,
        text: matchedText,
        mark,
      };

      if (mark === 'link') {
        matchObj.text = match[1];
        matchObj.href = match[2];
      }

      // Check for overlaps with existing matches
      const overlaps = matches.some(
        (m) =>
          (matchObj.start >= m.start && matchObj.start < m.end) ||
          (matchObj.end > m.start && matchObj.end <= m.end)
      );

      if (!overlaps) {
        matches.push(matchObj);
      }
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Build result
  for (const match of matches) {
    // Add plain text before this match
    if (match.start > lastIndex) {
      const plainText = text.slice(lastIndex, match.start);
      if (plainText) {
        result.push({ type: 'text', text: plainText });
      }
    }

    // Add the marked text
    const marks: ADFMark[] = [{ type: match.mark }];
    if (match.mark === 'link' && match.href) {
      marks[0] = { type: 'link', attrs: { href: match.href } };
    }

    result.push({
      type: 'text',
      text: match.text,
      marks,
    });

    lastIndex = match.end;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    const plainText = text.slice(lastIndex);
    if (plainText) {
      result.push({ type: 'text', text: plainText });
    }
  }

  // If no matches, return plain text
  if (result.length === 0 && text) {
    result.push({ type: 'text', text });
  }

  return result;
}

/**
 * Converts ADF document back to plain text.
 *
 * Useful for displaying Jira content in a human-readable format.
 *
 * @param adf - ADF document to convert
 * @returns Plain text representation
 */
export function adfToText(adf: unknown): string {
  if (!adf || typeof adf !== 'object') {
    return '';
  }

  const doc = adf as { type?: string; content?: unknown[] };

  if (doc.type !== 'doc' || !Array.isArray(doc.content)) {
    // If it's a string, return it directly
    if (typeof adf === 'string') {
      return adf;
    }
    return '';
  }

  const lines: string[] = [];

  for (const node of doc.content) {
    const block = node as {
      type?: string;
      content?: unknown[];
      attrs?: unknown;
    };
    const text = extractBlockText(block);
    if (text !== null) {
      lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * Extracts text from an ADF block node.
 */
function extractBlockText(block: {
  type?: string;
  content?: unknown[];
  attrs?: unknown;
}): string | null {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return extractTextFromContent(block.content);
    case 'codeBlock':
      return extractTextFromContent(block.content);
    case 'bulletList':
    case 'orderedList':
      return extractListText(block.content);
    case 'blockquote':
      return extractTextFromContent(block.content);
    case 'rule':
      return '---';
    default:
      return extractTextFromContent(block.content);
  }
}

/**
 * Extracts text from list items.
 */
function extractListText(content: unknown[] | undefined): string {
  if (!Array.isArray(content)) return '';

  return content
    .map((item) => {
      const listItem = item as { type?: string; content?: unknown[] };
      if (listItem.type === 'listItem' && Array.isArray(listItem.content)) {
        return listItem.content
          .map((c) =>
            extractBlockText(c as { type?: string; content?: unknown[] })
          )
          .join('');
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Extracts text from ADF content array.
 */
function extractTextFromContent(content: unknown[] | undefined): string {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      const node = item as {
        type?: string;
        text?: string;
        content?: unknown[];
      };

      if (node.type === 'text' && typeof node.text === 'string') {
        return node.text;
      }

      if (node.type === 'hardBreak') {
        return '\n';
      }

      // Handle nested block nodes (like in blockquote)
      if (node.type === 'paragraph' || node.type === 'heading') {
        return extractTextFromContent(node.content);
      }

      // Recursively extract from nested content
      if (Array.isArray(node.content)) {
        return extractTextFromContent(node.content);
      }

      return '';
    })
    .join('');
}

/**
 * Enhances Jira API error messages with helpful hints.
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
  let message = `Jira API Error (${statusCode} ${statusText})`;

  // Try to parse JSON error
  try {
    const errorJson = JSON.parse(errorText);
    const errorMessages =
      Array.isArray(errorJson.errorMessages) &&
      errorJson.errorMessages.length > 0
        ? errorJson.errorMessages.join(', ')
        : '';
    const fieldErrors =
      errorJson.errors && typeof errorJson.errors === 'object'
        ? Object.entries(errorJson.errors)
            .map(([field, msg]) => `${field}: ${msg}`)
            .join(', ')
        : '';

    if (errorMessages || fieldErrors) {
      message += `: ${[errorMessages, fieldErrors].filter(Boolean).join(' | ')}`;
    } else if (errorJson.message) {
      message += `: ${errorJson.message}`;
    }
  } catch {
    // If not JSON, use raw text
    if (errorText && errorText.length < 500) {
      message += `: ${errorText}`;
    }
  }

  // Add helpful hints based on status code
  switch (statusCode) {
    case 400:
      message +=
        '\nHint: Check your request parameters. Common issues: invalid JQL syntax, missing required fields, or invalid field values.';
      break;
    case 401:
      message +=
        '\nHint: Authentication failed. Check your API token and ensure it has the correct permissions.';
      break;
    case 403:
      message +=
        '\nHint: Permission denied. Ensure your account has access to this project/issue.';
      break;
    case 404:
      message +=
        '\nHint: Resource not found. Verify the issue key, project key, or transition ID exists.';
      break;
    case 429:
      message += '\nHint: Rate limited. Wait a moment before retrying.';
      break;
  }

  return message;
}

/**
 * Validates and normalizes a date string to YYYY-MM-DD format.
 *
 * @param date - Date string to validate
 * @returns Normalized date string or null if invalid
 */
export function normalizeDate(date: string | null | undefined): string | null {
  if (!date) {
    return null;
  }

  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  // Try to parse and format
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().split('T')[0];
}

/**
 * Finds a transition by target status name (case-insensitive).
 *
 * @param transitions - Available transitions
 * @param targetStatus - Target status name
 * @returns Matching transition or undefined
 */
export function findTransitionByStatus(
  transitions: Array<{ id: string; name: string; to?: { name: string } }>,
  targetStatus: string
): { id: string; name: string; to?: { name: string } } | undefined {
  const normalizedTarget = targetStatus.toLowerCase().trim();

  return transitions.find((t) => {
    // Match by transition name
    if (t.name.toLowerCase().trim() === normalizedTarget) {
      return true;
    }
    // Match by target status name
    if (t.to?.name.toLowerCase().trim() === normalizedTarget) {
      return true;
    }
    return false;
  });
}
