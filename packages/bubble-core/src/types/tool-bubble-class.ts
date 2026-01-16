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

    // Remove credentials and config from schema for agent use
    // Handle both ZodObject and ZodDiscriminatedUnion schemas
    // For Gemini compatibility, convert discriminated unions to flat objects with enum
    let agentSchema: z.ZodSchema;

    if (schema instanceof z.ZodDiscriminatedUnion) {
      // For discriminated unions, convert to a flat object for Gemini compatibility
      // Discriminated unions produce "const" in JSON Schema which Gemini doesn't support
      const discriminator = schema.discriminator;
      const options = schema.options as z.ZodObject<z.ZodRawShape>[];

      // Collect all discriminator values and merge all fields
      const discriminatorValues: string[] = [];
      const mergedShape: z.ZodRawShape = {};
      const descriptions: Record<string, string> = {};

      for (const option of options) {
        const shape = option.shape;

        // Extract discriminator literal value
        const discriminatorField = shape[discriminator];
        if (discriminatorField instanceof z.ZodLiteral) {
          discriminatorValues.push(discriminatorField.value as string);
        }

        // Merge all other fields (make them optional since they're operation-specific)
        for (const [key, fieldSchema] of Object.entries(shape)) {
          if (
            key === discriminator ||
            key === 'credentials' ||
            key === 'config'
          )
            continue;
          if (!mergedShape[key]) {
            // Make the field optional since it's only required for certain operations
            const zodField = fieldSchema as z.ZodTypeAny;
            mergedShape[key] = zodField.isOptional()
              ? zodField
              : zodField.optional();
            // Preserve description if available
            if (zodField.description) {
              descriptions[key] = zodField.description;
            }
          }
        }
      }

      // Build the flat schema with enum for discriminator
      const flatShape: z.ZodRawShape = {
        [discriminator]: z
          .enum(discriminatorValues as [string, ...string[]])
          .describe(
            `Operation to perform. One of: ${discriminatorValues.join(', ')}`
          ),
        ...mergedShape,
      };

      agentSchema = z.object(flatShape).passthrough();
    } else {
      // For regular ZodObject schemas
      let objectSchema = schema as z.ZodObject<z.ZodRawShape>;
      if (objectSchema.shape?.credentials) {
        objectSchema = objectSchema.omit({ credentials: true });
      }
      if (objectSchema.shape?.config) {
        objectSchema = objectSchema.omit({ config: true });
      }
      agentSchema = objectSchema.passthrough();
    }

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
