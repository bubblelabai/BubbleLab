/**
 * Zod schemas for organization management
 * These are shared between frontend and backend
 */

import { z } from '@hono/zod-openapi';

// ============================================================================
// Enums and Base Types
// ============================================================================

export const orgRoleSchema = z
  .enum(['owner', 'admin', 'member'])
  .openapi('OrgRole');

export type OrgRole = z.infer<typeof orgRoleSchema>;

export const orgTypeSchema = z
  .enum(['personal', 'organization'])
  .openapi('OrgType');

export type OrgType = z.infer<typeof orgTypeSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const organizationSchema = z
  .object({
    id: z.number().openapi({
      description: 'Organization ID',
      example: 123,
    }),
    name: z.string().openapi({
      description: 'Organization name',
      example: 'My Team',
    }),
    slug: z.string().openapi({
      description: 'Organization slug for URLs',
      example: 'my-team',
    }),
    type: orgTypeSchema,
    role: orgRoleSchema.openapi({
      description: "Current user's role in this organization",
    }),
    memberCount: z.number().openapi({
      description: 'Number of members in the organization',
      example: 5,
    }),
    createdAt: z.string().openapi({
      description: 'ISO timestamp when organization was created',
      example: '2024-01-01T00:00:00Z',
    }),
  })
  .openapi('Organization');

export type Organization = z.infer<typeof organizationSchema>;

export const organizationDetailSchema = organizationSchema
  .extend({
    workflowCount: z.number().openapi({
      description: 'Number of workflows in the organization',
      example: 10,
    }),
    updatedAt: z.string().openapi({
      description: 'ISO timestamp when organization was last updated',
      example: '2024-01-02T00:00:00Z',
    }),
  })
  .openapi('OrganizationDetail');

export type OrganizationDetail = z.infer<typeof organizationDetailSchema>;

export const organizationMemberSchema = z
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
    role: orgRoleSchema,
    joinedAt: z.string().openapi({
      description: 'ISO timestamp when user joined the organization',
      example: '2024-01-01T00:00:00Z',
    }),
  })
  .openapi('OrganizationMember');

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const createOrganizationSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({
      description: 'Organization name',
      example: 'My Team',
    }),
    slug: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
      .openapi({
        description: 'Organization slug for URLs',
        example: 'my-team',
      }),
  })
  .openapi('CreateOrganizationRequest');

export type CreateOrganizationRequest = z.infer<
  typeof createOrganizationSchema
>;

export const updateOrganizationSchema = z
  .object({
    name: z.string().min(1).max(100).optional().openapi({
      description: 'Organization name',
      example: 'My Team',
    }),
    slug: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
      .optional()
      .openapi({
        description: 'Organization slug for URLs',
        example: 'my-team',
      }),
  })
  .openapi('UpdateOrganizationRequest');

export type UpdateOrganizationRequest = z.infer<
  typeof updateOrganizationSchema
>;

export const addMemberSchema = z
  .object({
    email: z.string().email().openapi({
      description: 'Email of the user to add',
      example: 'user@example.com',
    }),
    role: z.enum(['admin', 'member']).openapi({
      description: 'Role to assign to the new member',
      example: 'member',
    }),
  })
  .openapi('AddMemberRequest');

export type AddMemberRequest = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z
  .object({
    role: z.enum(['admin', 'member']).openapi({
      description: 'New role for the member',
      example: 'admin',
    }),
  })
  .openapi('UpdateMemberRoleRequest');

export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const listOrganizationsResponseSchema = z
  .object({
    organizations: z.array(organizationSchema),
  })
  .openapi('ListOrganizationsResponse');

export type ListOrganizationsResponse = z.infer<
  typeof listOrganizationsResponseSchema
>;

export const updateOrganizationResponseSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
    updatedAt: z.string(),
  })
  .openapi('UpdateOrganizationResponse');

export type UpdateOrganizationResponse = z.infer<
  typeof updateOrganizationResponseSchema
>;

export const listMembersResponseSchema = z
  .object({
    members: z.array(organizationMemberSchema),
  })
  .openapi('ListMembersResponse');

export type ListMembersResponse = z.infer<typeof listMembersResponseSchema>;

export const addMemberResponseSchema = z
  .object({
    userId: z.string(),
    role: orgRoleSchema,
    joinedAt: z.string(),
  })
  .openapi('AddMemberResponse');

export type AddMemberResponse = z.infer<typeof addMemberResponseSchema>;

export const updateMemberRoleResponseSchema = z
  .object({
    userId: z.string(),
    role: orgRoleSchema,
  })
  .openapi('UpdateMemberRoleResponse');

export type UpdateMemberRoleResponse = z.infer<
  typeof updateMemberRoleResponseSchema
>;

export const successResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .openapi('SuccessResponse');

export type SuccessResponse = z.infer<typeof successResponseSchema>;
