import { z } from 'zod';
import type { IBubble, BubbleContext } from './types/bubble.js';
import {
  CredentialType,
  type BubbleName,
  type BubbleNodeType,
  BUBBLE_CREDENTIAL_OPTIONS,
  TRIGGER_EVENT_CONFIGS,
} from '@bubblelab/shared-schemas';
// Local type to describe detailed dependencies without cross-package type coupling
type BubbleDependencySpec = {
  name: BubbleName;
  tools?: BubbleName[];
  instances?: Array<{
    variableName: string;
    isAnonymous: boolean;
    startLine?: number;
    endLine?: number;
  }>;
};
import type { LangGraphTool } from './types/tool-bubble-class.js';
import { WebCrawlTool } from './bubbles/tool-bubble/web-crawl-tool.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildClassNameLookup as buildLookupForSource,
  parseBubbleInstancesFromSource,
} from './utils/source-bubble-parser.js';

// Type for concrete bubble class constructors with static metadata
export type BubbleClassWithMetadata<TResult extends object = object> = {
  new (
    params: unknown,
    context?: BubbleContext
  ): IBubble<
    {
      success: boolean;
      error: string;
    } & TResult
  >;
  readonly bubbleName: BubbleName;
  readonly schema:
    | z.ZodObject<z.ZodRawShape>
    | z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>;
  readonly resultSchema?:
    | z.ZodObject<z.ZodRawShape>
    | z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly alias?: string;
  readonly type: BubbleNodeType;
  readonly credentialOptions?: CredentialType[];
  readonly bubbleDependencies?: BubbleName[];
  toolAgent?: (
    credentials: Partial<Record<CredentialType, string>>,
    config?: Record<string, unknown>,
    context?: BubbleContext
  ) => LangGraphTool;
};

export class BubbleFactory {
  private registry = new Map<BubbleName, BubbleClassWithMetadata<any>>();
  private static dependenciesPopulated = false;
  private static detailedDepsCache = new Map<
    BubbleName,
    BubbleDependencySpec[]
  >();
  // Stores detailed dependencies inferred from source for each registered bubble
  private detailedDeps = new Map<BubbleName, BubbleDependencySpec[]>();

  constructor(autoRegisterDefaults = false) {
    if (autoRegisterDefaults) {
      this.registerDefaults();
    }
    // Seed instance detailed deps from global cache if available
    if (BubbleFactory.detailedDepsCache.size > 0) {
      for (const [name, deps] of BubbleFactory.detailedDepsCache) {
        this.detailedDeps.set(name, deps);
      }
    }
  }

  /**
   * Register a bubble class with the factory
   */
  register(name: BubbleName, bubbleClass: BubbleClassWithMetadata<any>): void {
    if (this.registry.has(name)) {
      // Silently skip if already registered - makes it idempotent
      return;
    }
    this.registry.set(name, bubbleClass);
  }

  /**
   * Get a bubble class from the registry
   */
  get(name: BubbleName): BubbleClassWithMetadata<any> | undefined {
    return this.registry.get(name as BubbleName);
  }

  /**
   * Create a bubble instance
   */
  createBubble<T extends IBubble = IBubble>(
    name: BubbleName,
    params?: unknown,
    context?: BubbleContext
  ): T {
    const BubbleClass = this.registry.get(name as BubbleName);
    if (!BubbleClass) {
      throw new Error(`Bubble '${name}' not found in factory registry`);
    }
    // Always pass params, even if undefined
    return new BubbleClass(params, context) as unknown as T;
  }

  getDetailedDependencies(name: BubbleName): BubbleDependencySpec[] {
    return this.detailedDeps.get(name) || [];
  }

  /**
   * List all registered bubble names
   */
  list(): BubbleName[] {
    return Array.from(this.registry.keys());
  }

