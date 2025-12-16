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
  [CredentialType.TELEGRAM_BOT_TOKEN]: {},
  [CredentialType.AGI_API_KEY]: {},
  [CredentialType.FUB_CRED]: {},
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
  [CredentialType.ELEVENLABS_API_KEY]: {},
  [CredentialType.GOOGLE_DRIVE_CRED]: {},
  [CredentialType.GMAIL_CRED]: {},
  [CredentialType.GOOGLE_SHEETS_CRED]: {},
  [CredentialType.GOOGLE_CALENDAR_CRED]: {},
  [CredentialType.GITHUB_TOKEN]: {},
  [CredentialType.AIRTABLE_CRED]: {},
  [CredentialType.NOTION_OAUTH_TOKEN]: {},
  [CredentialType.FAL_AI_API_KEY]: {},
  [CredentialType.INSFORGE_BASE_URL]: {},
  [CredentialType.INSFORGE_API_KEY]: {},
};

// Fixed list of bubble names that need context injection
export const BUBBLE_NAMES_WITH_CONTEXT_INJECTION = [
  'database-analyzer',
  'slack-data-assistant',
];

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
  /**
   * Source of the parameter - indicates whether it came from an object literal property
   * or represents the entire first argument. Used to determine if spread pattern should be applied.
   * Ex.
   * const abc = '1234567890';
   * new GoogleDriveBubble({
   *   fileId: abc,
   * })
   * source: 'object-property',
   *
   * new GoogleDriveBubble({
   *   url: 'https://www.google.com',
   *   ...args,
   * })
   * source: 'spread',
   *
   * source = 'first-arg'
   * new GoogleDriveBubble(args)
   */
  source: z
    .enum(['object-property', 'first-arg', 'spread'])
    .optional()
    .describe(
      'Source of the parameter - indicates if it came from an object literal property, represents the entire first argument, or came from a spread operator'
    ),
});

// Bubble parameter from backend parser (derived from Zod schema - single source of truth)
export type BubbleParameter = z.infer<typeof BubbleParameterSchema>;

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
  description?: string;
  /**
   * Indicates that this bubble was cloned for a specific invocation context,
   * using the provided call site key for uniqueness.
   */
  invocationCallSiteKey?: string;
  /**
   * Reference to the original parsed bubble's variableId when this entry
   * represents an invocation-specific clone.
   */
  clonedFromVariableId?: number;
}

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
  description: z.string().optional(),
  invocationCallSiteKey: z.string().optional(),
  clonedFromVariableId: z.number().optional(),
});

// Inferred types from Zod schemas
export type BubbleParameterTypeInferred = z.infer<
  typeof BubbleParameterTypeSchema
>;
// Keep for backwards compatibility - now just an alias
export type BubbleParameterInferred = BubbleParameter;
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

// Workflow node types for hierarchical workflow representation
export type WorkflowNodeType =
  | 'bubble'
  | 'if'
  | 'for'
  | 'while'
  | 'try_catch'
  | 'variable_declaration'
  | 'return'
  | 'function_call'
  | 'code_block'
  | 'parallel_execution'
  | 'transformation_function';

export interface BubbleWorkflowNode {
  type: 'bubble';
  variableId: number; // Reference to bubble in ParsedWorkflow.bubbles map
}

export interface ControlFlowWorkflowNode {
  type: 'if' | 'for' | 'while';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  condition?: string; // For if/for/while conditions
  children: WorkflowNode[];
  elseBranch?: WorkflowNode[]; // For if statements
  thenTerminates?: boolean; // True if then branch contains return/throw
  elseTerminates?: boolean; // True if else branch contains return/throw
}

export interface TryCatchWorkflowNode {
  type: 'try_catch';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  children: WorkflowNode[]; // Try block
  catchBlock?: WorkflowNode[]; // Catch block
}

export interface CodeBlockWorkflowNode {
  type: 'code_block';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  code: string; // The actual code snippet
  children: WorkflowNode[]; // Nested bubbles/control flow within this block
}

