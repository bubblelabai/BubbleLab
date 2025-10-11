import { z } from '@hono/zod-openapi';

export const errorResponseSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
      example: 'Validation failed',
    }),
    details: z.string().optional().openapi({
      description: 'Additional error details',
      example: 'Invalid field: name is required',
    }),
  })
  .openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export interface HealthCheckResponse {
  message: string;
  timestamp: string;
}

export const slackUrlVerificationSchema = z.object({
  token: z.string(),
  challenge: z.string(),
  type: z.literal('url_verification'),
});

export const slackUrlVerificationResponseSchema = z
  .object({
    challenge: z
      .string()
      .openapi({ description: 'Slack URL verification challenge' }),
  })
  .openapi('SlackUrlVerificationResponse');

export type SlackUrlVerificationResponse = z.infer<
  typeof slackUrlVerificationResponseSchema
>;
