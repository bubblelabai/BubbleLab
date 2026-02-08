// Define CredentialType enum here to avoid circular dependencies

export enum CredentialType {
  /**
   * Wildcard marker that indicates a bubble accepts any credential type.
   * Used in BUBBLE_CREDENTIAL_OPTIONS to allow users to plug in any credential.
   */
  CREDENTIAL_WILDCARD = '*',

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
  SLACK_API = 'SLACK_API',
  TELEGRAM_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN',
  // Email Credentials
  RESEND_CRED = 'RESEND_CRED',
  // Storage Credentials
  CLOUDFLARE_R2_ACCESS_KEY = 'CLOUDFLARE_R2_ACCESS_KEY',
  CLOUDFLARE_R2_SECRET_KEY = 'CLOUDFLARE_R2_SECRET_KEY',
  CLOUDFLARE_R2_ACCOUNT_ID = 'CLOUDFLARE_R2_ACCOUNT_ID',
  // Scraping Credentials
  APIFY_CRED = 'APIFY_CRED',

  // Voice Credentials
  ELEVENLABS_API_KEY = 'ELEVENLABS_API_KEY',

  // OAuth Credentials
  GOOGLE_DRIVE_CRED = 'GOOGLE_DRIVE_CRED',
  GMAIL_CRED = 'GMAIL_CRED',
  GOOGLE_SHEETS_CRED = 'GOOGLE_SHEETS_CRED',
  GOOGLE_CALENDAR_CRED = 'GOOGLE_CALENDAR_CRED',
  FUB_CRED = 'FUB_CRED',
  NOTION_OAUTH_TOKEN = 'NOTION_OAUTH_TOKEN',
  NOTION_API = 'NOTION_API',
  AIRTABLE_OAUTH = 'AIRTABLE_OAUTH',

  // Development Platform Credentials
  GITHUB_TOKEN = 'GITHUB_TOKEN',

  // Browser Automation Credentials
  AGI_API_KEY = 'AGI_API_KEY',

  // Database/Storage Credentials
  AIRTABLE_CRED = 'AIRTABLE_CRED',

  // InsForge Credentials
  INSFORGE_BASE_URL = 'INSFORGE_BASE_URL',
  INSFORGE_API_KEY = 'INSFORGE_API_KEY',

  // Custom Authentication Credentials
  CUSTOM_AUTH_KEY = 'CUSTOM_AUTH_KEY',

  // Browser Session Credentials (BrowserBase-powered)
  AMAZON_CRED = 'AMAZON_CRED',
  LINKEDIN_CRED = 'LINKEDIN_CRED',
  // Crustdata Credentials
  CRUSTDATA_API_KEY = 'CRUSTDATA_API_KEY',

  // Jira Credentials
  JIRA_CRED = 'JIRA_CRED',

  // Ashby Credentials
  ASHBY_CRED = 'ASHBY_CRED',

  // FullEnrich Credentials
  FULLENRICH_API_KEY = 'FULLENRICH_API_KEY',

  // Stripe Credentials
  STRIPE_CRED = 'STRIPE_CRED',

  // Confluence Credentials
  CONFLUENCE_CRED = 'CONFLUENCE_CRED',
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
  | 'get-trigger-detail-tool'
  | 'list-bubbles-tool'
  | 'list-capabilities-tool'
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
  | 'tiktok-tool'
  | 'twitter-tool'
  | 'google-maps-tool'
  | 'youtube-tool'
  | 'github'
  | 'eleven-labs'
  | 'followupboss'
  | 'agi-inc'
  | 'telegram'
  | 'airtable'
  | 'notion'
  | 'firecrawl'
  | 'insforge-db'
  | 'browserbase'
  | 'amazon-shopping-tool'
  | 'crustdata'
  | 'company-enrichment-tool'
  | 'people-search-tool'
  | 'jira'
  | 'ashby'
  | 'fullenrich'
  | 'linkedin-connection-tool'
  | 'stripe'
  | 'confluence'
  | 'yc-scraper-tool';
