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
  type SlackBlock,
  type SlackTextObject,
  type SlackSectionBlock,
  type SlackDividerBlock,
  type SlackHeaderBlock,
  type SlackContextBlock,
  type MarkdownToBlocksOptions,
} from './slack.utils.js';