  // Return a list of bubbles to be used in the BubbleFlow code generator
  listBubblesForCodeGenerator(): BubbleName[] {
    return [
      'postgresql',
      'ai-agent',
      'slack',
      'telegram',
      'resend',
      'google-drive',
      'gmail',
      'google-sheets',
      'google-calendar',
      'pdf-form-operations',
      'slack-formatter-agent',
      'research-agent-tool',
      'web-crawl-tool',
      'web-scrape-tool',
      'web-search-tool',
      'reddit-scrape-tool',
      'apify',
      'instagram-tool',
      'linkedin-tool',
      'tiktok-tool',
      'twitter-tool',
      'google-maps-tool',
      'youtube-tool',
      'github',
      'eleven-labs',
      'followupboss',
      'agi-inc',
      'airtable',
      'notion',
      'insforge-db',
      'amazon-shopping-tool',
      'linkedin-connection-tool',
      'linkedin-sent-invitations-tool',
      'linkedin-received-invitations-tool',
      'company-enrichment-tool',
      'people-search-tool',
      'jira',
      'confluence',
      'ashby',
      'fullenrich',
      'stripe',
      'yc-scraper-tool',
      'posthog',
    ];
  }

  /**
   * Get the class names (e.g., 'SlackBubble', 'PostgreSQLBubble') for all bubbles
   * available for code generation. Used to generate import statements.
   */
  listBubbleClassNamesForCodeGenerator(): string[] {
    const bubbleNames = this.listBubblesForCodeGenerator();
    const classNames: string[] = [];

    for (const name of bubbleNames) {
      const bubbleClass = this.registry.get(name);
      if (bubbleClass && bubbleClass.name) {
        classNames.push(bubbleClass.name);
      }
    }

    return classNames;
  }

  /**
   * Get a mapping of bubble names to class names for code generation.
   * Returns object like { 'slack': 'SlackBubble', 'postgresql': 'PostgreSQLBubble' }
   */
  getBubbleNameToClassNameMap(): Record<string, string> {
    const bubbleNames = this.listBubblesForCodeGenerator();
    const mapping: Record<string, string> = {};

    for (const name of bubbleNames) {
      const bubbleClass = this.registry.get(name);
      if (bubbleClass && bubbleClass.name) {
        mapping[name] = bubbleClass.name;
      }
    }

    return mapping;
  }

