const BASE_URL = 'https://api.assembledhq.com/v0';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Builds Basic Auth header from an Assembled API key.
 * Assembled uses the API key as the Basic Auth username with no password.
 */
function buildAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

/**
 * Enhance error messages with helpful hints based on HTTP status
 */
function enhanceErrorMessage(status: number, body: string): string {
  let detail = body;
  try {
    const parsed = JSON.parse(body);
    detail = parsed.error || parsed.message || parsed.detail || body;
  } catch {
    // keep raw body
  }

  switch (status) {
    case 401:
      return `Authentication failed (HTTP 401): Invalid API key. Ensure your Assembled API key starts with "sk_live_". ${detail}`;
    case 403:
      return `Access denied (HTTP 403): Your API key does not have permission for this operation. ${detail}`;
    case 404:
      return `Not found (HTTP 404): The requested resource does not exist. ${detail}`;
    case 429:
      return `Rate limited (HTTP 429): Too many requests. Assembled allows 300 requests/min. ${detail}`;
    default:
      return `HTTP ${status}: ${detail}`;
  }
}

export interface AssembledRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  apiKey: string;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string | number | boolean | undefined>;
}

/**
 * Make an authenticated request to the Assembled API.
 */
export async function makeAssembledRequest<T = unknown>(
  options: AssembledRequestOptions
): Promise<T> {
  const { method, path, apiKey, body, queryParams } = options;

  // Build URL with query params
  const url = new URL(`${BASE_URL}${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Authorization: buildAuthHeader(apiKey),
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(body);
    }

    // For DELETE with body, we still need to send it
    if (body && method === 'DELETE') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(enhanceErrorMessage(response.status, errorBody));
    }

    // Some DELETE operations may return empty body
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Request to Assembled API timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
