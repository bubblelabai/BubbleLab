import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';
import { ProxyChoiceSchema } from '../_shared/schema.js';

export const ReceivedInvitationInfoSchema = z.object({
  name: z.string().describe('Full name of the person'),
  headline: z.string().optional().describe('Professional headline/tagline'),
  mutual_connections: z.string().optional().describe('Mutual connections info'),
  received_date: z.string().describe('When the invitation was received'),
  profile_url: z.string().optional().describe('LinkedIn profile URL'),
});

export type ReceivedInvitationInfo = z.infer<
  typeof ReceivedInvitationInfoSchema
>;

export const LinkedInReceivedInvitationsToolParamsSchema = z.object({
  operation: z.literal('get_received_invitations'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
  proxy: ProxyChoiceSchema.optional(),
});

export const LinkedInReceivedInvitationsToolResultSchema = z.object({
  operation: z.literal('get_received_invitations'),
  success: z.boolean(),
  invitations: z.array(ReceivedInvitationInfoSchema).optional(),
  total_count: z.number().optional(),
  message: z.string().optional(),
  error: z.string(),
});

export type LinkedInReceivedInvitationsToolParamsInput = z.input<
  typeof LinkedInReceivedInvitationsToolParamsSchema
>;
export type LinkedInReceivedInvitationsToolResult = z.output<
  typeof LinkedInReceivedInvitationsToolResultSchema
>;
