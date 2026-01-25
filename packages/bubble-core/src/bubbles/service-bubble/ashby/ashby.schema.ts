import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// DATA SCHEMAS - Ashby API Response Types
// ============================================================================

/**
 * Email address object from Ashby API
 */
export const AshbyEmailSchema = z
  .object({
    value: z.string().describe('Email address value'),
    type: z.enum(['Personal', 'Work', 'Other']).describe('Type of email'),
    isPrimary: z.boolean().describe('Whether this is the primary email'),
  })
  .describe('Email address information');

/**
 * Phone number object from Ashby API
 */
export const AshbyPhoneSchema = z
  .object({
    value: z.string().describe('Phone number value'),
    type: z.enum(['Personal', 'Work', 'Other']).describe('Type of phone'),
    isPrimary: z.boolean().describe('Whether this is the primary phone'),
  })
  .describe('Phone number information');

/**
 * Custom field object from Ashby API
 */
export const AshbyCustomFieldSchema = z
  .object({
    id: z.string().describe('Custom field ID'),
    title: z.string().describe('Custom field title'),
    value: z.unknown().describe('Custom field value'),
    isPrivate: z.boolean().optional().describe('Whether the field is private'),
  })
  .describe('Custom field information');

/**
 * Candidate object from Ashby API
 */
export const AshbyCandidateSchema = z
  .object({
    id: z.string().describe('Unique candidate identifier (UUID)'),
    createdAt: z.string().optional().describe('ISO 8601 creation timestamp'),
    updatedAt: z.string().optional().describe('ISO 8601 update timestamp'),
    name: z.string().describe('Full name of the candidate'),
    primaryEmailAddress: AshbyEmailSchema.optional()
      .nullable()
      .describe('Primary email address'),
    primaryPhoneNumber: AshbyPhoneSchema.optional()
      .nullable()
      .describe('Primary phone number'),
    customFields: z
      .array(AshbyCustomFieldSchema)
      .optional()
      .describe('Custom field values'),
  })
  .describe('Ashby candidate record');

/**
 * Social link object from Ashby API
 */
export const AshbySocialLinkSchema = z
  .object({
    url: z.string().describe('Social link URL'),
    type: z.string().describe('Type of social link (e.g., LinkedIn, GitHub)'),
  })
  .describe('Social link information');

/**
 * Tag object from Ashby API
 */
export const AshbyTagSchema = z
  .object({
    id: z.string().describe('Tag ID'),
    title: z.string().describe('Tag title'),
    isArchived: z.boolean().optional().describe('Whether the tag is archived'),
  })
  .describe('Tag information');

/**
 * File handle object from Ashby API
 */
export const AshbyFileHandleSchema = z
  .object({
    id: z.string().describe('File ID'),
    name: z.string().describe('File name'),
    handle: z.string().describe('File handle for download'),
  })
  .describe('File handle information');

/**
 * Selectable value for custom field from Ashby API
 */
export const AshbySelectableValueSchema = z
  .object({
    label: z.string().describe('Display label for the value'),
    value: z.string().describe('Value identifier'),
    isArchived: z.boolean().describe('Whether the value is archived'),
  })
  .describe('Selectable value for custom field');

/**
 * Custom field definition from Ashby API (from customField.list endpoint)
 */
export const AshbyCustomFieldDefinitionSchema = z
  .object({
    id: z.string().describe('Custom field ID (UUID)'),
    isPrivate: z.boolean().describe('Whether the field is private'),
    title: z.string().describe('Custom field title'),
    objectType: z
      .string()
      .describe(
        'Object type this field applies to (e.g., Application, Candidate)'
      ),
    isArchived: z.boolean().describe('Whether the field is archived'),
    fieldType: z
      .string()
      .describe('Type of field (e.g., MultiValueSelect, String, Number)'),
    selectableValues: z
      .array(AshbySelectableValueSchema)
      .optional()
      .describe('Available values for select-type fields'),
  })
  .describe('Custom field definition');

/**
 * Candidate list item from Ashby API (from candidate.list endpoint)
 */
