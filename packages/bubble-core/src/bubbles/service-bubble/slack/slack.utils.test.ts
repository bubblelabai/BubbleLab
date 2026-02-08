import { describe, it, expect } from 'vitest';
import {
  markdownToMrkdwn,
  markdownToBlocks,
  createTextBlock,
  createDividerBlock,
  createHeaderBlock,
  createContextBlock,
  createTableBlock,
  SLACK_TABLE_MAX_ROWS,
  SLACK_TABLE_MAX_COLUMNS,
  type SlackSectionBlock,
  type SlackDividerBlock,
  type SlackHeaderBlock,
  type SlackTableBlock,
  type SlackContextBlock,
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

  describe('createTableBlock', () => {
    it('should create a basic table block with correct structure', () => {
      const result = createTableBlock(
        ['Name', 'Age'],
        [
          ['Alice', '30'],
          ['Bob', '25'],
        ]
      );
      expect(result.tableBlock.type).toBe('table');
      expect(result.tableBlock.rows).toHaveLength(3); // 1 header + 2 data
      expect(result.wasTruncated).toBe(false);
      expect(result.originalRowCount).toBe(2);
      expect(result.overflowCsv).toBeUndefined();
    });

    it('should use raw_text cells for header row', () => {
      const result = createTableBlock(['Col1', 'Col2'], [['a', 'b']]);
      const headerRow = result.tableBlock.rows[0];
      expect(headerRow[0]).toEqual({ type: 'raw_text', text: 'Col1' });
      expect(headerRow[1]).toEqual({ type: 'raw_text', text: 'Col2' });
    });

    it('should apply and truncate column settings', () => {
      const result = createTableBlock(
        ['A', 'B'],
        [['1', '2']],
        [
          { align: 'left', is_wrapped: true },
          { align: 'right' },
          { align: 'center' }, // extra setting — should be truncated
        ]
      );
      expect(result.tableBlock.column_settings).toHaveLength(2);
      expect(result.tableBlock.column_settings![0]).toEqual({
        align: 'left',
        is_wrapped: true,
      });
    });

    it('should pad short rows with empty cells', () => {
      const result = createTableBlock(
        ['A', 'B', 'C'],
        [['1']] // only one cell instead of 3
      );
      const dataRow = result.tableBlock.rows[1];
      expect(dataRow).toHaveLength(3);
      expect(dataRow[2]).toEqual({ type: 'raw_text', text: '' });
    });

    it('should truncate columns beyond 20', () => {
      const headers = Array.from({ length: 25 }, (_, i) => `Col${i}`);
      const rows = [Array.from({ length: 25 }, (_, i) => `val${i}`)];
      const result = createTableBlock(headers, rows);
      expect(result.tableBlock.rows[0]).toHaveLength(SLACK_TABLE_MAX_COLUMNS);
      expect(result.tableBlock.rows[1]).toHaveLength(SLACK_TABLE_MAX_COLUMNS);
    });

    it('should truncate rows beyond 99 data rows and generate CSV', () => {
      const headers = ['ID', 'Value'];
      const rows = Array.from({ length: 150 }, (_, i) => [
        String(i),
        `val${i}`,
      ]);
      const result = createTableBlock(headers, rows);
      expect(result.tableBlock.rows).toHaveLength(SLACK_TABLE_MAX_ROWS); // 1 header + 99 data
      expect(result.wasTruncated).toBe(true);
      expect(result.originalRowCount).toBe(150);
      expect(result.overflowCsv).toBeDefined();
    });

    it('should generate CSV with proper escaping', () => {
      const result = createTableBlock(
        ['Name', 'Description'],
        [
          ['Alice', 'Has a "quote"'],
          ['Bob', 'Has a, comma'],
          ['Charlie', 'Has a\nnewline'],
        ]
        // Force overflow by not actually overflowing — test CSV content via manual overflow
      );
      // No overflow for 3 rows, so test the CSV helpers indirectly
      // by creating an overflow scenario
      const bigRows = Array.from({ length: 100 }, (_, i) => [
        `Name${i}`,
        i === 0 ? 'Has "quotes", commas' : `Desc${i}`,
      ]);
      const overflowResult = createTableBlock(['Name', 'Description'], bigRows);
      expect(overflowResult.overflowCsv).toBeDefined();
      expect(overflowResult.overflowCsv).toContain('Name,Description');
      expect(overflowResult.overflowCsv).toContain('"Has ""quotes"", commas"');
    });

    it('should not generate CSV when rows are within limit', () => {
      const rows = Array.from({ length: 99 }, (_, i) => [String(i)]);
      const result = createTableBlock(['ID'], rows);
      expect(result.wasTruncated).toBe(false);
      expect(result.overflowCsv).toBeUndefined();
    });

    it('should handle empty rows array', () => {
      const result = createTableBlock(['A', 'B'], []);
      expect(result.tableBlock.rows).toHaveLength(1); // header only
      expect(result.wasTruncated).toBe(false);
      expect(result.originalRowCount).toBe(0);
    });

    it('should handle single column', () => {
      const result = createTableBlock(['Only'], [['one'], ['two']]);
      expect(result.tableBlock.rows[0]).toHaveLength(1);
      expect(result.tableBlock.rows[1]).toHaveLength(1);
    });

    it('should handle exactly 99 data rows without truncation', () => {
      const rows = Array.from({ length: 99 }, (_, i) => [String(i)]);
      const result = createTableBlock(['ID'], rows);
      expect(result.tableBlock.rows).toHaveLength(100); // 1 header + 99
      expect(result.wasTruncated).toBe(false);
    });

    it('should handle exactly 100 data rows with truncation', () => {
      const rows = Array.from({ length: 100 }, (_, i) => [String(i)]);
      const result = createTableBlock(['ID'], rows);
      expect(result.tableBlock.rows).toHaveLength(100); // 1 header + 99
      expect(result.wasTruncated).toBe(true);
      expect(result.originalRowCount).toBe(100);
    });

    it('should pad column settings if fewer than column count', () => {
      const result = createTableBlock(
        ['A', 'B', 'C'],
        [['1', '2', '3']],
        [{ align: 'left' }]
      );
      expect(result.tableBlock.column_settings).toHaveLength(3);
      expect(result.tableBlock.column_settings![0]).toEqual({ align: 'left' });
      expect(result.tableBlock.column_settings![1]).toEqual({});
    });
  });
});

