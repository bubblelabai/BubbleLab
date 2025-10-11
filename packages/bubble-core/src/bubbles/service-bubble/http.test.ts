import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpBubble } from './http.js';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout for Node.js compatibility
global.AbortSignal.timeout = vi.fn((timeout: number) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller.signal;
});

describe('HttpBubble', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should have correct static properties', () => {
    expect(HttpBubble.bubbleName).toBe('http');
    expect(HttpBubble.service).toBe('nodex-core');
    expect(HttpBubble.authType).toBe('none');
    expect(HttpBubble.type).toBe('service');
    expect(HttpBubble.alias).toBe('fetch');
    expect(HttpBubble.shortDescription).toContain('HTTP requests');
  });

  it('should validate parameters correctly', () => {
    const validParams = {
      url: 'https://api.example.com/data',
      method: 'GET' as const,
      timeout: 5000,
    };

    const result = HttpBubble.schema.safeParse(validParams);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.url).toBe('https://api.example.com/data');
      expect(result.data.method).toBe('GET');
      expect(result.data.timeout).toBe(5000);
      expect(result.data.followRedirects).toBe(true); // default value
    }
  });

  it('should reject invalid URL', () => {
    const invalidParams = {
      url: 'not-a-url',
    };

    const result = HttpBubble.schema.safeParse(invalidParams);
    expect(result.success).toBe(false);
  });

  it('should make successful GET request', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('{"message": "success"}'),
      headers: new Map([['content-type', 'application/json']]),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/data',
      method: 'GET',
    });

    const result = await httpBubble.performAction();

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.body).toBe('{"message": "success"}');
    expect(result.json).toEqual({ message: 'success' });
    expect(result.error).toBe('');
    expect(result.responseTime).toBeGreaterThanOrEqual(0);

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'GET',
      headers: {
        'User-Agent': 'NodeX-HttpBubble/1.0',
      },
      redirect: 'follow',
      signal: expect.any(Object),
    });
  });

  it('should make POST request with JSON body', async () => {
    const mockResponse = {
      ok: true,
      status: 201,
      statusText: 'Created',
      text: vi.fn().mockResolvedValue('{"id": 123, "status": "created"}'),
      headers: new Map([['content-type', 'application/json']]),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/create',
      method: 'POST',
      body: { name: 'Test Item', value: 42 },
      headers: {
        Authorization: 'Bearer token123',
      },
    });

    const result = await httpBubble.performAction();

    expect(result.success).toBe(true);
    expect(result.status).toBe(201);
    expect(result.json).toEqual({ id: 123, status: 'created' });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/create', {
      method: 'POST',
      headers: {
        'User-Agent': 'NodeX-HttpBubble/1.0',
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      },
      redirect: 'follow',
      signal: expect.any(Object),
      body: '{"name":"Test Item","value":42}',
    });
  });

  it('should make POST request with string body', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('success'),
      headers: new Map([['content-type', 'text/plain']]),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/webhook',
      method: 'POST',
      body: 'raw string data',
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    const result = await httpBubble.performAction();

    expect(result.success).toBe(true);
    expect(result.body).toBe('success');

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/webhook', {
      method: 'POST',
      headers: {
        'User-Agent': 'NodeX-HttpBubble/1.0',
        'Content-Type': 'text/plain',
      },
      redirect: 'follow',
      signal: expect.any(Object),
      body: 'raw string data',
    });
  });

  it('should handle HTTP errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('{"error": "Resource not found"}'),
      headers: new Map([['content-type', 'application/json']]),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/nonexistent',
    });

    const result = await httpBubble.performAction();

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.statusText).toBe('Not Found');
    expect(result.error).toBe('HTTP 404: Not Found');
    expect(result.json).toEqual({ error: 'Resource not found' });
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/data',
    });

    const result = await httpBubble.performAction();

    expect(result.success).toBe(false);
    expect(result.status).toBe(0);
    expect(result.statusText).toBe('Request Failed');
    expect(result.error).toBe('Network error');
    expect(result.body).toBe('');
    expect(result.json).toBeUndefined();
  });

  it('should handle non-JSON responses', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('<html><body>Hello World</body></html>'),
      headers: new Map([['content-type', 'text/html']]),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://example.com',
    });

    const result = await httpBubble.performAction();

    expect(result.success).toBe(true);
    expect(result.body).toBe('<html><body>Hello World</body></html>');
    expect(result.json).toBeUndefined(); // Not JSON
  });

  it('should handle custom timeout and redirect settings', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('success'),
      headers: new Map(),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/data',
      timeout: 10000,
      followRedirects: false,
    });

    await httpBubble.performAction();

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
      method: 'GET',
      headers: {
        'User-Agent': 'NodeX-HttpBubble/1.0',
      },
      redirect: 'manual',
      signal: expect.any(Object),
    });
  });

  it('should validate result schema', () => {
    const validResult = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"test": true}',
      json: { test: true },
      success: true,
      error: '',
      responseTime: 150,
      size: 15,
    };

    const result = HttpBubble.resultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
  });

  it('should not include body for GET requests', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('success'),
      headers: new Map(),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/data',
      method: 'GET',
      body: { shouldIgnore: 'this' }, // This should be ignored for GET
    });

    await httpBubble.performAction();

    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1]).not.toHaveProperty('body');
  });

  it('should not include body for HEAD requests', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue(''),
      headers: new Map([['content-length', '1234']]),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const httpBubble = new HttpBubble({
      url: 'https://api.example.com/data',
      method: 'HEAD',
      body: { shouldIgnore: 'this' }, // This should be ignored for HEAD
    });

    await httpBubble.performAction();

    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1]).not.toHaveProperty('body');
  });
});
