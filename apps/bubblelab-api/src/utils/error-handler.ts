import type { Context } from 'hono';
import type { OpenAPIHono } from '@hono/zod-openapi';

// Validation error hook for intercepting Zod validation errors
export const validationErrorHook = (result: any, c: Context) => {
  if (result.success) {
    return;
  }

  // Transform ZodError to expected format for tests
  const details =
    result.error.issues?.map((issue: any) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    }) || [];

  return c.json(
    {
      error: `Validation failed. ${details.join('; ')}`,
      details,
    },
    400
  );
};

export function setupErrorHandler(app: OpenAPIHono) {
  app.onError((err, c: Context) => {
    console.error('API Error:', err);

    if (err.name === 'ZodError') {
      // Transform ZodError to expected format for tests
      const zodError = err as any;
      const details =
        zodError.issues?.map((issue: any) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
          return `${path}: ${issue.message}`;
        }) || [];

      return c.json(
        {
          error: 'Validation failed',
          details,
        },
        400
      );
    }

    // Handle JSON parsing errors
    if (err.message && err.message.includes('Malformed JSON in request body')) {
      return c.json(
        {
          error: 'Invalid request body',
          details: 'Request body must be valid JSON',
        },
        400
      );
    }

    // Handle other errors
    return c.json(
      {
        error: 'Internal server error',
        details: err.message,
      },
      500
    );
  });
}
