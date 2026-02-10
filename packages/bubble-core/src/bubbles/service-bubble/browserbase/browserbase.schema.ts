import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * CDP Cookie schema matching Chrome DevTools Protocol
 */
export const CDPCookieSchema = z.object({
  name: z.string().describe('Cookie name'),
  value: z.string().describe('Cookie value'),
  domain: z.string().describe('Cookie domain'),
  path: z.string().describe('Cookie path'),
  expires: z.number().describe('Expiration timestamp'),
  httpOnly: z.boolean().describe('HTTP only flag'),
  secure: z.boolean().describe('Secure flag'),
});

export type CDPCookie = z.infer<typeof CDPCookieSchema>;

/**
 * Embedded proxy config in browser session credential payload
 * Backward compatible: old credentials omit proxy entirely
 */
export const BrowserSessionProxySchema = z
  .object({
    server: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .optional();

/**
 * Browser session data returned from credential injection
 * This is what gets decrypted from AMAZON_CRED or similar browser session credentials
 */
export const BrowserSessionDataSchema = z.object({
  contextId: z
    .string()
    .describe('BrowserBase context ID for session persistence'),
  cookies: z.array(CDPCookieSchema).describe('Array of cookies to inject'),
  proxy: BrowserSessionProxySchema,
});

export type BrowserSessionData = z.infer<typeof BrowserSessionDataSchema>;

/**
 * Geolocation configuration for BrowserBase proxies
 */
export const ProxyGeolocationSchema = z.object({
  city: z
    .string()
    .optional()
    .describe('City name (e.g., "NEW_YORK", "LONDON")'),
  state: z
    .string()
    .optional()
    .describe('State code for US locations (e.g., "NY", "CA")'),
  country: z
    .string()
    .describe('ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "JP")'),
});

export type ProxyGeolocation = z.infer<typeof ProxyGeolocationSchema>;

/**
 * BrowserBase built-in proxy configuration
 */
export const BrowserbaseProxySchema = z.object({
  type: z.literal('browserbase').describe('Use BrowserBase built-in proxies'),
  geolocation: ProxyGeolocationSchema.optional().describe(
    'Proxy geolocation settings'
  ),
  domainPattern: z
    .string()
    .optional()
    .describe('Regex pattern for domains to route through this proxy'),
});

export type BrowserbaseProxy = z.infer<typeof BrowserbaseProxySchema>;

/**
 * External/custom proxy configuration
 */
export const ExternalProxySchema = z.object({
  type: z.literal('external').describe('Use custom external proxy'),
  server: z
    .string()
    .describe('Proxy server URL (e.g., "http://proxy.example.com:8080")'),
  username: z.string().optional().describe('Proxy authentication username'),
  password: z.string().optional().describe('Proxy authentication password'),
  domainPattern: z
    .string()
    .optional()
    .describe('Regex pattern for domains to route through this proxy'),
});

export type ExternalProxy = z.infer<typeof ExternalProxySchema>;

/**
 * Union type for proxy configurations
 */
export const ProxyConfigSchema = z.discriminatedUnion('type', [
  BrowserbaseProxySchema,
  ExternalProxySchema,
]);

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;

/**
 * Stealth mode configuration for BrowserBase sessions
 */
export const StealthConfigSchema = z.object({
  advancedStealth: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Enable Advanced Stealth Mode with custom Chromium for better anti-bot avoidance (Scale Plan only)'
    ),
  solveCaptchas: z
    .boolean()
    .optional()
    .default(true)
    .describe('Enable automatic CAPTCHA solving (enabled by default)'),
  captchaImageSelector: z
    .string()
    .optional()
    .describe('CSS selector for custom CAPTCHA image element'),
  captchaInputSelector: z
    .string()
    .optional()
    .describe('CSS selector for custom CAPTCHA input field'),
});

export type StealthConfig = z.infer<typeof StealthConfigSchema>;

/**
 * BrowserBase service bubble parameters schema
 * Multi-operation service for browser automation
 */
export const BrowserBaseParamsSchema = z.discriminatedUnion('operation', [
  // Start session operation - creates a new browser session
  z.object({
    operation: z
      .literal('start_session')
      .describe('Create a new BrowserBase browser session'),
    context_id: z
      .string()
      .optional()
      .describe('Existing context ID for session persistence'),
    cookies: z
      .array(CDPCookieSchema)
      .optional()
      .describe('Cookies to inject into the session'),
    viewport_width: z
      .number()
      .min(320)
      .optional()
      .default(1280)
      .describe('Browser viewport width'),
    viewport_height: z
      .number()
      .min(240)
      .optional()
      .default(900)
      .describe('Browser viewport height'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Credentials including AMAZON_CRED for browser session data'),
    // Proxy configuration
    proxies: z
      .union([z.literal(true), z.array(ProxyConfigSchema)])
      .optional()
      .describe(
        'Proxy configuration: true for built-in proxies, or array of proxy configs with routing rules'
      ),
    // Stealth mode configuration
    stealth: StealthConfigSchema.optional().describe(
      'Stealth mode configuration for anti-bot avoidance and CAPTCHA solving'
    ),
    // Session timeout (BrowserBase: 60-21600 seconds)
    timeout_seconds: z
      .number()
      .min(60)
      .max(21600)
      .optional()
      .describe(
        'Session timeout in seconds. Duration after which the session automatically ends (60-21600).'
      ),
  }),

  // Navigate operation - navigate to a URL
  z.object({
    operation: z.literal('navigate').describe('Navigate to a URL'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    url: z.string().url().describe('URL to navigate to'),
    wait_until: z
      .enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
      .optional()
      .default('domcontentloaded')
      .describe('Wait condition for navigation'),
    timeout: z
      .number()
      .min(1000)
      .optional()
      .default(30000)
      .describe('Navigation timeout in milliseconds'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Click operation - click an element
  z.object({
    operation: z.literal('click').describe('Click an element on the page'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    selector: z.string().min(1).describe('CSS selector of element to click'),
    wait_for_navigation: z
      .boolean()
      .optional()
      .default(false)
      .describe('Wait for navigation after click'),
    timeout: z
      .number()
      .min(1000)
      .optional()
      .default(5000)
      .describe('Element wait timeout in milliseconds'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Type operation - type text into an element
  z.object({
    operation: z.literal('type').describe('Type text into an input element'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    selector: z.string().min(1).describe('CSS selector of input element'),
    text: z.string().describe('Text to type'),
    clear_first: z
      .boolean()
      .optional()
      .default(false)
      .describe('Clear the input before typing'),
    delay: z
      .number()
      .min(0)
      .optional()
      .default(0)
      .describe('Delay between keystrokes in milliseconds'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Evaluate operation - run JavaScript in page context
  z.object({
    operation: z
      .literal('evaluate')
      .describe('Execute JavaScript in page context'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    script: z
      .string()
      .min(1)
      .describe('JavaScript code to execute (will be wrapped in a function)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Get content operation - get page HTML or text content
  z.object({
    operation: z.literal('get_content').describe('Get page or element content'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    selector: z
      .string()
      .optional()
      .describe(
        'CSS selector for specific element (optional, defaults to body)'
      ),
    content_type: z
      .enum(['html', 'text', 'outer_html'])
      .optional()
      .default('text')
      .describe('Type of content to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Screenshot operation - take a screenshot
  z.object({
    operation: z
      .literal('screenshot')
      .describe('Take a screenshot of the page'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    selector: z
      .string()
      .optional()
      .describe(
        'CSS selector for specific element (optional, defaults to full page)'
      ),
    full_page: z
      .boolean()
      .optional()
      .default(false)
      .describe('Capture full scrollable page'),
    format: z
      .enum(['png', 'jpeg', 'webp'])
      .optional()
      .default('png')
      .describe('Screenshot image format'),
    quality: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe('Image quality for jpeg/webp (0-100)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Wait operation - wait for condition
  z.object({
    operation: z.literal('wait').describe('Wait for a condition'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    wait_type: z
      .enum(['selector', 'timeout', 'navigation'])
      .describe('Type of wait condition'),
    selector: z
      .string()
      .optional()
      .describe('CSS selector to wait for (for selector wait_type)'),
    timeout: z
      .number()
      .min(0)
      .optional()
      .default(5000)
      .describe('Wait timeout in milliseconds'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // Get cookies operation - retrieve cookies from session
  z.object({
    operation: z
      .literal('get_cookies')
      .describe('Get cookies from the browser'),
    session_id: z.string().min(1).describe('Active browser session ID'),
    domain_filter: z
      .string()
      .optional()
      .describe('Filter cookies by domain (partial match)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),

  // End session operation - close browser and release resources
  z.object({
    operation: z
      .literal('end_session')
      .describe('Close browser session and release resources'),
    session_id: z.string().min(1).describe('Session ID to close'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values'),
  }),
]);

/**
 * BrowserBase result schemas for each operation
 */
export const BrowserBaseResultSchema = z.discriminatedUnion('operation', [
  // Start session result
  z.object({
    operation: z.literal('start_session'),
    success: z.boolean().describe('Whether the operation was successful'),
    session_id: z.string().optional().describe('Created session ID'),
    context_id: z.string().optional().describe('Context ID for persistence'),
    debug_url: z.string().optional().describe('Debug URL for live viewing'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Navigate result
  z.object({
    operation: z.literal('navigate'),
    success: z.boolean().describe('Whether the operation was successful'),
    url: z.string().optional().describe('Final URL after navigation'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Click result
  z.object({
    operation: z.literal('click'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Type result
  z.object({
    operation: z.literal('type'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Evaluate result
  z.object({
    operation: z.literal('evaluate'),
    success: z.boolean().describe('Whether the operation was successful'),
    result: z.unknown().optional().describe('Result of JavaScript execution'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get content result
  z.object({
    operation: z.literal('get_content'),
    success: z.boolean().describe('Whether the operation was successful'),
    content: z.string().optional().describe('Retrieved content'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Screenshot result
  z.object({
    operation: z.literal('screenshot'),
    success: z.boolean().describe('Whether the operation was successful'),
    data: z.string().optional().describe('Base64-encoded screenshot data'),
    format: z.string().optional().describe('Image format'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Wait result
  z.object({
    operation: z.literal('wait'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get cookies result
  z.object({
    operation: z.literal('get_cookies'),
    success: z.boolean().describe('Whether the operation was successful'),
    cookies: z.array(CDPCookieSchema).optional().describe('Retrieved cookies'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // End session result
  z.object({
    operation: z.literal('end_session'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// Type exports
export type BrowserBaseParams = z.output<typeof BrowserBaseParamsSchema>;
export type BrowserBaseParamsInput = z.input<typeof BrowserBaseParamsSchema>;
export type BrowserBaseResult = z.output<typeof BrowserBaseResultSchema>;
