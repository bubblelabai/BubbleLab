/**
 * Sanitizes error messages to remove sensitive credential information
 */

/**
 * Sanitizes a string to remove credential patterns
 */
function sanitizeString(str: string): string {
  if (!str) return str;

  let sanitized = str;

  // Common credential field name patterns (case-insensitive)
  const credentialFieldPatterns = [
    'api[_-]?key',
    'access[_-]?key',
    'secret[_-]?key',
    'secret',
    'token',
    'password',
    'passwd',
    'pwd',
    'auth[_-]?token',
    'bearer[_-]?token',
    'account[_-]?id',
    'client[_-]?id',
    'client[_-]?secret',
    'private[_-]?key',
    'public[_-]?key',
    'api[_-]?secret',
    'credential',
    'auth',
    'authentication',
  ];

  // Create pattern to match any credential field name
  const credentialPattern = new RegExp(
    `(${credentialFieldPatterns.join('|')})["\\s]*:["\\s]*(["'])([^"']+)\\2`,
    'gi'
  );

  // Replace credential values with [REDACTED]
  sanitized = sanitized.replace(
    credentialPattern,
    (match, fieldName, quote, value) => {
      // Only replace if it looks like a credential value (long alphanumeric/hex string)
      if (value.length > 8 && /^[a-zA-Z0-9+\/=-]+$/.test(value)) {
        return `${fieldName}: ${quote}[REDACTED]${quote}`;
      }
      return match;
    }
  );

  // Sanitize entire credentials objects that might be in the error
  // Match: credentials: { ... }
  sanitized = sanitized.replace(
    /credentials["\s]*:["\s]*\{[^}]*\}/gi,
    'credentials: { [REDACTED] }'
  );

  // Sanitize any object literal that contains credential-like keys
  // This catches objects like { CLOUDFLARE_R2_ACCESS_KEY: "...", ... }
  sanitized = sanitized.replace(
    /\{[^}]*\b(?:API[_-]?KEY|ACCESS[_-]?KEY|SECRET[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)\b[^}]*\}/gi,
    (match) => {
      // Replace all values in this object that look like credentials
      return match.replace(
        /([\w_]+)["\s]*:["\s]*(["'])([^"']+)\2/g,
        (fullMatch, key, quote, value) => {
          // Check if the key looks like a credential field
          const isCredentialKey = credentialFieldPatterns.some((pattern) =>
            new RegExp(pattern, 'i').test(key)
          );

          // Check if the value looks like a credential
          const isCredentialValue =
            value.length > 8 && /^[a-zA-Z0-9+\/=-]+$/.test(value);

          if (isCredentialKey || isCredentialValue) {
            return `${key}: ${quote}[REDACTED]${quote}`;
          }
          return fullMatch;
        }
      );
    }
  );

  return sanitized;
}

/**
 * Sanitizes error messages to remove sensitive credential information
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';

  let errorMessage = '';

  if (error instanceof Error) {
    errorMessage = error.message;

    // Also sanitize stack traces if present
    if (error.stack) {
      errorMessage = sanitizeString(error.stack);
    } else {
      errorMessage = sanitizeString(errorMessage);
    }
  } else {
    errorMessage = sanitizeString(String(error));
  }

  return errorMessage;
}

/**
 * Safely extracts error message without exposing sensitive data
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Sanitize both message and stack trace
    const sanitizedMessage = sanitizeString(error.message);
    const sanitizedStack = error.stack ? sanitizeString(error.stack) : '';

    // If stack trace contains credentials, prefer sanitized stack
    // Otherwise use sanitized message
    if (sanitizedStack && sanitizedStack !== error.stack) {
      return sanitizedStack.split('\n')[0] || sanitizedMessage;
    }

    return sanitizedMessage;
  }

  const errorStr = String(error);

  // If the error string contains credential-like patterns, sanitize it
  const credentialIndicators = [
    'credentials',
    'api_key',
    'access_key',
    'secret_key',
    'secret',
    'token',
    'password',
    'auth',
    'credential',
  ];

  const hasCredentialIndicators = credentialIndicators.some((indicator) =>
    errorStr.toLowerCase().includes(indicator.toLowerCase())
  );

  if (hasCredentialIndicators) {
    return sanitizeString(errorStr);
  }

  return errorStr;
}