  async registerDefaults(): Promise<void> {
    // Import and register all default bubbles
    // This will be implemented in a separate file to avoid circular deps
    // Register all default bubbles
    const { PeopleSearchTool } = await import(
      './bubbles/tool-bubble/people-search-tool.js'
    );
    const { HelloWorldBubble } = await import(
      './bubbles/service-bubble/hello-world.js'
    );
    const { AIAgentBubble } = await import(
      './bubbles/service-bubble/ai-agent.js'
    );
    const { PostgreSQLBubble } = await import(
      './bubbles/service-bubble/postgresql.js'
    );
    const { SlackBubble } = await import('./bubbles/service-bubble/slack');
    const { TelegramBubble } = await import(
      './bubbles/service-bubble/telegram.js'
    );
    const { ResendBubble } = await import('./bubbles/service-bubble/resend.js');
    const { HttpBubble } = await import('./bubbles/service-bubble/http.js');
    const { StorageBubble } = await import(
      './bubbles/service-bubble/storage.js'
    );
    const { GoogleDriveBubble } = await import(
      './bubbles/service-bubble/google-drive.js'
    );
    const { GmailBubble } = await import('./bubbles/service-bubble/gmail.js');
    const { GoogleSheetsBubble } = await import(
      './bubbles/service-bubble/google-sheets'
    );
    const { GoogleCalendarBubble } = await import(
      './bubbles/service-bubble/google-calendar.js'
    );
    const { ApifyBubble } = await import('./bubbles/service-bubble/apify');
    const { GithubBubble } = await import('./bubbles/service-bubble/github.js');
    const { FollowUpBossBubble } = await import(
      './bubbles/service-bubble/followupboss.js'
    );
    const { NotionBubble } = await import(
      './bubbles/service-bubble/notion/notion.js'
    );
    const { DatabaseAnalyzerWorkflowBubble } = await import(
      './bubbles/workflow-bubble/database-analyzer.workflow.js'
    );
    const { SlackNotifierWorkflowBubble } = await import(
      './bubbles/workflow-bubble/slack-notifier.workflow.js'
    );
    const { SlackDataAssistantWorkflow } = await import(
      './bubbles/workflow-bubble/slack-data-assistant.workflow.js'
    );

    const { ListBubblesTool } = await import(
      './bubbles/tool-bubble/list-bubbles-tool.js'
    );
    const { ListCapabilitiesTool } = await import(
      './bubbles/tool-bubble/list-capabilities-tool.js'
    );
    const { GetBubbleDetailsTool } = await import(
      './bubbles/tool-bubble/get-bubble-details-tool.js'
    );
    const { GetTriggerDetailTool } = await import(
      './bubbles/tool-bubble/get-trigger-detail-tool.js'
    );
    const { SQLQueryTool } = await import(
      './bubbles/tool-bubble/sql-query-tool.js'
    );
    const { ChartJSTool } = await import(
      './bubbles/tool-bubble/chart-js-tool.js'
    );
    const { BubbleFlowValidationTool } = await import(
      './bubbles/tool-bubble/bubbleflow-validation-tool.js'
    );
    const { EditBubbleFlowTool } = await import(
      './bubbles/tool-bubble/code-edit-tool.js'
    );
    const { WebSearchTool } = await import(
      './bubbles/tool-bubble/web-search-tool.js'
    );
    const { WebScrapeTool } = await import(
      './bubbles/tool-bubble/web-scrape-tool.js'
    );
    const { WebExtractTool } = await import(
      './bubbles/tool-bubble/web-extract-tool.js'
    );
    const { ResearchAgentTool } = await import(
      './bubbles/tool-bubble/research-agent-tool.js'
    );
    const { RedditScrapeTool } = await import(
      './bubbles/tool-bubble/reddit-scrape-tool.js'
    );
    const { InstagramTool } = await import(
      './bubbles/tool-bubble/instagram-tool.js'
    );
    const { LinkedInTool } = await import(
      './bubbles/tool-bubble/linkedin-tool.js'
    );
    const { YouTubeTool } = await import(
      './bubbles/tool-bubble/youtube-tool.js'
    );
    const { TikTokTool } = await import('./bubbles/tool-bubble/tiktok-tool.js');
    const { TwitterTool } = await import(
      './bubbles/tool-bubble/twitter-tool.js'
    );
    const { GoogleMapsTool } = await import(
      './bubbles/tool-bubble/google-maps-tool.js'
    );
    const { SlackFormatterAgentBubble } = await import(
      './bubbles/workflow-bubble/slack-formatter-agent.js'
    );
    const { PDFFormOperationsWorkflow } = await import(
      './bubbles/workflow-bubble/pdf-form-operations.workflow.js'
    );
    const { PDFOcrWorkflow } = await import(
      './bubbles/workflow-bubble/pdf-ocr.workflow.js'
    );
    const { GenerateDocumentWorkflow } = await import(
      './bubbles/workflow-bubble/generate-document.workflow.js'
    );
    const { ParseDocumentWorkflow } = await import(
      './bubbles/workflow-bubble/parse-document.workflow.js'
    );
    const { ElevenLabsBubble } = await import(
      './bubbles/service-bubble/eleven-labs.js'
    );
    const { AGIIncBubble } = await import(
      './bubbles/service-bubble/agi-inc.js'
    );
    const { AirtableBubble } = await import(
      './bubbles/service-bubble/airtable.js'
    );
    const { FirecrawlBubble } = await import(
      './bubbles/service-bubble/firecrawl.js'
    );
    const { InsForgeDbBubble } = await import(
      './bubbles/service-bubble/insforge-db.js'
    );
    const { BrowserBaseBubble } = await import(
      './bubbles/service-bubble/browserbase/index.js'
    );
    const { AmazonShoppingTool } = await import(
      './bubbles/tool-bubble/amazon-shopping-tool/index.js'
    );
    const { CrustdataBubble } = await import(
      './bubbles/service-bubble/crustdata/index.js'
    );
    const { CompanyEnrichmentTool } = await import(
      './bubbles/tool-bubble/company-enrichment-tool.js'
    );
    const { JiraBubble } = await import(
      './bubbles/service-bubble/jira/index.js'
    );
    const { ConfluenceBubble } = await import(
      './bubbles/service-bubble/confluence/index.js'
    );
    const { AshbyBubble } = await import(
      './bubbles/service-bubble/ashby/index.js'
    );
    const { FullEnrichBubble } = await import(
      './bubbles/service-bubble/fullenrich/index.js'
    );
    const {
      LinkedInConnectionTool,
      LinkedInSentInvitationsTool,
      LinkedInReceivedInvitationsTool,
      LinkedInAcceptInvitationsTool,
    } = await import('./bubbles/tool-bubble/browser-tools/index.js');
    const { StripeBubble } = await import(
      './bubbles/service-bubble/stripe/index.js'
    );
    const { YCScraperTool } = await import(
      './bubbles/tool-bubble/yc-scraper-tool.js'
    );
    const { PosthogBubble } = await import(
      './bubbles/service-bubble/posthog/index.js'
    );

    // Create the default factory instance
    this.register('hello-world', HelloWorldBubble as BubbleClassWithMetadata);
    this.register('ai-agent', AIAgentBubble as BubbleClassWithMetadata);
    this.register('postgresql', PostgreSQLBubble as BubbleClassWithMetadata);
    this.register('slack', SlackBubble as BubbleClassWithMetadata);
    this.register(
      'telegram' as BubbleName,
      TelegramBubble as unknown as BubbleClassWithMetadata
    );
    this.register('resend', ResendBubble as BubbleClassWithMetadata);
    this.register('http', HttpBubble as BubbleClassWithMetadata);
    this.register('storage', StorageBubble as BubbleClassWithMetadata);
    this.register('google-drive', GoogleDriveBubble as BubbleClassWithMetadata);
    this.register('gmail', GmailBubble as BubbleClassWithMetadata);
    this.register(
      'google-sheets',
      GoogleSheetsBubble as BubbleClassWithMetadata
    );
    this.register(
      'google-calendar',
      GoogleCalendarBubble as BubbleClassWithMetadata
    );
    this.register('apify', ApifyBubble as BubbleClassWithMetadata);
    this.register('github', GithubBubble as BubbleClassWithMetadata);
    this.register(
      'followupboss',
      FollowUpBossBubble as BubbleClassWithMetadata
    );
    this.register('notion', NotionBubble as BubbleClassWithMetadata);
    this.register(
      'database-analyzer',
      DatabaseAnalyzerWorkflowBubble as BubbleClassWithMetadata
    );
    this.register(
      'slack-notifier',
      SlackNotifierWorkflowBubble as BubbleClassWithMetadata
    );
    this.register(
      'slack-data-assistant',
      SlackDataAssistantWorkflow as BubbleClassWithMetadata
    );
    this.register(
      'slack-formatter-agent',
      SlackFormatterAgentBubble as BubbleClassWithMetadata
    );
    this.register(
      'pdf-form-operations',
      PDFFormOperationsWorkflow as BubbleClassWithMetadata
    );
    this.register(
      'pdf-ocr-workflow',
      PDFOcrWorkflow as BubbleClassWithMetadata
    );
    this.register(
      'generate-document-workflow',
      GenerateDocumentWorkflow as BubbleClassWithMetadata
    );
    this.register(
      'parse-document-workflow',
      ParseDocumentWorkflow as BubbleClassWithMetadata
    );
    this.register(
      'get-bubble-details-tool',
      GetBubbleDetailsTool as BubbleClassWithMetadata
    );
    this.register(
      'get-trigger-detail-tool',
      GetTriggerDetailTool as BubbleClassWithMetadata
    );
    this.register(
      'list-bubbles-tool',
      ListBubblesTool as BubbleClassWithMetadata
    );
    this.register(
      'list-capabilities-tool',
      ListCapabilitiesTool as BubbleClassWithMetadata
    );
    this.register('sql-query-tool', SQLQueryTool as BubbleClassWithMetadata);
    this.register('chart-js-tool', ChartJSTool as BubbleClassWithMetadata);
    this.register(
      'bubbleflow-validation-tool',
      BubbleFlowValidationTool as BubbleClassWithMetadata
    );
    this.register(
      'code-edit-tool',
      EditBubbleFlowTool as BubbleClassWithMetadata
    );
    this.register('web-search-tool', WebSearchTool as BubbleClassWithMetadata);
    this.register('web-scrape-tool', WebScrapeTool as BubbleClassWithMetadata);
    this.register(
      'web-extract-tool',
      WebExtractTool as BubbleClassWithMetadata
    );
    this.register(
      'research-agent-tool',
      ResearchAgentTool as BubbleClassWithMetadata
    );
    this.register(
      'reddit-scrape-tool',
      RedditScrapeTool as BubbleClassWithMetadata
    );
    this.register('instagram-tool', InstagramTool as BubbleClassWithMetadata);
    this.register('linkedin-tool', LinkedInTool as BubbleClassWithMetadata);
    this.register('tiktok-tool', TikTokTool as BubbleClassWithMetadata);
    this.register('twitter-tool', TwitterTool as BubbleClassWithMetadata);
    this.register(
      'google-maps-tool',
      GoogleMapsTool as BubbleClassWithMetadata
    );
    this.register('youtube-tool', YouTubeTool as BubbleClassWithMetadata);
    this.register('web-crawl-tool', WebCrawlTool as BubbleClassWithMetadata);
    this.register('eleven-labs', ElevenLabsBubble as BubbleClassWithMetadata);
    this.register('agi-inc', AGIIncBubble as BubbleClassWithMetadata);
    this.register('airtable', AirtableBubble as BubbleClassWithMetadata);
    this.register('firecrawl', FirecrawlBubble as BubbleClassWithMetadata);
    this.register('insforge-db', InsForgeDbBubble as BubbleClassWithMetadata);
    this.register('browserbase', BrowserBaseBubble as BubbleClassWithMetadata);
    this.register(
      'people-search-tool',
      PeopleSearchTool as BubbleClassWithMetadata
    );
    this.register(
      'amazon-shopping-tool',
      AmazonShoppingTool as BubbleClassWithMetadata
    );
    this.register('crustdata', CrustdataBubble as BubbleClassWithMetadata);
    this.register(
      'company-enrichment-tool',
      CompanyEnrichmentTool as BubbleClassWithMetadata
    );
    this.register('jira', JiraBubble as BubbleClassWithMetadata);
    this.register('confluence', ConfluenceBubble as BubbleClassWithMetadata);
    this.register('ashby', AshbyBubble as BubbleClassWithMetadata);
    this.register('fullenrich', FullEnrichBubble as BubbleClassWithMetadata);
    this.register(
      'linkedin-connection-tool',
      LinkedInConnectionTool as unknown as BubbleClassWithMetadata
    );
    this.register(
      'linkedin-sent-invitations-tool',
      LinkedInSentInvitationsTool as unknown as BubbleClassWithMetadata
    );
    this.register(
      'linkedin-received-invitations-tool',
      LinkedInReceivedInvitationsTool as unknown as BubbleClassWithMetadata
    );
    this.register(
      'linkedin-accept-invitations-tool',
      LinkedInAcceptInvitationsTool as unknown as BubbleClassWithMetadata
    );
    this.register('stripe', StripeBubble as BubbleClassWithMetadata);
    this.register('yc-scraper-tool', YCScraperTool as BubbleClassWithMetadata);
    this.register('posthog', PosthogBubble as BubbleClassWithMetadata);

    // After all default bubbles are registered, auto-populate bubbleDependencies
    if (!BubbleFactory.dependenciesPopulated) {
      console.log('Populating bubble dependencies from source....');
      await this.populateBubbleDependenciesFromSource();
      BubbleFactory.dependenciesPopulated = true;
      // Cache detailed dependencies globally for seeding future instances
      BubbleFactory.detailedDepsCache = new Map(this.detailedDeps);
    } else {
      // Seed this instance from the global cache if available
      if (BubbleFactory.detailedDepsCache.size > 0) {
        for (const [name, deps] of BubbleFactory.detailedDepsCache) {
          this.detailedDeps.set(name, deps);
        }
      }
    }
  }

