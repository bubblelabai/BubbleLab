import { decodeCredentialPayload } from '@bubblelab/shared-schemas';

export interface MemberfulCredentials {
  subdomain: string;
  apiKey: string;
}

/**
 * Parse a multi-field Memberful credential into typed fields.
 * Uses the shared decodeCredentialPayload() which handles both base64
 * (injection path) and raw JSON (validator path).
 */
export function parseMemberfulCredential(value: string): MemberfulCredentials {
  const parsed = decodeCredentialPayload<Record<string, string>>(value);
  if (!parsed.subdomain || !parsed.apiKey) {
    throw new Error(
      'Memberful credential is missing required fields: subdomain, apiKey'
    );
  }
  // Users may paste a full URL; normalize to bare subdomain label
  const normalizedSubdomain = parsed.subdomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\.memberful\.com.*$/, '')
    .replace(/\/.*$/, '');
  return {
    subdomain: normalizedSubdomain,
    apiKey: parsed.apiKey.trim(),
  };
}

export function memberfulEndpoint(creds: MemberfulCredentials): string {
  return `https://${creds.subdomain}.memberful.com/api/graphql`;
}

export function enhanceMemberfulErrorMessage(
  error: string,
  statusCode?: number
): string {
  if (statusCode === 401 || statusCode === 403) {
    return `${error}\n\nHint: Your Memberful API key may be invalid or lack permission. Generate a new key in Memberful → Settings → Custom applications.`;
  }
  if (statusCode === 404) {
    return `${error}\n\nHint: The resource was not found, or the subdomain is incorrect. Verify your Memberful subdomain (e.g., "mysite" from mysite.memberful.com).`;
  }
  return error;
}
