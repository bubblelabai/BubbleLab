/**
 * Utility functions for Slack bubble
 * Handles markdown to Slack blocks conversion and mrkdwn formatting
 */

/**
 * Slack block types for rich message formatting
 */
export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

export interface SlackSectionBlock {
  type: 'section';
  text: SlackTextObject;
}

export interface SlackDividerBlock {
  type: 'divider';
}

export interface SlackHeaderBlock {
  type: 'header';
  text: SlackTextObject;
}

export interface SlackContextBlock {
  type: 'context';
  elements: SlackTextObject[];
}

export interface SlackTableCellRawText {
  type: 'raw_text';
  text: string;
}

export interface SlackTableCellRichText {
  type: 'rich_text';
  elements: unknown[];
}

export type SlackTableCell = SlackTableCellRawText | SlackTableCellRichText;

export interface SlackTableColumnSetting {
  align?: 'left' | 'center' | 'right';
  is_wrapped?: boolean;
}

export interface SlackTableBlock {
  type: 'table';
  rows: SlackTableCell[][];
  column_settings?: SlackTableColumnSetting[];
  block_id?: string;
}

export type SlackBlock =
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackHeaderBlock
  | SlackContextBlock
  | SlackTableBlock;

/**
 * Options for markdown to blocks conversion
 */
export interface MarkdownToBlocksOptions {
  /**
   * Whether to convert headers to header blocks (true) or bold section blocks (false)
   * Header blocks have larger text but limited formatting
   * @default false
   */
  useHeaderBlocks?: boolean;

  /**
   * Whether to add dividers after headers
   * @default false
   */
  addDividersAfterHeaders?: boolean;

  /**
   * Whether to preserve line breaks within paragraphs
   * @default true
   */
  preserveLineBreaks?: boolean;
}

/**
 * Converts standard markdown text formatting to Slack mrkdwn format.
 *
 * Conversions:
 * - **bold** or __bold__ → *bold*
 * - *italic* (when not **) or _italic_ (when not __) → _italic_
 * - ~~strikethrough~~ → ~strikethrough~
 * - `code` → `code` (unchanged)
 * - [text](url) → <url|text>
 * - > blockquote → > blockquote (unchanged, Slack supports this)
 *
 * @param markdown - Standard markdown text
 * @returns Slack mrkdwn formatted text
 */
export function markdownToMrkdwn(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  let result = markdown;

  // Convert links: [text](url) → <url|text>
  // Must be done first to preserve link text formatting
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // Convert bullet lists: - item or * item → • item
  // Must be done BEFORE italic/bold to avoid * being treated as formatting
  result = result.replace(/^(\s*)[-]\s+/gm, '$1• ');
  result = result.replace(/^(\s*)\*\s+/gm, '$1• ');

  // Use placeholder tokens to safely convert bold before italic
  // This prevents **text** from being partially matched by *text* pattern
  const BOLD_PLACEHOLDER = '\u0000BOLD\u0000';

  // Convert headers for inline display: # Header → BOLD placeholder
  // Using placeholder so it doesn't get converted by italic regex
  result = result.replace(
    /^#{1,6}\s+(.+)$/gm,
    `${BOLD_PLACEHOLDER}$1${BOLD_PLACEHOLDER}`
  );

  // Convert bold: **text** → placeholder
  result = result.replace(
    /\*\*([^*]+)\*\*/g,
    `${BOLD_PLACEHOLDER}$1${BOLD_PLACEHOLDER}`
  );

  // Convert bold: __text__ → placeholder
  result = result.replace(
    /__([^_]+)__/g,
    `${BOLD_PLACEHOLDER}$1${BOLD_PLACEHOLDER}`
  );

  // Convert italic: *text* (single asterisk) → _text_
  // Now safe because ** and headers have been converted to placeholder
  result = result.replace(/\*([^*]+)\*/g, '_$1_');

  // Convert italic: _text_ (single underscore, not double) → _text_ (unchanged for Slack)
  // Already correct format for Slack mrkdwn

  // Replace bold placeholders with Slack bold syntax
  result = result.replace(new RegExp(BOLD_PLACEHOLDER, 'g'), '*');

  // Convert strikethrough: ~~text~~ → ~text~
  result = result.replace(/~~([^~]+)~~/g, '~$1~');

  return result;
}

/**
 * Parses markdown content and identifies different block types.
 * Returns an array of parsed blocks with their types and content.
 */
