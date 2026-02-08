import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { getAllCapabilityMetadata } from '../../capabilities/index.js';

// Define the parameters schema (no params needed)
const ListCapabilitiesToolParamsSchema = z.object({});

// Type definitions
type ListCapabilitiesToolParamsInput = z.input<
  typeof ListCapabilitiesToolParamsSchema
>;
type ListCapabilitiesToolParams = z.output<
  typeof ListCapabilitiesToolParamsSchema
>;
type ListCapabilitiesToolResult = z.output<
  typeof ListCapabilitiesToolResultSchema
>;

// Result schema for validation
const ListCapabilitiesToolResultSchema = z.object({
  capabilities: z
    .array(
      z.object({
        id: z.string().describe('Unique identifier for the capability'),
        name: z.string().describe('Display name of the capability'),
        description: z.string().describe('What the capability does'),
        category: z
          .string()
          .optional()
          .describe('Category grouping (e.g., knowledge, data)'),
        requiredCredentials: z
          .array(z.string())
          .describe('Credential types that must be provided'),
        optionalCredentials: z
          .array(z.string())
          .optional()
          .describe('Credential types that can optionally be provided'),
        inputs: z
          .array(
            z.object({
              name: z.string(),
              description: z.string(),
            })
          )
          .describe('User-configurable input parameters'),
        tools: z
          .array(
            z.object({
              name: z.string(),
              description: z.string(),
            })
          )
          .describe('Tools provided by this capability'),
        delegationHint: z
          .string()
          .optional()
          .describe('Guidance on when to use this capability'),
      })
    )
    .describe('Array of capability summary objects'),
  totalCount: z.number().describe('Total number of registered capabilities'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

export class ListCapabilitiesTool extends ToolBubble<
  ListCapabilitiesToolParams,
  ListCapabilitiesToolResult
> {
  // Required static metadata
  static readonly bubbleName = 'list-capabilities-tool';
  static readonly schema = ListCapabilitiesToolParamsSchema;
  static readonly resultSchema = ListCapabilitiesToolResultSchema;
  static readonly shortDescription =
    'Lists all available capabilities that can be attached to AI agents';
  static readonly longDescription = `
    A tool that lists all registered capabilities — pre-built skill packs for AIAgentBubble.

    Capabilities bundle tools, system prompts, credential requirements, and user inputs
    into a declarative config that can be attached to AI agents.

    Returns information about each capability including:
    - ID, name, description, and category
    - Required and optional credentials
    - User-configurable inputs
    - Tools provided by the capability
    - Delegation hint for when to use

    Use cases:
    - Discovering available capabilities before building AI agent workflows
    - Checking if a pre-built capability exists instead of manually wiring tools
    - Understanding what credentials and inputs a capability needs
  `;
  static readonly alias = 'list-caps';
  static readonly type = 'tool';

  constructor(
    params: ListCapabilitiesToolParamsInput = {},
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(
    context?: BubbleContext
  ): Promise<ListCapabilitiesToolResult> {
    void context;

    const allMetadata = getAllCapabilityMetadata();

    const capabilities = allMetadata
      .filter((meta) => !meta.hidden)
      .map((meta) => ({
        id: meta.id,
        name: meta.name,
        description: meta.description,
        category: meta.category,
        requiredCredentials: meta.requiredCredentials,
        optionalCredentials: meta.optionalCredentials,
        inputs: meta.inputs.map((input) => ({
          name: input.name,
          description: input.description,
        })),
        tools: meta.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
        delegationHint: meta.delegationHint,
      }));

    return {
      capabilities,
      totalCount: capabilities.length,
      success: true,
      error: '',
    };
  }
}
