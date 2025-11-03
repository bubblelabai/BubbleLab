import { z } from 'zod';
import type {
  IToolBubble,
  ServiceBubbleParams,
  BubbleContext,
  BubbleOperationResult,
  BubbleResult,
} from '@bubblelab/bubble-core';
import { BaseBubble } from './base-bubble-class.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// LangGraph tool interface structure
export interface LangGraphTool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  func<TResult extends BubbleOperationResult = BubbleOperationResult>(
    params: unknown
  ): Promise<BubbleResult<TResult>>;
}

/**
 * Abstract base class for all tool bubbles that can be converted to LangGraph tools
 */
export abstract class ToolBubble<
    TParams extends ServiceBubbleParams = ServiceBubbleParams,
    TResult extends BubbleOperationResult = BubbleOperationResult,
  >
  extends BaseBubble<TParams, TResult>
  implements IToolBubble<TResult>
{
  public readonly type = 'tool' as const;

  constructor(params: unknown, context?: BubbleContext, instanceId?: string) {
    super(params, context, instanceId);
  }

  // Static method - returns LangChain tool with credentials injected
  // Creates a LangGraph compatible tool with specific configurations that will
  // be passed in to the tool bubble
  static toolAgent(
    credentials?: Partial<Record<CredentialType, string>>,
    config?: Record<string, unknown>,
    context?: BubbleContext
  ): LangGraphTool {
    // In static context, 'this' refers to the constructor/class
    const ToolClass = this as typeof ToolBubble & {
      schema: z.ZodObject<any>;
      bubbleName: string;
      shortDescription: string;
    };
    const { schema, bubbleName, shortDescription } = ToolClass;

    if (!schema || !bubbleName || !shortDescription) {
      throw new Error(
        `${ToolClass.name} must define static schema, bubbleName, and shortDescription`
      );
    }

    // Remove credentials from schema for agent use
    // Remove config from schema for agent use
    let agentSchema: z.ZodObject<any> = schema;
    if (schema.shape?.credentials) {
      agentSchema = schema.omit({ credentials: true });
    }
    if (agentSchema.shape?.config) {
      agentSchema = agentSchema.omit({ config: true });
    }
    agentSchema = agentSchema.passthrough();

    return {
      name: bubbleName,
      description: shortDescription,
      schema: agentSchema,
      func: async (toolParams: unknown) => {
        // Create instance with credentials and config injected

        // Sometimes config should be dynamic and determined on each
        // tool invocation, rather than the start of agent run
        // In this case, we will replace the config (statically configured in the tool bubble)
        // with the runtime config

        const runtimeConfig = (toolParams as Record<string, unknown>)?.config;
        const enrichedParams = {
          ...(toolParams as Record<string, unknown>),
          credentials,
          config: runtimeConfig || config,
        };

        // 'this' in static context is the constructor
        const instance = new (ToolClass as any)(enrichedParams, context);
        // Use performAction directly to get raw result, not wrapped BubbleResult
        return instance.action();
      },
    };
  }
}
