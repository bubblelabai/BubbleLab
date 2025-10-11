import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { BubbleFactory } from '../../bubble-factory.js';

// Define the parameters schema
const ListBubblesToolParamsSchema = z.object({});

// Type definitions
type ListBubblesToolParamsInput = z.input<typeof ListBubblesToolParamsSchema>;
type ListBubblesToolParams = z.output<typeof ListBubblesToolParamsSchema>;
type ListBubblesToolResult = z.output<typeof ListBubblesToolResultSchema>;

// Result schema for validation
const ListBubblesToolResultSchema = z.object({
  bubbles: z
    .array(
      z.object({
        name: z.string().describe('Name of the bubble'),
        alias: z.string().optional().describe('Short alias for the bubble'),
        shortDescription: z
          .string()
          .describe('Brief description of the bubble functionality'),
        useCase: z.string().describe('Primary use cases for the bubble'),
        type: z.string().describe('Type of bubble (service, workflow, tool)'),
      })
    )
    .describe('Array of bubble information objects'),
  totalCount: z.number().describe('Total number of bubbles in the registry'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

export class ListBubblesTool extends ToolBubble<
  ListBubblesToolParams,
  ListBubblesToolResult
> {
  // Required static metadata
  static readonly bubbleName = 'list-bubbles-tool';
  static readonly schema = ListBubblesToolParamsSchema;
  static readonly resultSchema = ListBubblesToolResultSchema;
  static readonly shortDescription =
    'Lists all available bubbles in the registry';
  static readonly longDescription = `
    A tool bubble that provides a comprehensive list of all registered bubbles in the NodeX system.
    
    Returns information about each bubble including:
    - Bubble name and alias
    - Short description
    - Extracted use cases
    - Bubble type (service, workflow, tool)
    
    Use cases:
    - AI agent discovery of available capabilities
    - System introspection and documentation
    - Dynamic tool selection for workflow building
  `;
  static readonly alias = 'list';
  static readonly type = 'tool';
  constructor(
    params: ListBubblesToolParamsInput = {},
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(context?: BubbleContext): Promise<ListBubblesToolResult> {
    void context; // Context available but not currently used
    const factory = new BubbleFactory();
    await factory.registerDefaults();
    const allMetadata = factory.getAllMetadata();
    // Filter out any metadata that is undefined
    const filteredMetadata = allMetadata.filter(
      (metadata): metadata is NonNullable<typeof metadata> =>
        metadata !== undefined
    );

    const bubbles = filteredMetadata.map((metadata) => ({
      name: metadata.name,
      alias: metadata.alias,
      shortDescription: metadata.shortDescription,
      useCase: this.extractUseCaseFromDescription(metadata.longDescription),
      type: metadata.type,
    }));

    return {
      bubbles,
      totalCount: bubbles.length,
      success: true,
      error: '',
    };
  }

  private extractUseCaseFromDescription(longDescription: string): string {
    // Extract use cases from long description
    const useCaseMatch = longDescription.match(
      /Use cases?:\s*\n?(.*?)(?:\n\n|\n\s*-|\n\s*\*|$)/s
    );
    if (useCaseMatch) {
      return useCaseMatch[1]
        .trim()
        .replace(/\n\s*-\s*/g, ', ')
        .replace(/\n/g, ' ');
    }

    // Fallback to short description if no use cases found
    return 'General purpose bubble for various workflow needs';
  }
}
