import { describe, it, expect } from 'vitest';
import {
  markdownToMrkdwn,
  markdownToBlocks,
  createTextBlock,
  createDividerBlock,
  createHeaderBlock,
  createContextBlock,
  type SlackSectionBlock,
  type SlackDividerBlock,
  type SlackHeaderBlock,
} from './slack.utils.js';

describe('markdownToMrkdwn', () => {
  describe('basic text handling', () => {
    it('should return empty string for null/undefined input', () => {
      expect(markdownToMrkdwn(null as unknown as string)).toBe('');
      expect(markdownToMrkdwn(undefined as unknown as string)).toBe('');
      expect(markdownToMrkdwn('')).toBe('');
    });

    it('should return plain text unchanged', () => {
      expect(markdownToMrkdwn('Hello world')).toBe('Hello world');
    });
  });

  describe('bold formatting', () => {
    it('should convert **bold** to *bold*', () => {
      expect(markdownToMrkdwn('This is **bold** text')).toBe(
        'This is *bold* text'
      );
    });

    it('should convert __bold__ to *bold*', () => {
      expect(markdownToMrkdwn('This is __bold__ text')).toBe(
        'This is *bold* text'
      );
    });

    it('should handle multiple bold segments', () => {
      expect(markdownToMrkdwn('**one** and **two**')).toBe('*one* and *two*');
    });
  });

  describe('italic formatting', () => {
    it('should convert single *italic* to _italic_', () => {
      expect(markdownToMrkdwn('This is *italic* text')).toBe(
        'This is _italic_ text'
      );
    });

    it('should preserve _italic_ (already Slack format)', () => {
      expect(markdownToMrkdwn('This is _italic_ text')).toBe(
        'This is _italic_ text'
      );
    });
  });

  describe('strikethrough formatting', () => {
    it('should convert ~~strikethrough~~ to ~strikethrough~', () => {
      expect(markdownToMrkdwn('This is ~~deleted~~ text')).toBe(
        'This is ~deleted~ text'
      );
    });
  });

  describe('links', () => {
    it('should convert [text](url) to <url|text>', () => {
      expect(markdownToMrkdwn('[Click here](https://example.com)')).toBe(
        '<https://example.com|Click here>'
      );
    });

    it('should handle multiple links', () => {
      expect(
        markdownToMrkdwn('[One](https://one.com) and [Two](https://two.com)')
      ).toBe('<https://one.com|One> and <https://two.com|Two>');
    });
  });

  describe('lists', () => {
    it('should convert - item to bullet point', () => {
      expect(markdownToMrkdwn('- Item one\n- Item two')).toBe(
        '• Item one\n• Item two'
      );
    });

    it('should convert * item to bullet point', () => {
      expect(markdownToMrkdwn('* Item one\n* Item two')).toBe(
        '• Item one\n• Item two'
      );
    });
  });

  describe('headers', () => {
    it('should convert # header to bold', () => {
      expect(markdownToMrkdwn('# Main Title')).toBe('*Main Title*');
    });

    it('should convert ## header to bold', () => {
      expect(markdownToMrkdwn('## Subtitle')).toBe('*Subtitle*');
    });

    it('should convert all header levels to bold', () => {
      expect(markdownToMrkdwn('### Level 3')).toBe('*Level 3*');
      expect(markdownToMrkdwn('#### Level 4')).toBe('*Level 4*');
    });
  });

  describe('code', () => {
    it('should preserve inline code', () => {
      expect(markdownToMrkdwn('Use `const` keyword')).toBe(
        'Use `const` keyword'
      );
    });
  });

  describe('complex formatting', () => {
    it('should handle mixed formatting', () => {
      expect(markdownToMrkdwn('**Bold** and *italic* and ~~strike~~')).toBe(
        '*Bold* and _italic_ and ~strike~'
      );
    });

    it('should handle formatting with links', () => {
      expect(
        markdownToMrkdwn('Check out **[this link](https://example.com)**')
      ).toBe('Check out *<https://example.com|this link>*');
    });
  });
});

