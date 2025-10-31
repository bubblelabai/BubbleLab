import { z } from 'zod';
import { CredentialType, BubbleName } from './types';

// Bubble parameter type enum
export enum BubbleParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array',
  ENV = 'env',
  VARIABLE = 'variable',
  EXPRESSION = 'expression',
  UNKNOWN = 'unknown',
}

// Credential configuration mappings - defines what configurations are available for each credential type
export const CREDENTIAL_CONFIGURATION_MAP: Record<
  CredentialType,
  Record<string, BubbleParameterType>
> = {
  [CredentialType.DATABASE_CRED]: {
    ignoreSSL: BubbleParameterType.BOOLEAN,
  },
  [CredentialType.OPENAI_CRED]: {},
  [CredentialType.GOOGLE_GEMINI_CRED]: {},
  [CredentialType.ANTHROPIC_CRED]: {},
  [CredentialType.FIRECRAWL_API_KEY]: {},
  [CredentialType.SLACK_CRED]: {},
  [CredentialType.RESEND_CRED]: {},
  [CredentialType.OPENROUTER_CRED]: {},
  [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: {},
  [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: {},
  [CredentialType.CLOUDFLARE_R2_ACCOUNT_ID]: {},
  [CredentialType.APIFY_CRED]: {},
  [CredentialType.GOOGLE_DRIVE_CRED]: {},
  [CredentialType.GMAIL_CRED]: {},
  [CredentialType.GOOGLE_SHEETS_CRED]: {},
  [CredentialType.GOOGLE_CALENDAR_CRED]: {},
  [CredentialType.X_TWITTER_CRED]: {},
};

// Fixed list of bubble names that need context injection
export const BUBBLE_NAMES_WITH_CONTEXT_INJECTION = [
  'database-analyzer',
  'slack-data-assistant',
];

// Bubble parameter from backend parser (matches backend BubbleParameter interface)
export interface BubbleParameter {
  location?: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  variableId?: number;
  name: string;
  value: string | number | boolean | Record<string, unknown> | unknown[]; // Raw string representation of the value
  type: BubbleParameterType;
}

// Parsed bubble from backend parser (matches backend ParsedBubble interface)
export interface ParsedBubble {
  variableName: string;
  bubbleName: string; // This comes from the registry (e.g., 'postgresql', 'slack')
  className: string; // This is the actual class name (e.g., 'PostgreSQLBubble', 'SlackBubble')
  parameters: BubbleParameter[];
  hasAwait: boolean; // Whether the original expression was awaited
  hasActionCall: boolean; // Whether the original expression called .action()
  dependencies?: BubbleName[];
  dependencyGraph?: DependencyGraphNode;
}
// Nested dependency graph node for a bubble
export interface DependencyGraphNode {
  name: BubbleName;
  /** Optional variable name for this node instance, when available */
  variableName?: string;
  nodeType: BubbleNodeType;
  /**
   * Unique hierarchical ID path for the node within a flow.
   * Constructed as parentUniqueId + "." + bubbleName + "#" + ordinal.
   * Root nodes can omit or use empty string for the parent portion.
   */
  uniqueId?: string;
  /**
   * Variable id assigned by the parser/scope manager if available.
   * Root bubble nodes will carry their declaration variable id; synthetic/child nodes
   * inferred from dependencies may be assigned a negative synthetic id.
   */
  variableId?: number;
  dependencies: DependencyGraphNode[];
}

// Detailed dependency specification for factory metadata
export interface BubbleDependencySpec {
  name: BubbleName;
  // If this dependency is an ai-agent, include its tool dependencies
  tools?: BubbleName[];
}

export type BubbleNodeType = 'service' | 'tool' | 'workflow' | 'unknown';

export interface ParsedBubbleWithInfo extends ParsedBubble {
  variableId: number;
  nodeType: BubbleNodeType;
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
}

// Zod schemas for validation and type inference
export const BubbleParameterTypeSchema = z.nativeEnum(BubbleParameterType);

export const BubbleParameterSchema = z.object({
  location: z.optional(
    z.object({
      startLine: z.number(),
      startCol: z.number(),
      endLine: z.number(),
      endCol: z.number(),
    })
  ),
  variableId: z
    .number()
    .optional()
    .describe('The variable id of the parameter'),
  name: z.string().describe('The name of the parameter'),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.record(z.unknown()),
      z.array(z.unknown()),
    ])
    .describe('The value of the parameter'),
  type: BubbleParameterTypeSchema,
});

export const BubbleNodeTypeSchema = z.enum([
  'service',
  'tool',
  'workflow',
  'unknown',
]);

export const DependencyGraphNodeSchema: z.ZodType<DependencyGraphNode> = z.lazy(
  () =>
    z.object({
      name: z.string() as z.ZodType<BubbleName>,
      variableName: z.string().optional(),
      nodeType: BubbleNodeTypeSchema,
      uniqueId: z.string().optional(),
      variableId: z.number().optional(),
      dependencies: z.array(DependencyGraphNodeSchema),
    })
);

export const ParsedBubbleSchema = z.object({
  variableName: z.string(),
  bubbleName: z.string(),
  className: z.string(),
  parameters: z.array(BubbleParameterSchema),
  hasAwait: z.boolean(),
  hasActionCall: z.boolean(),
  dependencies: z.array(z.string() as z.ZodType<BubbleName>).optional(),
  dependencyGraph: DependencyGraphNodeSchema.optional(),
});

export const BubbleDependencySpecSchema = z.object({
  name: z.string() as z.ZodType<BubbleName>,
  tools: z.array(z.string() as z.ZodType<BubbleName>).optional(),
});

export const ParsedBubbleWithInfoSchema = z.object({
  variableName: z.string(),
  bubbleName: z.string(),
  className: z.string(),
  parameters: z.array(BubbleParameterSchema),
  hasAwait: z.boolean(),
  hasActionCall: z.boolean(),
  dependencies: z.array(z.string() as z.ZodType<BubbleName>).optional(),
  dependencyGraph: DependencyGraphNodeSchema.optional(),
  variableId: z.number(),
  nodeType: BubbleNodeTypeSchema,
  location: z.object({
    startLine: z.number(),
    startCol: z.number(),
    endLine: z.number(),
    endCol: z.number(),
  }),
});

// Inferred types from Zod schemas
export type BubbleParameterTypeInferred = z.infer<
  typeof BubbleParameterTypeSchema
>;
export type BubbleParameterInferred = z.infer<typeof BubbleParameterSchema>;
export type BubbleNodeTypeInferred = z.infer<typeof BubbleNodeTypeSchema>;
export type DependencyGraphNodeInferred = z.infer<
  typeof DependencyGraphNodeSchema
>;
export type ParsedBubbleInferred = z.infer<typeof ParsedBubbleSchema>;
export type BubbleDependencySpecInferred = z.infer<
  typeof BubbleDependencySpecSchema
>;
export type ParsedBubbleWithInfoInferred = z.infer<
  typeof ParsedBubbleWithInfoSchema
>;
