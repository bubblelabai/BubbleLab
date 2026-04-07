import { decodeCredentialPayload } from '@bubblelab/shared-schemas';

export interface MetabaseCredentials {
  url: string;
  apiKey: string;
}

/**
 * Parse a multi-field credential value into typed Metabase fields.
 * Uses the shared decodeCredentialPayload() which handles both
 * base64 (injection path) and raw JSON (validator path).
 */
export function parseMetabaseCredential(value: string): MetabaseCredentials {
  const parsed = decodeCredentialPayload<Record<string, string>>(value);
  if (!parsed.url || !parsed.apiKey) {
    throw new Error(
      'Metabase credential is missing required fields: url, apiKey'
    );
  }
  return {
    url: parsed.url.replace(/\/+$/, ''), // strip trailing slashes
    apiKey: parsed.apiKey,
  };
}

/**
 * Enhance Metabase API error messages with helpful hints
 */
export function enhanceMetabaseErrorMessage(
  error: string,
  statusCode?: number
): string {
  if (statusCode === 401) {
    return `${error}\n\nHint: Your Metabase API key may be invalid or expired. Please check your credentials.`;
  }
  if (statusCode === 403) {
    return `${error}\n\nHint: Your Metabase API key may not have permission for this operation.`;
  }
  if (statusCode === 404) {
    return `${error}\n\nHint: The requested resource was not found. Check that the ID is correct.`;
  }
  return error;
}
