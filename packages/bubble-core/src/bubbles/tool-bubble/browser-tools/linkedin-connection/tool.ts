import { ToolBubble } from '../../../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../../../types/bubble.js';
import { AIFallbackStep } from '../_shared/ai/ai-fallback-step.js';
import {
  BrowserBaseBubble,
  type CDPCookie,
} from '../../../service-bubble/browserbase/index.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { parseBrowserSessionData, buildProxyConfig } from '../_shared/utils.js';
import {
  LinkedInConnectionToolParamsSchema,
  LinkedInConnectionToolResultSchema,
  ProfileInfoSchema,
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

  /** JS helper to query elements across main document, iframes, and shadow DOM */
  private static readonly CROSS_DOM_QUERY = `
    function queryAllDOMs(selector) {
      const results = [...document.querySelectorAll(selector)];
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          if (iframe.contentDocument) {
            results.push(...iframe.contentDocument.querySelectorAll(selector));
          }
        } catch(e) {}
      }
      const shadowHost = document.querySelector('[data-testid="interop-shadowdom"]');
      if (shadowHost && shadowHost.shadowRoot) {
        results.push(...shadowHost.shadowRoot.querySelectorAll(selector));
      }
      return results;
    }
  `;

  /**
   * JS helper to find the profile card's action button container.
   *
   * LinkedIn renders sidebar recommendation buttons (e.g. "Invite Dr. David P.
   * to connect") inside the same <main><section> as the profile card, so we
   * can't rely on section scoping. Instead, we find a known profile-specific
   * button like "Follow <name>" or "Message <name>" and walk up to the action
   * button row that also contains the "More" button.
   */
  private static readonly FIND_ACTION_ROW = `
    function findActionRow() {
      const titleEl = document.querySelector('title');
      const profileName = titleEl ? titleEl.textContent.split('|')[0].trim() : '';
      if (!profileName) return null;

      // Find a button whose aria-label starts with "Follow/Message" + the profile name
      const allBtns = document.querySelectorAll('button, a, [role="button"]');
      let anchorBtn = null;
      for (const btn of allBtns) {
        const aria = btn.getAttribute('aria-label') || '';
        if (aria.includes(profileName) &&
            (aria.startsWith('Follow') || aria.startsWith('Message'))) {
          anchorBtn = btn;
          break;
        }
      }
      if (!anchorBtn) return null;

      // Walk up from the anchor to find the container that also holds the More button
      let container = anchorBtn.parentElement;
      for (let i = 0; i < 5; i++) {
        if (!container || !container.parentElement) break;
        // Check if this container has a More button
        if (container.querySelector('[aria-label="More"], [aria-label*="more actions" i]')) {
          return container;
        }
        container = container.parentElement;
      }

      // Fallback: return the last container we walked up to
      return container || null;
    }
  `;

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

  @AIFallbackStep('Navigate to profile', {
    taskDescription:
      'Navigate to the LinkedIn profile URL and wait for page to load',
  })
  private async stepNavigateToProfile(): Promise<void> {
    if (!this.sessionId) throw new Error('No active session');

    const browserbase = new BrowserBaseBubble(
      {
        operation: 'navigate' as const,
        session_id: this.sessionId,
        url: this.params.profile_url,
        wait_until: 'load',
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

  @AIFallbackStep('Wait for profile page', {
    taskDescription:
      'Wait for LinkedIn profile page to fully load with action buttons (Connect, Message, Follow)',
  })
  private async stepWaitForProfilePage(): Promise<boolean> {
    const checkScript = `
      (() => {
        const elements = document.querySelectorAll('button, a, [role="button"]');
        for (const el of elements) {
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (ariaLabel.includes('connect') || text === 'connect') return true;
          if (ariaLabel === 'more' || ariaLabel.includes('more actions')) return true;
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

  @AIFallbackStep('Extract profile info', {
    taskDescription:
      'Extract the LinkedIn profile name, headline, and location from the profile page',
    extractionSchema: ProfileInfoSchema,
  })
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

  @AIFallbackStep('Click Connect button', {
    taskDescription:
      'Find and click the Connect button to send a connection request. If there is no visible "Connect" button, first click the "More" button to open the dropdown menu, then click "Connect" inside the dropdown. The goal is to open the connection request modal.',
  })
  private async stepClickConnect(): Promise<boolean> {
    const directResult = (await this.evaluate(`
      (() => {
        ${LinkedInConnectionTool.FIND_ACTION_ROW}
        const actionRow = findActionRow();
        if (!actionRow) return { clicked: false, openedMore: false, reason: 'could not find profile action row' };

        // 1. Check for <a> with /custom-invite/ href in action row
        const connectLink = actionRow.querySelector('a[href*="/custom-invite/"]');
        if (connectLink) {
          connectLink.click();
          return { clicked: true, element: 'A - ' + (connectLink.getAttribute('aria-label') || 'custom-invite') };
        }

        // 2. Look for a button with exact text "Connect" in action row
        const buttons = actionRow.querySelectorAll('button, a, [role="button"]');
        for (const el of buttons) {
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (text === 'connect') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              el.click();
              return { clicked: true, element: el.tagName + ' - connect' };
            }
          }
        }

        // 3. Click the "More" (...) button in action row
        const moreBtn = actionRow.querySelector('[aria-label="More"], [aria-label*="more actions" i]');
        if (moreBtn) {
          moreBtn.click();
          return { clicked: false, openedMore: true, element: moreBtn.getAttribute('aria-label') };
        }

        return { clicked: false, openedMore: false, reason: 'no connect or more button in action row' };
      })()
    `)) as {
      clicked: boolean;
      openedMore?: boolean;
      element?: string;
      reason?: string;
    };

    if (directResult.clicked) return true;

    if (directResult.openedMore) {
      await new Promise((r) => setTimeout(r, 1000));

      // Search the dropdown (rendered at document level, outside the action row)
      const dropdownResult = (await this.evaluate(`
        (() => {
          const items = document.querySelectorAll('[role="menuitem"], [role="option"], .artdeco-dropdown__content-inner li');
          for (const item of items) {
            const text = (item.innerText || item.textContent || '').trim().toLowerCase();
            if (text.includes('connect')) {
              item.click();
              return { clicked: true, element: text };
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

    throw new Error(
      `Could not find Connect button or More dropdown: ${directResult.reason || 'unknown'}`
    );
  }

  /**
   * Wait for the connection modal OR detect that the connection was sent
   * directly (no modal). Returns 'modal' if modal appeared, 'pending' if
   * connection was sent directly, or throws if neither happened.
   */
  @AIFallbackStep('Wait for connection modal', {
    taskDescription:
      'Wait for the connection modal to appear with "Add a note" or "Send without a note" buttons',
  })
  private async stepWaitForModal(): Promise<'modal' | 'pending'> {
    const checkScript = `
      (() => {
        ${LinkedInConnectionTool.CROSS_DOM_QUERY}
        const elements = queryAllDOMs('button, a, [role="button"]');
        for (const el of elements) {
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (text.includes('add a note') || text.includes('send without')) return true;
        }
        return false;
      })()
    `;

    for (let attempt = 1; attempt <= 12; attempt++) {
      // Check for the modal FIRST — before dismissing popups, because
      // dismissPopupsOnce could accidentally close the connection modal
      const found = await this.evaluate(checkScript);
      if (found) return 'modal';

      // Check if connection was sent directly (button changed to Pending)
      // This can happen with a delay after clicking Connect
      const pending = await this.checkIfConnectionPending();
      if (pending) return 'pending';

      // Only dismiss popups (Premium upsell, etc.) if modal isn't showing
      await this.dismissPopupsOnce();

      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Connection modal did not appear within 12 seconds');
  }

  @AIFallbackStep('Add note to connection', {
    taskDescription:
      'Click "Add a note" button and type the personalized message into the textarea',
  })
  private async stepAddNote(message: string): Promise<void> {
    await this.evaluate(`
      (() => {
        ${LinkedInConnectionTool.CROSS_DOM_QUERY}
        const elements = queryAllDOMs('button, a, [role="button"]');
        for (const el of elements) {
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (text.includes('add a note')) {
            el.click();
            return true;
          }
        }
        return false;
      })()
    `);

    await new Promise((r) => setTimeout(r, 500));

    await this.evaluate(`
      (() => {
        ${LinkedInConnectionTool.CROSS_DOM_QUERY}
        const textareas = queryAllDOMs('textarea');
        const textarea = textareas.find(t => {
          const rect = t.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }) || textareas[0];
        if (textarea) {
          textarea.value = ${JSON.stringify(message)};
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        return false;
      })()
    `);
  }

  @AIFallbackStep('Send connection request', {
    taskDescription:
      'Click the Send button to submit the connection request. Look for a blue "Send" button or "Send without a note" button in the connection modal.',
  })
  private async stepSendRequest(withNote: boolean): Promise<boolean> {
    if (withNote) {
      const result = (await this.evaluate(`
        (() => {
          ${LinkedInConnectionTool.CROSS_DOM_QUERY}
          const elements = queryAllDOMs('button, a, [role="button"]');
          for (const el of elements) {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (text === 'send') {
              el.click();
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
          ${LinkedInConnectionTool.CROSS_DOM_QUERY}
          const elements = queryAllDOMs('button, a, [role="button"]');
          for (const el of elements) {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (text.includes('send without')) {
              el.click();
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

  /**
   * Check if the connection was already sent directly (no modal).
   * LinkedIn sometimes sends connections immediately when clicking Connect
   * from the More dropdown, skipping the "Add a note" / "Send without a note" modal.
   * In that case the button changes to "Pending".
   *
   * Scoped to the profile card (via h1 ancestor) to avoid matching Pending
   * buttons on sidebar recommendation profiles.
   */
  private async checkIfConnectionPending(): Promise<boolean> {
    const pending = (await this.evaluate(`
      (() => {
        ${LinkedInConnectionTool.FIND_ACTION_ROW}
        const actionRow = findActionRow();
        if (!actionRow) return false;
        const elements = actionRow.querySelectorAll('button, a, [role="button"]');
        for (const el of elements) {
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (text === 'pending') return true;
        }
        return false;
      })()
    `)) as boolean;
    return pending;
  }

  /**
   * Dismiss visible LinkedIn overlay popups (Premium upsell, Sales Navigator,
   * cookie consent, etc.). Called from inside polling loops so it runs on
   * every iteration rather than as a one-shot step.
   */
  private async dismissPopupsOnce(): Promise<number> {
    const dismissed = (await this.evaluate(`
      (() => {
        let count = 0;

        // Helper: check if an element is inside the connection modal
        // (we must NOT dismiss the connection modal itself)
        function isInsideConnectionModal(el) {
          const modal = el.closest('[role="dialog"], .artdeco-modal, .artdeco-modal-overlay');
          if (!modal) return false;
          const modalText = (modal.innerText || '').toLowerCase();
          return modalText.includes('add a note') ||
                 modalText.includes('send without') ||
                 modalText.includes('how would you like to connect');
        }

        // 1. Dismiss buttons with aria-label="Dismiss" that are visible
        //    (LinkedIn Premium popup, upsell modals, etc.)
        //    Skip any Dismiss button inside the connection modal.
        const dismissButtons = document.querySelectorAll('button[aria-label="Dismiss"]');
        for (const btn of dismissButtons) {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && !isInsideConnectionModal(btn)) {
            btn.click();
            count++;
          }
        }

        // 2. "Not now" / "No thanks" links/buttons (common on upsell modals)
        //    Also skip if inside connection modal.
        const allButtons = document.querySelectorAll('button, a, [role="button"]');
        for (const el of allButtons) {
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          if (text === 'not now' || text === 'no thanks' || text === 'maybe later') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && !isInsideConnectionModal(el)) {
              el.click();
              count++;
            }
          }
        }

        return count;
      })()
    `)) as number;

    if (dismissed > 0) {
      console.log(`[RecordableLinkedIn] Dismissed ${dismissed} popup(s)`);
      // Wait for popup close animation
      await new Promise((r) => setTimeout(r, 500));
    }

    return dismissed;
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

      // Let LinkedIn SPA render after navigation — recording overhead
      // previously masked this with ~1-2s of screenshot capture time
      await new Promise((r) => setTimeout(r, 2000));

      const pageReady = await this.stepWaitForProfilePage();
      if (!pageReady) {
        console.log(
          '[RecordableLinkedIn] Profile page slow to load, continuing anyway'
        );
      }

      const profileInfo = await this.stepExtractProfileInfo();
      await this.stepClickConnect();

      // Let the connection modal (or popup) animate in
      await new Promise((r) => setTimeout(r, 1000));

      // LinkedIn sometimes sends the connection directly (no modal) —
      // check if the button already shows "Pending"
      const alreadySent = await this.checkIfConnectionPending();
      if (alreadySent) {
        console.log(
          '[RecordableLinkedIn] Connection sent directly (no modal) — button shows Pending'
        );
        return {
          operation: 'send_connection',
          success: true,
          message: `Connection request sent to ${profileInfo?.name || 'profile'} (direct, no modal)`,
          profile: profileInfo || undefined,
          error: '',
        };
      }

      // Wait for modal or detect late pending state (connection sent
      // directly but Pending button appeared with a delay)
      const modalResult = await this.stepWaitForModal();
      if (modalResult === 'pending') {
        console.log(
          '[RecordableLinkedIn] Connection sent directly (detected during modal wait) — button shows Pending'
        );
        return {
          operation: 'send_connection',
          success: true,
          message: `Connection request sent to ${profileInfo?.name || 'profile'} (direct, no modal)`,
          profile: profileInfo || undefined,
          error: '',
        };
      }

      const { message } = this.params;
      if (message) {
        await this.stepAddNote(message);
        // Let LinkedIn process the note input before looking for Send
        await new Promise((r) => setTimeout(r, 500));
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
