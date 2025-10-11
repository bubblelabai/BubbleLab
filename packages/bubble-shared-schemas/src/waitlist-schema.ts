import { z } from '@hono/zod-openapi';
// ============================================================================
// JOIN WAITLIST SCHEMAS
// ============================================================================

// POST /join-waitlist - Join waitlist request schema
export const joinWaitlistSchema = z
  .object({
    name: z.string().min(1, 'Name is required').openapi({
      description: 'Full name of the user',
      example: 'John Doe',
    }),
    email: z.string().email('Valid email is required').openapi({
      description: 'Email address of the user',
      example: 'john.doe@example.com',
    }),
    database: z.string().min(1, 'Database selection is required').openapi({
      description: 'Database type the user wants to use',
      example: 'postgres',
    }),
    otherDatabase: z.string().optional().openapi({
      description: 'Other database type if "other" was selected',
      example: 'Redis',
    }),
  })
  .openapi('JoinWaitlistRequest');

// POST /join-waitlist - Join waitlist response schema
export const joinWaitlistResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether the request was successful',
      example: true,
    }),
    message: z.string().openapi({
      description: 'Success message',
      example:
        'Successfully joined the waitlist! Check your email for next steps.',
    }),
  })
  .openapi('JoinWaitlistResponse');

// Export TypeScript types
export type JoinWaitlistRequest = z.infer<typeof joinWaitlistSchema>;
export type JoinWaitlistResponse = z.infer<typeof joinWaitlistResponseSchema>;
