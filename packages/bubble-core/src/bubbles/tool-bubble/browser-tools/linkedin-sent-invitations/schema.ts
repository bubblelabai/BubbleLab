import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';
import { ProxyChoiceSchema } from '../_shared/schema.js';

export const SentInvitationInfoSchema = z.object({
  name: z.string().describe('Full name of the person'),
  headline: z.string().optional().describe('Professional headline/tagline'),
  sent_date: z.string().describe('When the invitation was sent'),
  profile_url: z.string().optional().describe('LinkedIn profile URL'),
});

export type SentInvitationInfo = z.infer<typeof SentInvitationInfoSchema>;

export const LinkedInSentInvitationsToolParamsSchema = z.object({
  operation: z.literal('get_sent_invitations'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
  proxy: ProxyChoiceSchema.optional(),
});

export const LinkedInSentInvitationsToolResultSchema = z.object({
  operation: z.literal('get_sent_invitations'),
  success: z.boolean(),
  invitations: z.array(SentInvitationInfoSchema).optional(),
  total_count: z.number().optional(),
  message: z.string().optional(),
  error: z.string(),
});

export type LinkedInSentInvitationsToolParamsInput = z.input<
  typeof LinkedInSentInvitationsToolParamsSchema
>;
export type LinkedInSentInvitationsToolResult = z.output<
  typeof LinkedInSentInvitationsToolResultSchema
>;
