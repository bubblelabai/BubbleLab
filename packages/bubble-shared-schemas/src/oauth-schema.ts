// ========================= OAuth Schemas =========================
import { z } from '@hono/zod-openapi';
import { CredentialType } from './types';

// OAuth initiation request schema
export const oauthInitiateRequestSchema = z
  .object({
    credentialType: z.nativeEnum(CredentialType).openapi({
      description: 'The type of credential to create',
      example: CredentialType.GOOGLE_DRIVE_CRED,
    }),
    name: z.string().optional().openapi({
      description: 'Optional name for the credential',
      example: 'My Google Drive',
    }),
    scopes: z
      .array(z.string())
      .optional()
      .openapi({
        description:
          'Optional OAuth scopes to request (defaults based on credential type)',
        example: ['https://www.googleapis.com/auth/drive.readonly'],
      }),
  })
  .openapi('OAuthInitiateRequest');

// OAuth initiation response schema
export const oauthInitiateResponseSchema = z
  .object({
    authUrl: z.string().url().openapi({
      description: 'OAuth authorization URL to redirect user to',
      example: 'https://accounts.google.com/oauth2/auth?client_id=...',
    }),
    state: z.string().openapi({
      description: 'CSRF protection state parameter',
      example: 'abc123-def456-ghi789',
    }),
  })
  .openapi('OAuthInitiateResponse');

// OAuth callback request schema (for POST callback with credential details)
export const oauthCallbackRequestSchema = z
  .object({
    code: z.string().openapi({
      description: 'OAuth authorization code from provider',
      example: 'abc123def456',
    }),
    state: z.string().openapi({
      description: 'CSRF protection state parameter',
      example: 'abc123-def456-ghi789',
    }),
    name: z.string().openapi({
      description: 'Name for the credential',
      example: 'My Google Drive',
    }),
    description: z.string().optional().openapi({
      description: 'Optional description for the credential',
    }),
  })
  .openapi('OAuthCallbackRequest');

// OAuth token refresh response schema
export const oauthTokenRefreshResponseSchema = z
  .object({
    message: z.string().openapi({
      description: 'Success message',
      example: 'Token refreshed successfully',
    }),
  })
  .openapi('OAuthTokenRefreshResponse');

// OAuth revoke response schema
export const oauthRevokeResponseSchema = z
  .object({
    message: z.string().openapi({
      description: 'Success message',
      example: 'Credential revoked successfully',
    }),
  })
  .openapi('OAuthRevokeResponse');

// Export OAuth TypeScript types
export type OAuthInitiateRequest = z.infer<typeof oauthInitiateRequestSchema>;
export type OAuthInitiateResponse = z.infer<typeof oauthInitiateResponseSchema>;
export type OAuthCallbackRequest = z.infer<typeof oauthCallbackRequestSchema>;
export type OAuthTokenRefreshResponse = z.infer<
  typeof oauthTokenRefreshResponseSchema
>;
export type OAuthRevokeResponse = z.infer<typeof oauthRevokeResponseSchema>;
