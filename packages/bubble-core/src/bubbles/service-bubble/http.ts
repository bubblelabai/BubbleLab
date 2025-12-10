import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';

// HTTP methods enum
const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

// Define the parameters schema for the HTTP bubble
const HttpParamsSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe('The URL to make the HTTP request to'),
  method: HttpMethodSchema.default('GET').describe(
    'HTTP method to use (default: GET)'
  ),
  headers: z
    .record(z.string())
    .optional()
    .describe('HTTP headers to include in the request'),
  body: z
    .union([z.string(), z.record(z.unknown())])
    .optional()
    .describe('Request body (string or JSON object)'),
  timeout: z
    .number()
    .min(1000)
    .max(120000)
    .default(30000)
    .describe('Request timeout in milliseconds (default: 30000, max: 120000)'),
  followRedirects: z
    .boolean()
    .default(true)
    .describe('Whether to follow HTTP redirects (default: true)'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Optional credentials for authentication (injected at runtime)'),
});

type HttpParamsInput = z.input<typeof HttpParamsSchema>;
type HttpParams = z.output<typeof HttpParamsSchema>;

// Define the result schema for validation
const HttpResultSchema = z.object({
  status: z.number().describe('HTTP status code'),
  statusText: z.string().describe('HTTP status text'),
  headers: z.record(z.string()).describe('Response headers'),
  body: z.string().describe('Response body as string'),
  json: z.unknown().optional().describe('Parsed JSON response (if applicable)'),
  success: z
    .boolean()
    .describe('Whether the request was successful (HTTP 2xx status codes)'),
  error: z.string().describe('Error message if request failed'),
  responseTime: z.number().describe('Response time in milliseconds'),
  size: z.number().describe('Response size in bytes'),
});

type HttpResult = z.output<typeof HttpResultSchema>;

export class HttpBubble extends ServiceBubble<HttpParams, HttpResult> {
  static readonly service = 'nodex-core';
  static readonly authType = 'none' as const;
  static readonly bubbleName: BubbleName = 'http';
  static readonly type = 'service' as const;
  static readonly schema = HttpParamsSchema;
  static readonly resultSchema = HttpResultSchema;
  static readonly shortDescription =
    'Makes HTTP requests to external APIs and services';
  static readonly longDescription = `
    A basic HTTP client bubble for making requests to external APIs and web services.
    
    Features:
    - Support for all major HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.)
    - Custom headers and request body support
    - Configurable timeouts and redirect handling
    - JSON parsing for API responses
    - Detailed response metadata (status, headers, timing, size)
    - Error handling with meaningful messages
    
    Use cases:
    - Calling external REST APIs
    - Webhook requests
    - Data fetching from web services
    - Integration with third-party services
    - Simple web scraping (for public APIs)
    - Health checks and monitoring
  `;
  static readonly alias = 'fetch';

  constructor(
    params: HttpParamsInput = {
      url: 'https://httpbin.org/get',
      method: 'GET',
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    // HTTP bubble can work without credentials for public APIs
    return undefined;
  }

  public async testCredential(): Promise<boolean> {
    // HTTP bubble doesn't require specific credentials to test
    // We could optionally test the URL accessibility here
    return true;
  }

  protected async performAction(context?: BubbleContext): Promise<HttpResult> {
    void context; // Context available but not currently used

    const { url, method, headers, body, timeout, followRedirects } =
      this.params;
    const startTime = Date.now();

    try {
      console.log(`[HttpBubble] Making ${method} request to ${url}`);

      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: {
          'User-Agent': 'NodeX-HttpBubble/1.0',
          ...headers,
        },
        redirect: followRedirects ? 'follow' : 'manual',
        signal: abortController.signal,
      };

      // Add body for non-GET methods
      if (body && method !== 'GET' && method !== 'HEAD') {
        if (typeof body === 'string') {
          requestOptions.body = body;
        } else {
          requestOptions.headers = {
            'Content-Type': 'application/json',
            ...requestOptions.headers,
          };
          requestOptions.body = JSON.stringify(body);
        }
      }

      // Make the request
      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId); // Clear timeout if request completes
      const responseTime = Date.now() - startTime;

      // Read response body
      const responseText = await response.text();
      const responseSize = new Blob([responseText]).size;

      // Try to parse as JSON
      let jsonResponse: unknown;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch {
        // Not JSON, that's fine
        jsonResponse = undefined;
      }

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });

      const result: HttpResult = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText,
        json: jsonResponse,
        success: response.ok,
        error: response.ok
          ? ''
          : `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
        size: responseSize,
      };

      console.log(
        `[HttpBubble] Request completed: ${response.status} (${responseTime}ms)`
      );
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error('[HttpBubble] Request failed:', errorMessage);

      return {
        status: 0,
        statusText: 'Request Failed',
        headers: {},
        body: '',
        json: undefined,
        success: false,
        error: errorMessage,
        responseTime,
        size: 0,
      };
    }
  }
}