export const AshbyCandidateListItemSchema = z
  .object({
    id: z.string().describe('Unique candidate identifier (UUID)'),
    createdAt: z.string().optional().describe('ISO 8601 creation timestamp'),
    updatedAt: z.string().optional().describe('ISO 8601 update timestamp'),
    name: z.string().describe('Full name of the candidate'),
    primaryEmailAddress: AshbyEmailSchema.optional()
      .nullable()
      .describe('Primary email address'),
    emailAddresses: z
      .array(AshbyEmailSchema)
      .optional()
      .describe('All email addresses'),
    primaryPhoneNumber: AshbyPhoneSchema.optional()
      .nullable()
      .describe('Primary phone number'),
    phoneNumbers: z
      .array(AshbyPhoneSchema)
      .optional()
      .describe('All phone numbers'),
    socialLinks: z
      .array(AshbySocialLinkSchema)
      .optional()
      .describe('Social media links'),
    tags: z
      .array(AshbyTagSchema)
      .optional()
      .describe('Tags assigned to candidate'),
    position: z.string().optional().nullable().describe('Current position'),
    company: z.string().optional().nullable().describe('Current company'),
    school: z.string().optional().nullable().describe('School'),
    applicationIds: z
      .array(z.string())
      .optional()
      .describe('IDs of applications for this candidate'),
    resumeFileHandle: AshbyFileHandleSchema.optional()
      .nullable()
      .describe('Resume file handle'),
    fileHandles: z
      .array(AshbyFileHandleSchema)
      .optional()
      .describe('All file handles'),
    customFields: z
      .array(AshbyCustomFieldSchema)
      .optional()
      .describe('Custom field values'),
  })
  .describe('Ashby candidate list item');

// ============================================================================
// PARAMETER SCHEMAS - Discriminated Union for Multiple Operations
// ============================================================================

