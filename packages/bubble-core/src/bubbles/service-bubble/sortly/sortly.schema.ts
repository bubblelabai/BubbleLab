import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// DATA SCHEMAS - Sortly API Response Types
// ============================================================================

export const SortlyItemSchema = z
  .object({
    id: z.number().describe('Item identifier'),
    name: z.string().describe('Item name'),
    notes: z.string().optional().nullable().describe('Item notes'),
    price: z.string().optional().nullable().describe('Item price'),
    quantity: z.number().optional().nullable().describe('Current quantity'),
    min_quantity: z
      .number()
      .optional()
      .nullable()
      .describe('Minimum quantity threshold for alerts'),
    type: z
      .enum(['item', 'folder'])
      .describe('"item" for inventory items, "folder" for folders'),
    parent_id: z
      .number()
      .optional()
      .nullable()
      .describe('Parent folder ID (null for root items)'),
    sid: z.string().optional().nullable().describe('Custom identifier / SKU'),
    tag_names: z
      .array(z.string())
      .optional()
      .nullable()
      .describe('Tag names associated with this item'),
    photos: z
      .array(
        z.object({
          id: z.number().describe('Photo ID'),
          url: z.string().describe('Photo URL'),
        })
      )
      .optional()
      .nullable()
      .describe('Item photos'),
    custom_attribute_values: z
      .array(
        z.object({
          id: z.number().describe('Attribute value ID'),
          custom_field_id: z.number().describe('Custom field ID'),
          value: z.unknown().describe('Attribute value'),
        })
      )
      .optional()
      .nullable()
      .describe('Custom field values'),
    created_at: z.string().optional().nullable().describe('Creation timestamp'),
    updated_at: z
      .string()
      .optional()
      .nullable()
      .describe('Last update timestamp'),
  })
  .describe('Sortly inventory item or folder');

export const SortlyCustomFieldSchema = z
  .object({
    id: z.number().describe('Custom field identifier'),
    name: z.string().describe('Field name'),
    type: z.string().describe('Field type (text, number, date, etc.)'),
  })
  .describe('Sortly custom field definition');

// ============================================================================
// SHARED FIELDS
// ============================================================================

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

// ============================================================================
// PARAMETER SCHEMAS - Discriminated Union for Multiple Operations
// ============================================================================

export const SortlyParamsSchema = z.discriminatedUnion('operation', [
  // List items
  z.object({
    operation: z
      .literal('list_items')
      .describe(
        'List inventory items with optional folder and pagination filters'
      ),
    folder_id: z
      .number()
      .optional()
      .describe('Filter by parent folder ID (omit for root items)'),
    page: z.number().optional().default(1).describe('Page number (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Items per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // Get a single item
  z.object({
    operation: z
      .literal('get_item')
      .describe('Get a specific item or folder by ID'),
    item_id: z.number().describe('The ID of the item to retrieve'),
    credentials: credentialsField,
  }),

  // Create an item
  z.object({
    operation: z
      .literal('create_item')
      .describe('Create a new inventory item or folder'),
    name: z.string().min(1).describe('Item name'),
    type: z
      .enum(['item', 'folder'])
      .optional()
      .default('item')
      .describe('Type: "item" for inventory item, "folder" for folder'),
    notes: z.string().optional().describe('Item notes or description'),
    price: z.string().optional().describe('Item price as string'),
    quantity: z.number().optional().describe('Initial quantity'),
    min_quantity: z
      .number()
      .optional()
      .describe('Minimum quantity threshold for alerts'),
    parent_id: z
      .number()
      .optional()
      .describe('Parent folder ID (omit for root level)'),
    sid: z.string().optional().describe('Custom identifier / SKU'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Tag names to assign to the item'),
    credentials: credentialsField,
  }),

  // Update an item
  z.object({
    operation: z
      .literal('update_item')
      .describe('Update an existing item or folder'),
    item_id: z.number().describe('The ID of the item to update'),
    name: z.string().optional().describe('Updated item name'),
    notes: z.string().optional().describe('Updated notes'),
    price: z.string().optional().describe('Updated price'),
    quantity: z.number().optional().describe('Updated quantity'),
    min_quantity: z
      .number()
      .optional()
      .describe('Updated minimum quantity threshold'),
    sid: z.string().optional().describe('Updated custom identifier / SKU'),
    tags: z.array(z.string()).optional().describe('Updated tag names'),
    credentials: credentialsField,
  }),

  // Delete an item
  z.object({
    operation: z
      .literal('delete_item')
      .describe('Delete an item or folder by ID'),
    item_id: z.number().describe('The ID of the item to delete'),
    credentials: credentialsField,
  }),

  // Search items
  z.object({
    operation: z
      .literal('search_items')
      .describe('Search items by name and optional filters'),
    name: z.string().min(1).describe('Search query to match item names'),
    type: z
      .enum(['item', 'folder'])
      .optional()
      .describe('Filter by type: "item" or "folder"'),
    page: z.number().optional().default(1).describe('Page number (default 1)'),
    per_page: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Items per page (1-100, default 25)'),
    credentials: credentialsField,
  }),

  // Move an item
  z.object({
    operation: z
      .literal('move_item')
      .describe('Move an item to a different folder'),
    item_id: z.number().describe('The ID of the item to move'),
    folder_id: z
      .number()
      .optional()
      .nullable()
      .describe('Target folder ID (null or omit to move to root)'),
    quantity: z.number().describe('Quantity to move'),
    credentials: credentialsField,
  }),

  // List custom fields
  z.object({
    operation: z
      .literal('list_custom_fields')
      .describe('List all custom field definitions'),
    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMAS - Discriminated Union for Operation Results
// ============================================================================

export const SortlyResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('list_items'),
    success: z.boolean(),
    items: z.array(SortlyItemSchema).optional(),
    page: z.number().optional(),
    per_page: z.number().optional(),
    total: z.number().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_item'),
    success: z.boolean(),
    item: SortlyItemSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_item'),
    success: z.boolean(),
    item: SortlyItemSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_item'),
    success: z.boolean(),
    item: SortlyItemSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_item'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('search_items'),
    success: z.boolean(),
    items: z.array(SortlyItemSchema).optional(),
    page: z.number().optional(),
    per_page: z.number().optional(),
    total: z.number().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('move_item'),
    success: z.boolean(),
    item: SortlyItemSchema.optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_custom_fields'),
    success: z.boolean(),
    custom_fields: z.array(SortlyCustomFieldSchema).optional(),
    error: z.string(),
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SortlyParamsInput = z.input<typeof SortlyParamsSchema>;
export type SortlyParams = z.output<typeof SortlyParamsSchema>;
export type SortlyResult = z.output<typeof SortlyResultSchema>;

export type SortlyItem = z.output<typeof SortlyItemSchema>;
export type SortlyCustomField = z.output<typeof SortlyCustomFieldSchema>;

export type SortlyListItemsParams = Extract<
  SortlyParams,
  { operation: 'list_items' }
>;
export type SortlyGetItemParams = Extract<
  SortlyParams,
  { operation: 'get_item' }
>;
export type SortlyCreateItemParams = Extract<
  SortlyParams,
  { operation: 'create_item' }
>;
export type SortlyUpdateItemParams = Extract<
  SortlyParams,
  { operation: 'update_item' }
>;
export type SortlyDeleteItemParams = Extract<
  SortlyParams,
  { operation: 'delete_item' }
>;
export type SortlySearchItemsParams = Extract<
  SortlyParams,
  { operation: 'search_items' }
>;
export type SortlyMoveItemParams = Extract<
  SortlyParams,
  { operation: 'move_item' }
>;
