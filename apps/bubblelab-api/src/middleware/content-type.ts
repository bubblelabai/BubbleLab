import { Context, Next } from 'hono';

/**
 * Middleware to validate that POST/PUT requests have application/json content-type
 * This prevents runtime errors when handlers expect JSON but receive other content types
 */
export async function requireJsonContentType(c: Context, next: Next) {
  const method = c.req.method;

  // Only check content-type for methods that typically have a body
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const contentType = c.req.header('content-type');

    if (!contentType || !contentType.includes('application/json')) {
      return c.json(
        {
          error: 'Invalid content type',
          details: 'Content-Type must be application/json',
        },
        400
      );
    }
  }

  return await next();
}
