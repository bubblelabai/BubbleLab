// Main bubble export (must come FIRST - bundler processes in order, and slack.ts
// imports from schema, so schema gets properly inlined with correct declaration order)
export { SlackBubble } from './slack';

// Utility exports
export {
  markdownToMrkdwn,
  markdownToBlocks,
  createTextBlock,
  createDividerBlock,
  createHeaderBlock,
  createContextBlock,
  createTableBlock,
  SLACK_TABLE_MAX_ROWS,
  SLACK_TABLE_MAX_COLUMNS,
  type SlackBlock,
  type SlackTextObject,
  type SlackSectionBlock,
  type SlackDividerBlock,
  type SlackHeaderBlock,
  type SlackContextBlock,
  type SlackTableBlock,
  type SlackImageBlock,
  type SlackTableCell,
  type SlackTableCellRawText,
  type SlackTableCellRichText,
  type SlackTableColumnSetting,
  type CreateTableBlockResult,
  type MarkdownToBlocksOptions,
} from './slack.utils.js';
