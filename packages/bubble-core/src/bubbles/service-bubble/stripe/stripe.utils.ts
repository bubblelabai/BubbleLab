/**
 * Stripe Bubble Utility Functions
 *
 * Helper functions for Stripe API interactions and data formatting.
 */

/**
 * Format amount from smallest currency unit to display format
 * @param amount Amount in smallest currency unit (e.g., cents)
 * @param currency Three-letter ISO currency code
 * @returns Formatted currency string
 */
export function formatStripeAmount(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  // Most currencies use 2 decimal places (divide by 100)
  // Some currencies like JPY use 0 decimal places
  const zeroDecimalCurrencies = [
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'JPY',
    'KMF',
    'KRW',
    'MGA',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XOF',
    'XPF',
  ];
  const divisor = zeroDecimalCurrencies.includes(currency.toUpperCase())
    ? 1
    : 100;
  return formatter.format(amount / divisor);
}

/**
 * Convert display amount to Stripe smallest currency unit
 * @param displayAmount Amount in display format (e.g., 10.99)
 * @param currency Three-letter ISO currency code
 * @returns Amount in smallest currency unit
 */
export function toStripeAmount(
  displayAmount: number,
  currency: string
): number {
  const zeroDecimalCurrencies = [
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'JPY',
    'KMF',
    'KRW',
    'MGA',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XOF',
    'XPF',
  ];
  const multiplier = zeroDecimalCurrencies.includes(currency.toUpperCase())
    ? 1
    : 100;
  return Math.round(displayAmount * multiplier);
}

/**
 * Format Unix timestamp to human-readable date
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatStripeTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Validate Stripe ID format
 * @param id Stripe object ID
 * @param prefix Expected prefix (e.g., 'cus', 'prod', 'price')
 * @returns Whether the ID is valid
 */
export function isValidStripeId(id: string, prefix: string): boolean {
  const pattern = new RegExp(`^${prefix}_[a-zA-Z0-9]+$`);
  return pattern.test(id);
}

/**
 * Enhance Stripe API error messages with helpful hints
 * @param error Original error message
 * @param statusCode HTTP status code
 * @returns Enhanced error message
 */
export function enhanceStripeErrorMessage(
  error: string,
  statusCode?: number
): string {
  if (statusCode === 401) {
    return `${error}\n\nHint: Your Stripe API key may be invalid or expired. Please check your credentials.`;
  }
  if (statusCode === 403) {
    return `${error}\n\nHint: Your Stripe API key may not have permission for this operation. Check your key permissions.`;
  }
  if (statusCode === 404) {
    return `${error}\n\nHint: The requested resource was not found. Check that the ID is correct.`;
  }
  if (statusCode === 429) {
    return `${error}\n\nHint: Rate limit exceeded. Please wait a moment before retrying.`;
  }
  return error;
}