export const AshbyParamsSchema = z.discriminatedUnion('operation', [
  // List candidates operation
  z.object({
    operation: z
      .literal('list_candidates')
      .describe('List all candidates with optional filtering'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Maximum number of candidates to return (1-100)'),
    cursor: z
      .string()
      .optional()
      .describe('Pagination cursor for fetching subsequent pages'),
    status: z
      .enum(['Hired', 'Archived', 'Active', 'Lead'])
      .optional()
      .describe('Filter candidates by application status'),
    job_id: z
      .string()
      .optional()
      .describe('Filter candidates by specific job ID'),
    created_after: z
      .number()
      .optional()
      .describe(
        'Unix timestamp in milliseconds to filter candidates created after this time'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get candidate info operation
  z.object({
    operation: z
      .literal('get_candidate')
      .describe('Get detailed information about a specific candidate'),
    candidate_id: z
      .string()
      .min(1, 'Candidate ID is required')
      .describe('UUID of the candidate to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create candidate operation
  z.object({
    operation: z.literal('create_candidate').describe('Create a new candidate'),
    name: z
      .string()
      .min(1, 'Name is required')
      .describe("Candidate's full name (first and last name)"),
    email: z
      .string()
      .email()
      .optional()
      .describe("Candidate's primary email address"),
    phone_number: z
      .string()
      .optional()
      .describe("Candidate's primary phone number"),
    linkedin_url: z
      .string()
      .url()
      .optional()
      .describe("URL to the candidate's LinkedIn profile"),
    github_url: z
      .string()
      .url()
      .optional()
      .describe("URL to the candidate's GitHub profile"),
    website: z
      .string()
      .url()
      .optional()
      .describe("URL of the candidate's website"),
    source_id: z
      .string()
      .uuid()
      .optional()
      .describe('The source ID to set on the candidate'),
    credited_to_user_id: z
      .string()
      .uuid()
      .optional()
      .describe('The ID of the user the candidate will be credited to'),
    tag: z
      .string()
      .optional()
      .describe(
        'Optional tag to add to the candidate. Can be a tag ID (UUID) or tag name. If a name is provided, the tag will be created first.'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Search candidates operation
  z.object({
    operation: z
      .literal('search_candidates')
      .describe('Search for candidates by email or name'),
    email: z.string().optional().describe('Search by candidate email address'),
    name: z.string().optional().describe('Search by candidate name'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Add tag to candidate operation
  z.object({
    operation: z.literal('add_tag').describe('Add a tag to a candidate'),
    candidate_id: z
      .string()
      .min(1, 'Candidate ID is required')
      .describe('UUID of the candidate'),
    tag_id: z
      .string()
      .min(1, 'Tag ID is required')
      .describe('UUID of the tag to add'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List tags operation
  z.object({
    operation: z.literal('list_tags').describe('List all candidate tags'),
    include_archived: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether to include archived tags'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create tag operation
  z.object({
    operation: z.literal('create_tag').describe('Create a new candidate tag'),
    title: z
      .string()
      .min(1, 'Tag title is required')
      .describe('Title of the tag to create'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List custom fields operation
  z.object({
    operation: z
      .literal('list_custom_fields')
      .describe('List all custom field definitions'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(100)
      .describe('Maximum number of custom fields to return (1-100)'),
    cursor: z
      .string()
      .optional()
      .describe('Pagination cursor for fetching subsequent pages'),
    sync_token: z
      .string()
      .optional()
      .describe('Token for incremental synchronization'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// ============================================================================
// RESULT SCHEMAS - Discriminated Union for Operation Results
// ============================================================================

export const AshbyResultSchema = z.discriminatedUnion('operation', [
  // List candidates result
  z.object({
    operation: z
      .literal('list_candidates')
      .describe('List candidates operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    candidates: z
      .array(AshbyCandidateListItemSchema)
      .optional()
      .describe('List of candidates'),
    next_cursor: z
      .string()
      .optional()
      .describe('Cursor for fetching the next page of results'),
    more_data_available: z
      .boolean()
      .optional()
      .describe('Whether more data is available'),
    sync_token: z.string().optional().describe('Token for incremental sync'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get candidate result
  z.object({
    operation: z.literal('get_candidate').describe('Get candidate operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    candidate: AshbyCandidateSchema.optional().describe('Candidate details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create candidate result
  z.object({
    operation: z
      .literal('create_candidate')
      .describe('Create candidate operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    candidate: AshbyCandidateSchema.optional().describe(
      'Created candidate details'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Search candidates result
  z.object({
    operation: z
      .literal('search_candidates')
      .describe('Search candidates operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    candidates: z
      .array(AshbyCandidateSchema)
      .optional()
      .describe('List of matching candidates'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Add tag result
  z.object({
    operation: z.literal('add_tag').describe('Add tag operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    candidate: AshbyCandidateSchema.optional().describe(
      'Updated candidate details'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List tags result
  z.object({
    operation: z.literal('list_tags').describe('List tags operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    tags: z.array(AshbyTagSchema).optional().describe('List of candidate tags'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Create tag result
  z.object({
    operation: z.literal('create_tag').describe('Create tag operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    tag: AshbyTagSchema.optional().describe('Created tag details'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // List custom fields result
  z.object({
    operation: z
      .literal('list_custom_fields')
      .describe('List custom fields operation'),
    success: z.boolean().describe('Whether the operation was successful'),
    custom_fields: z
      .array(AshbyCustomFieldDefinitionSchema)
      .optional()
      .describe('List of custom field definitions'),
    next_cursor: z
      .string()
      .optional()
      .describe('Cursor for fetching the next page of results'),
    more_data_available: z
      .boolean()
      .optional()
      .describe('Whether more data is available'),
    sync_token: z.string().optional().describe('Token for incremental sync'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// INPUT TYPE: For generic constraint and constructor (user-facing)
export type AshbyParamsInput = z.input<typeof AshbyParamsSchema>;

// OUTPUT TYPE: For internal methods (after validation/transformation)
export type AshbyParams = z.output<typeof AshbyParamsSchema>;

// RESULT TYPE: Always output (after validation)
export type AshbyResult = z.output<typeof AshbyResultSchema>;

// Data types
export type AshbyCandidate = z.output<typeof AshbyCandidateSchema>;
export type AshbyEmail = z.output<typeof AshbyEmailSchema>;
export type AshbyPhone = z.output<typeof AshbyPhoneSchema>;
export type AshbyCustomField = z.output<typeof AshbyCustomFieldSchema>;
export type AshbyCandidateListItem = z.output<
  typeof AshbyCandidateListItemSchema
>;
export type AshbySocialLink = z.output<typeof AshbySocialLinkSchema>;
export type AshbyTag = z.output<typeof AshbyTagSchema>;
export type AshbyFileHandle = z.output<typeof AshbyFileHandleSchema>;
export type AshbySelectableValue = z.output<typeof AshbySelectableValueSchema>;
export type AshbyCustomFieldDefinition = z.output<
  typeof AshbyCustomFieldDefinitionSchema
>;

// Operation-specific types (for internal method parameters)
export type AshbyListCandidatesParams = Extract<
  AshbyParams,
  { operation: 'list_candidates' }
>;
export type AshbyGetCandidateParams = Extract<
  AshbyParams,
  { operation: 'get_candidate' }
>;
export type AshbyCreateCandidateParams = Extract<
  AshbyParams,
  { operation: 'create_candidate' }
>;
export type AshbySearchCandidatesParams = Extract<
  AshbyParams,
  { operation: 'search_candidates' }
>;
export type AshbyAddTagParams = Extract<AshbyParams, { operation: 'add_tag' }>;
export type AshbyListTagsParams = Extract<
  AshbyParams,
  { operation: 'list_tags' }
>;
export type AshbyCreateTagParams = Extract<
  AshbyParams,
  { operation: 'create_tag' }
>;
export type AshbyListCustomFieldsParams = Extract<
  AshbyParams,
  { operation: 'list_custom_fields' }
>;