export interface VariableDeclarationBlockNode {
  type: 'variable_declaration';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  code: string; // The variable declarations code
  variables: Array<{
    name: string;
    type: 'const' | 'let' | 'var';
    hasInitializer: boolean;
  }>;
  children: WorkflowNode[];
}

export interface ReturnWorkflowNode {
  type: 'return';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  code: string; // The return statement code
  value?: string; // Extracted return value expression (optional, for easier access)
  children: WorkflowNode[]; // Rare, but return could contain nested structures
}

export interface FunctionCallWorkflowNode {
  type: 'function_call';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  functionName: string; // e.g., "processData"
  isMethodCall: boolean; // true for this.method(), false for helper()
  description?: string; // Method description from code comments
  arguments?: string; // The arguments as code string
  code: string; // Full call expression code
  variableId: number; // Unique variable ID for tracking execution (added for logging consistency)
  variableDeclaration?: {
    // If this function call is part of a variable declaration
    variableName: string;
    variableType: 'const' | 'let' | 'var';
  };
  methodDefinition?: {
    // If method definition found in class
    location: {
      startLine: number;
      endLine: number;
    };
    isAsync: boolean;
    parameters: string[]; // Parameter names
  };
  children: WorkflowNode[]; // If method definition found, expand its body here
}

export interface ParallelExecutionWorkflowNode {
  type: 'parallel_execution';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  code: string; // Full Promise.all() code
  variableDeclaration?: {
    // If this parallel execution is part of a variable declaration
    variableNames: string[]; // Array destructuring names
    variableType: 'const' | 'let' | 'var';
  };
  children: WorkflowNode[]; // Parallel tasks (function calls inside Promise.all)
}

export interface TransformationFunctionWorkflowNode {
  type: 'transformation_function';
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
  code: string; // Entire function call code
  functionName: string; // e.g., "validateInput"
  isMethodCall: boolean; // true for this.method(), false for helper()
  description?: string; // Method description from code comments
  arguments?: string; // The arguments as code string
  variableId: number; // Unique variable ID for tracking execution
  variableDeclaration?: {
    // If this function call is part of a variable declaration
    variableName: string;
    variableType: 'const' | 'let' | 'var';
  };
  methodDefinition?: {
    // If method definition found in class
    location: {
      startLine: number;
      endLine: number;
    };
    isAsync: boolean;
    parameters: string[]; // Parameter names
  };
}

export type WorkflowNode =
  | BubbleWorkflowNode
  | ControlFlowWorkflowNode
  | TryCatchWorkflowNode
  | CodeBlockWorkflowNode
  | VariableDeclarationBlockNode
  | ReturnWorkflowNode
  | FunctionCallWorkflowNode
  | ParallelExecutionWorkflowNode
  | TransformationFunctionWorkflowNode;

export interface ParsedWorkflow {
  root: WorkflowNode[];
  bubbles: Record<number, ParsedBubbleWithInfo>; // Keep for backward compatibility
}

// Zod schemas for workflow nodes
export const WorkflowNodeTypeSchema = z.enum([
  'bubble',
  'if',
  'for',
  'while',
  'try_catch',
  'variable_declaration',
  'return',
  'function_call',
  'code_block',
  'parallel_execution',
  'transformation_function',
]);

export const LocationSchema = z.object({
  startLine: z.number(),
  startCol: z.number(),
  endLine: z.number(),
  endCol: z.number(),
});

export const BubbleWorkflowNodeSchema: z.ZodType<BubbleWorkflowNode> = z.object(
  {
    type: z.literal('bubble'),
    variableId: z.number(),
  }
);

export const ControlFlowWorkflowNodeSchema: z.ZodType<ControlFlowWorkflowNode> =
  z.lazy(() =>
    z.object({
      type: z.enum(['if', 'for', 'while']),
      location: LocationSchema,
      condition: z.string().optional(),
      children: z.array(WorkflowNodeSchema),
      elseBranch: z.array(WorkflowNodeSchema).optional(),
      thenTerminates: z.boolean().optional(),
      elseTerminates: z.boolean().optional(),
    })
  );

