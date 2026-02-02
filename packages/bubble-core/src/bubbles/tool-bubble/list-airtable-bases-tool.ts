import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define the parameters schema
const ListAirtableBasesToolParamsSchema = z.object({
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime). Requires AIRTABLE_OAUTH credential.'
    ),
});

// Type definitions
type ListAirtableBasesToolParamsInput = z.input<
  typeof ListAirtableBasesToolParamsSchema
>;
type ListAirtableBasesToolParams = z.output<
  typeof ListAirtableBasesToolParamsSchema
>;

// Result schema
const ListAirtableBasesToolResultSchema = z.object({
  bases: z
    .array(
      z.object({
        id: z.string().describe('The Airtable base ID (e.g., appXXXXXXXX)'),
        name: z.string().describe('The name of the base'),
        permissionLevel: z
          .string()
          .describe(
            'User permission level (none, read, comment, edit, create)'
          ),
      })
    )
    .optional()
    .describe('List of Airtable bases the user has access to'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type ListAirtableBasesToolResult = z.output<
  typeof ListAirtableBasesToolResultSchema
>;

/**
 * Tool to list Airtable bases accessible by the user.
 * Used by AI to help users configure Airtable triggers.
 */
export class ListAirtableBasesTool extends ToolBubble<
  ListAirtableBasesToolParams,
  ListAirtableBasesToolResult
> {
  static readonly type = 'tool' as const;
  static readonly bubbleName = 'list-airtable-bases-tool';
  static readonly schema = ListAirtableBasesToolParamsSchema;
  static readonly resultSchema = ListAirtableBasesToolResultSchema;
  static readonly shortDescription =
    'Lists Airtable bases accessible by the user for trigger configuration';
  static readonly longDescription = `
    A tool that retrieves all Airtable bases the user has access to.

    Use this tool when:
    - User wants to set up an Airtable trigger (record created/updated/deleted)
    - You need to find which base contains a specific table
    - User mentions an Airtable base by name and you need to find its ID

    Returns:
    - List of bases with their IDs, names, and permission levels

    Requires: AIRTABLE_OAUTH credential to be connected.
  `;
  static readonly alias = 'airtable-bases';

  constructor(
    params: ListAirtableBasesToolParamsInput,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(
    context?: BubbleContext
  ): Promise<ListAirtableBasesToolResult> {
    void context;

    const { credentials } = this.params;

    // Get Airtable OAuth token
    const airtableToken = credentials?.[CredentialType.AIRTABLE_OAUTH];

    if (!airtableToken) {
      return {
        success: false,
        error:
          'Airtable OAuth credential not found. Please connect your Airtable account first.',
      };
    }

    try {
      const response = await fetch('https://api.airtable.com/v0/meta/bases', {
        headers: {
          Authorization: `Bearer ${airtableToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to fetch Airtable bases: ${response.status} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        bases: Array<{
          id: string;
          name: string;
          permissionLevel: string;
        }>;
      };

      return {
        bases: data.bases.map((base) => ({
          id: base.id,
          name: base.name,
          permissionLevel: base.permissionLevel,
        })),
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching Airtable bases: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
