import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';
import { ProxyChoiceSchema } from '../_shared/schema.js';

export const AcceptedInvitationInfoSchema = z.object({
  name: z
    .string()
    .describe('Full name of the person whose invitation was accepted'),
  headline: z.string().optional().describe('Professional headline/tagline'),
  mutual_connections: z.string().optional().describe('Mutual connections info'),
  profile_url: z.string().optional().describe('LinkedIn profile URL'),
});

export type AcceptedInvitationInfo = z.infer<
  typeof AcceptedInvitationInfoSchema
>;

export const LinkedInAcceptInvitationsToolParamsSchema = z.object({
  operation: z.enum(['accept_invitations']),
  count: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(5)
    .describe('Number of invitations to accept (default: 5, max: 100)'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
  proxy: ProxyChoiceSchema.optional(),
});

export const LinkedInAcceptInvitationsToolResultSchema = z.object({
  operation: z.enum(['accept_invitations']),
  success: z.boolean(),
  accepted: z.array(AcceptedInvitationInfoSchema).optional(),
  accepted_count: z.number().optional(),
  skipped_count: z.number().optional(),
  message: z.string().optional(),
  error: z.string(),
});

export type LinkedInAcceptInvitationsToolParamsInput = z.input<
  typeof LinkedInAcceptInvitationsToolParamsSchema
>;
export type LinkedInAcceptInvitationsToolResult = z.output<
  typeof LinkedInAcceptInvitationsToolResultSchema
>;
