import { expect } from '@jest/globals';

interface TestResponse<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

// Create a test client that works with Hono's fetch-based API
export class TestClient {
  constructor(
    private app: {
      fetch: (
        request: Request,
        env?: unknown,
        executionCtx?: any
      ) => Response | Promise<Response>;
    }
  ) {}

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<TestResponse<T>> {
    const url = `http://localhost${path}`;
    const response = await this.app.fetch(
      new Request(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': '1',
          ...options?.headers,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      })
    );

    const contentType = response.headers.get('content-type');
    const body = contentType?.includes('application/json')
      ? await response.json()
      : await response.text();

    return {
      status: response.status,
      body: body as T,
      headers: response.headers,
    };
  }

  get<T = unknown>(path: string): Promise<TestResponse<T>> {
    return this.request<T>('GET', path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<TestResponse<T>> {
    return this.request<T>('POST', path, { body });
  }
}

import app from '../../index.js';
export const testApp = new TestClient(app as any);

export interface CreateBubbleFlowResponse {
  id: number;
  message: string;
}

export interface ExecuteBubbleFlowResponse {
  executionId: number;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ErrorResponse {
  error: string;
  details?: unknown[];
}

export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' && response !== null && 'error' in response
  );
}

export function isCreateBubbleFlowResponse(
  response: unknown
): response is CreateBubbleFlowResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'id' in response &&
    'message' in response
  );
}

export function isExecuteBubbleFlowResponse(
  response: unknown
): response is ExecuteBubbleFlowResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'executionId' in response &&
    'success' in response
  );
}

export async function createBubbleFlow(data: {
  name: string;
  description?: string;
  code: string;
  eventType: string;
}) {
  return await testApp.post<CreateBubbleFlowResponse | ErrorResponse>(
    '/bubble-flow',
    data
  );
}

export async function executeBubbleFlow(id: number, payload: unknown) {
  return await testApp.post<ExecuteBubbleFlowResponse | ErrorResponse>(
    `/bubble-flow/${id}/execute`,
    payload // Send payload directly (no wrapper)
  );
}

export function expectValidationError<T = unknown>(
  response: TestResponse<T>,
  expectedError?: string
) {
  expect(response.status).toBe(400);
  const body = response.body as ErrorResponse;
  expect(body).toHaveProperty('error');

  if (expectedError) {
    // Handle both string and array details formats
    const details = body.details;
    if (Array.isArray(details)) {
      expect(details).toEqual(
        expect.arrayContaining([expect.stringContaining(expectedError)])
      );
    } else if (typeof details === 'string') {
      expect(details).toContain(expectedError);
    }
  }
}

export function expectSuccess<T = unknown>(
  response: TestResponse<T>,
  expectedId?: number
) {
  expect(response.status).toBe(201);
  const body = response.body as CreateBubbleFlowResponse;
  expect(body).toHaveProperty('id');
  expect(body).toHaveProperty('message', 'BubbleFlow created successfully');

  if (expectedId !== undefined) {
    expect(body.id).toBe(expectedId);
  }
}
