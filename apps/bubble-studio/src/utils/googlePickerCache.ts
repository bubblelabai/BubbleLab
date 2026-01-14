/**
 * Google Picker Token Caching Utility
 *
 * Manages caching of Google Picker access tokens in sessionStorage.
 * Tokens are cached per Google account and expire after 1 hour.
 */

export interface CachedPickerToken {
  accessToken: string;
  expiresAt: number; // timestamp
  accountEmail: string; // which Google account this token is for
}

const CACHE_KEY_PREFIX = 'google_picker_token_';
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer

/**
 * Get a cached Picker token if available and not expired
 * @returns The access token string, or null if no valid token found
 */
export const getCachedPickerToken = (): string | null => {
  try {
    // Check all cached tokens and return first valid one
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        const cached = sessionStorage.getItem(key);
        if (!cached) continue;

        const token: CachedPickerToken = JSON.parse(cached);

        // Validate token structure
        if (
          !token.accessToken ||
          typeof token.accessToken !== 'string' ||
          typeof token.expiresAt !== 'number' ||
          !token.accountEmail ||
          typeof token.accountEmail !== 'string'
        ) {
          sessionStorage.removeItem(key);
          continue;
        }

        // Check if expired (with buffer)
        if (Date.now() >= token.expiresAt - EXPIRY_BUFFER_MS) {
          sessionStorage.removeItem(key);
          continue;
        }

        // console.log(`✅ Using cached token for ${token.accountEmail}`);
        return token.accessToken;
      }
    }
    return null;
  } catch (error) {
    console.error('Error reading cached token:', error);
    return null;
  }
};

/**
 * Cache a Picker token for future use
 * @param accessToken - The Google access token
 * @param accountEmail - The Google account email (or identifier)
 */
export const cachePickerToken = (
  accessToken: string,
  accountEmail: string
): void => {
  try {
    const key = `${CACHE_KEY_PREFIX}${accountEmail}`;
    const token: CachedPickerToken = {
      accessToken,
      expiresAt: Date.now() + TOKEN_EXPIRY_MS,
      accountEmail,
    };

    sessionStorage.setItem(key, JSON.stringify(token));
    // console.log(`💾 Cached token for ${accountEmail}`);
  } catch (error) {
    console.error('Error caching token:', error);
  }
};

/**
 * Clear all cached Picker tokens
 */
export const clearAllPickerTokens = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    // console.log(`🗑️ Cleared ${keysToRemove.length} cached tokens`);
  } catch (error) {
    console.error('Error clearing cached tokens:', error);
  }
};
