import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  BrowserBaseParamsSchema,
  BrowserBaseResultSchema,
  BrowserSessionDataSchema,
  type BrowserBaseParams,
  type BrowserBaseParamsInput,
  type BrowserBaseResult,
  type CDPCookie,
  type BrowserSessionData,
} from './browserbase.schema.js';

/**
 * Configuration for BrowserBase API
 */
interface BrowserBaseConfig {
  apiKey: string;
  projectId: string;
  baseUrl?: string;
}

/**
 * Active browser session stored in memory
 */
interface ActiveSession {
  sessionId: string;
  contextId: string;
  browser: Browser;
  page: Page;
  connectUrl: string;
}

/**
 * BrowserBase Session creation response from API
 */
interface BrowserBaseSessionResponse {
  id: string;
  connectUrl: string;
  projectId: string;
  status: string;
}

/**
 * BrowserBase Context creation response from API
 */
interface BrowserBaseContextResponse {
  id: string;
  projectId: string;
}

/**
 * BrowserBase Debug response
 */
interface BrowserBaseDebugResponse {
  debuggerFullscreenUrl: string;
}

/**
 * BrowserBase Service Bubble
 *
 * Provides browser automation capabilities using BrowserBase cloud browsers.
 * Supports session management, navigation, clicking, typing, JavaScript
 * execution, content extraction, screenshots, and cookie management.
 *
 * Features:
 * - Cloud-based browser sessions (BrowserBase)
 * - Session persistence via context IDs
 * - Cookie injection for authenticated sessions
 * - Full page automation (click, type, evaluate)
 * - Screenshot and content extraction
 *
 * Use cases:
 * - Automated shopping workflows (Amazon, etc.)
 * - Web scraping with authentication
 * - Form automation and submission
 * - Browser-based testing
 *
 * Security Features:
 * - Sessions are isolated in BrowserBase cloud
 * - Credentials are handled securely
 * - Sessions are properly closed and cleaned up
 */
export class BrowserBaseBubble<
  T extends BrowserBaseParamsInput = BrowserBaseParamsInput,
