// Export all types
export * from './types/bubble.js';
export * from '@bubblelab/shared-schemas';
export * from './types/credentials.js';
export * from './types/available-tools.js';

// Export capabilities framework
export * from './capabilities/index.js';

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
export type { BubbleTriggerEvent } from '@bubblelab/shared-schemas';
export { HelloWorldBubble } from './bubbles/service-bubble/hello-world.js';
export {
  AIAgentBubble,
  type StreamingCallback,
  type ToolHookContext,
  type ToolHookBefore,
  type ToolHookAfter,
  type AfterLLMCallContext,
  type AfterLLMCallHook,
  type ConversationMessage,
} from './bubbles/service-bubble/ai-agent.js';
export { PostgreSQLBubble } from './bubbles/service-bubble/postgresql.js';
export { SlackBubble } from './bubbles/service-bubble/slack/index.js';
export { TelegramBubble } from './bubbles/service-bubble/telegram.js';
export { ResendBubble } from './bubbles/service-bubble/resend.js';
export { HttpBubble } from './bubbles/service-bubble/http.js';
export { SlackFormatterAgentBubble } from './bubbles/workflow-bubble/slack-formatter-agent.js';
export { StorageBubble } from './bubbles/service-bubble/storage.js';
export { GoogleDriveBubble } from './bubbles/service-bubble/google-drive.js';
export { GmailBubble } from './bubbles/service-bubble/gmail.js';
export { GoogleSheetsBubble } from './bubbles/service-bubble/google-sheets/index.js';
export { GoogleCalendarBubble } from './bubbles/service-bubble/google-calendar.js';
export { ApifyBubble } from './bubbles/service-bubble/apify/apify.js';
export { FollowUpBossBubble } from './bubbles/service-bubble/followupboss.js';
export { TwitterTool } from './bubbles/tool-bubble/twitter-tool.js';
export { TikTokTool } from './bubbles/tool-bubble/tiktok-tool.js';
export { GoogleMapsTool } from './bubbles/tool-bubble/google-maps-tool.js';
export type {
  ApifyParamsInput,
  ApifyActorInput,
} from './bubbles/service-bubble/apify/apify.js';
// Export Apify actor type helpers for type-safe actor usage
// Note: APIFY_ACTOR_SCHEMAS is not exported to avoid bloating the bundle
// with Zod runtime schemas. Use the type helpers instead.
export type {
  ActorId,
  ActorInput,
  ActorOutput,
  ActorSchema,
} from './bubbles/service-bubble/apify/types.js';
export type { APIFY_ACTOR_SCHEMAS } from './bubbles/service-bubble/apify/apify-scraper.schema.js';
export { GithubBubble } from './bubbles/service-bubble/github.js';
export type { GithubParamsInput } from './bubbles/service-bubble/github.js';
export { ElevenLabsBubble } from './bubbles/service-bubble/eleven-labs.js';
export type { ElevenLabsParamsInput } from './bubbles/service-bubble/eleven-labs.js';
export { AGIIncBubble } from './bubbles/service-bubble/agi-inc.js';
export type { AGIIncParamsInput } from './bubbles/service-bubble/agi-inc.js';
export { AirtableBubble } from './bubbles/service-bubble/airtable.js';
export type { AirtableParamsInput } from './bubbles/service-bubble/airtable.js';
export { NotionBubble } from './bubbles/service-bubble/notion/notion.js';
export { JiraBubble } from './bubbles/service-bubble/jira/index.js';
export type { JiraParamsInput } from './bubbles/service-bubble/jira/index.js';
export { ConfluenceBubble } from './bubbles/service-bubble/confluence/index.js';
export type { ConfluenceParamsInput } from './bubbles/service-bubble/confluence/index.js';
export { AshbyBubble } from './bubbles/service-bubble/ashby/index.js';
export type { AshbyParamsInput } from './bubbles/service-bubble/ashby/index.js';
export { FullEnrichBubble } from './bubbles/service-bubble/fullenrich/index.js';
export type { FullEnrichParamsInput } from './bubbles/service-bubble/fullenrich/index.js';
export {
  StripeBubble,
  StripeParamsSchema,
  StripeResultSchema,
  type StripeParams,
  type StripeParamsInput,
  type StripeResult,
} from './bubbles/service-bubble/stripe/index.js';
export type { FirecrawlParamsInput } from './bubbles/service-bubble/firecrawl.js';
export { FirecrawlBubble } from './bubbles/service-bubble/firecrawl.js';
export { InsForgeDbBubble } from './bubbles/service-bubble/insforge-db.js';
export type { InsForgeDbParamsInput } from './bubbles/service-bubble/insforge-db.js';
export {
  BrowserBaseBubble,
  BrowserBaseParamsSchema,
  BrowserBaseResultSchema,
  type BrowserBaseParams,
  type BrowserBaseParamsInput,
  type BrowserBaseResult,
  type CDPCookie,
  type BrowserSessionData,
} from './bubbles/service-bubble/browserbase/index.js';
export { CrustdataBubble } from './bubbles/service-bubble/crustdata/index.js';
export type {
  CrustdataParams,
  CrustdataParamsInput,
  CrustdataResult,
  PersonProfile,
  CompanyInfo,
} from './bubbles/service-bubble/crustdata/index.js';

