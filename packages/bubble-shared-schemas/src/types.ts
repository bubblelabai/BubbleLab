// Define CredentialType enum here to avoid circular dependencies

export enum CredentialType {
  // AI Credentials
  OPENAI_CRED = 'OPENAI_CRED',
  GOOGLE_GEMINI_CRED = 'GOOGLE_GEMINI_CRED',
  ANTHROPIC_CRED = 'ANTHROPIC_CRED',
  OPENROUTER_CRED = 'OPENROUTER_CRED',
  // Search Credentials
  FIRECRAWL_API_KEY = 'FIRECRAWL_API_KEY',
  // Database Credentials
  DATABASE_CRED = 'DATABASE_CRED',
  // Communication Credentials
  SLACK_CRED = 'SLACK_CRED',
  // Email Credentials
  RESEND_CRED = 'RESEND_CRED',
  // Storage Credentials
  CLOUDFLARE_R2_ACCESS_KEY = 'CLOUDFLARE_R2_ACCESS_KEY',
  CLOUDFLARE_R2_SECRET_KEY = 'CLOUDFLARE_R2_SECRET_KEY',
  CLOUDFLARE_R2_ACCOUNT_ID = 'CLOUDFLARE_R2_ACCOUNT_ID',
  // Scraping Credentials
  APIFY_CRED = 'APIFY_CRED',

  // OAuth Credentials
  GOOGLE_DRIVE_CRED = 'GOOGLE_DRIVE_CRED',
  GMAIL_CRED = 'GMAIL_CRED',
  GOOGLE_SHEETS_CRED = 'GOOGLE_SHEETS_CRED',
  GOOGLE_CALENDAR_CRED = 'GOOGLE_CALENDAR_CRED',
  FUB_CRED = 'FUB_CRED',

  // Development Platform Credentials
  GITHUB_TOKEN = 'GITHUB_TOKEN',
}

// Define all bubble names as a union type for type safety
export type BubbleName =
  | 'hello-world'
  | 'ai-agent'
  | 'postgresql'
  | 'slack'
  | 'resend'
  | 'http'
  | 'slack-formatter-agent'
  | 'database-analyzer'
  | 'slack-notifier'
  | 'get-bubble-details-tool'
  | 'list-bubbles-tool'
  | 'sql-query-tool'
  | 'chart-js-tool'
  | 'web-search-tool'
  | 'web-scrape-tool'
  | 'web-crawl-tool'
  | 'web-extract-tool'
  | 'research-agent-tool'
  | 'reddit-scrape-tool'
  | 'slack-data-assistant'
  | 'bubbleflow-code-generator'
  | 'bubbleflow-generator'
  | 'pdf-form-operations'
  | 'pdf-ocr-workflow'
  | 'generate-document-workflow'
  | 'parse-document-workflow'
  | 'bubbleflow-validation-tool'
  | 'code-edit-tool'
  | 'storage'
  | 'google-drive'
  | 'gmail'
  | 'google-sheets'
  | 'google-calendar'
  | 'apify'
  | 'instagram-tool'
  | 'linkedin-tool'
  | 'youtube-tool'
  | 'github'
  | 'followupboss';
