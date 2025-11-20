import { z } from 'zod';
import type { IBubble, BubbleContext } from './types/bubble.js';
import {
  CredentialType,
  type BubbleName,
  type BubbleNodeType,
  BUBBLE_CREDENTIAL_OPTIONS,
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
      'youtube-tool',
      'github',
      'followupboss',
    ];
  }

  async registerDefaults(): Promise<void> {
    // Import and register all default bubbles
    // This will be implemented in a separate file to avoid circular deps
    // Register all default bubbles

    const { HelloWorldBubble } = await import(
      './bubbles/service-bubble/hello-world.js'
    );
    const { AIAgentBubble } = await import(
      './bubbles/service-bubble/ai-agent.js'
    );
    const { PostgreSQLBubble } = await import(
      './bubbles/service-bubble/postgresql.js'
    );
    const { SlackBubble } = await import('./bubbles/service-bubble/slack.js');
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
      './bubbles/service-bubble/google-sheets.js'
    );
    const { GoogleCalendarBubble } = await import(
      './bubbles/service-bubble/google-calendar.js'
    );
    const { ApifyBubble } = await import('./bubbles/service-bubble/apify');
    const { GithubBubble } = await import('./bubbles/service-bubble/github.js');
    const { FollowUpBossBubble } = await import(
      './bubbles/service-bubble/followupboss.js'
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
    const { GetBubbleDetailsTool } = await import(
      './bubbles/tool-bubble/get-bubble-details-tool.js'
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

    // Create the default factory instance
    this.register('hello-world', HelloWorldBubble as BubbleClassWithMetadata);
    this.register('ai-agent', AIAgentBubble as BubbleClassWithMetadata);
    this.register('postgresql', PostgreSQLBubble as BubbleClassWithMetadata);
    this.register('slack', SlackBubble as BubbleClassWithMetadata);
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
      'list-bubbles-tool',
      ListBubblesTool as BubbleClassWithMetadata
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
    this.register('youtube-tool', YouTubeTool as BubbleClassWithMetadata);
    this.register('web-crawl-tool', WebCrawlTool as BubbleClassWithMetadata);

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
   * Generate comprehensive BubbleFlow boilerplate template with all imports
   * This template includes ALL available bubble classes and types
   * Perfect for AI code generation and testing
   */
  generateBubbleFlowBoilerplate(options?: { className?: string }): string {
    const className = options?.className || 'GeneratedFlow';

    return `
import {z} from 'zod';
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
  FollowUpBossBubble, // bubble name: 'followupboss'

  // Tool Bubbles (Perform useful actions)
  ResearchAgentTool, // bubble name: 'research-agent-tool'
  RedditScrapeTool, // bubble name: 'reddit-scrape-tool'
  WebScrapeTool, // bubble name: 'web-scrape-tool'
  WebCrawlTool, // bubble name: 'web-crawl-tool'
  WebSearchTool, // bubble name: 'web-search-tool'
  InstagramTool, // bubble name: 'instagram-tool'
  LinkedInTool, // bubble name: 'linkedin-tool'
  YouTubeTool, // bubble name: 'youtube-tool'

  // Event Types (How the workflow is triggered)
  type WebhookEvent,
  type CronEvent,
} from '@bubblelab/bubble-core';

export interface Output {
 // TODO: Add your output fields here
  message: string;
}

// TRIGGER TYPE 1: Webhook HTTP Trigger
// Define your custom input interface for webhook triggers
export interface CustomWebhookPayload extends WebhookEvent {
// TODO: Add your custom payload fields here
  input: string;
}

export class ${className} extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    // TODO: Implement your workflow logic here
    const { input = 'sensible example value' } = payload;

    return {
      message: \`Response from \${payload.path} (Request: \${payload.requestId})\`,
    };
  }
}

// TRIGGER TYPE 2: Cron Schedule Trigger
// For cron-based scheduled workflows, or any workflow that can be benefited from being scheduled, extend BubbleFlow with 'schedule/cron'
// and define the cronSchedule property with a cron expression
// Time is in utc timezone, so if you want to schedule for a specific timezone, you need to convert the timezone to utc before writing the cron expression
/*
export interface CustomCronPayload extends CronEvent {
  // TODO: Add your custom payload fields here
  input: string;
}

export class ${className}Cron extends BubbleFlow<'schedule/cron'> {
  // Define cron schedule using standard 5-part cron format:
  // * * * * * = minute hour day-of-month month day-of-week
  // Examples:
  //   '0 0 * * *'     = Daily at midnight
  //   '0 9 * * 1-5'   = Every weekday at 9am
  //   '*/15 * * * *' = Every 15 minutes
  //   '0 0 1 * *'     = First day of every month at midnight
  readonly cronSchedule = '* 3 * * * *'; // Every 3 minutes

  async handle(payload: CustomCronPayload): Promise<Output> {
    // TODO: Implement your scheduled workflow logic here
    const { input = 'sensible example value', cron } = payload;

    return {
      message: \`Cron job executed at \${payload.timestamp} with schedule: \${cron}\`,
    };
  }
}
*/`;
  }
}