// Export workflow bubbles
export { DatabaseAnalyzerWorkflowBubble } from './bubbles/workflow-bubble/database-analyzer.workflow.js';
export { SlackNotifierWorkflowBubble } from './bubbles/workflow-bubble/slack-notifier.workflow.js';
export { SlackDataAssistantWorkflow } from './bubbles/workflow-bubble/slack-data-assistant.workflow.js';
export { PDFFormOperationsWorkflow } from './bubbles/workflow-bubble/pdf-form-operations.workflow.js';
export { PDFOcrWorkflow } from './bubbles/workflow-bubble/pdf-ocr.workflow.js';
export { GenerateDocumentWorkflow } from './bubbles/workflow-bubble/generate-document.workflow.js';
export { ParseDocumentWorkflow } from './bubbles/workflow-bubble/parse-document.workflow.js';

// Export tool bubbles
export { ListBubblesTool } from './bubbles/tool-bubble/list-bubbles-tool.js';
export { GetBubbleDetailsTool } from './bubbles/tool-bubble/get-bubble-details-tool.js';
export { GetTriggerDetailTool } from './bubbles/tool-bubble/get-trigger-detail-tool.js';
export { ListAirtableBasesTool } from './bubbles/tool-bubble/list-airtable-bases-tool.js';
export { ListAirtableTablesTool } from './bubbles/tool-bubble/list-airtable-tables-tool.js';
export { SQLQueryTool } from './bubbles/tool-bubble/sql-query-tool.js';
export { BubbleFlowValidationTool } from './bubbles/tool-bubble/bubbleflow-validation-tool.js';
export { EditBubbleFlowTool } from './bubbles/tool-bubble/code-edit-tool.js';
export { WebSearchTool } from './bubbles/tool-bubble/web-search-tool.js';
export { WebScrapeTool } from './bubbles/tool-bubble/web-scrape-tool.js';
export { WebCrawlTool } from './bubbles/tool-bubble/web-crawl-tool.js';
export { WebExtractTool } from './bubbles/tool-bubble/web-extract-tool.js';
export { ResearchAgentTool } from './bubbles/tool-bubble/research-agent-tool.js';
export { RedditScrapeTool } from './bubbles/tool-bubble/reddit-scrape-tool.js';
export { InstagramTool } from './bubbles/tool-bubble/instagram-tool.js';
export { PeopleSearchTool } from './bubbles/tool-bubble/people-search-tool.js';
export type {
  InstagramPost,
  InstagramProfile,
} from './bubbles/tool-bubble/instagram-tool.js';
export { LinkedInTool } from './bubbles/tool-bubble/linkedin-tool.js';
export type {
  LinkedInPost,
  LinkedInAuthor,
  LinkedInStats,
} from './bubbles/tool-bubble/linkedin-tool.js';
export { YouTubeTool } from './bubbles/tool-bubble/youtube-tool.js';
export type {
  YouTubeVideo,
  YouTubeTranscriptSegment,
} from './bubbles/tool-bubble/youtube-tool.js';
export {
  AmazonShoppingTool,
  AmazonShoppingToolParamsSchema,
  AmazonShoppingToolResultSchema,
  type AmazonShoppingToolParams,
  type AmazonShoppingToolParamsInput,
  type AmazonShoppingToolResult,
  type CartItem,
  type SearchResult,
  type ProductDetails,
} from './bubbles/tool-bubble/amazon-shopping-tool/index.js';
export {
  LinkedInConnectionTool,
  LinkedInConnectionToolParamsSchema,
  LinkedInConnectionToolResultSchema,
  type LinkedInConnectionToolParams,
  type LinkedInConnectionToolParamsInput,
  type LinkedInConnectionToolResult,
  type ProfileInfo,
} from './bubbles/tool-bubble/linkedin-connection-tool/index.js';
export { CompanyEnrichmentTool } from './bubbles/tool-bubble/company-enrichment-tool.js';
export type {
  Contact,
  CompanyEnrichmentResult,
} from './bubbles/tool-bubble/company-enrichment-tool.js';
export { YCScraperTool } from './bubbles/tool-bubble/yc-scraper-tool.js';
export type {
  YCPerson,
  YCCompany,
  YCFounder,
} from './bubbles/tool-bubble/yc-scraper-tool.js';

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
export { WebhookStreamLogger } from './logging/WebhookStreamLogger.js';

// Re-export MockDataGenerator from shared-schemas for convenience
export { MockDataGenerator } from '@bubblelab/shared-schemas';

// Re-export langchain message types for use in API and other packages
export { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
export type { BaseMessage } from '@langchain/core/messages';
export {
  parseJsonWithFallbacks,
  unwrapSchemaStyleResponse,
} from './utils/json-parsing.js';
