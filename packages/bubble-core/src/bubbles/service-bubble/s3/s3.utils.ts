import { decodeCredentialPayload } from '@bubblelab/shared-schemas';

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  region?: string;
}

/**
 * Parse a multi-field credential value into typed S3 fields.
 * Uses the shared decodeCredentialPayload() which handles both
 * base64 (injection path) and raw JSON (validator path).
 */
export function parseS3Credential(value: string): S3Credentials {
  const parsed = decodeCredentialPayload<Record<string, string>>(value);
  if (!parsed.accessKeyId || !parsed.secretAccessKey) {
    throw new Error(
      'S3 credential is missing required fields: accessKeyId, secretAccessKey'
    );
  }
  return {
    accessKeyId: parsed.accessKeyId,
    secretAccessKey: parsed.secretAccessKey,
    endpoint: parsed.endpoint || undefined,
    region: parsed.region || undefined,
  };
}

/**
 * Helper method to detect if a string is base64 encoded
 */
export function isBase64(str: string): boolean {
  try {
    // Check if it's a data URL (e.g., "data:image/png;base64,...")
    if (str.startsWith('data:') && str.includes('base64,')) {
      return true;
    }

    // Check if it's pure base64 (valid base64 characters, proper length)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (base64Regex.test(str) && str.length > 0) {
      // Try to decode and re-encode to verify it's valid base64
      try {
        const decoded = Buffer.from(str, 'base64').toString('base64');
        return decoded === str;
      } catch {
        return false;
      }
    }

    return false;
  } catch {
    return false;
  }
}
