import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

const metadataField = z
  .record(z.string(), z.unknown())
  .optional()
  .describe('Arbitrary metadata object (JSON key-value pairs)');

// ============================================================================
// PARAMETER SCHEMAS (Discriminated Union)
// ============================================================================

export const ClerkParamsSchema = z.discriminatedUnion('operation', [
  // --- Users ---
  z.object({
    operation: z
      .literal('list_users')
      .describe('List users with optional filtering and pagination'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(10)
      .describe('Maximum number of users to return (1-500)'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of users to skip for pagination'),
    order_by: z
      .string()
      .optional()
      .describe(
        'Sort field (e.g. "-created_at" for newest first, "+created_at" for oldest)'
      ),
    query: z
      .string()
      .optional()
      .describe('Search query across first name, last name, and email'),
    email_address: z
      .array(z.string())
      .optional()
      .describe('Filter by specific email addresses'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('get_user').describe('Get a single user by their ID'),
    user_id: z
      .string()
      .min(1)
      .describe('The Clerk user ID (e.g. "user_abc123")'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('create_user').describe('Create a new user in Clerk'),
    email_address: z
      .array(z.string().email())
      .min(1)
      .describe('Email addresses for the new user'),
    first_name: z.string().optional().describe('First name'),
    last_name: z.string().optional().describe('Last name'),
    username: z.string().optional().describe('Username'),
    password: z.string().optional().describe('Password for the user'),
    public_metadata: metadataField.describe(
      'Public metadata visible to frontend and backend'
    ),
    private_metadata: metadataField.describe(
      'Private metadata visible only to the backend'
    ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('update_user').describe('Update an existing user'),
    user_id: z.string().min(1).describe('The Clerk user ID to update'),
    first_name: z.string().optional().describe('Updated first name'),
    last_name: z.string().optional().describe('Updated last name'),
    username: z.string().optional().describe('Updated username'),
    public_metadata: metadataField.describe('Updated public metadata'),
    private_metadata: metadataField.describe('Updated private metadata'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('delete_user').describe('Delete a user by ID'),
    user_id: z.string().min(1).describe('The Clerk user ID to delete'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('ban_user')
      .describe('Ban a user, preventing them from signing in'),
    user_id: z.string().min(1).describe('The Clerk user ID to ban'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('unban_user')
      .describe('Unban a previously banned user'),
    user_id: z.string().min(1).describe('The Clerk user ID to unban'),
    credentials: credentialsField,
  }),

  // --- Organizations ---
  z.object({
    operation: z
      .literal('list_organizations')
      .describe('List all organizations'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(10)
      .describe('Maximum number of organizations to return'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of organizations to skip for pagination'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_organization')
      .describe('Get a single organization by ID or slug'),
    organization_id: z.string().min(1).describe('Organization ID or slug'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_organization')
      .describe('Create a new organization'),
    name: z.string().min(1).describe('Organization name'),
    slug: z.string().optional().describe('URL-friendly slug'),
    created_by: z
      .string()
      .optional()
      .describe('User ID of the organization creator'),
    public_metadata: metadataField.describe(
      'Public metadata for the organization'
    ),
    private_metadata: metadataField.describe(
      'Private metadata for the organization'
    ),
    max_allowed_memberships: z
      .number()
      .int()
      .optional()
      .describe('Maximum number of members allowed'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('update_organization')
      .describe('Update an existing organization'),
    organization_id: z
      .string()
      .min(1)
      .describe('Organization ID or slug to update'),
    name: z.string().optional().describe('Updated organization name'),
    slug: z.string().optional().describe('Updated slug'),
    public_metadata: metadataField.describe('Updated public metadata'),
    private_metadata: metadataField.describe('Updated private metadata'),
    max_allowed_memberships: z
      .number()
      .int()
      .optional()
      .describe('Updated max allowed memberships'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('delete_organization')
      .describe('Delete an organization by ID or slug'),
    organization_id: z
      .string()
      .min(1)
      .describe('Organization ID or slug to delete'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('list_organization_memberships')
      .describe('List memberships for an organization'),
    organization_id: z
      .string()
      .min(1)
      .describe('Organization ID to list memberships for'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(10)
      .describe('Maximum number of memberships to return'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of memberships to skip for pagination'),
    credentials: credentialsField,
  }),

  // --- Invitations ---
  z.object({
    operation: z
      .literal('list_invitations')
      .describe('List all pending invitations'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(10)
      .describe('Maximum number of invitations to return'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of invitations to skip for pagination'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('create_invitation')
      .describe('Create an invitation to sign up'),
    email_address: z.string().email().describe('Email address to invite'),
    redirect_url: z
      .string()
      .url()
      .optional()
      .describe('URL to redirect to after the invitation is accepted'),
    public_metadata: metadataField.describe(
      'Public metadata for the invitation'
    ),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('revoke_invitation')
      .describe('Revoke a pending invitation'),
    invitation_id: z
      .string()
      .min(1)
      .describe('The invitation ID to revoke (e.g. "inv_abc123")'),
    credentials: credentialsField,
  }),

  // --- Sessions ---
  z.object({
    operation: z.literal('list_sessions').describe('List sessions for a user'),
    user_id: z
      .string()
      .min(1)
      .describe('User ID to list sessions for (required by Clerk API)'),
    status: z
      .enum([
        'active',
        'ended',
        'expired',
        'removed',
        'replaced',
        'revoked',
        'abandoned',
      ])
      .optional()
      .describe('Filter by session status'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(10)
      .describe('Maximum number of sessions to return'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of sessions to skip for pagination'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z.literal('revoke_session').describe('Revoke an active session'),
    session_id: z.string().min(1).describe('The session ID to revoke'),
    credentials: credentialsField,
  }),

  // --- Billing ---
  z.object({
    operation: z
      .literal('get_user_subscription')
      .describe("Get a user's billing subscription status"),
    user_id: z
      .string()
      .min(1)
      .describe('The user ID to get subscription info for'),
    credentials: credentialsField,
  }),

  z.object({
    operation: z
      .literal('get_organization_subscription')
      .describe("Get an organization's billing subscription status"),
    organization_id: z
      .string()
      .min(1)
      .describe('The organization ID to get subscription info for'),
    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMAS (Discriminated Union)
// ============================================================================

export const ClerkResultSchema = z.discriminatedUnion('operation', [
  // Users results
  z.object({
    operation: z.literal('list_users'),
    users: z.array(z.record(z.string(), z.unknown())).optional(),
    total_count: z.number().optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_user'),
    user: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_user'),
    user: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_user'),
    user: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_user'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('ban_user'),
    user: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('unban_user'),
    user: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),

  // Organizations results
  z.object({
    operation: z.literal('list_organizations'),
    organizations: z.array(z.record(z.string(), z.unknown())).optional(),
    total_count: z.number().optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_organization'),
    organization: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_organization'),
    organization: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('update_organization'),
    organization: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete_organization'),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('list_organization_memberships'),
    memberships: z.array(z.record(z.string(), z.unknown())).optional(),
    total_count: z.number().optional(),
    success: z.boolean(),
    error: z.string(),
  }),

  // Invitations results
  z.object({
    operation: z.literal('list_invitations'),
    invitations: z.array(z.record(z.string(), z.unknown())).optional(),
    total_count: z.number().optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('create_invitation'),
    invitation: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('revoke_invitation'),
    success: z.boolean(),
    error: z.string(),
  }),

  // Sessions results
  z.object({
    operation: z.literal('list_sessions'),
    sessions: z.array(z.record(z.string(), z.unknown())).optional(),
    total_count: z.number().optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('revoke_session'),
    success: z.boolean(),
    error: z.string(),
  }),

  // Billing results
  z.object({
    operation: z.literal('get_user_subscription'),
    subscription: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('get_organization_subscription'),
    subscription: z.record(z.string(), z.unknown()).optional(),
    success: z.boolean(),
    error: z.string(),
  }),
]);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ClerkParamsInput = z.input<typeof ClerkParamsSchema>;
export type ClerkParams = z.output<typeof ClerkParamsSchema>;
export type ClerkResult = z.output<typeof ClerkResultSchema>;
