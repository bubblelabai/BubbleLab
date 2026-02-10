import { z } from 'zod';

/**
 * Schema for parsing browser session data from credentials (LINKEDIN_CRED, etc.)
 */
export const BrowserSessionDataSchema = z.object({
  contextId: z.string(),
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      domain: z.string(),
      path: z.string().optional(),
      expires: z.number().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
    })
  ),
});

/**
 * Custom proxy configuration
 */
export const CustomProxySchema = z.object({
  id: z.string().describe('User-provided identifier for the proxy'),
  server: z.string().describe('Proxy server URL'),
  username: z.string().optional().describe('Proxy authentication username'),
  password: z.string().optional().describe('Proxy authentication password'),
});

/**
 * Proxy choice - none, browserbase, or custom proxy
 */
export const ProxyChoiceSchema = z.union([
  z.object({ type: z.enum(['none']) }),
  z.object({ type: z.enum(['browserbase']) }),
  z.object({ type: z.enum(['custom']), proxy: CustomProxySchema }),
]);

export type CustomProxy = z.infer<typeof CustomProxySchema>;
export type ProxyChoice = z.infer<typeof ProxyChoiceSchema>;
