/**
 * Zod schemas for workflow permission and trash management
 * These are shared between frontend and backend
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// Enums and Base Types
// ============================================================================

export const flowRoleSchema = z
  .enum(['owner', 'editor', 'runner', 'viewer'])
  .openapi('FlowRole');

export type FlowRole = z.infer<typeof flowRoleSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const flowPermissionSchema = z
  .object({
    userId: z.string().openapi({
      description: 'User ID',
      example: 'user_123',
    }),
    email: z.string().openapi({
      description: 'User email',
      example: 'user@example.com',
    }),
    name: z.string().nullable().openapi({
      description: 'User display name',
      example: 'John Doe',
    }),
    avatarUrl: z.string().optional().openapi({
      description: 'User avatar URL',
      example: 'https://example.com/avatar.png',
    }),
    role: flowRoleSchema,
    grantedAt: z.string().openapi({
      description: 'ISO timestamp when permission was granted',
      example: '2024-01-01T00:00:00Z',
    }),
    grantedBy: z.string().nullable().openapi({
      description: 'User ID who granted the permission',
      example: 'user_456',
    }),
  })
  .openapi('FlowPermission');

export type FlowPermission = z.infer<typeof flowPermissionSchema>;

export const trashedFlowSchema = z
  .object({
    id: z.number().openapi({
      description: 'Flow ID',
      example: 123,
    }),
    name: z.string().openapi({
      description: 'Flow name',
      example: 'My Workflow',
    }),
    organizationId: z.number().nullable().openapi({
      description: 'Organization ID if the flow belongs to an organization',
      example: 456,
    }),
    organizationName: z.string().nullable().openapi({
      description: 'Organization name',
      example: 'My Team',
    }),
    deletedAt: z.string().openapi({
      description: 'ISO timestamp when flow was deleted',
      example: '2024-01-01T00:00:00Z',
    }),
    deletedBy: z.string().nullable().openapi({
      description: 'User ID who deleted the flow',
      example: 'user_123',
    }),
    canRestore: z.boolean().openapi({
      description: 'Whether the current user can restore this flow',
      example: true,
    }),
    canPermanentDelete: z.boolean().openapi({
      description: 'Whether the current user can permanently delete this flow',
      example: false,
    }),
  })
  .openapi('TrashedFlow');

export type TrashedFlow = z.infer<typeof trashedFlowSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const grantPermissionSchema = z
  .object({
    email: z.string().email().optional().openapi({
      description: 'User email to grant permission to',
      example: 'user@example.com',
    }),
    userId: z.string().optional().openapi({
      description: 'User ID to grant permission to',
      example: 'user_123',
    }),
    role: flowRoleSchema,
  })
  .refine((data) => data.email || data.userId, {
    message: 'Either email or userId must be provided',
  })
  .openapi('GrantPermissionRequest');

export type GrantPermissionRequest = z.infer<typeof grantPermissionSchema>;

export const updatePermissionSchema = z
  .object({
    role: flowRoleSchema,
  })
  .openapi('UpdatePermissionRequest');

export type UpdatePermissionRequest = z.infer<typeof updatePermissionSchema>;

export const transferOwnershipSchema = z
  .object({
    fromUserId: z.string().openapi({
      description: 'Current owner user ID',
      example: 'user_123',
    }),
    toUserId: z.string().openapi({
      description: 'New owner user ID',
      example: 'user_456',
    }),
  })
  .openapi('TransferOwnershipRequest');

export type TransferOwnershipRequest = z.infer<typeof transferOwnershipSchema>;

// ============================================================================
// List Permissions Response
// ============================================================================

export const listFlowPermissionsResponseSchema = z
  .object({
    permissions: z.array(flowPermissionSchema),
    organizationId: z.number().nullable().openapi({
      description: 'Organization ID if the flow belongs to an organization',
      example: 456,
    }),
    isInTrash: z.boolean().openapi({
      description: 'Whether the flow is in trash',
      example: false,
    }),
  })
  .openapi('ListFlowPermissionsResponse');

export type ListFlowPermissionsResponse = z.infer<
  typeof listFlowPermissionsResponseSchema
>;

// ============================================================================
// Grant Permission Response
// ============================================================================

export const grantPermissionResponseSchema = z
  .object({
    userId: z.string(),
    role: flowRoleSchema,
    grantedAt: z.string(),
  })
  .openapi('GrantPermissionResponse');

export type GrantPermissionResponse = z.infer<
  typeof grantPermissionResponseSchema
>;

// ============================================================================
// Update Permission Response
// ============================================================================

export const updatePermissionResponseSchema = z
  .object({
    userId: z.string(),
    role: flowRoleSchema,
    updatedAt: z.string(),
  })
  .openapi('UpdatePermissionResponse');

export type UpdatePermissionResponse = z.infer<
  typeof updatePermissionResponseSchema
>;

// ============================================================================
// Transfer Ownership Response
// ============================================================================

export const transferOwnershipResponseSchema = z
  .object({
    previousOwner: z.string(),
    newOwner: z.string(),
    transferredAt: z.string(),
  })
  .openapi('TransferOwnershipResponse');

export type TransferOwnershipResponse = z.infer<
  typeof transferOwnershipResponseSchema
>;

// ============================================================================
// Trash List Response
// ============================================================================

export const listTrashResponseSchema = z
  .object({
    workflows: z.array(trashedFlowSchema),
  })
  .openapi('ListTrashResponse');

export type ListTrashResponse = z.infer<typeof listTrashResponseSchema>;

// ============================================================================
// Restore Flow Response
// ============================================================================

export const restoreFlowResponseSchema = z
  .object({
    id: z.number(),
    restoredAt: z.string(),
    message: z.string(),
  })
  .openapi('RestoreFlowResponse');

export type RestoreFlowResponse = z.infer<typeof restoreFlowResponseSchema>;
