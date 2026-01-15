import Browserbase from '@browserbasehq/sdk';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db, userCredentials } from '../db/index.js';
import { CredentialEncryption } from '../utils/encryption.js';
import {
  CredentialType,
  BROWSER_SESSION_PROVIDERS,
} from '@bubblelab/shared-schemas';

/**
 * CDP Cookie interface matching Chrome DevTools Protocol
 */
interface CDPCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

/**
 * Active session data stored in memory
 */
interface ActiveSession {
  userId: string;
  credentialType: CredentialType;
  credentialName?: string;
  sessionId: string;
  contextId: string;
  browser: Browser;
  page: Page;
  timestamp: number;
}

/**
 * State store for session creation CSRF protection
 */
interface StateData {
  userId: string;
  credentialType: CredentialType;
  credentialName?: string;
  sessionId: string;
  contextId: string;
  timestamp: number;
}

/**
 * Browser session credential data returned for injection
 */
export interface BrowserSessionCredentialData {
  contextId: string;
  cookies: CDPCookie[];
}

/**
 * BrowserBase service for managing browser-based authentication sessions.
 * Creates remote browser sessions where users can manually log in,
 * then captures cookies for credential storage.
 */
export class BrowserbaseService {
  private bb: Browserbase | null = null;
  private projectId: string = '';
  private activeSessions: Map<string, ActiveSession> = new Map(); // state -> session
  private stateStore: Map<string, StateData> = new Map();

  constructor() {
    if (!env.BROWSERBASE_API_KEY || !env.BROWSERBASE_PROJECT_ID) {
      console.warn(
        '[BrowserbaseService] BrowserBase credentials not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID'
      );
      return;
    }

    this.bb = new Browserbase({ apiKey: env.BROWSERBASE_API_KEY });
    this.projectId = env.BROWSERBASE_PROJECT_ID;

    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Check if BrowserBase is configured
   */
  isConfigured(): boolean {
    return this.bb !== null && this.projectId !== '';
  }

  /**
   * Create a new browser session for authentication
   */
  async createSession(
    userId: string,
    credentialType: CredentialType,
    credentialName?: string
  ): Promise<{
    sessionId: string;
    debugUrl: string;
    contextId: string;
    state: string;
  }> {
    if (!this.isConfigured() || !this.bb) {
      throw new Error('BrowserBase is not configured');
    }

    // Validate credential type is browser-session based
    const providerConfig =
      BROWSER_SESSION_PROVIDERS.browserbase.credentialTypes[credentialType];
    if (!providerConfig) {
      throw new Error(
        `Credential type ${credentialType} does not support browser session authentication`
      );
    }

    // Create a new context for persistent sessions
    const context = await this.bb.contexts.create({
      projectId: this.projectId,
    });
    const contextId = context.id;
    console.log(`[BrowserbaseService] Created new context: ${contextId}`);

    // Create session with context
    const session = await this.bb.sessions.create({
      projectId: this.projectId,
      browserSettings: {
        context: { id: contextId, persist: true },
      },
    });
    const sessionId = session.id;
    console.log(`[BrowserbaseService] Session started: ${sessionId}`);

    // Connect via Puppeteer CDP
    const browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
      defaultViewport: { width: 1280, height: 900 },
    });

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    // Navigate to target URL
    await page.goto(providerConfig.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    console.log(
      `[BrowserbaseService] Navigated to ${providerConfig.targetUrl}`
    );

    // Get debug URL
    const debug = await this.bb.sessions.debug(sessionId);
    const debugUrl = debug.debuggerFullscreenUrl;

    // Generate state for CSRF protection
    const state = randomUUID();
    const timestamp = Date.now();

    // Store session info
    this.stateStore.set(state, {
      userId,
      credentialType,
      credentialName,
      sessionId,
      contextId,
      timestamp,
    });

    this.activeSessions.set(state, {
      userId,
      credentialType,
      credentialName,
      sessionId,
      contextId,
      browser,
      page,
      timestamp,
    });

    return { sessionId, debugUrl, contextId, state };
  }