export const TryCatchWorkflowNodeSchema: z.ZodType<TryCatchWorkflowNode> =
  z.lazy(() =>
    z.object({
      type: z.literal('try_catch'),
      location: LocationSchema,
      children: z.array(WorkflowNodeSchema),
      catchBlock: z.array(WorkflowNodeSchema).optional(),
    })
  );

export const CodeBlockWorkflowNodeSchema: z.ZodType<CodeBlockWorkflowNode> =
  z.lazy(() =>
    z.object({
      type: z.literal('code_block'),
      location: LocationSchema,
      code: z.string(),
      children: z.array(WorkflowNodeSchema),
    })
  );

export const VariableDeclarationBlockNodeSchema: z.ZodType<VariableDeclarationBlockNode> =
  z.lazy(() =>
    z.object({
      type: z.literal('variable_declaration'),
      location: LocationSchema,
      code: z.string(),
      variables: z.array(
        z.object({
          name: z.string(),
          type: z.enum(['const', 'let', 'var']),
          hasInitializer: z.boolean(),
        })
      ),
      children: z.array(WorkflowNodeSchema),
    })
  );

export const ReturnWorkflowNodeSchema: z.ZodType<ReturnWorkflowNode> = z.lazy(
  () =>
    z.object({
      type: z.literal('return'),
      location: LocationSchema,
      code: z.string(),
      value: z.string().optional(),
      children: z.array(WorkflowNodeSchema),
    })
);

export const FunctionCallWorkflowNodeSchema: z.ZodType<FunctionCallWorkflowNode> =
  z.lazy(() =>
    z.object({
      type: z.literal('function_call'),
      location: LocationSchema,
      functionName: z.string(),
      isMethodCall: z.boolean(),
      description: z.string().optional(),
      arguments: z.string().optional(),
      code: z.string(),
      variableId: z.number(),
      variableDeclaration: z
        .object({
          variableName: z.string(),
          variableType: z.enum(['const', 'let', 'var']),
        })
        .optional(),
      methodDefinition: z
        .object({
          location: z.object({
            startLine: z.number(),
            endLine: z.number(),
          }),
          isAsync: z.boolean(),
          parameters: z.array(z.string()),
        })
        .optional(),
      children: z.array(WorkflowNodeSchema),
    })
  );

export const ParallelExecutionWorkflowNodeSchema: z.ZodType<ParallelExecutionWorkflowNode> =
  z.lazy(() =>
    z.object({
      type: z.literal('parallel_execution'),
      location: LocationSchema,
      code: z.string(),
      variableDeclaration: z
        .object({
          variableNames: z.array(z.string()),
          variableType: z.enum(['const', 'let', 'var']),
        })
        .optional(),
      children: z.array(WorkflowNodeSchema),
    })
  );

export const TransformationFunctionWorkflowNodeSchema: z.ZodType<TransformationFunctionWorkflowNode> =
  z.object({
    type: z.literal('transformation_function'),
    location: LocationSchema,
    code: z.string(),
    functionName: z.string(),
    isMethodCall: z.boolean(),
    description: z.string().optional(),
    arguments: z.string().optional(),
    variableId: z.number(),
    variableDeclaration: z
      .object({
        variableName: z.string(),
        variableType: z.enum(['const', 'let', 'var']),
      })
      .optional(),
    methodDefinition: z
      .object({
        location: z.object({
          startLine: z.number(),
          endLine: z.number(),
        }),
        isAsync: z.boolean(),
        parameters: z.array(z.string()),
      })
      .optional(),
  });

export const WorkflowNodeSchema: z.ZodType<WorkflowNode> = z.lazy(() =>
  z.union([
    BubbleWorkflowNodeSchema,
    ControlFlowWorkflowNodeSchema,
    TryCatchWorkflowNodeSchema,
    CodeBlockWorkflowNodeSchema,
    VariableDeclarationBlockNodeSchema,
    ReturnWorkflowNodeSchema,
    FunctionCallWorkflowNodeSchema,
    ParallelExecutionWorkflowNodeSchema,
    TransformationFunctionWorkflowNodeSchema,
  ])
);

export const ParsedWorkflowSchema = z.object({
  root: z.array(WorkflowNodeSchema),
  bubbles: z.record(z.number(), ParsedBubbleWithInfoSchema),
});