describe('markdownToBlocks', () => {
  describe('basic handling', () => {
    it('should return empty array for null/undefined input', () => {
      expect(markdownToBlocks(null as unknown as string)).toEqual([]);
      expect(markdownToBlocks(undefined as unknown as string)).toEqual([]);
      expect(markdownToBlocks('')).toEqual([]);
    });
  });

  describe('paragraphs', () => {
    it('should convert single paragraph to section block', () => {
      const blocks = markdownToBlocks('Hello world');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('section');
      expect((blocks[0] as SlackSectionBlock).text.type).toBe('mrkdwn');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe('Hello world');
    });

    it('should convert multiple paragraphs to separate section blocks', () => {
      const blocks = markdownToBlocks('First paragraph\n\nSecond paragraph');
      expect(blocks).toHaveLength(2);
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        'First paragraph'
      );
      expect((blocks[1] as SlackSectionBlock).text.text).toBe(
        'Second paragraph'
      );
    });
  });

  describe('headers', () => {
    it('should convert headers to bold section blocks by default', () => {
      const blocks = markdownToBlocks('# Main Title');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('section');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe('*Main Title*');
    });

    it('should convert headers to header blocks when option is set', () => {
      const blocks = markdownToBlocks('# Main Title', {
        useHeaderBlocks: true,
      });
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('header');
      expect((blocks[0] as SlackHeaderBlock).text.text).toBe('Main Title');
    });

    it('should add dividers after headers when option is set', () => {
      const blocks = markdownToBlocks('# Title\n\nContent', {
        addDividersAfterHeaders: true,
      });
      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('section');
      expect(blocks[1].type).toBe('divider');
      expect(blocks[2].type).toBe('section');
    });

    it('should truncate header blocks to 150 characters', () => {
      const longTitle = 'A'.repeat(200);
      const blocks = markdownToBlocks(`# ${longTitle}`, {
        useHeaderBlocks: true,
      });
      expect((blocks[0] as SlackHeaderBlock).text.text).toHaveLength(150);
    });
  });

  describe('horizontal rules', () => {
    it('should convert --- to divider block', () => {
      const blocks = markdownToBlocks('Before\n\n---\n\nAfter');
      expect(blocks).toHaveLength(3);
      expect(blocks[1].type).toBe('divider');
    });

    it('should convert *** to divider block', () => {
      const blocks = markdownToBlocks('Before\n\n***\n\nAfter');
      expect(blocks).toHaveLength(3);
      expect(blocks[1].type).toBe('divider');
    });

    it('should convert ___ to divider block', () => {
      const blocks = markdownToBlocks('Before\n\n___\n\nAfter');
      expect(blocks).toHaveLength(3);
      expect(blocks[1].type).toBe('divider');
    });
  });

  describe('code blocks', () => {
    it('should convert code blocks to section with code formatting', () => {
      const blocks = markdownToBlocks('```\nconst x = 1;\n```');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('section');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        '```const x = 1;```'
      );
    });

    it('should handle code blocks with language specifier', () => {
      const blocks = markdownToBlocks('```javascript\nconst x = 1;\n```');
      expect(blocks).toHaveLength(1);
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        '```const x = 1;```'
      );
    });

    it('should handle multi-line code blocks', () => {
      const blocks = markdownToBlocks('```\nline1\nline2\nline3\n```');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        '```line1\nline2\nline3```'
      );
    });
  });

  describe('blockquotes', () => {
    it('should convert blockquotes to section with quote formatting', () => {
      const blocks = markdownToBlocks('> This is a quote');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('section');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        '> This is a quote'
      );
    });

    it('should handle multi-line blockquotes', () => {
      const blocks = markdownToBlocks('> Line 1\n> Line 2');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        '> Line 1\n> Line 2'
      );
    });
  });

  describe('lists', () => {
    it('should convert bullet lists to section blocks', () => {
      const blocks = markdownToBlocks('- Item 1\n- Item 2\n- Item 3');
      expect(blocks).toHaveLength(1);
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        '• Item 1\n• Item 2\n• Item 3'
      );
    });

    it('should handle asterisk lists', () => {
      const blocks = markdownToBlocks('* Item 1\n* Item 2');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        '• Item 1\n• Item 2'
      );
    });
  });

  describe('complex documents', () => {
    it('should handle full markdown document', () => {
      const markdown = `# Welcome

This is a **bold** statement and some *italic* text.

## Features

- Feature one
- Feature two
- Feature three

---

> A wise quote here

\`\`\`javascript
function hello() {
  return 'world';
}
\`\`\`

Visit [our site](https://example.com) for more info.`;

      const blocks = markdownToBlocks(markdown);

      // Verify structure
      expect(blocks.length).toBeGreaterThan(5);

      // First block should be header (as bold section)
      expect(blocks[0].type).toBe('section');
      expect((blocks[0] as SlackSectionBlock).text.text).toBe('*Welcome*');

      // Find the divider
      const dividerIndex = blocks.findIndex(
        (b): b is SlackDividerBlock => b.type === 'divider'
      );
      expect(dividerIndex).toBeGreaterThan(-1);

      // Find the code block
      const codeBlock = blocks.find(
        (b): b is SlackSectionBlock =>
          b.type === 'section' && b.text.text.includes('```')
      );
      expect(codeBlock).toBeDefined();
    });
  });

  describe('formatting conversion', () => {
    it('should apply mrkdwn conversion in paragraphs', () => {
      const blocks = markdownToBlocks(
        'This has **bold** and [link](https://test.com)'
      );
      expect((blocks[0] as SlackSectionBlock).text.text).toBe(
        'This has *bold* and <https://test.com|link>'
      );
    });
  });
});

describe('helper functions', () => {
  describe('createTextBlock', () => {
    it('should create a section block with mrkdwn text', () => {
      const block = createTextBlock('Hello **world**');
      expect(block.type).toBe('section');
      expect(block.text.type).toBe('mrkdwn');
      expect(block.text.text).toBe('Hello *world*');
    });

    it('should skip mrkdwn conversion when disabled', () => {
      const block = createTextBlock('Hello **world**', false);
      expect(block.text.text).toBe('Hello **world**');
    });
  });

  describe('createDividerBlock', () => {
    it('should create a divider block', () => {
      const block = createDividerBlock();
      expect(block.type).toBe('divider');
    });
  });

  describe('createHeaderBlock', () => {
    it('should create a header block with plain text', () => {
      const block = createHeaderBlock('My Header');
      expect(block.type).toBe('header');
      expect(block.text.type).toBe('plain_text');
      expect(block.text.text).toBe('My Header');
      expect(block.text.emoji).toBe(true);
    });

    it('should truncate long headers to 150 characters', () => {
      const longText = 'A'.repeat(200);
      const block = createHeaderBlock(longText);
      expect(block.text.text).toHaveLength(150);
    });
  });

  describe('createContextBlock', () => {
    it('should create a context block with multiple text elements', () => {
      const block = createContextBlock(['First', 'Second', 'Third']);
      expect(block.type).toBe('context');
      expect(block.elements).toHaveLength(3);
      expect(block.elements[0].type).toBe('mrkdwn');
      expect(block.elements[0].text).toBe('First');
    });

    it('should apply mrkdwn conversion to context text', () => {
      const block = createContextBlock(['**Bold** text']);
      expect(block.elements[0].text).toBe('*Bold* text');
    });
  });
});
