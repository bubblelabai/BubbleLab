import { ToolBubble } from '../../../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../../../types/bubble.js';
import {
  BrowserBaseBubble,
  type CDPCookie,
} from '../../../service-bubble/browserbase/index.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { parseBrowserSessionData, buildProxyConfig } from '../_shared/utils.js';
import {
  LinkedInConnectionToolParamsSchema,
  LinkedInConnectionToolResultSchema,
  type LinkedInConnectionToolParamsInput,
  type LinkedInConnectionToolResult,
  type ProfileInfo,
} from './schema.js';

/**
 * Recordable LinkedIn Connection Tool
 *
 * A tool bubble for automating LinkedIn connection requests with step recording.
 * Each major action is decorated with @RecordableStep to capture before/after
 * screenshots, URLs, and timing information.
 */
export class LinkedInConnectionTool<
  T extends
    LinkedInConnectionToolParamsInput = LinkedInConnectionToolParamsInput,
> extends ToolBubble<T, LinkedInConnectionToolResult> {
  static readonly bubbleName = 'linkedin-connection-tool' as const;
  static readonly schema = LinkedInConnectionToolParamsSchema;
  static readonly resultSchema = LinkedInConnectionToolResultSchema;
  static readonly shortDescription =
    'LinkedIn connection automation with step recording';
  static readonly longDescription = `
    Recordable LinkedIn Connection Tool for automating connection requests.
    Records each step with screenshots and timing information for debugging.
  `;
  static readonly alias = 'linkedin-recordable';
  static readonly type = 'tool';

  private sessionId: string | null = null;
  private contextId: string | null = null;
  private cookies: CDPCookie[] | null = null;

  constructor(
    params: T = { operation: 'send_connection', profile_url: '' } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  /** Required by RecordableToolBubble - returns the active browser session ID */
  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.LINKEDIN_CRED];
  }

  private parseBrowserSessionData() {
    return parseBrowserSessionData(this.chooseCredential());
  }

  // ==================== RECORDABLE STEPS ====================

  private async stepStartBrowserSession(): Promise<void> {
    if (this.sessionId) return;

    const sessionData = this.parseBrowserSessionData();
    if (sessionData) {
      this.contextId = sessionData.contextId;
      this.cookies = sessionData.cookies;
    }

    const proxyConfig = buildProxyConfig(this.params.proxy);
    const browserbase = new BrowserBaseBubble(
      {
        operation: 'start_session' as const,
        context_id: this.contextId || undefined,
        cookies: this.cookies || undefined,
        credentials: this.params.credentials,
        stealth: { solveCaptchas: true },
        ...proxyConfig,
      },
      this.context,
      'startsession'
    );

    const result = await browserbase.action();
    if (!result.data.success || !result.data.session_id) {
      throw new Error(result.data.error || 'Failed to start browser session');
    }

    this.sessionId = result.data.session_id;
    if (result.data.context_id) {
      this.contextId = result.data.context_id;
    }
    console.log(`[RecordableLinkedIn] Session started: ${this.sessionId}`);

    const ipAddress = await this.detectIPAddress();
    if (ipAddress) {
      console.log(`[RecordableLinkedIn] Browser IP: ${ipAddress}`);
    }
  }

  private async stepNavigateToProfile(): Promise<void> {
    if (!this.sessionId) throw new Error('No active session');

    const browserbase = new BrowserBaseBubble(
      {
        operation: 'navigate' as const,
        session_id: this.sessionId,
        url: this.params.profile_url,
        wait_until: 'domcontentloaded',
        timeout: 30000,
      },
      this.context,
      'navigate'
    );

    const result = await browserbase.action();
    if (!result.data.success) {
      throw new Error(result.data.error || 'Navigation failed');
    }
  }

  private async stepWaitForProfilePage(): Promise<boolean> {
    const checkScript = `
      (() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
          if (ariaLabel.includes('connect') || text === 'connect') return true;
          if (ariaLabel === 'more actions') return true;
          if (text === 'message' || ariaLabel.includes('message')) return true;
          if (text === 'follow' || ariaLabel.includes('follow')) return true;
        }
        return false;
      })()
    `;

    for (let attempt = 1; attempt <= 30; attempt++) {
      const found = await this.evaluate(checkScript);
      if (found) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  private async stepExtractProfileInfo(): Promise<ProfileInfo | null> {
    const info = (await this.evaluate(`
      (() => {
        let name = '';
        const h1El = document.querySelector('h1');
        if (h1El) name = h1El.textContent?.trim() || '';

        let headline = '';
        const headlineEl = document.querySelector('div.text-body-medium.break-words');
        if (headlineEl) headline = headlineEl.textContent?.trim() || '';

        let location = '';
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (text.includes(',') && text.length < 100 && text.length > 5) {
            if (/(?:United|Kingdom|States|England|Germany|France|India|Canada|Australia)/i.test(text)) {
              location = text;
              break;
            }
          }
        }

        return { name, headline, location, profile_url: window.location.href };
      })()
    `)) as ProfileInfo;

    return info.name ? info : null;
  }

  private async stepClickConnect(): Promise<boolean> {
    const directResult = (await this.evaluate(`
      (() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
          if (ariaLabel.toLowerCase().includes('connect') || text === 'connect') {
            if (btn.classList.contains('artdeco-button--primary') ||
                btn.closest('.pvs-profile-actions') ||
                btn.closest('.pv-top-card-v2-ctas') ||
                btn.closest('.artdeco-dropdown__content')) {
              btn.click();
              return { clicked: true, element: btn.tagName + ' - ' + (ariaLabel || text) };
            }
          }
        }
        return { clicked: false };
      })()
    `)) as { clicked: boolean; element?: string };

    if (directResult.clicked) return true;

    const moreResult = (await this.evaluate(`
      (() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
          if ((ariaLabel === 'more actions' || ariaLabel === 'more' || text === 'more') &&
              (btn.classList.contains('artdeco-dropdown__trigger') || btn.closest('.pv-top-card-v2-ctas'))) {
            btn.click();
            return { clicked: true, element: ariaLabel || text };
          }
        }
        return { clicked: false };
      })()
    `)) as { clicked: boolean; element?: string };

    if (moreResult.clicked) {
      await new Promise((r) => setTimeout(r, 1000));

      const dropdownResult = (await this.evaluate(`
        (() => {
          const items = document.querySelectorAll('.artdeco-dropdown__item[role="button"], .artdeco-dropdown__content [role="button"]');
          for (const item of items) {
            const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase();
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            if (ariaLabel.includes('connect') || text === 'connect') {
              item.click();
              return { clicked: true, element: ariaLabel || text };
            }
          }
          return { clicked: false, itemCount: items.length };
        })()
      `)) as { clicked: boolean; element?: string; itemCount?: number };

      if (dropdownResult.clicked) return true;
      throw new Error(
        `Could not find Connect option in More dropdown (found ${dropdownResult.itemCount} items)`
      );
    }

    throw new Error('Could not find Connect button or More dropdown');
  }

  private async stepWaitForModal(): Promise<boolean> {
    const checkScript = `
      (() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
          if (text.includes('add a note') || text.includes('send without')) return true;
        }
        return false;
      })()
    `;

    for (let attempt = 1; attempt <= 8; attempt++) {
      const found = await this.evaluate(checkScript);
      if (found) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Connection modal did not appear within 8 seconds');
  }

  private async stepAddNote(message: string): Promise<void> {
    await this.evaluate(`
      (() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
          if (text.includes('add a note')) {
            btn.click();
            return true;
          }
        }
        return false;
      })()
    `);

    await new Promise((r) => setTimeout(r, 500));

    await this.evaluate(`
      (() => {
        const textarea = document.querySelector('#custom-message');
        if (textarea) {
          textarea.value = ${JSON.stringify(message)};
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      })()
    `);
  }

  private async stepSendRequest(withNote: boolean): Promise<boolean> {
    if (withNote) {
      const result = (await this.evaluate(`
        (() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            if (text === 'send' && btn.classList.contains('artdeco-button--primary')) {
              btn.click();
              return { clicked: true };
            }
          }
          return { clicked: false };
        })()
      `)) as { clicked: boolean };
      if (!result.clicked)
        throw new Error('Could not find Send button in modal');
      return true;
    } else {
      const result = (await this.evaluate(`
        (() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            if (text.includes('send without')) {
              btn.click();
              return { clicked: true };
            }
          }
          return { clicked: false };
        })()
      `)) as { clicked: boolean };
      if (!result.clicked)
        throw new Error('Could not find "Send without a note" button in modal');
      return true;
    }
  }

  private async stepEndBrowserSession(): Promise<void> {
    if (!this.sessionId) return;

    const browserbase = new BrowserBaseBubble(
      {
        operation: 'end_session' as const,
        session_id: this.sessionId,
      },
      this.context,
      'endsession'
    );

    await browserbase.action();
    console.log(`[RecordableLinkedIn] Session ended: ${this.sessionId}`);
    this.sessionId = null;
  }

  private async evaluate(script: string): Promise<unknown> {
    if (!this.sessionId) throw new Error('No active session');

    const browserbase = new BrowserBaseBubble(
      {
        operation: 'evaluate' as const,
        session_id: this.sessionId,
        script,
      },
      this.context,
      'evaluate'
    );

    const result = await browserbase.action();
    if (!result.data.success) {
      throw new Error(result.data.error || 'Evaluation failed');
    }
    return result.data.result;
  }

  private async detectIPAddress(): Promise<string | null> {
    if (!this.sessionId) return null;
    try {
      const result = await this.evaluate(`
        (async () => {
          try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
          } catch (e) {
            return null;
          }
        })()
      `);
      return result as string | null;
    } catch {
      return null;
    }
  }

  async performAction(): Promise<LinkedInConnectionToolResult> {
    try {
      await this.stepStartBrowserSession();
      await this.stepNavigateToProfile();

      const pageReady = await this.stepWaitForProfilePage();
      if (!pageReady) {
        console.log(
          '[RecordableLinkedIn] Profile page slow to load, continuing anyway'
        );
      }

      const profileInfo = await this.stepExtractProfileInfo();
      await this.stepClickConnect();
      await this.stepWaitForModal();

      const { message } = this.params;
      if (message) {
        await this.stepAddNote(message);
      }

      await this.stepSendRequest(!!message);

      return {
        operation: 'send_connection',
        success: true,
        message: `Connection request sent to ${profileInfo?.name || 'profile'}`,
        profile: profileInfo || undefined,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'send_connection',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.stepEndBrowserSession();
    }
  }
}
