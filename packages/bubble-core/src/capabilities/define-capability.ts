import type {
  CapabilityMetadata,
  CapabilityInput,
  CapabilityToolDef,
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
  inputs: Record<string, string | number | boolean>;
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
) => string;

/** Full runtime capability definition with metadata + factories. */
export interface CapabilityDefinition {
  metadata: CapabilityMetadata;
  createTools: CapabilityToolFactory;
  createSystemPrompt?: CapabilitySystemPromptFactory;
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
  hooks?: CapabilityDefinition['hooks'];
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
    inputs: options.inputs,
    tools: toolDefs,
    systemPromptAddition:
      typeof options.systemPrompt === 'string'
        ? options.systemPrompt
        : undefined,
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

  return {
    metadata,
    createTools,
    createSystemPrompt,
    hooks: options.hooks,
  };
}
