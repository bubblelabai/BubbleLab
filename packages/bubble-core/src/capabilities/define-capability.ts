import type {
  CapabilityMetadata,
  CapabilityInput,
  CapabilityToolDef,
  CapabilityModelConfigOverride,
} from '@bubblelab/shared-schemas';
import type { CredentialType, BubbleName } from '@bubblelab/shared-schemas';
import type {
  ToolHookBefore,
  ToolHookAfter,
} from '../bubbles/service-bubble/ai-agent.js';
import type { BubbleContext } from '../types/bubble.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/** Runtime context passed to capability tool factories and system prompt factories. */
export interface CapabilityRuntimeContext {
  credentials: Partial<Record<CredentialType, string>>;
  inputs: Record<string, string | number | boolean | string[]>;
  bubbleContext?: BubbleContext;
}

/** A single capability tool function that accepts parsed parameters and returns a result. */
export type CapabilityToolFunc = (
  params: Record<string, unknown>
) => Promise<unknown>;

/** Factory that creates tool functions given a runtime context. */
export type CapabilityToolFactory = (
  context: CapabilityRuntimeContext
) => Record<string, CapabilityToolFunc>;

/** Factory that creates a system prompt addition given a runtime context. */
export type CapabilitySystemPromptFactory = (
  context: CapabilityRuntimeContext
) => string | Promise<string>;

/** Factory that creates text to append to the agent's final response. */
export type CapabilityResponseAppendFactory = (
  context: CapabilityRuntimeContext
) => string | Promise<string>;

/** Full runtime capability definition with metadata + factories. */
export interface CapabilityDefinition {
  metadata: CapabilityMetadata;
  createTools: CapabilityToolFactory;
  createSystemPrompt?: CapabilitySystemPromptFactory;
  /** Called after the agent finishes — returned text is appended to the response. */
  createResponseAppend?: CapabilityResponseAppendFactory;
  hooks?: {
    beforeToolCall?: ToolHookBefore;
    afterToolCall?: ToolHookAfter;
  };
}

/** Options for the defineCapability() helper — ergonomic API for creating capabilities. */
export interface DefineCapabilityOptions {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  version?: string;
  requiredCredentials: CredentialType[];
  optionalCredentials?: CredentialType[];
  inputs: CapabilityInput[];
  tools: Array<{
    name: string;
    description: string;
    schema: z.ZodObject<z.ZodRawShape>;
    /** Bubble names used internally by this tool (e.g., ['google-drive']). */
    internalBubbles?: BubbleName[];
    func: (ctx: CapabilityRuntimeContext) => CapabilityToolFunc;
  }>;
  systemPrompt?: string | CapabilitySystemPromptFactory;
  /** Text (or async factory) to append to the agent's final response. */
  responseAppend?: string | CapabilityResponseAppendFactory;
  hooks?: CapabilityDefinition['hooks'];
  /** Optional model config overrides applied at runtime (e.g., force a specific model or raise maxTokens). */
  modelConfigOverride?: CapabilityModelConfigOverride;
  /** Short guidance for the main agent on when to delegate to this capability in multi-capability mode. */
  delegationHint?: string;
  /** Hidden capabilities are registered for runtime use but not shown in the UI. */
  hidden?: boolean;
}

/**
 * Creates a CapabilityDefinition from a user-friendly options object.
 * Converts Zod schemas to JSON Schema for serializable metadata,
 * and wraps tool functions with context currying.
 */
export function defineCapability(
  options: DefineCapabilityOptions
): CapabilityDefinition {
  // Build serializable tool definitions from Zod schemas
  const toolDefs: CapabilityToolDef[] = options.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameterSchema: zodToJsonSchema(tool.schema, {
      $refStrategy: 'none',
    }) as Record<string, unknown>,
    ...(tool.internalBubbles ? { internalBubbles: tool.internalBubbles } : {}),
  }));

  // Build serializable metadata
  const metadata: CapabilityMetadata = {
    id: options.id,
    name: options.name,
    description: options.description,
    icon: options.icon,
    category: options.category,
    version: options.version ?? '1.0.0',
    requiredCredentials: options.requiredCredentials,
    optionalCredentials: options.optionalCredentials,
    inputs: options.inputs,
    tools: toolDefs,
    systemPromptAddition:
      typeof options.systemPrompt === 'string'
        ? options.systemPrompt
        : undefined,
    modelConfigOverride: options.modelConfigOverride,
    delegationHint: options.delegationHint,
    hidden: options.hidden,
  };

  // Build tool factory that curries context into each tool func
  const createTools: CapabilityToolFactory = (ctx) => {
    const toolFuncs: Record<string, CapabilityToolFunc> = {};
    for (const tool of options.tools) {
      toolFuncs[tool.name] = tool.func(ctx);
    }
    return toolFuncs;
  };

  // Build system prompt factory
  const createSystemPrompt: CapabilitySystemPromptFactory | undefined =
    typeof options.systemPrompt === 'function'
      ? options.systemPrompt
      : undefined;

  // Build response append factory
  const createResponseAppend: CapabilityResponseAppendFactory | undefined =
    typeof options.responseAppend === 'function'
      ? options.responseAppend
      : typeof options.responseAppend === 'string'
        ? () => options.responseAppend as string
        : undefined;

  return {
    metadata,
    createTools,
    createSystemPrompt,
    createResponseAppend,
    hooks: options.hooks,
  };
}