interface ParsedBlock {
  type:
    | 'header'
    | 'paragraph'
    | 'code'
    | 'divider'
    | 'quote'
    | 'list'
    | 'table';
  content: string;
  level?: number; // For headers (1-6)
  language?: string; // For code blocks
  tableHeaders?: string[]; // For table blocks
  tableRows?: string[][]; // For table blocks
}

/**
 * Normalizes markdown text by ensuring block-level elements start on new lines.
 * This handles cases where markdown is pasted without proper line breaks.
 */
function normalizeMarkdownNewlines(markdown: string): string {
  let result = markdown;

  // Add newlines before headers (### Header) if not already at line start
  // Lookbehind ensures we don't add newline if already at start or after newline
  result = result.replace(/([^\n])(#{1,6}\s+\S)/g, '$1\n$2');

  // Add newlines before horizontal rules (--- or ***)
  // Exclude table separator rows (preceded by |)
  result = result.replace(
    /([^\n\s|])\s*(---+|___+|\*\*\*+)\s*(?=\S|$)/g,
    '$1\n$2\n'
  );

  // Add newlines before list items (- ** or * **) that appear after sentence endings
  // This catches patterns like "...text. * **Item:**" or "...documentation. - **Item:**"
  result = result.replace(/([.!?:])(\s+)([-*])\s+(\*\*)/g, '$1\n$3 $4');

  // Add newlines before standalone list items (lines starting with - or * followed by space and text)
  // But only after sentence-ending punctuation to avoid false positives
  result = result.replace(/([.!?])(\s+)([-*]\s+)(?!\*)/g, '$1\n$3');

  return result;
}

function parseMarkdownBlocks(markdown: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  // Normalize markdown to ensure block elements are on their own lines
  const normalizedMarkdown = normalizeMarkdownNewlines(markdown);
  const lines = normalizedMarkdown.split('\n');
  let currentBlock: ParsedBlock | null = null;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for code block start/end
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // Start of code block
        if (currentBlock) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        // End of code block
        blocks.push({
          type: 'code',
          content: codeBlockContent.join('\n'),
          language: codeBlockLanguage,
        });
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLanguage = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Check for table row (lines starting with |) — must come before divider detection
    if (line.trimStart().startsWith('|')) {
      if (currentBlock?.type !== 'table') {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'table', content: line };
      } else {
        currentBlock.content += '\n' + line;
      }
      continue;
    }

    // Check for horizontal rule / divider
    if (/^[-*_]{3,}\s*$/.test(line)) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      blocks.push({ type: 'divider', content: '' });
      continue;
    }

    // Check for header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      blocks.push({
        type: 'header',
        content: headerMatch[2],
        level: headerMatch[1].length,
      });
      continue;
    }

    // Check for blockquote
    if (line.startsWith('>')) {
      const quoteContent = line.replace(/^>\s*/, '');
      if (currentBlock?.type === 'quote') {
        currentBlock.content += '\n' + quoteContent;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'quote', content: quoteContent };
      }
      continue;
    }

    // Check for list item
    if (/^[\s]*[-*]\s+/.test(line) || /^[\s]*\d+\.\s+/.test(line)) {
      const listContent = line
        .replace(/^[\s]*[-*]\s+/, '• ')
        .replace(/^[\s]*\d+\.\s+/, (match) => match); // Keep numbered lists as-is
      if (currentBlock?.type === 'list') {
        currentBlock.content += '\n' + listContent;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: 'list', content: listContent };
      }
      continue;
    }

    // Empty line - end current block
    if (line.trim() === '') {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Regular paragraph
    if (currentBlock?.type === 'paragraph') {
      currentBlock.content += '\n' + line;
    } else {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = { type: 'paragraph', content: line };
    }
  }

  // Don't forget the last block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    blocks.push({
      type: 'code',
      content: codeBlockContent.join('\n'),
      language: codeBlockLanguage,
    });
  }

  // Post-process table blocks: parse |..| lines into headers and rows
  for (const block of blocks) {
    if (block.type !== 'table') continue;
    const tableLines = block.content.split('\n');
    const parsedRows: string[][] = [];
    for (const tl of tableLines) {
      const trimmed = tl.trim();
      // Skip separator rows like |---|---|
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;
      // Parse cells
      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
      parsedRows.push(cells);
    }
    if (parsedRows.length > 0) {
      block.tableHeaders = parsedRows[0];
      block.tableRows = parsedRows.slice(1);
    }
  }

  return blocks;
}

