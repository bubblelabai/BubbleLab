import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define the parameters schema
const ListAirtableTablesToolParamsSchema = z.object({
  baseId: z
    .string()
    .describe(
      'The Airtable base ID to list tables from (e.g., appXXXXXXXX). Use list-airtable-bases-tool to find available bases.'
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime). Requires AIRTABLE_OAUTH credential.'
    ),
});

// Type definitions
type ListAirtableTablesToolParamsInput = z.input<
  typeof ListAirtableTablesToolParamsSchema
>;
type ListAirtableTablesToolParams = z.output<
  typeof ListAirtableTablesToolParamsSchema
>;

// Result schema
const ListAirtableTablesToolResultSchema = z.object({
  baseId: z.string().optional().describe('The base ID that was queried'),
  baseName: z.string().optional().describe('The name of the base'),
  tables: z
    .array(
      z.object({
        id: z.string().describe('The Airtable table ID (e.g., tblXXXXXXXX)'),
        name: z.string().describe('The name of the table'),
        description: z
          .string()
          .optional()
          .describe('The description of the table'),
        fields: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
            })
          )
          .optional()
          .describe('List of fields in the table'),
      })
    )
    .optional()
    .describe('List of tables in the Airtable base'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type ListAirtableTablesToolResult = z.output<
  typeof ListAirtableTablesToolResultSchema
>;

/**
 * Tool to list tables in an Airtable base.
 * Used by AI to help users configure Airtable triggers for specific tables.
 */
export class ListAirtableTablesTool extends ToolBubble<
  ListAirtableTablesToolParams,
  ListAirtableTablesToolResult
> {
  static readonly type = 'tool' as const;
  static readonly bubbleName = 'list-airtable-tables-tool';
  static readonly schema = ListAirtableTablesToolParamsSchema;
  static readonly resultSchema = ListAirtableTablesToolResultSchema;
  static readonly shortDescription =
    'Lists tables in an Airtable base for trigger configuration';
  static readonly longDescription = `
    A tool that retrieves all tables in a specific Airtable base.

    Use this tool when:
    - User wants to set up an Airtable trigger for a specific table
    - User mentions a table name and you need to find its ID
    - You need to show the user what tables are available in their base

    Returns:
    - List of tables with their IDs, names, descriptions, and field information

    Requires:
    - AIRTABLE_OAUTH credential to be connected
    - A valid baseId (use list-airtable-bases-tool first)
  `;
  static readonly alias = 'airtable-tables';

  constructor(
    params: ListAirtableTablesToolParamsInput,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(
    context?: BubbleContext
  ): Promise<ListAirtableTablesToolResult> {
    void context;

    const { baseId, credentials } = this.params;

    if (!baseId) {
      return {
        success: false,
        error:
          'baseId is required. Use list-airtable-bases-tool to find available bases.',
      };
    }

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
      const response = await fetch(
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
        {
          headers: {
            Authorization: `Bearer ${airtableToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to fetch Airtable tables: ${response.status} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        tables: Array<{
          id: string;
          name: string;
          description?: string;
          primaryFieldId: string;
          fields: Array<{
            id: string;
            name: string;
            type: string;
            description?: string;
          }>;
        }>;
      };

      return {
        baseId,
        tables: data.tables.map((table) => ({
          id: table.id,
          name: table.name,
          description: table.description,
          fields: table.fields.map((field) => ({
            id: field.id,
            name: field.name,
            type: field.type,
          })),
        })),
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        success: false,
        error: `Error fetching Airtable tables: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
