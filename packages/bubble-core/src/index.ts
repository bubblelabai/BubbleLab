// Export all types
export * from './types/bubble.js';
export * from './bubble-trigger/types.js';
export * from './types/credentials.js';
export * from './types/available-tools.js';

// Export error classes
export {
  BubbleError,
  BubbleValidationError,
  BubbleExecutionError,
} from './types/bubble-errors.js';

// Export base classes
export { BaseBubble } from './types/base-bubble-class.js';
export { ServiceBubble } from './types/service-bubble-class.js';
export { WorkflowBubble } from './types/workflow-bubble-class.js';
export { ToolBubble } from './types/tool-bubble-class.js';
export { BubbleFlow } from './bubble-flow/bubble-flow-class.js';

// Export bubbles
export type { BubbleTriggerEvent } from './bubble-trigger/types.js';
export { HelloWorldBubble } from './bubbles/service-bubble/hello-world.js';
export {
  AIAgentBubble,
  type StreamingEvent,
  type StreamingCallback,
  type ToolHookContext,
  type ToolHookBefore,
  type ToolHookAfter,
} from './bubbles/service-bubble/ai-agent.js';
export { PostgreSQLBubble } from './bubbles/service-bubble/postgresql.js';
export { SlackBubble } from './bubbles/service-bubble/slack.js';
export { ResendBubble } from './bubbles/service-bubble/resend.js';
export { HttpBubble } from './bubbles/service-bubble/http.js';
export { SlackFormatterAgentBubble } from './bubbles/workflow-bubble/slack-formatter-agent.js';
export { StorageBubble } from './bubbles/service-bubble/storage.js';
export { GoogleDriveBubble } from './bubbles/service-bubble/google-drive.js';
export { GmailBubble } from './bubbles/service-bubble/gmail.js';
export { GoogleSheetsBubble } from './bubbles/service-bubble/google-sheets.js';
export { GoogleCalendarBubble } from './bubbles/service-bubble/google-calendar.js';

// Export workflow bubbles
export { DatabaseAnalyzerWorkflowBubble } from './bubbles/workflow-bubble/database-analyzer.workflow.js';
export { SlackNotifierWorkflowBubble } from './bubbles/workflow-bubble/slack-notifier.workflow.js';
export { BubbleFlowGeneratorWorkflow } from './bubbles/workflow-bubble/bubbleflow-generator.workflow.js';
export { SlackDataAssistantWorkflow } from './bubbles/workflow-bubble/slack-data-assistant.workflow.js';
export { PDFFormOperationsWorkflow } from './bubbles/workflow-bubble/pdf-form-operations.workflow.js';
export { PDFOcrWorkflow } from './bubbles/workflow-bubble/pdf-ocr.workflow.js';
export { GenerateDocumentWorkflow } from './bubbles/workflow-bubble/generate-document.workflow.js';
export { ParseDocumentWorkflow } from './bubbles/workflow-bubble/parse-document.workflow.js';

// Export tool bubbles
export { ListBubblesTool } from './bubbles/tool-bubble/list-bubbles-tool.js';
export { GetBubbleDetailsTool } from './bubbles/tool-bubble/get-bubble-details-tool.js';
export { SQLQueryTool } from './bubbles/tool-bubble/sql-query-tool.js';
export { BubbleFlowValidationTool } from './bubbles/tool-bubble/bubbleflow-validation-tool.js';
export { WebSearchTool } from './bubbles/tool-bubble/web-search-tool.js';
export { WebScrapeTool } from './bubbles/tool-bubble/web-scrape-tool.js';
export { WebCrawlTool } from './bubbles/tool-bubble/web-crawl-tool.js';
export { WebExtractTool } from './bubbles/tool-bubble/web-extract-tool.js';
export { ResearchAgentTool } from './bubbles/tool-bubble/research-agent-tool.js';
export { RedditScrapeTool } from './bubbles/tool-bubble/reddit-scrape-tool.js';

// Export factory (this is the main way to access bubbles)
export {
  BubbleFactory,
  type BubbleClassWithMetadata,
} from './bubble-factory.js';

// Export logging utilities
export {
  BubbleLogger,
  LogLevel,
  type LogEntry,
  type LogMetadata,
  type LoggerConfig,
} from './logging/BubbleLogger.js';
export { StreamingBubbleLogger } from './logging/StreamingBubbleLogger.js';

// Re-export MockDataGenerator from shared-schemas for convenience
export { MockDataGenerator } from '@bubblelab/shared-schemas';

// Re-export langchain message types for use in API and other packages
export { HumanMessage, AIMessage } from '@langchain/core/messages';
export type { BaseMessage } from '@langchain/core/messages';
export { parseJsonWithFallbacks } from './utils/json-parsing.js';