describe('markdownToBlocks with tables', () => {
  it('should convert a simple markdown table to a table block', () => {
    const md = `| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`;
    const blocks = markdownToBlocks(md);
    const tableBlock = blocks.find(
      (b) => b.type === 'table'
    ) as SlackTableBlock;
    expect(tableBlock).toBeDefined();
    expect(tableBlock.rows).toHaveLength(3); // 1 header + 2 data
    expect(tableBlock.rows[0][0]).toEqual({ type: 'raw_text', text: 'Name' });
    expect(tableBlock.rows[0][1]).toEqual({ type: 'raw_text', text: 'Age' });
    expect(tableBlock.rows[1][0]).toEqual({ type: 'raw_text', text: 'Alice' });
  });

  it('should parse table with separator line correctly', () => {
    const md = `| Col1 | Col2 |
|:---|---:|
| a | b |`;
    const blocks = markdownToBlocks(md);
    const tableBlock = blocks.find(
      (b) => b.type === 'table'
    ) as SlackTableBlock;
    expect(tableBlock).toBeDefined();
    // Separator should be skipped
    expect(tableBlock.rows).toHaveLength(2); // 1 header + 1 data
  });

  it('should handle table mixed with other content', () => {
    const md = `# Report

Some text here.

| Name | Value |
| --- | --- |
| X | 1 |

More text.`;
    const blocks = markdownToBlocks(md);
    expect(blocks.some((b) => b.type === 'section')).toBe(true);
    expect(blocks.some((b) => b.type === 'table')).toBe(true);
  });

  it('should render second table as code block', () => {
    const md = `| A | B |
| --- | --- |
| 1 | 2 |

| C | D |
| --- | --- |
| 3 | 4 |`;
    const blocks = markdownToBlocks(md);
    const tableBlocks = blocks.filter((b) => b.type === 'table');
    expect(tableBlocks).toHaveLength(1); // Only first table
    // Second table should be a code block (section with ```)
    const codeBlocks = blocks.filter(
      (b): b is SlackSectionBlock =>
        b.type === 'section' && b.text.text.startsWith('```')
    );
    expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it('should truncate table with >20 columns', () => {
    const headers = Array.from({ length: 25 }, (_, i) => `C${i}`);
    const headerLine = '| ' + headers.join(' | ') + ' |';
    const sepLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
    const dataLine = '| ' + headers.map((_, i) => `v${i}`).join(' | ') + ' |';
    const md = `${headerLine}\n${sepLine}\n${dataLine}`;
    const blocks = markdownToBlocks(md);
    const tableBlock = blocks.find(
      (b) => b.type === 'table'
    ) as SlackTableBlock;
    expect(tableBlock).toBeDefined();
    expect(tableBlock.rows[0]).toHaveLength(SLACK_TABLE_MAX_COLUMNS);
  });

  it('should convert real-world AI response with table to valid blocks', () => {
    const md = `Sure thing, Diana! Here are the top 5 users based on their monthly usage activity and total workflows created:

| Name | Email | Monthly Usage | Workflows |
| :--- | :--- | :--- | :--- |
| Alice Park | alice.park@gmail.com | 1,655 | 16 |
| Bob Chen | bob.chen@acmerobotics.ai | 769 | 6 |
| Charlie Kim | charlie.kim@example.com | 719 | 67 |
| Diana Lee | diana.lee@example.com | 445 | 720 |
| Eve Martinez | eve.martinez@hotmail.com | 288 | 6 |

It looks like you've been busy with those 720 workflows!

**Fun Fact:** The world's oldest known recipe is for beer, dating back to 1800 BC in ancient Mesopotamia.`;

    const blocks = markdownToBlocks(md);

    // Should have: intro section, table, outro section, fun fact section
    expect(blocks.length).toBeGreaterThanOrEqual(3);

    // First block should be the intro text
    expect(blocks[0].type).toBe('section');
    expect((blocks[0] as SlackSectionBlock).text.text).toContain('Diana');

    // Should have a table block
    const tableBlock = blocks.find(
      (b) => b.type === 'table'
    ) as SlackTableBlock;
    expect(tableBlock).toBeDefined();

    // Table should have 1 header + 5 data rows = 6 rows
    expect(tableBlock.rows).toHaveLength(6);

    // Header row
    expect(tableBlock.rows[0]).toHaveLength(4);
    expect(tableBlock.rows[0][0]).toEqual({ type: 'raw_text', text: 'Name' });
    expect(tableBlock.rows[0][1]).toEqual({ type: 'raw_text', text: 'Email' });
    expect(tableBlock.rows[0][2]).toEqual({
      type: 'raw_text',
      text: 'Monthly Usage',
    });
    expect(tableBlock.rows[0][3]).toEqual({
      type: 'raw_text',
      text: 'Workflows',
    });

    // First data row
    expect(tableBlock.rows[1][0]).toEqual({
      type: 'raw_text',
      text: 'Alice Park',
    });
    expect(tableBlock.rows[1][1]).toEqual({
      type: 'raw_text',
      text: 'alice.park@gmail.com',
    });
    expect(tableBlock.rows[1][2]).toEqual({
      type: 'raw_text',
      text: '1,655',
    });
    expect(tableBlock.rows[1][3]).toEqual({ type: 'raw_text', text: '16' });

    // All cells should have non-empty text
    for (const row of tableBlock.rows) {
      for (const cell of row) {
        expect(
          (cell as { type: string; text: string }).text.length
        ).toBeGreaterThan(0);
      }
    }

    // Should have outro text
    const outroBlock = blocks.find(
      (b): b is SlackSectionBlock =>
        b.type === 'section' && b.text.text.includes('720 workflows')
    );
    expect(outroBlock).toBeDefined();
  });

  it('should convert AI response with table and numbered list to valid blocks', () => {
    const md = `Sure thing, dad! Here is a table of the 5 most recent users from our database:

| First Name | Last Name | Email | Created At | Monthly Usage |
| :--- | :--- | :--- | :--- | :--- |
| Frank | Miller | frank.miller@gmail.com | 2026-02-07 | 0 |
| Grace | Patel | grace.patel@gmail.com | 2026-02-07 | 1 |
| Henry | Wilson | henry.wilson@gmail.com | 2026-02-07 | 0 |
| Iris | Chang | iris.chang@gmail.com | 2026-02-07 | 4 |
| Jack | Thompson | jack.thompson@gmail.com | 2026-02-07 | 2 |

**Tool Usage & Reasoning:**

1. **\`schema-query-tool (list_tables)\`**: I first checked the available tables to locate the user data.
2. **\`schema-query-tool (describe_table)\`**: I inspected the \`users\` table schema to ensure I had the correct column names for the table.
3. **\`sql-query-tool\`**: I executed a query to fetch the five most recently created accounts, ordered by \`created_at\` descending, to provide you with the latest activity.

**Fun Fact:** A group of flamingos is called a "flamboyance".`;

    const blocks = markdownToBlocks(md);

    // Should have a table block
    const tableBlock = blocks.find(
      (b) => b.type === 'table'
    ) as SlackTableBlock;
    expect(tableBlock).toBeDefined();

    // Table should have 1 header + 5 data rows = 6 rows
    expect(tableBlock.rows).toHaveLength(6);

    // 5 columns
    expect(tableBlock.rows[0]).toHaveLength(5);
    expect(tableBlock.rows[0][0]).toEqual({
      type: 'raw_text',
      text: 'First Name',
    });
    expect(tableBlock.rows[0][4]).toEqual({
      type: 'raw_text',
      text: 'Monthly Usage',
    });

    // First data row
    expect(tableBlock.rows[1][0]).toEqual({ type: 'raw_text', text: 'Frank' });
    expect(tableBlock.rows[1][2]).toEqual({
      type: 'raw_text',
      text: 'frank.miller@gmail.com',
    });

    // All cells should have non-empty text
    for (const row of tableBlock.rows) {
      for (const cell of row) {
        expect(
          (cell as { type: string; text: string }).text.length
        ).toBeGreaterThan(0);
      }
    }

    // Should have the numbered list content
    const listOrSectionBlocks = blocks.filter(
      (b): b is SlackSectionBlock =>
        b.type === 'section' && b.text.text.includes('schema-query-tool')
    );
    expect(listOrSectionBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it('should add context block when table is truncated', () => {
    const headers = ['ID', 'Val'];
    const headerLine = '| ' + headers.join(' | ') + ' |';
    const sepLine = '| --- | --- |';
    const dataLines = Array.from({ length: 110 }, (_, i) => `| ${i} | v${i} |`);
    const md = [headerLine, sepLine, ...dataLines].join('\n');
    const blocks = markdownToBlocks(md);
    const contextBlock = blocks.find(
      (b) => b.type === 'context'
    ) as SlackContextBlock;
    expect(contextBlock).toBeDefined();
    expect(contextBlock.elements[0].text).toContain('99');
    expect(contextBlock.elements[0].text).toContain('110');
  });
});