> extends ServiceBubble<
  T,
  Extract<BrowserBaseResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'browserbase';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'browserbase';
  static readonly schema = BrowserBaseParamsSchema;
  static readonly resultSchema = BrowserBaseResultSchema;
  static readonly shortDescription =
    'Browser automation service using BrowserBase cloud browsers';
  static readonly longDescription = `
    BrowserBase service integration for cloud-based browser automation.

    Features:
    - Cloud-based browser sessions
    - Session persistence via context IDs
    - Cookie injection for authenticated sessions
    - Full page automation (click, type, evaluate)
    - Screenshot and content extraction
    - Cross-browser support

    Use cases:
    - Automated shopping workflows (Amazon, etc.)
    - Web scraping with authentication
    - Form automation and submission
    - Browser-based testing

    Security Features:
    - Sessions are isolated in BrowserBase cloud
    - Credentials are handled securely
    - Sessions are properly closed and cleaned up
  `;
  static readonly alias = 'browser';

  // Static session store shared across instances
  private static activeSessions: Map<string, ActiveSession> = new Map();

  constructor(
    params: T = {
      operation: 'start_session',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  /**
   * Get BrowserBase configuration from environment
   */
  private getConfig(): BrowserBaseConfig | null {
    const apiKey = process.env.BROWSERBASE_API_KEY;
    const projectId = process.env.BROWSERBASE_PROJECT_ID;

    if (!apiKey || !projectId) {
      return null;
    }

    return {
      apiKey,
      projectId,
      baseUrl: 'https://api.browserbase.com/v1',
    };
  }

  /**
   * Make an API request to BrowserBase
   */
  private async browserbaseApi<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const config = this.getConfig();
    if (!config) {
      throw new Error('BrowserBase not configured');
    }

    const url = `${config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'x-bb-api-key': config.apiKey,
      'Content-Type': 'application/json',
    };

    const requestInit: RequestInit = { method, headers };
    if (body) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `BrowserBase API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Parse browser session credential data (cookies + contextId)
   * Credential is base64-encoded JSON to avoid escaping issues
   */
  private parseBrowserSessionCredential(
    credentialValue: string
  ): BrowserSessionData | null {
    try {
      // Credential is base64-encoded JSON
      const jsonString = Buffer.from(credentialValue, 'base64').toString(
        'utf-8'
      );
      const parsed = JSON.parse(jsonString);
      const validated = BrowserSessionDataSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      console.error(
        '[BrowserBaseBubble] Invalid credential format:',
        validated.error
      );
      return null;
    } catch (error) {
      console.error('[BrowserBaseBubble] Failed to parse credential:', error);
      return null;
    }
  }

  public async testCredential(): Promise<boolean> {
    const config = this.getConfig();
    if (!config) {
      return false;
    }

    try {
      // Test by listing projects (simple API call)
      await this.browserbaseApi('/projects');
      return true;
    } catch {
      return false;
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<BrowserBaseResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;
    const parsedParams = this.params as BrowserBaseParams;

    try {
      const result = await (async (): Promise<BrowserBaseResult> => {
        switch (operation) {
          case 'start_session':
            return await this.startSession(
              parsedParams as Extract<
                BrowserBaseParams,
                { operation: 'start_session' }
              >
            );
          case 'navigate':
            return await this.navigate(
              parsedParams as Extract<
                BrowserBaseParams,
                { operation: 'navigate' }
              >
            );
          case 'click':
            return await this.click(
              parsedParams as Extract<BrowserBaseParams, { operation: 'click' }>
            );
          case 'type':
            return await this.typeText(
              parsedParams as Extract<BrowserBaseParams, { operation: 'type' }>
            );
          case 'evaluate':
            return await this.evaluate(
              parsedParams as Extract<
                BrowserBaseParams,
                { operation: 'evaluate' }
              >
            );
          case 'get_content':
            return await this.getContent(
              parsedParams as Extract<
                BrowserBaseParams,
                { operation: 'get_content' }
              >
            );
          case 'screenshot':
            return await this.screenshot(
              parsedParams as Extract<
                BrowserBaseParams,
                { operation: 'screenshot' }
              >
            );
          case 'wait':
            return await this.waitFor(
              parsedParams as Extract<BrowserBaseParams, { operation: 'wait' }>
            );
          case 'get_cookies':
            return await this.getCookies(
              parsedParams as Extract<
                BrowserBaseParams,
                { operation: 'get_cookies' }
              >
            );
          case 'end_session':
            return await this.endSession(
              parsedParams as Extract<
                BrowserBaseParams,
                { operation: 'end_session' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<
        BrowserBaseResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<BrowserBaseResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Start a new browser session
   */
  private async startSession(
    params: Extract<BrowserBaseParams, { operation: 'start_session' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'start_session' }>> {
    const config = this.getConfig();
    if (!config) {
      return {
        operation: 'start_session',
        success: false,
        error:
          'BrowserBase not configured - set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID',
      };
    }

    let contextId = params.context_id;
    let cookiesToInject = params.cookies;
    const hasExistingContext = !!contextId;

    // Try to get contextId from credentials if not provided
    if (!contextId && params.credentials) {
      const amazonCred = params.credentials[CredentialType.AMAZON_CRED];
      if (amazonCred) {
        const sessionData = this.parseBrowserSessionCredential(amazonCred);
        if (sessionData) {
          contextId = sessionData.contextId;
          // Only use cookies as fallback if no contextId from credential
          if (!contextId && sessionData.cookies) {
            cookiesToInject = sessionData.cookies;
          }
          if (contextId) {
            console.log(
              `[BrowserBaseBubble] Using contextId from AMAZON_CRED: ${contextId}`
            );
          }
        }
      }
    }

    const contextFromCredential = !hasExistingContext && !!contextId;

    // Create new context if none provided
    if (!contextId) {
      const contextResponse =
        await this.browserbaseApi<BrowserBaseContextResponse>(
          '/contexts',
          'POST',
          { projectId: config.projectId }
        );
      contextId = contextResponse.id;
      console.log(`[BrowserBaseBubble] Created new context: ${contextId}`);
    }

    // Create session with context
    const sessionResponse =
      await this.browserbaseApi<BrowserBaseSessionResponse>(
        '/sessions',
        'POST',
        {
          projectId: config.projectId,
          browserSettings: {
            context: { id: contextId, persist: true },
          },
        }
      );

    const sessionId = sessionResponse.id;
    const connectUrl = sessionResponse.connectUrl;
    console.log(`[BrowserBaseBubble] Session created: ${sessionId}`);

    // Connect via Puppeteer
    const browser = await puppeteer.connect({
      browserWSEndpoint: connectUrl,
      defaultViewport: {
        width: params.viewport_width || 1280,
        height: params.viewport_height || 900,
      },
    });

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    // Only inject cookies if we created a new context (no existing contextId from param or credential)
    // When contextId exists, BrowserBase context handles cookie persistence automatically
    if (
      !hasExistingContext &&
      !contextFromCredential &&
      cookiesToInject &&
      cookiesToInject.length > 0
    ) {
      const client = await page.createCDPSession();
      for (const cookie of cookiesToInject) {
        await client.send('Network.setCookie', {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
        });
      }
      console.log(
        `[BrowserBaseBubble] Injected ${cookiesToInject.length} cookies (no context)`
      );
    }

    // Get debug URL
    const debugResponse = await this.browserbaseApi<BrowserBaseDebugResponse>(
      `/sessions/${sessionId}/debug`
    );

    // Store session
    BrowserBaseBubble.activeSessions.set(sessionId, {
      sessionId,
      contextId,
      browser,
      page,
      connectUrl,
    });

    // Emit browser session start event for live viewing in UI
    if (this.context?.logger) {
      this.context.logger.logBrowserSessionStart(
        sessionId,
        debugResponse.debuggerFullscreenUrl,
        this.context.variableId
      );
    }

    return {
      operation: 'start_session',
      success: true,
      session_id: sessionId,
      context_id: contextId,
      debug_url: debugResponse.debuggerFullscreenUrl,
      error: '',
    };
  }

  /**
   * Navigate to a URL
   */
  private async navigate(
    params: Extract<BrowserBaseParams, { operation: 'navigate' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'navigate' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'navigate',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    await session.page.goto(params.url, {
      waitUntil: params.wait_until,
      timeout: params.timeout,
    });

    return {
      operation: 'navigate',
      success: true,
      url: session.page.url(),
      error: '',
    };
  }

  /**
   * Click an element
   */
  private async click(
    params: Extract<BrowserBaseParams, { operation: 'click' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'click' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'click',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    await session.page.waitForSelector(params.selector, {
      timeout: params.timeout,
    });

    if (params.wait_for_navigation) {
      await Promise.all([
        session.page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: params.timeout,
        }),
        session.page.click(params.selector),
      ]);
    } else {
      await session.page.click(params.selector);
    }

    return {
      operation: 'click',
      success: true,
      error: '',
    };
  }

  /**
   * Type text into an element
   */
  private async typeText(
    params: Extract<BrowserBaseParams, { operation: 'type' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'type' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'type',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    await session.page.waitForSelector(params.selector);

    if (params.clear_first) {
      await session.page.click(params.selector, { clickCount: 3 });
      await session.page.keyboard.press('Backspace');
    }

    await session.page.type(params.selector, params.text, {
      delay: params.delay,
    });

    return {
      operation: 'type',
      success: true,
      error: '',
    };
  }

  /**
   * Execute JavaScript in page context
   */
  private async evaluate(
    params: Extract<BrowserBaseParams, { operation: 'evaluate' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'evaluate' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'evaluate',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    // Wrap script in an async function for safety
    const result = await session.page.evaluate(params.script);

    return {
      operation: 'evaluate',
      success: true,
      result,
      error: '',
    };
  }

  /**
   * Get page or element content
   */
  private async getContent(
    params: Extract<BrowserBaseParams, { operation: 'get_content' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'get_content' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'get_content',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    let content: string;
    const selector = params.selector || 'body';

    if (params.content_type === 'html') {
      content = await session.page.$eval(selector, (el) => el.innerHTML);
    } else if (params.content_type === 'outer_html') {
      content = await session.page.$eval(selector, (el) => el.outerHTML);
    } else {
      content = await session.page.$eval(
        selector,
        (el) => el.textContent || ''
      );
    }

    return {
      operation: 'get_content',
      success: true,
      content,
      error: '',
    };
  }

  /**
   * Take a screenshot
   */
  private async screenshot(
    params: Extract<BrowserBaseParams, { operation: 'screenshot' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'screenshot' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'screenshot',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    const options: {
      encoding: 'base64';
      fullPage?: boolean;
      type: 'png' | 'jpeg' | 'webp';
      quality?: number;
    } = {
      encoding: 'base64',
      fullPage: params.full_page,
      type: params.format || 'png',
    };

    if (
      params.quality &&
      (params.format === 'jpeg' || params.format === 'webp')
    ) {
      options.quality = params.quality;
    }

    let data: string;

    if (params.selector) {
      const element = await session.page.$(params.selector);
      if (!element) {
        return {
          operation: 'screenshot',
          success: false,
          error: `Element not found: ${params.selector}`,
        };
      }
      data = (await element.screenshot(options)) as string;
    } else {
      data = (await session.page.screenshot(options)) as string;
    }

    return {
      operation: 'screenshot',
      success: true,
      data,
      format: params.format || 'png',
      error: '',
    };
  }

  /**
   * Wait for a condition
   */
  private async waitFor(
    params: Extract<BrowserBaseParams, { operation: 'wait' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'wait' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'wait',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    switch (params.wait_type) {
      case 'selector':
        if (!params.selector) {
          return {
            operation: 'wait',
            success: false,
            error: 'Selector required for selector wait type',
          };
        }
        await session.page.waitForSelector(params.selector, {
          timeout: params.timeout,
        });
        break;

      case 'timeout':
        await new Promise((resolve) => setTimeout(resolve, params.timeout));
        break;

      case 'navigation':
        await session.page.waitForNavigation({
          timeout: params.timeout,
          waitUntil: 'domcontentloaded',
        });
        break;
    }

    return {
      operation: 'wait',
      success: true,
      error: '',
    };
  }

  /**
   * Get cookies from the browser
   */
  private async getCookies(
    params: Extract<BrowserBaseParams, { operation: 'get_cookies' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'get_cookies' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'get_cookies',
        success: false,
        error: 'Session not found. Call start_session first.',
      };
    }

    const client = await session.page.createCDPSession();
    const { cookies } = (await client.send('Network.getAllCookies')) as {
      cookies: CDPCookie[];
    };

    let filteredCookies = cookies;
    if (params.domain_filter) {
      filteredCookies = cookies.filter((c) =>
        c.domain.includes(params.domain_filter!)
      );
    }

    return {
      operation: 'get_cookies',
      success: true,
      cookies: filteredCookies,
      error: '',
    };
  }

  /**
   * End a browser session
   */
  private async endSession(
    params: Extract<BrowserBaseParams, { operation: 'end_session' }>
  ): Promise<Extract<BrowserBaseResult, { operation: 'end_session' }>> {
    const session = BrowserBaseBubble.activeSessions.get(params.session_id);
    if (!session) {
      return {
        operation: 'end_session',
        success: false,
        error: 'Session not found',
      };
    }

    try {
      // Emit browser session end event before closing
      if (this.context?.logger) {
        this.context.logger.logBrowserSessionEnd(
          params.session_id,
          this.context.variableId
        );
      }

      // Disconnect browser
      await session.browser.disconnect();

      // Release session via API
      await this.browserbaseApi(`/sessions/${params.session_id}`, 'POST', {
        projectId: this.getConfig()?.projectId,
        status: 'REQUEST_RELEASE',
      });

      // Remove from active sessions
      BrowserBaseBubble.activeSessions.delete(params.session_id);

      console.log(`[BrowserBaseBubble] Session ${params.session_id} closed`);

      return {
        operation: 'end_session',
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'end_session',
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error closing session',
      };
    }
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    // BrowserBase bubble can use AMAZON_CRED (or other browser session creds)
    // to get contextId and cookies for session initialization
    return credentials[CredentialType.AMAZON_CRED];
  }

  /**
   * Get an active session by ID (for use by other bubbles)
   */
  public static getSession(sessionId: string): ActiveSession | undefined {
    return BrowserBaseBubble.activeSessions.get(sessionId);
  }

  /**
   * Check if a session is active
   */
  public static hasSession(sessionId: string): boolean {
    return BrowserBaseBubble.activeSessions.has(sessionId);
  }
}
