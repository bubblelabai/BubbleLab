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

export type SlackBlock =
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackHeaderBlock
  | SlackContextBlock;

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
  type: 'header' | 'paragraph' | 'code' | 'divider' | 'quote' | 'list';
  content: string;
  level?: number; // For headers (1-6)
  language?: string; // For code blocks
}

function parseMarkdownBlocks(markdown: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = markdown.split('\n');
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

  for (const block of parsedBlocks) {
    switch (block.type) {
      case 'header':
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
          // Use section with bold mrkdwn for more formatting flexibility
          slackBlocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${markdownToMrkdwn(block.content)}*`,
            },
          });
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

      case 'quote':
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

      case 'list':
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: markdownToMrkdwn(block.content),
          },
        });
        break;

      case 'paragraph':
      default:
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

  return slackBlocks;
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
