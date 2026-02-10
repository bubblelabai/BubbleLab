import type { CDPCookie } from '../../../service-bubble/browserbase/index.js';
import { BrowserSessionDataSchema } from './schema.js';
import type { ProxyChoice } from './schema.js';

export interface BrowserSessionData {
  contextId: string;
  cookies: CDPCookie[];
}

/**
 * Parse browser session credential (base64 JSON) to contextId + cookies
 */
export function parseBrowserSessionData(
  credential: string | undefined
): BrowserSessionData | null {
  if (!credential) return null;

  try {
    const jsonString = Buffer.from(credential, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonString);
    const validated = BrowserSessionDataSchema.safeParse(parsed);
    if (validated.success) {
      const cookies: CDPCookie[] = validated.data.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        expires: c.expires ?? -1,
        httpOnly: c.httpOnly ?? false,
        secure: c.secure ?? false,
      }));
      return {
        contextId: validated.data.contextId,
        cookies,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build proxy configuration for BrowserBase from ProxyChoice
 */
export function buildProxyConfig(proxy: ProxyChoice | undefined): {
  proxies?:
    | true
    | Array<{
        type: 'external';
        server: string;
        username?: string;
        password?: string;
      }>;
} {
  if (!proxy || proxy.type === 'none') {
    return {};
  }
  if (proxy.type === 'browserbase') {
    return { proxies: true };
  }
  if (proxy.type === 'custom') {
    return {
      proxies: [
        {
          type: 'external' as const,
          server: proxy.proxy.server,
          ...(proxy.proxy.username && { username: proxy.proxy.username }),
          ...(proxy.proxy.password && { password: proxy.proxy.password }),
        },
      ],
    };
  }
  return {};
}
