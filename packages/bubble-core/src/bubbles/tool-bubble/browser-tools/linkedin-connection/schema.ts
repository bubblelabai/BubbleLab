import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';
import { ProxyChoiceSchema } from '../_shared/schema.js';

/**
 * Profile information extracted from LinkedIn
 */
export const ProfileInfoSchema = z.object({
  name: z.string().describe('Full name of the profile owner'),
  headline: z.string().optional().describe('Professional headline'),
  location: z.string().optional().describe('Location information'),
  profile_url: z.string().describe('LinkedIn profile URL'),
});

export type ProfileInfo = z.infer<typeof ProfileInfoSchema>;

/**
 * LinkedIn Connection Tool parameters schema
 */
export const LinkedInConnectionToolParamsSchema = z.object({
  operation: z
    .enum(['send_connection'])
    .describe('Send a connection request to a LinkedIn profile'),
  profile_url: z
    .string()
    .min(1)
    .describe(
      'LinkedIn profile URL (e.g., https://www.linkedin.com/in/username)'
    ),
  message: z
    .string()
    .max(300)
    .optional()
    .describe(
      'Optional personalized note to include with the connection request (max 300 characters)'
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required: LINKEDIN_CRED for authenticated LinkedIn session'),
  proxy: ProxyChoiceSchema.optional().describe(
    'Proxy configuration: none (direct connection), browserbase (residential), or custom proxy'
  ),
});

/**
 * LinkedIn Connection Tool result schema
 */
export const LinkedInConnectionToolResultSchema = z.object({
  operation: z.enum(['send_connection']),
  success: z.boolean().describe('Whether the connection request was sent'),
  message: z.string().optional().describe('Success or status message'),
  profile: ProfileInfoSchema.optional().describe(
    'Profile information of the person'
  ),
  error: z.string().describe('Error message if operation failed'),
});

export type LinkedInConnectionToolParams = z.output<
  typeof LinkedInConnectionToolParamsSchema
>;
export type LinkedInConnectionToolParamsInput = z.input<
  typeof LinkedInConnectionToolParamsSchema
>;
export type LinkedInConnectionToolResult = z.output<
  typeof LinkedInConnectionToolResultSchema
>;