/**
 * Converts markdown text to an array of Slack blocks for rich message formatting.
 *
 * This function parses markdown and creates appropriate Slack block types:
 * - Headers → header blocks or bold section blocks
 * - Paragraphs → section blocks with mrkdwn
 * - Code blocks → section blocks with code formatting
 * - Horizontal rules → divider blocks
 * - Block quotes → section blocks with quote formatting
 * - Lists → section blocks with bullet formatting
 *
 * @param markdown - Standard markdown text
 * @param options - Conversion options
 * @returns Array of Slack blocks
 *
 * @example
 * ```typescript
 * const blocks = markdownToBlocks(`
 * # Welcome
 *
 * This is **bold** and _italic_ text.
 *
 * - Item 1
 * - Item 2
 *
 * \`\`\`javascript
 * const x = 1;
 * \`\`\`
 * `);
 *
 * // Returns:
 * // [
 * //   { type: 'section', text: { type: 'mrkdwn', text: '*Welcome*' } },
 * //   { type: 'section', text: { type: 'mrkdwn', text: 'This is *bold* and _italic_ text.' } },
 * //   { type: 'section', text: { type: 'mrkdwn', text: '• Item 1\n• Item 2' } },
 * //   { type: 'section', text: { type: 'mrkdwn', text: '```const x = 1;```' } }
 * // ]
 * ```
 */