  /**
   * Get all registered bubble classes
   */
  getAll(): BubbleClassWithMetadata[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get metadata for a bubble without instantiating it
   */
  getMetadata(name: BubbleName) {
    const BubbleClass = this.get(name);
    if (!BubbleClass) return undefined;

    // Type guard to check if schema is a ZodObject
    const schemaParams =
      BubbleClass.schema &&
      typeof BubbleClass.schema === 'object' &&
      'shape' in BubbleClass.schema
        ? (BubbleClass.schema as z.ZodObject<z.ZodRawShape>).shape
        : undefined;

    return {
      bubbleDependenciesDetailed: this.detailedDeps.get(BubbleClass.bubbleName),
      name: BubbleClass.bubbleName,
      shortDescription: BubbleClass.shortDescription,
      longDescription: BubbleClass.longDescription,
      alias: BubbleClass.alias,
      credentialOptions: BubbleClass.credentialOptions,
      bubbleDependencies: BubbleClass.bubbleDependencies,
      // Provide richer dependency details (ai-agent may include tools)
      schema: BubbleClass.schema,
      resultSchema: BubbleClass.resultSchema,
      type: BubbleClass.type,
      params: schemaParams,
    };
  }

  /**
   * Get all bubble metadata
   */
  getAllMetadata() {
    return this.list()
      .map((name) => this.getMetadata(name))
      .filter(Boolean);
  }

  /**
   * Scan bubble source modules to infer direct dependencies between bubbles by
   * inspecting ES module import statements, then attach the resulting
   * `bubbleDependencies` array onto the corresponding registered classes.
   *
   * Notes:
   * - Works in both dev (src) and build (dist) because it resolves paths
   *   relative to this module at runtime.
   * - Only imports under ./bubbles/** that themselves define a bubble class are
   *   considered dependencies; all other imports are ignored.
   */
  private async populateBubbleDependenciesFromSource(): Promise<void> {
    try {
      const currentFilePath = fileURLToPath(import.meta.url);
      const baseDir = path.dirname(currentFilePath);
      const bubblesDir = path.resolve(baseDir, './bubbles');

      console.log('Bubbles directory:', bubblesDir);
      // Gather all .js and .ts files under bubbles/**
      const bubbleFiles = await this.listModuleFilesRecursively(bubblesDir);

      // Build lookup once for all files
      const lookup = buildLookupForSource(this.registry);

      for (const filePath of bubbleFiles) {
        const content = await fs.readFile(filePath, 'utf-8');
        const ownerBubbleNames = this.extractBubbleNamesFromContent(
          content
        ) as BubbleName[];
        if (ownerBubbleNames.length === 0) {
          continue;
        }

        // Parse instances used within this file
        let instancesByDep: Map<
          BubbleName,
          {
            variableName: string;
            isAnonymous: boolean;
            startLine?: number;
            endLine?: number;
          }[]
        > = new Map();
        try {
          instancesByDep = parseBubbleInstancesFromSource(content, lookup, {
            debug: false,
            filePath,
          });
        } catch {
          // ignore parser failures for this file
        }

        // Collect ai-agent tools from instances directly (AST-derived)
        const aiAgentInst = instancesByDep.get(
          'ai-agent' as BubbleName
        ) as unknown as
          | Array<{
              variableName: string;
              isAnonymous: boolean;
              startLine?: number;
              endLine?: number;
              tools?: BubbleName[];
            }>
          | undefined;
        const aiTools = Array.from(
          new Set(
            (aiAgentInst || [])
              .flatMap((i) => i.tools || [])
              .filter((t): t is BubbleName => typeof t === 'string')
          )
        );

        for (const owner of ownerBubbleNames) {
          const detailed: BubbleDependencySpec[] = [];
          for (const [depName, instList] of instancesByDep.entries()) {
            if (depName === owner) continue;
            const spec: BubbleDependencySpec = {
              name: depName,
              instances: instList.map((i) => ({
                variableName: i.variableName,
                isAnonymous: i.isAnonymous,
                startLine: i.startLine,
                endLine: i.endLine,
              })),
            };
            if (depName === ('ai-agent' as BubbleName) && aiTools.length > 0) {
              spec.tools = aiTools as BubbleName[];
            }
            detailed.push(spec);
          }

          // Persist results for this owner bubble
          this.detailedDeps.set(owner, detailed);
          // Maintain classic flat dependency list on the class
          const klass = this.get(owner);
          if (klass) {
            try {
              (klass as any).bubbleDependencies = detailed.map((d) => d.name);
            } catch {
              try {
                Object.defineProperty(klass as object, 'bubbleDependencies', {
                  value: detailed.map((d) => d.name),
                  configurable: true,
                });
              } catch {
                // ignore
              }
            }
          }
        }
      }
    } catch {
      // Silently ignore issues in dependency scanning to avoid blocking runtime
    }
  }

  private async listModuleFilesRecursively(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.listModuleFilesRecursively(full);
        out.push(...nested);
      } else if (
        entry.isFile() &&
        (full.endsWith('.ts') || full.endsWith('.js')) &&
        !full.endsWith('.test.ts') &&
        !full.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }

    return out;
  }

