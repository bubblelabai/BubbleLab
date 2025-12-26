// @ts-expect-error - Bun test
import { describe, it, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { rateLimit } from './rate-limit.js';

describe('rateLimit middleware', () => {
  let app: Hono;

  beforeEach(() => {
    // Create a fresh app for each test
    app = new Hono();
  });

  it('should allow requests within the limit', async () => {
    app.use(
      '/test',
      rateLimit({
        windowMs: 60000,
        maxAttempts: 3,
        keyGenerator: () => 'test-user-allow',
      })
    );
    app.post('/test', (c) => c.json({ success: true }));

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test', { method: 'POST' });
      expect(res.status).toBe(200);
    }
  });

  it('should block requests exceeding the limit with 429', async () => {
    app.use(
      '/test',
      rateLimit({
        windowMs: 60000,
        maxAttempts: 2,
        keyGenerator: () => 'test-user-block',
      })
    );
    app.post('/test', (c) => c.json({ success: true }));

    // First 2 requests succeed
    const res1 = await app.request('/test', { method: 'POST' });
    expect(res1.status).toBe(200);

    const res2 = await app.request('/test', { method: 'POST' });
    expect(res2.status).toBe(200);

    // Third request should be blocked
    const res3 = await app.request('/test', { method: 'POST' });
    expect(res3.status).toBe(429);

    const body = await res3.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Too many requests');
  });

  it('should include rate limit headers when blocked', async () => {
    app.use(
      '/test',
      rateLimit({
        windowMs: 60000,
        maxAttempts: 1,
        keyGenerator: () => 'test-user-headers',
      })
    );
    app.post('/test', (c) => c.json({ success: true }));

    // First request succeeds
    const res1 = await app.request('/test', { method: 'POST' });
    expect(res1.status).toBe(200);

    // Second request blocked - headers are included in the 429 response
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('should include Retry-After header when blocked', async () => {
    app.use(
      '/test',
      rateLimit({
        windowMs: 60000,
        maxAttempts: 1,
        keyGenerator: () => 'test-user-retry',
      })
    );
    app.post('/test', (c) => c.json({ success: true }));

    // First request succeeds
    const res1 = await app.request('/test', { method: 'POST' });
    expect(res1.status).toBe(200);

    // Second request blocked
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('should use custom error message', async () => {
    app.use(
      '/test',
      rateLimit({
        windowMs: 60000,
        maxAttempts: 1,
        keyGenerator: () => 'test-user-message',
        message: 'Too many redemption attempts.',
      })
    );
    app.post('/test', (c) => c.json({ success: true }));

    // First request succeeds
    const res1 = await app.request('/test', { method: 'POST' });
    expect(res1.status).toBe(200);

    // Second request blocked
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.message).toContain('Too many redemption attempts');
  });

  it('should track different users separately', async () => {
    let currentUser = 'user-a';
    app.use(
      '/test',
      rateLimit({
        windowMs: 60000,
        maxAttempts: 1,
        keyGenerator: () => currentUser,
      })
    );
    app.post('/test', (c) => c.json({ success: true }));

    // User A's first request succeeds
    const resA1 = await app.request('/test', { method: 'POST' });
    expect(resA1.status).toBe(200);

    // User A's second request blocked
    const resA2 = await app.request('/test', { method: 'POST' });
    expect(resA2.status).toBe(429);

    // User B's first request succeeds
    currentUser = 'user-b';
    const resB1 = await app.request('/test', { method: 'POST' });
    expect(resB1.status).toBe(200);
  });
});