export function markdownToBlocks(
  markdown: string,
  options: MarkdownToBlocksOptions = {}
): SlackBlock[] {
  const {
    useHeaderBlocks = false,
    addDividersAfterHeaders = false,
    preserveLineBreaks = true,
  } = options;

  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const parsedBlocks = parseMarkdownBlocks(markdown.trim());
  const slackBlocks: SlackBlock[] = [];
  let tableBlockUsed = false; // Slack allows only one table per message

  for (const block of parsedBlocks) {
    switch (block.type) {
      case 'header':
        {
          if (useHeaderBlocks) {
            // Header blocks only support plain_text and have a 150 char limit
            slackBlocks.push({
              type: 'header',
              text: {
                type: 'plain_text',
                text: block.content.slice(0, 150),
                emoji: true,
              },
            });
          } else {
            // Strip markdown bold markers since the entire header will be wrapped in bold
            // This prevents nested/mismatched asterisks like *1. *TanStack Start**
            let headerContent = block.content
              .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold**
              .replace(/__([^_]+)__/g, '$1'); // Remove __bold__

            // Convert other formatting (links, italics, etc.)
            headerContent = markdownToMrkdwn(headerContent);

            // Use section with bold mrkdwn for more formatting flexibility
            slackBlocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${headerContent}*`,
              },
            });
          }
        }
        if (addDividersAfterHeaders) {
          slackBlocks.push({ type: 'divider' });
        }
        break;

      case 'divider':
        slackBlocks.push({ type: 'divider' });
        break;

      case 'code':
        // Slack code blocks in mrkdwn
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '```' + block.content + '```',
          },
        });
        break;

      case 'quote': {
        // Slack supports > for quotes in mrkdwn
        const quoteLines = block.content.split('\n').map((line) => `> ${line}`);
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: quoteLines.join('\n'),
          },
        });
        break;
      }

      case 'list':
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: markdownToMrkdwn(block.content),
          },
        });
        break;

      case 'table': {
        if (
          !tableBlockUsed &&
          block.tableHeaders &&
          block.tableHeaders.length > 0 &&
          block.tableRows &&
          block.tableRows.length > 0
        ) {
          const result = createTableBlock(block.tableHeaders, block.tableRows);
          slackBlocks.push(result.tableBlock);
          tableBlockUsed = true;
          if (result.wasTruncated) {
            slackBlocks.push({
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn' as const,
                  text: `Showing ${SLACK_TABLE_MAX_ROWS - 1} of ${result.originalRowCount} rows`,
                },
              ],
            });
          }
        } else {
          // Second+ table or failed parse: render as code block
          slackBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '```' + block.content + '```',
            },
          });
        }
        break;
      }

      case 'paragraph':
      default: {
        let content = markdownToMrkdwn(block.content);
        if (!preserveLineBreaks) {
          content = content.replace(/\n/g, ' ');
        }
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: content,
          },
        });
        break;
      }
    }
  }

  // Split any blocks that exceed Slack's text character limit
  return splitLongBlocks(slackBlocks);
}

/**
 * Creates a simple text message with optional markdown formatting.
 * Use this for simple messages that don't need complex block structure.
 *
 * @param text - Text to send (supports markdown)
 * @param useMrkdwn - Whether to convert markdown to Slack mrkdwn format
 * @returns A single section block with the formatted text
 */
export function createTextBlock(
  text: string,
  useMrkdwn: boolean = true
): SlackSectionBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: useMrkdwn ? markdownToMrkdwn(text) : text,
    },
  };
}

/**
 * Creates a divider block for visual separation
 */
export function createDividerBlock(): SlackDividerBlock {
  return { type: 'divider' };
}

/**
 * Creates a header block with plain text
 * Note: Header blocks have a 150 character limit
 *
 * @param text - Header text (will be truncated to 150 chars)
 */
export function createHeaderBlock(text: string): SlackHeaderBlock {
  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: text.slice(0, 150),
      emoji: true,
    },
  };
}

/**
 * Creates a context block for secondary information
 * Context blocks display smaller text, useful for timestamps, metadata, etc.
 *
 * @param texts - Array of text strings to display
 */
export function createContextBlock(texts: string[]): SlackContextBlock {
  return {
    type: 'context',
    elements: texts.map((text) => ({
      type: 'mrkdwn' as const,
      text: markdownToMrkdwn(text),
    })),
  };
}

/**
 * Slack table block constraints
 */
export const SLACK_TABLE_MAX_ROWS = 100;
export const SLACK_TABLE_MAX_COLUMNS = 20;

export interface CreateTableBlockResult {
  tableBlock: SlackTableBlock;
  overflowCsv?: string;
  wasTruncated: boolean;
  originalRowCount: number;
}

function escapeCsvValue(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function generateCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvValue).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(','));
  }
  return lines.join('\n');
}

/**
 * Creates a Slack table block from headers and rows.
 * Truncates to fit Slack's limits (100 rows including header, 20 columns).
 * If rows exceed the limit, generates a CSV containing all data.
 *
 * @param headers - Column header strings
 * @param rows - 2D array of cell values
 * @param columnSettings - Optional column alignment/wrapping settings
 * @returns Table block, optional CSV overflow, and truncation info
 */
export function createTableBlock(
  headers: string[],
  rows: string[][],
  columnSettings?: SlackTableColumnSetting[]
): CreateTableBlockResult {
  const originalRowCount = rows.length;
  const maxDataRows = SLACK_TABLE_MAX_ROWS - 1; // 1 row reserved for header

  // Truncate columns if needed
  const colCount = Math.min(headers.length, SLACK_TABLE_MAX_COLUMNS);
  const truncatedHeaders = headers.slice(0, colCount);

  // Truncate rows if needed
  const wasTruncated = originalRowCount > maxDataRows;
  const truncatedRows = rows.slice(0, maxDataRows);

  // Build header row cells
  const headerRowCells: SlackTableCellRawText[] = truncatedHeaders.map((h) => ({
    type: 'raw_text' as const,
    text: String(h),
  }));

  // Build data row cells, padding short rows with empty cells
  const dataRowCells: SlackTableCellRawText[][] = truncatedRows.map((row) => {
    const cells: SlackTableCellRawText[] = [];
    for (let i = 0; i < colCount; i++) {
      cells.push({
        type: 'raw_text' as const,
        text: i < row.length ? String(row[i]) : '',
      });
    }
    return cells;
  });

  // Build column settings
  let settings: SlackTableColumnSetting[] | undefined;
  if (columnSettings) {
    settings = columnSettings.slice(0, colCount);
    // Pad with defaults if fewer settings than columns
    while (settings.length < colCount) {
      settings.push({});
    }
  }

  const tableBlock: SlackTableBlock = {
    type: 'table',
    rows: [headerRowCells, ...dataRowCells],
    ...(settings ? { column_settings: settings } : {}),
  };

  // Generate CSV for overflow
  let overflowCsv: string | undefined;
  if (wasTruncated) {
    overflowCsv = generateCsv(headers, rows);
  }

  return {
    tableBlock,
    overflowCsv,
    wasTruncated,
    originalRowCount,
  };
}

/**
 * Slack's maximum character limit for text in a single block
 */
const SLACK_MAX_BLOCK_TEXT_LENGTH = 3000;

/**
 * Splits long text into chunks that fit within Slack's block text limit.
 * Attempts to split at paragraph boundaries first, then at sentence boundaries,
 * and finally at word boundaries if necessary.
 *
 * @param text - Text to split
 * @param maxLength - Maximum length per chunk (default: 3000)
 * @returns Array of text chunks, each within the limit
 */
export function splitLongText(
  text: string,
  maxLength: number = SLACK_MAX_BLOCK_TEXT_LENGTH
): string[] {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find the best split point within maxLength
    let splitPoint = maxLength;

    // Try to split at a double newline (paragraph boundary)
    const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.5) {
      splitPoint = paragraphBreak;
    } else {
      // Try to split at a single newline
      const lineBreak = remaining.lastIndexOf('\n', maxLength);
      if (lineBreak > maxLength * 0.5) {
        splitPoint = lineBreak;
      } else {
        // Try to split at a sentence boundary (. ! ?)
        const sentenceEnd = Math.max(
          remaining.lastIndexOf('. ', maxLength),
          remaining.lastIndexOf('! ', maxLength),
          remaining.lastIndexOf('? ', maxLength)
        );
        if (sentenceEnd > maxLength * 0.5) {
          splitPoint = sentenceEnd + 1; // Include the punctuation
        } else {
          // Fall back to splitting at a word boundary
          const wordBreak = remaining.lastIndexOf(' ', maxLength);
          if (wordBreak > maxLength * 0.3) {
            splitPoint = wordBreak;
          }
          // If no good break point, just split at maxLength
        }
      }
    }

    chunks.push(remaining.slice(0, splitPoint).trim());
    remaining = remaining.slice(splitPoint).trim();
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Splits a SlackBlock into multiple blocks if its text exceeds the character limit.
 * Only splits section blocks; other block types are returned as-is.
 *
 * @param block - The block to potentially split
 * @returns Array of blocks (1 if no split needed, multiple if text was too long)
 */
function splitLongBlock(block: SlackBlock): SlackBlock[] {
  // Only split section blocks with text
  if (block.type !== 'section' || !block.text) {
    return [block];
  }

  const textContent = block.text.text;
  if (textContent.length <= SLACK_MAX_BLOCK_TEXT_LENGTH) {
    return [block];
  }

  // Split the text and create multiple section blocks
  const textChunks = splitLongText(textContent, SLACK_MAX_BLOCK_TEXT_LENGTH);

  return textChunks.map((chunk) => ({
    type: 'section' as const,
    text: {
      type: block.text.type,
      text: chunk,
    },
  }));
}

/**
 * Processes an array of Slack blocks, splitting any that exceed the text limit.
 *
 * @param blocks - Array of Slack blocks
 * @returns Array of blocks with long texts split into multiple blocks
 */
export function splitLongBlocks(blocks: SlackBlock[]): SlackBlock[] {
  return blocks.flatMap(splitLongBlock);
}

/**
 * Detects if a string contains markdown formatting.
 * Checks for common markdown patterns like headers, bold, italic, code blocks, lists, etc.
 *
 * @param text - Text to check for markdown
 * @returns True if markdown patterns are detected
 */
export function containsMarkdown(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for headers (# Header)
  if (/^#{1,6}\s+.+$/m.test(text)) {
    return true;
  }

  // Check for bold (**text** or __text__)
  if (/\*\*[^*]+\*\*/.test(text) || /__[^_]+__/.test(text)) {
    return true;
  }

  // Check for italic (*text* or _text_ - but not ** or __)
  if (/(?<!\*)\*[^*]+\*(?!\*)/.test(text) || /(?<!_)_[^_]+_(?!_)/.test(text)) {
    return true;
  }

  // Check for code blocks (```code```)
  if (/```[\s\S]*?```/.test(text)) {
    return true;
  }

  // Check for inline code (`code`)
  if (/`[^`]+`/.test(text)) {
    return true;
  }

  // Check for lists (- item or * item or 1. item)
  if (/^[\s]*[-*]\s+/m.test(text) || /^[\s]*\d+\.\s+/m.test(text)) {
    return true;
  }

  // Check for links [text](url)
  if (/\[([^\]]+)\]\(([^)]+)\)/.test(text)) {
    return true;
  }

  // Check for blockquotes (> text)
  if (/^>\s+/m.test(text)) {
    return true;
  }

  // Check for horizontal rules (--- or ***)
  if (/^[-*_]{3,}\s*$/m.test(text)) {
    return true;
  }

  // Check for strikethrough (~~text~~)
  if (/~~[^~]+~~/.test(text)) {
    return true;
  }

  return false;
}
