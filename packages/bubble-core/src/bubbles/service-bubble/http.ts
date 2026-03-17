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
  authType: z
    .enum(['none', 'bearer', 'basic', 'api-key', 'api-key-header', 'custom'])
    .default('none')
    .describe(
      'Authentication type: none (default), bearer (Authorization: Bearer), basic (Authorization: Basic), api-key (X-API-Key), api-key-header (Api-Key), custom (user-specified header)'
    ),
  authHeader: z
    .string()
    .optional()
    .describe(
      'Custom header name when authType is "custom" (e.g., "X-Custom-Auth")'
    ),
  responseType: z
    .enum(['auto', 'text', 'binary'])
    .default('auto')
    .describe(
      'How to handle the response body. auto: detects from Content-Type (e.g., application/pdf → base64). text: always returns UTF-8 string. binary: always returns base64-encoded string. Use binary when downloading files like PDFs or images.'
    ),
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
  body: z
    .string()
    .describe(
      'Response body. For text responses (HTML, JSON, etc.) this is the raw text. For binary responses (PDFs, images, etc.) this is base64-encoded — check isBase64 to know which.'
    ),
  isBase64: z
    .boolean()
    .describe(
      'True when body is base64-encoded binary data. When true, pass body directly to tools that accept base64 content (e.g., google_drive upload_file, resend attachment content).'
    ),
  contentType: z
    .string()
    .describe(
      'Response Content-Type (e.g., application/pdf, text/html). Pass to downstream tools as mimeType/contentType.'
    ),
  json: z.unknown().optional().describe('Parsed JSON response (if applicable)'),
  success: z
    .boolean()
    .describe('Whether the request was successful (HTTP 2xx status codes)'),
  error: z.string().describe('Error message if request failed'),
  responseTime: z.number().describe('Response time in milliseconds'),
  size: z
    .number()
    .describe(
      'Raw response size in bytes (before base64 encoding, if applicable)'
    ),
});

type HttpResult = z.output<typeof HttpResultSchema>;

export class HttpBubble extends ServiceBubble<HttpParams, HttpResult> {
  static readonly service = 'nodex-core';
  static readonly authType = 'apikey' as const;
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
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    // Accept any credential type - use CUSTOM_AUTH_KEY first if available,
    // otherwise use the first credential provided (wildcard support)
    if (credentials[CredentialType.CUSTOM_AUTH_KEY]) {
      return credentials[CredentialType.CUSTOM_AUTH_KEY];
    }
    // Return the first available credential value
    const values = Object.values(credentials);
    return values.length > 0 ? values[0] : undefined;
  }

  public async testCredential(): Promise<boolean> {
    // HTTP bubble doesn't require specific credentials to test
    // We could optionally test the URL accessibility here
    return true;
  }

  protected async performAction(context?: BubbleContext): Promise<HttpResult> {
    void context; // Context available but not currently used

    const {
      url,
      method,
      headers,
      body,
      timeout,
      followRedirects,
      authType,
      authHeader,
    } = this.params;
    const startTime = Date.now();

    try {
      console.log(`[HttpBubble] Making ${method} request to ${url}`);

      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      // Build auth headers based on authType
      const authHeaders: Record<string, string> = {};
      const credential = this.chooseCredential();
      if (credential && authType !== 'none') {
        switch (authType) {
          case 'bearer':
            authHeaders['Authorization'] = `Bearer ${credential}`;
            break;
          case 'basic':
            authHeaders['Authorization'] = `Basic ${credential}`;
            break;
          case 'api-key':
            authHeaders['X-API-Key'] = credential;
            break;
          case 'api-key-header':
            authHeaders['Api-Key'] = credential;
            break;
          case 'custom':
            if (authHeader) {
              authHeaders[authHeader] = credential;
            }
            break;
        }
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: {
          'User-Agent': 'NodeX-HttpBubble/1.0',
          ...authHeaders,
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

      // Determine binary vs text handling
      const rawContentType = response.headers.get('content-type') ?? '';
      const responseTypeParam =
        (this.params as HttpParams).responseType ?? 'auto';

      let isBinary: boolean;
      if (responseTypeParam === 'binary') {
        isBinary = true;
      } else if (responseTypeParam === 'text') {
        isBinary = false;
      } else {
        isBinary = !this.isTextMimeType(rawContentType);
      }

      // Read response body based on detected type
      let responseBody: string;
      let responseSize: number;
      let jsonResponse: unknown;

      if (isBinary) {
        const arrayBuffer = await response.arrayBuffer();
        responseSize = arrayBuffer.byteLength;
        responseBody =
          arrayBuffer.byteLength > 0
            ? Buffer.from(arrayBuffer).toString('base64')
            : '';
        jsonResponse = undefined;
      } else {
        responseBody = await response.text();
        responseSize = new Blob([responseBody]).size;
        try {
          jsonResponse = JSON.parse(responseBody);
        } catch {
          jsonResponse = undefined;
        }
      }

      // Clean Content-Type for result (strip charset and other params)
      const cleanContentType = rawContentType.split(';')[0].trim();

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });

      const result: HttpResult = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        isBase64: isBinary,
        contentType: cleanContentType,
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
        isBase64: false,
        contentType: '',
        json: undefined,
        success: false,
        error: errorMessage,
        responseTime,
        size: 0,
      };
    }
  }

  /**
   * Determines if a Content-Type represents text content (as opposed to binary).
   * Binary content will be base64-encoded in the response body.
   */
  private isTextMimeType(rawContentType: string): boolean {
    if (!rawContentType) return true; // default to text for backward compat

    // Strip charset and other params: "text/html; charset=utf-8" → "text/html"
    const mimeType = rawContentType.split(';')[0].trim().toLowerCase();

    // Text prefixes
    if (mimeType.startsWith('text/')) return true;

    // Explicit text types
    const textTypes = [
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript',
      'application/x-sh',
      'application/x-yaml',
      'application/x-toml',
      'application/csv',
      'application/x-www-form-urlencoded',
    ];
    if (textTypes.includes(mimeType)) return true;

    // Structured syntax suffixes (e.g., application/vnd.api+json, application/soap+xml)
    if (mimeType.endsWith('+json') || mimeType.endsWith('+xml')) return true;

    return false;
  }
}