  /**
   * Complete a browser session and capture credentials
   */
  async completeSession(
    state: string,
    credentialName?: string
  ): Promise<{ credentialId: number }> {
    // Validate state
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new Error('Invalid or expired state parameter');
    }

    // Check state expiration (30 minutes for browser sessions)
    if (Date.now() - stateData.timestamp > 30 * 60 * 1000) {
      this.stateStore.delete(state);
      this.activeSessions.delete(state);
      throw new Error('Session expired - please try again');
    }

    const activeSession = this.activeSessions.get(state);
    if (!activeSession) {
      throw new Error('No active session found');
    }

    try {
      // Capture cookies via CDP
      const cookies = await this.getCookies(
        activeSession.page,
        activeSession.credentialType
      );
      console.log(`[BrowserbaseService] Captured ${cookies.length} cookies`);

      if (cookies.length === 0) {
        throw new Error(
          'No cookies captured - please ensure you completed the login'
        );
      }

      // Store credential in database
      const credentialId = await this.storeCredential(
        stateData.userId,
        stateData.credentialType,
        stateData.contextId,
        cookies,
        credentialName || stateData.credentialName
      );

      return { credentialId };
    } finally {
      // Clean up session
      await this.endSession(state);
    }
  }

  /**
   * Reopen an existing session with stored context ID for sync/review
   */
  async reopenSession(
    userId: string,
    credentialId: number
  ): Promise<{
    sessionId: string;
    debugUrl: string;
  }> {
    if (!this.isConfigured() || !this.bb) {
      throw new Error('BrowserBase is not configured');
    }

    // Get credential from database
    const credential = await db.query.userCredentials.findFirst({
      where: and(
        eq(userCredentials.id, credentialId),
        eq(userCredentials.userId, userId)
      ),
    });

    if (!credential) {
      throw new Error('Credential not found');
    }

    if (!credential.isBrowserSession || !credential.browserbaseContextId) {
      throw new Error('Credential is not a browser session credential');
    }

    const contextId = credential.browserbaseContextId;

    // Get provider config for target URL
    const providerConfig =
      BROWSER_SESSION_PROVIDERS.browserbase.credentialTypes[
        credential.credentialType as CredentialType
      ];
    if (!providerConfig) {
      throw new Error('Unknown credential type for browser session');
    }

    // Create session with existing context
    const session = await this.bb.sessions.create({
      projectId: this.projectId,
      browserSettings: {
        context: { id: contextId, persist: true },
      },
    });
    const sessionId = session.id;
    console.log(
      `[BrowserbaseService] Reopened session ${sessionId} with context ${contextId}`
    );

    // Get debug URL
    const debug = await this.bb.sessions.debug(sessionId);
    const debugUrl = debug.debuggerFullscreenUrl;

    // Navigate to target URL in background (don't await, don't disconnect)
    // This keeps the session alive while allowing the user to interact via debug URL
    puppeteer
      .connect({
        browserWSEndpoint: session.connectUrl,
        defaultViewport: { width: 1280, height: 900 },
      })
      .then(async (browser) => {
        const pages = await browser.pages();
        const page = pages[0] || (await browser.newPage());
        await page.goto(providerConfig.targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        // Don't disconnect - let the session stay alive for user interaction
      })
      .catch((err) => {
        console.error('[BrowserbaseService] Navigation error:', err);
      });

    return { sessionId, debugUrl };
  }

  /**
   * Close/release a browser session
   */
  async closeSession(sessionId: string): Promise<void> {
    if (!this.isConfigured() || !this.bb) {
      throw new Error('BrowserBase is not configured');
    }

    try {
      await this.bb.sessions.update(sessionId, {
        projectId: this.projectId,
        status: 'REQUEST_RELEASE',
      });
      console.log(`[BrowserbaseService] Session ${sessionId} closed`);
    } catch (error) {
      console.error('[BrowserbaseService] Error closing session:', error);
      throw error;
    }
  }

  /**
   * Get cookies from the browser page
   */
  private async getCookies(
    page: Page,
    credentialType: CredentialType
  ): Promise<CDPCookie[]> {
    const providerConfig =
      BROWSER_SESSION_PROVIDERS.browserbase.credentialTypes[credentialType];
    if (!providerConfig) {
      return [];
    }

    const client = await page.createCDPSession();
    const { cookies } = (await client.send('Network.getAllCookies')) as {
      cookies: CDPCookie[];
    };

    // Filter cookies by domain
    return cookies.filter((c) =>
      c.domain.includes(providerConfig.cookieDomain)
    );
  }

  /**
   * Store the captured credential
   */
  private async storeCredential(
    userId: string,
    credentialType: CredentialType,
    contextId: string,
    cookies: CDPCookie[],
    credentialName?: string
  ): Promise<number> {
    // Encrypt cookies
    const encryptedCookies = await CredentialEncryption.encrypt(
      JSON.stringify(cookies)
    );

    const providerConfig =
      BROWSER_SESSION_PROVIDERS.browserbase.credentialTypes[credentialType];

    const [result] = await db
      .insert(userCredentials)
      .values({
        userId,
        credentialType,
        name:
          credentialName || providerConfig?.displayName || 'Browser Session',
        isBrowserSession: true,
        browserbaseContextId: contextId,
        browserbaseCookies: encryptedCookies,
        browserbaseSessionData: {
          capturedAt: new Date().toISOString(),
          cookieCount: cookies.length,
          domain: providerConfig?.cookieDomain || 'unknown',
        },
        isOauth: false,
        metadata: null,
      })
      .returning({ id: userCredentials.id });

    console.log(
      `[BrowserbaseService] Stored credential ${result.id} with ${cookies.length} cookies`
    );
    return result.id;
  }

  /**
   * Get decrypted credential data (cookies + contextId) for injection
   */
  async getCredentialData(
    credentialId: number
  ): Promise<BrowserSessionCredentialData | null> {
    const credential = await db.query.userCredentials.findFirst({
      where: eq(userCredentials.id, credentialId),
    });

    if (
      !credential ||
      !credential.isBrowserSession ||
      !credential.browserbaseCookies
    ) {
      return null;
    }

    try {
      const decrypted = await CredentialEncryption.decrypt(
        credential.browserbaseCookies
      );
      const cookies = JSON.parse(decrypted) as CDPCookie[];

      return {
        contextId: credential.browserbaseContextId || '',
        cookies,
      };
    } catch (error) {
      console.error('[BrowserbaseService] Failed to decrypt cookies:', error);
      return null;
    }
  }

  /**
   * End a browser session
   */
  private async endSession(state: string): Promise<void> {
    const session = this.activeSessions.get(state);
    if (!session) return;

    try {
      // Disconnect browser
      await session.browser.disconnect();

      // Close session on BrowserBase
      if (this.bb) {
        await this.bb.sessions.update(session.sessionId, {
          projectId: this.projectId,
          status: 'REQUEST_RELEASE',
        });
      }
      console.log(`[BrowserbaseService] Session ${session.sessionId} closed`);
    } catch (e) {
      console.error('[BrowserbaseService] Error closing session:', e);
    } finally {
      this.stateStore.delete(state);
      this.activeSessions.delete(state);
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredStates: string[] = [];

    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.timestamp > 30 * 60 * 1000) {
        expiredStates.push(state);
      }
    }

    for (const state of expiredStates) {
      this.endSession(state);
    }

    if (expiredStates.length > 0) {
      console.info(
        `[BrowserbaseService] Cleaned up ${expiredStates.length} expired sessions`
      );
    }
  }
}

// Export singleton instance
export const browserbaseService = new BrowserbaseService();
