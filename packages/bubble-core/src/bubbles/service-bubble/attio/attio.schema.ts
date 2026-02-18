import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const AttioRecordValueSchema = z
  .record(z.string(), z.unknown())
  .describe(
    'Attribute values keyed by API slug. All values are arrays. ' +
      'People name: [{ first_name, last_name }] (full_name auto-generated if omitted). ' +
      'Company name: [{ value: "Name" }]. ' +
      'Email: [{ email_address: "x@y.com" }]. ' +
      'Text: ["value"]. '
  );

// ============================================================================
// PARAMETER SCHEMAS (Discriminated Union)
// ============================================================================

export const AttioParamsSchema = z.discriminatedUnion('operation', [
  // --- Records ---
  z.object({
    operation: z
      .literal('list_records')
      .describe('List records for a given object type with optional filtering'),
    object: z
      .string()
      .min(1)
      .describe(
        'Object slug or ID (e.g. "people", "companies", or a custom object slug)'
      ),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .default(25)
      .describe('Maximum number of records to return (1-500)'),
    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of records to skip for pagination'),
    sorts: z
      .array(
        z.object({
          attribute: z.string().describe('Attribute slug to sort by'),
          direction: z
            .enum(['asc', 'desc'])
            .optional()
            .default('asc')
            .describe('Sort direction'),
        })
      )
      .optional()
      .describe('Sort configuration for results'),
    filter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Filter object following Attio filter syntax (see Attio API docs)'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('get_record').describe('Get a single record by ID'),
    object: z
      .string()
      .min(1)
      .describe('Object slug or ID (e.g. "people", "companies")'),
    record_id: z.string().min(1).describe('The UUID of the record to retrieve'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_record')
      .describe('Create a new record in a given object type'),
    object: z
      .string()
      .min(1)
      .describe('Object slug or ID (e.g. "people", "companies")'),
    values: AttioRecordValueSchema.describe(
      'Attribute values for the new record (keyed by API slug)'
    ),
    matching_attribute: z
      .string()
      .optional()
      .describe(
        'Attribute slug for upsert matching (if set, acts as assert/upsert)'
      ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('update_record')
      .describe('Update an existing record by ID'),
    object: z
      .string()
      .min(1)
      .describe('Object slug or ID (e.g. "people", "companies")'),
    record_id: z.string().min(1).describe('The UUID of the record to update'),
    values: AttioRecordValueSchema.describe(
      'Attribute values to update (keyed by API slug)'
    ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('delete_record').describe('Delete a record by ID'),
    object: z
      .string()
      .min(1)
      .describe('Object slug or ID (e.g. "people", "companies")'),
    record_id: z.string().min(1).describe('The UUID of the record to delete'),
    credentials: credentialsField,
  }),

  // --- Notes ---
  z.object({
    operation: z
      .literal('create_note')
      .describe('Create a note linked to a record'),
    parent_object: z
      .string()
      .min(1)
      .describe(
        'Object slug the note is linked to (e.g. "people", "companies")'
      ),
    parent_record_id: z
      .string()
      .min(1)
      .describe('UUID of the record to attach the note to'),
    title: z.string().min(1).describe('Title of the note'),
    content: z.string().min(1).describe('Plain text content of the note'),
    format: z
      .enum(['plaintext'])
      .optional()
      .default('plaintext')
      .describe('Content format'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_notes')
      .describe('List notes, optionally filtered by parent record'),
    parent_object: z
      .string()
      .optional()
      .describe('Filter by object slug (e.g. "people")'),
    parent_record_id: z
      .string()
      .optional()
      .describe('Filter by parent record UUID'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Maximum number of notes to return'),
    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of notes to skip for pagination'),
    credentials: credentialsField,
  }),

  // --- Tasks ---
  z.object({
    operation: z.literal('create_task').describe('Create a new task in Attio'),
    content: z
      .string()
      .min(1)
      .max(2000)
      .describe('Plain text content of the task'),
    deadline_at: z
      .string()
      .optional()
      .describe('Deadline in ISO 8601 format (e.g. "2025-12-31T23:59:59Z")'),
    is_completed: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether the task starts as completed'),
    linked_records: z
      .array(
        z.object({
          target_object: z
            .string()
            .describe('Object slug (e.g. "people", "companies")'),
          target_record_id: z.string().describe('UUID of the record to link'),
        })
      )
      .optional()
      .describe('Records to link this task to'),
    assignees: z
      .array(
        z.object({
          referenced_actor_type: z
            .enum(['workspace-member'])
            .describe('Type of actor'),
          referenced_actor_id: z
            .string()
            .describe('UUID of the workspace member'),
        })
      )
      .optional()
      .describe('Workspace members to assign this task to'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_tasks')
      .describe('List tasks with optional filtering'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Maximum number of tasks to return'),
    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of tasks to skip for pagination'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('update_task').describe('Update an existing task'),
    task_id: z.string().min(1).describe('UUID of the task to update'),
    content: z.string().max(2000).optional().describe('Updated task content'),
    deadline_at: z
      .string()
      .optional()
      .describe('Updated deadline in ISO 8601 format'),
    is_completed: z.boolean().optional().describe('Updated completion status'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('delete_task').describe('Delete a task by ID'),
    task_id: z.string().min(1).describe('UUID of the task to delete'),
    credentials: credentialsField,
  }),

  // --- Lists & Entries ---
  z.object({
    operation: z
      .literal('list_lists')
      .describe('List all lists (pipelines) in the workspace'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Maximum number of lists to return'),
    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of lists to skip for pagination'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_entry')
      .describe('Add a record to a list (create a list entry)'),
    list: z.string().min(1).describe('List UUID or slug'),
    parent_object: z
      .string()
      .min(1)
      .describe('Object slug of the record being added (e.g. "companies")'),
    parent_record_id: z
      .string()
      .min(1)
      .describe('UUID of the record to add to the list'),
    entry_values: z
      .record(z.string(), z.unknown())
      .optional()
      .default({})
      .describe('Attribute values for the list entry (keyed by API slug)'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('list_entries').describe('List entries in a list'),
    list: z.string().min(1).describe('List UUID or slug'),
    limit: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .default(25)
      .describe('Maximum number of entries to return'),
    offset: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of entries to skip for pagination'),
    filter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Filter object following Attio filter syntax'),
    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMAS (Discriminated Union)
// ============================================================================

export const AttioResultSchema = z.discriminatedUnion('operation', [
  // Records results — use `records`/`record` instead of `data` to avoid
  // collision with BubbleResult.data (which wraps the entire result).
  // Access pattern: result.data.records / result.data.record
  z.object({
    operation: z.literal('list_records'),
    records: z.array(z.record(z.string(), z.unknown())).optional(),
    next_page_offset: z.number().optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_record'),
    record: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_record'),
    record: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_record'),
    record: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_record'),
    success: z.boolean(),
    error: z.string(),
  }),

  // Notes results
  z.object({
    operation: z.literal('create_note'),
    note: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_notes'),
    notes: z.array(z.record(z.string(), z.unknown())).optional(),
    success: z.boolean(),
    error: z.string(),
  }),

  // Tasks results
  z.object({
    operation: z.literal('create_task'),
    task: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_tasks'),
    tasks: z.array(z.record(z.string(), z.unknown())).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_task'),
    task: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_task'),
    success: z.boolean(),
    error: z.string(),
  }),

  // Lists & Entries results
  z.object({
    operation: z.literal('list_lists'),
    lists: z.array(z.record(z.string(), z.unknown())).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_entry'),
    entry: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_entries'),
    entries: z.array(z.record(z.string(), z.unknown())).optional(),
    next_page_offset: z.number().optional(),
    success: z.boolean(),
    error: z.string(),
  }),
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AttioParamsInput = z.input<typeof AttioParamsSchema>;
export type AttioParams = z.output<typeof AttioParamsSchema>;
export type AttioResult = z.output<typeof AttioResultSchema>;