  private extractBubbleNamesFromContent(content: string): string[] {
    const names: string[] = [];
    // Look for static bubbleName definitions in the class body
    const nameRegex =
      /static\s+(?:readonly\s+)?bubbleName\s*(?::[^=]+)?=\s*['"]([^'"\n]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = nameRegex.exec(content)) !== null) {
      names.push(match[1] as BubbleName);
    }
    return names;
  }

  /**
   * Get credential to bubble name mapping from registered bubbles
   * Provides type-safe mapping based on actual registered bubbles
   */
  getCredentialToBubbleMapping(): Partial<Record<CredentialType, BubbleName>> {
    const mapping: Partial<Record<CredentialType, BubbleName>> = {};

    for (const [bubbleName, credentialOptions] of Object.entries(
      BUBBLE_CREDENTIAL_OPTIONS
    )) {
      // Get the bubble class to check its type
      const BubbleClass = this.get(bubbleName as BubbleName);

      // Only include service bubbles for credential validation
      if (BubbleClass && BubbleClass.type === 'service') {
        for (const credentialType of credentialOptions) {
          // Only map if we haven't seen this credential type before
          // This gives priority to the first service bubble for each credential
          if (!mapping[credentialType]) {
            mapping[credentialType] = bubbleName as BubbleName;
          }
        }
      }
    }

    return mapping;
  }

