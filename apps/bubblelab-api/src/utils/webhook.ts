import { customAlphabet } from 'nanoid';

// Create a custom nanoid function with URL-safe characters
// Excludes ambiguous characters like 0, O, I, l for better readability
const nanoid = customAlphabet(
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz',
  12
);

/**
 * Generates a unique webhook path for a BubbleFlow
 * @returns A 12-character URL-safe string
 */
export function generateWebhookPath(): string {
  return nanoid();
}

/**
 * Constructs the full webhook URL for a given path with user ID
 * @param path The webhook path
 * @returns The full webhook URL with pattern /webhook/user_id/path
 */
export function getWebhookUrl(userId: string, path?: string): string {
  // TODO: Replace hard-coded user ID "1" with actual user authentication
  return `${process.env.NODEX_API_URL}/webhook/${userId}/${path}`;
}
