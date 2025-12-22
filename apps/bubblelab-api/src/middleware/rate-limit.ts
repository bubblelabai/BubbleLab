import { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Max attempts within window
  keyGenerator?: (c: Context) => string; // Function to generate rate limit key
  message?: string; // Custom error message
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Create a rate limiting middleware for Hono
 * @param options - Rate limit configuration
 * @returns Hono middleware function
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxAttempts,
    keyGenerator = (c) =>
      c.get('userId') || c.req.header('x-forwarded-for') || 'anonymous',
    message = 'Too many requests. Please try again later.',
  } = options;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    // Get or create entry for this key
    let entry = rateLimitStore.get(key);

    // Clean up expired entry
    if (entry && now >= entry.resetAt) {
      rateLimitStore.delete(key);
      entry = undefined;
    }

    if (!entry) {
      // First request in window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (entry.count >= maxAttempts) {
      // Rate limit exceeded
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

      c.header('Retry-After', retryAfterSeconds.toString());
      c.header('X-RateLimit-Limit', maxAttempts.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

      return c.json(
        {
          success: false,
          message: `${message} Try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''}.`,
        },
        429
      );
    }

    // Increment counter
    entry.count++;

    // Add rate limit headers
    c.header('X-RateLimit-Limit', maxAttempts.toString());
    c.header('X-RateLimit-Remaining', (maxAttempts - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    return next();
  };
}

/**
 * Pre-configured rate limiter for coupon redemption
 * 5 attempts per hour per user
 */
export const couponRedemptionRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 10,
  message: 'Too many redemption attempts.',
});