  /**
   * Get bubble name for a specific credential type
   */
  getBubbleNameForCredential(
    credentialType: CredentialType
  ): BubbleName | undefined {
    const mapping = this.getCredentialToBubbleMapping();
    return mapping[credentialType];
  }

  /**
   * Check if a credential type is supported by any registered bubble
   */
  isCredentialSupported(credentialType: CredentialType): boolean {
    return this.getBubbleNameForCredential(credentialType) !== undefined;
  }

  /**
   * Generate minimal BubbleFlow boilerplate template
   * Use get-trigger-detail-tool to get specific trigger configuration and payload types
   */
  generateBubbleFlowBoilerplate(options?: { className?: string }): string {
    const className = options?.className || 'GeneratedFlow';

    // Generate dynamic trigger list from registry
    const triggerList = Object.keys(TRIGGER_EVENT_CONFIGS)
      .map((t) => `'${t}'`)
      .join(' | ');

    return `
import { z } from 'zod';
import {
  // Base classes
  BubbleFlow,

  // Service Bubbles (Connects to external services)
  HelloWorldBubble, // bubble name: 'hello-world'
  AIAgentBubble, // bubble name: 'ai-agent'
  PostgreSQLBubble, // bubble name: 'postgresql'
  SlackBubble, // bubble name: 'slack'
  ResendBubble, // bubble name: 'resend'
  GoogleDriveBubble, // bubble name: 'google-drive'
  GoogleSheetsBubble, // bubble name: 'google-sheets'
  GoogleCalendarBubble, // bubble name: 'google-calendar'
  GmailBubble, // bubble name: 'gmail'
  SlackFormatterAgentBubble, // bubble name: 'slack-formatter-agent'
  HttpBubble, // bubble name: 'http'
  StorageBubble, // bubble name: 'storage'
  ApifyBubble, // bubble name: 'apify'
  ElevenLabsBubble, // bubble name: 'eleven-labs'
  FollowUpBossBubble, // bubble name: 'followupboss'
  JiraBubble, // bubble name: 'jira'
  ConfluenceBubble, // bubble name: 'confluence'
  AshbyBubble, // bubble name: 'ashby'
  FullEnrichBubble, // bubble name: 'fullenrich'
  StripeBubble, // bubble name: 'stripe'
  PosthogBubble, // bubble name: 'posthog'

  // Tool Bubbles (Perform useful actions)
  ResearchAgentTool, // bubble name: 'research-agent-tool'
  RedditScrapeTool, // bubble name: 'reddit-scrape-tool'
  WebScrapeTool, // bubble name: 'web-scrape-tool'
  WebCrawlTool, // bubble name: 'web-crawl-tool'
  WebSearchTool, // bubble name: 'web-search-tool'
  InstagramTool, // bubble name: 'instagram-tool'
  LinkedInTool, // bubble name: 'linkedin-tool'
  TikTokTool, // bubble name: 'tiktok-tool'
  TwitterTool, // bubble name: 'twitter-tool'
  GoogleMapsTool, // bubble name: 'google-maps-tool'
  YouTubeTool, // bubble name: 'youtube-tool'
  AmazonShoppingTool, // bubble name: 'amazon-shopping-tool',
  LinkedInConnectionTool, // bubble name: 'linkedin-connection-tool'
  LinkedInSentInvitationsTool, // bubble name: 'linkedin-sent-invitations-tool'
  LinkedInReceivedInvitationsTool, // bubble name: 'linkedin-received-invitations-tool'
  LinkedInAcceptInvitationsTool, // bubble name: 'linkedin-accept-invitations-tool'
  PeopleSearchTool, // bubble name: 'people-search-tool'
  YCScraperTool, // bubble name: 'yc-scraper-tool'

  // Event Types (Import the one matching your trigger)
  type WebhookEvent,
  type CronEvent,
  type SlackMentionEvent,
  type SlackMessageReceivedEvent,
} from '@bubblelab/bubble-core';

// AVAILABLE TRIGGERS: ${triggerList}
// Use get-trigger-detail-tool to get the payload schema and setup instructions for your chosen trigger

export interface Output {
  message: string;
  // Add your output fields here
}

export class ${className} extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    // Your workflow logic here
    // Use get-bubble-details-tool to learn about available bubbles
    return { message: 'Hello from BubbleFlow!' };
  }
}
`;
  }
}
