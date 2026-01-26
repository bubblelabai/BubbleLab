import { ToolBubble } from '../../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import {
  BrowserBaseBubble,
  BrowserSessionDataSchema,
  type CDPCookie,
} from '../../service-bubble/browserbase/index.js';
import {
  LinkedInConnectionToolParamsSchema,
  LinkedInConnectionToolResultSchema,
  type LinkedInConnectionToolParamsInput,
  type LinkedInConnectionToolResult,
  type ProfileInfo,
} from './linkedin-connection-tool.schema.js';

// Debug logging helper - only logs when DEBUG_BROWSER_BASE env var is set
const DEBUG = process.env.DEBUG_BROWSER_BASE;
function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * LinkedIn Connection Tool
 *
 * A tool bubble for automating LinkedIn connection requests.
 * Handles both profile types:
 * - Profiles with direct "Connect" button
 * - Profiles where "Connect" is under the "More" dropdown
 *
 * Features:
 * - Send connection requests to LinkedIn profiles
 * - Add optional personalized notes
 * - Handle various profile layouts
 *
 * Required Credentials:
 * - LINKEDIN_CRED: Browser session credential with LinkedIn cookies
 *
 * Security:
 * - Uses BrowserBase cloud browsers (isolated)
 * - Credentials are encrypted at rest
 * - Session data is not persisted beyond operation
 */
export class LinkedInConnectionTool<
  T extends
    LinkedInConnectionToolParamsInput = LinkedInConnectionToolParamsInput,
> extends ToolBubble<T, LinkedInConnectionToolResult> {
  static readonly bubbleName: BubbleName = 'linkedin-connection-tool';
  static readonly schema = LinkedInConnectionToolParamsSchema;
  static readonly resultSchema = LinkedInConnectionToolResultSchema;
  static readonly shortDescription =
    'LinkedIn connection automation - send connection requests with optional notes';
  static readonly longDescription = `
    LinkedIn Connection Tool for automating connection requests.

    Features:
    - Send connection requests to LinkedIn profiles
    - Add optional personalized notes (up to 300 characters)
    - Handles profiles with direct Connect button
    - Handles profiles where Connect is under "More" dropdown

    Required Credentials:
    - LINKEDIN_CRED: Browser session credential (authenticate via browser session)

    Note: The tool operates using authenticated browser sessions to ensure security.
  `;
  static readonly alias = 'linkedin';
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

  /**
   * Choose the credential to use for LinkedIn operations
   */
  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.LINKEDIN_CRED];
  }

  /**
   * Parse the LINKEDIN_CRED to extract contextId and cookies
   */
  private parseBrowserSessionData(): {
    contextId: string;
    cookies: CDPCookie[];
  } | null {
    const credential = this.chooseCredential();
    if (!credential) {
      return null;
    }

    try {
      const jsonString = Buffer.from(credential, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonString);
      const validated = BrowserSessionDataSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      console.error(
        '[LinkedInConnectionTool] Invalid credential format:',
        validated.error
      );
      return null;
    } catch (error) {
      console.error(
        '[LinkedInConnectionTool] Failed to parse credential:',
        error
      );
      return null;
    }
  }

  /**
   * Start a browser session using BrowserBase
   */
  private async startBrowserSession(): Promise<string> {
    debugLog('[LinkedInConnectionTool] Starting browser session');
    if (this.sessionId) {
      return this.sessionId;
    }

    const sessionData = this.parseBrowserSessionData();
    if (sessionData) {
      this.contextId = sessionData.contextId;
      this.cookies = sessionData.cookies;
      debugLog(
        `[LinkedInConnectionTool] Loaded session data: contextId=${this.contextId}, cookies=${this.cookies.length}`
      );
    } else {
      debugLog(
        '[LinkedInConnectionTool] No LINKEDIN_CRED found, creating new context'
      );
    }

    const startsession_browserbase = new BrowserBaseBubble(
      {
        operation: 'start_session' as const,
        context_id: this.contextId || undefined,
        cookies: this.cookies || undefined,
        credentials: this.params.credentials,
      },
      this.context,
      'startsession_browserbase'
    );

    const result = await startsession_browserbase.action();

    if (!result.data.success || !result.data.session_id) {
      throw new Error(result.data.error || 'Failed to start browser session');
    }

    this.sessionId = result.data.session_id;
    if (result.data.context_id) {
      this.contextId = result.data.context_id;
    }
    debugLog(
      `[LinkedInConnectionTool] Browser session started: ${this.sessionId}, context: ${this.contextId}`
    );

    if (this.context?.logger && result.data.debug_url) {
      this.context.logger.logBrowserSessionStart(
        this.sessionId,
        result.data.debug_url,
        this.context.variableId
      );
    }

    return this.sessionId;
  }

  /**
   * End the browser session
   */
  private async endBrowserSession(): Promise<void> {
    if (!this.sessionId) return;

    const sessionIdToEnd = this.sessionId;

    try {
      const endsession_browserbase = new BrowserBaseBubble(
        {
          operation: 'end_session' as const,
          session_id: sessionIdToEnd,
        },
        this.context,
        'endsession_browserbase'
      );

      await endsession_browserbase.action();
      debugLog(
        `[LinkedInConnectionTool] Browser session ended: ${sessionIdToEnd}`
      );
    } catch (error) {
      console.error('[LinkedInConnectionTool] Error ending session:', error);
    } finally {
      if (this.context?.logger) {
        this.context.logger.logBrowserSessionEnd(
          sessionIdToEnd,
          this.context.variableId
        );
      }
      this.sessionId = null;
    }
  }

  /**
   * Navigate to a URL
   */
  private async navigateTo(url: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const navigate_browserbase = new BrowserBaseBubble(
      {
        operation: 'navigate' as const,
        session_id: this.sessionId,
        url,
        wait_until: 'domcontentloaded',
        timeout: 30000,
      },
      this.context,
      'navigate_browserbase'
    );

    const result = await navigate_browserbase.action();
    if (!result.data.success) {
      throw new Error(result.data.error || 'Navigation failed');
    }
  }

  /**
   * Evaluate JavaScript in page
   */
  private async evaluate(script: string): Promise<unknown> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const evaluate_browserbase = new BrowserBaseBubble(
      {
        operation: 'evaluate' as const,
        session_id: this.sessionId,
        script,
      },
      this.context,
      'evaluate_browserbase'
    );

    const result = await evaluate_browserbase.action();
    if (!result.data.success) {
      throw new Error(result.data.error || 'Script evaluation failed');
    }

    return result.data.result;
  }

  /**
   * Type text into an input field
   */
  private async typeText(selector: string, text: string): Promise<boolean> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const type_browserbase = new BrowserBaseBubble(
      {
        operation: 'type' as const,
        session_id: this.sessionId,
        selector,
        text,
        delay: 50,
      },
      this.context,
      'type_browserbase'
    );

    const result = await type_browserbase.action();
    return result.data.success;
  }

  /**
   * Get current page URL
   */
  private async getCurrentUrl(): Promise<string> {
    const result = (await this.evaluate(`window.location.href`)) as string;
    return result;
  }

  /**
   * Save current DOM state to file for debugging
   * Only saves when DEBUG env var is set
   */
  private async saveDebugState(label: string): Promise<string | null> {
    if (!DEBUG) {
      return null;
    }

    try {
      const fs = await import('fs/promises');
      const htmlContent = (await this.evaluate(
        `document.documentElement.outerHTML`
      )) as string;
      const currentUrl = await this.getCurrentUrl();
      const timestamp = Date.now();
      const debugPath = `/tmp/linkedin-debug-${label}-${timestamp}.html`;

      // Add URL as comment at top of file
      const contentWithUrl = `<!-- URL: ${currentUrl} -->\n${htmlContent}`;
      await fs.writeFile(debugPath, contentWithUrl);
      debugLog(`[LinkedInConnectionTool] Saved debug DOM to: ${debugPath}`);
      return debugPath;
    } catch (e) {
      console.error('[LinkedInConnectionTool] Failed to save debug state:', e);
      return null;
    }
  }

  async performAction(): Promise<LinkedInConnectionToolResult> {
    try {
      await this.startBrowserSession();
      return await this.sendConnection();
    } catch (error) {
      console.error('[LinkedInConnectionTool] Error:', error);
      return {
        operation: 'send_connection',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      await this.endBrowserSession();
    }
  }

  /**
   * Send a connection request to a LinkedIn profile
   */
  private async sendConnection(): Promise<LinkedInConnectionToolResult> {
    const { profile_url, message } = this.params;

    debugLog(`[LinkedInConnectionTool] Sending connection to: ${profile_url}`);

    // Navigate to profile page
    await this.navigateTo(profile_url);

    // Wait for page to load
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Save debug state after page load
    await this.saveDebugState('01-after-page-load');

    // Extract profile info
    const profileInfo = await this.extractProfileInfo();
    debugLog('[LinkedInConnectionTool] Profile info:', profileInfo);

    // Try to find and click the Connect button
    // Strategy 1: Direct Connect button (visible on profile)
    let connectClicked = false;

    // Save debug state before attempting to click Connect
    await this.saveDebugState('02-before-connect-click');

    // Look for direct Connect button with various selectors
    const directConnectResult = (await this.evaluate(`
      (() => {
        // Look for primary Connect button
        const connectButtons = document.querySelectorAll('button');
        for (const btn of connectButtons) {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();

          // Check for "Invite X to connect" aria-label or "Connect" text
          if (ariaLabel.toLowerCase().includes('connect') || text === 'connect') {
            // Make sure it's a primary action button, not in a dropdown
            if (btn.classList.contains('artdeco-button--primary') ||
                btn.closest('.pvs-profile-actions') ||
                btn.closest('.pv-top-card-v2-ctas')) {
              btn.click();
              return { clicked: true, method: 'direct', ariaLabel, text };
            }
          }
        }
        return { clicked: false };
      })()
    `)) as {
      clicked: boolean;
      method?: string;
      ariaLabel?: string;
      text?: string;
    };

    if (directConnectResult.clicked) {
      connectClicked = true;
      debugLog(
        `[LinkedInConnectionTool] Clicked direct Connect button: ${directConnectResult.method}`
      );
    }

    // Strategy 2: Connect is under "More" dropdown
    if (!connectClicked) {
      debugLog(
        '[LinkedInConnectionTool] Direct Connect not found, trying More dropdown...'
      );

      // Click the "More" button
      const moreButtonResult = (await this.evaluate(`
        (() => {
          // Look for More button - specifically the profile overflow action button
          // It has id like "ember67-profile-overflow-action" and aria-label="More actions"
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const btnId = btn.id || '';

            // Profile overflow button has specific ID pattern and aria-label
            if (btnId.includes('profile-overflow-action') ||
                (ariaLabel === 'more actions' && btn.classList.contains('artdeco-dropdown__trigger'))) {
              btn.click();
              return { clicked: true, id: btnId, ariaLabel };
            }
          }
          return { clicked: false };
        })()
      `)) as { clicked: boolean; id?: string; ariaLabel?: string };

      if (moreButtonResult.clicked) {
        debugLog(
          `[LinkedInConnectionTool] Clicked More button: id="${moreButtonResult.id}", aria-label="${moreButtonResult.ariaLabel}"`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait longer for dropdown to open

        // Save debug state after clicking More button
        await this.saveDebugState('03-after-more-dropdown-open');

        // Now look for Connect in the dropdown
        const dropdownConnectResult = (await this.evaluate(`
          (() => {
            // LinkedIn uses div[role="button"] for dropdown items
            // Look for Connect option with aria-label containing "connect"
            const dropdownItems = document.querySelectorAll('.artdeco-dropdown__item[role="button"], .artdeco-dropdown__content-inner [role="button"]');
            for (const item of dropdownItems) {
              const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase();
              const text = (item.innerText || item.textContent || '').trim().toLowerCase();

              // Check aria-label like "Invite X to connect" or text "Connect"
              if (ariaLabel.includes('connect') || text === 'connect') {
                item.click();
                return { clicked: true, ariaLabel, text };
              }
            }

            return { clicked: false };
          })()
        `)) as { clicked: boolean; ariaLabel?: string; text?: string };

        if (dropdownConnectResult.clicked) {
          connectClicked = true;
          debugLog(
            `[LinkedInConnectionTool] Clicked Connect from dropdown: aria-label="${dropdownConnectResult.ariaLabel}", text="${dropdownConnectResult.text}"`
          );
        } else {
          debugLog(
            '[LinkedInConnectionTool] Connect option not found in dropdown'
          );
        }
      } else {
        debugLog('[LinkedInConnectionTool] More button not found');
      }
    }

    if (!connectClicked) {
      // Save debug state before reporting failure
      await this.saveDebugState('04-connect-not-found');

      return {
        operation: 'send_connection',
        success: false,
        profile: profileInfo || undefined,
        error:
          'Could not find Connect button. Profile may already be connected or connection requests may be restricted.',
      };
    }

    // Wait for connection modal to appear
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if we need to add a note or send without note
    if (message) {
      debugLog('[LinkedInConnectionTool] Adding note to connection request');

      // Click "Add a note" button
      const addNoteResult = (await this.evaluate(`
        (() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();

            if (ariaLabel.includes('add a note') || text.includes('add a note')) {
              btn.click();
              return { clicked: true };
            }
          }
          return { clicked: false };
        })()
      `)) as { clicked: boolean };

      if (addNoteResult.clicked) {
        debugLog('[LinkedInConnectionTool] Clicked Add a note button');
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Type the message into the textarea
        const typed = await this.typeText('#custom-message', message);
        if (!typed) {
          // Fallback: try evaluate to set value
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
        debugLog('[LinkedInConnectionTool] Typed note message');
      }

      // Wait a moment before sending
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Click Send button (after adding note)
      const sendResult = (await this.evaluate(`
        (() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();

            // Look for Send button (primary)
            if (text === 'send' && btn.classList.contains('artdeco-button--primary')) {
              btn.click();
              return { clicked: true, text };
            }
          }
          return { clicked: false };
        })()
      `)) as { clicked: boolean; text?: string };

      if (!sendResult.clicked) {
        return {
          operation: 'send_connection',
          success: false,
          profile: profileInfo || undefined,
          error: 'Could not find Send button to complete connection request.',
        };
      }

      debugLog('[LinkedInConnectionTool] Clicked Send button');
    } else {
      // No message - click "Send without a note" button
      debugLog(
        '[LinkedInConnectionTool] No message provided, clicking Send without a note'
      );

      const sendWithoutNoteResult = (await this.evaluate(`
        (() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();

            // Look for "Send without a note" button
            if (text.includes('send without a note') || text.includes('send without note')) {
              btn.click();
              return { clicked: true, text };
            }
          }
          return { clicked: false };
        })()
      `)) as { clicked: boolean; text?: string };

      if (!sendWithoutNoteResult.clicked) {
        return {
          operation: 'send_connection',
          success: false,
          profile: profileInfo || undefined,
          error:
            'Could not find Send without a note button to complete connection request.',
        };
      }

      debugLog('[LinkedInConnectionTool] Clicked Send without a note button');
    }

    // Wait for request to be processed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Handle "Not now" prompt if it appears (for adding to address book)
    await this.evaluate(`
      (() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
          if (text === 'not now') {
            btn.click();
            return true;
          }
        }
        return false;
      })()
    `);

    return {
      operation: 'send_connection',
      success: true,
      message: `Connection request sent to ${profileInfo?.name || 'profile'}`,
      profile: profileInfo || undefined,
      error: '',
    };
  }

  /**
   * Extract profile information from the current page
   */
  private async extractProfileInfo(): Promise<ProfileInfo | null> {
    try {
      const info = (await this.evaluate(`
        (() => {
          // Get profile name - try multiple strategies
          let name = '';

          // Strategy 1: h1 element (has obfuscated class but also standard classes)
          const h1El = document.querySelector('h1');
          if (h1El) {
            name = h1El.textContent?.trim() || '';
          }

          // Strategy 2: Profile picture alt/title attribute
          if (!name) {
            const imgEl = document.querySelector('img.pv-top-card-profile-picture__image--show') ||
                         document.querySelector('img[class*="pv-top-card-profile-picture"]');
            if (imgEl) {
              name = imgEl.getAttribute('alt') || imgEl.getAttribute('title') || '';
            }
          }

          // Strategy 3: Extract from Connect button aria-label "Invite X to connect"
          if (!name) {
            const connectBtn = document.querySelector('button[aria-label*="to connect"]');
            if (connectBtn) {
              const ariaLabel = connectBtn.getAttribute('aria-label') || '';
              const match = ariaLabel.match(/Invite (.+) to connect/i);
              if (match) {
                name = match[1];
              }
            }
          }

          // Get headline - div with text-body-medium break-words and data-generated-suggestion-target
          let headline = '';
          const headlineEl = document.querySelector('div.text-body-medium.break-words[data-generated-suggestion-target]') ||
                            document.querySelector('div.text-body-medium.break-words');
          if (headlineEl) {
            headline = headlineEl.textContent?.trim() || '';
          }

          // Get location - span before Contact info link
          let location = '';
          const contactInfoLink = document.querySelector('a[href*="contact-info"]');
          if (contactInfoLink) {
            // Location is in a sibling or parent span
            const parentSpan = contactInfoLink.closest('span');
            if (parentSpan && parentSpan.previousElementSibling) {
              location = parentSpan.previousElementSibling.textContent?.trim() || '';
            }
          }

          // Fallback: look for location pattern in spans
          if (!location) {
            const spans = document.querySelectorAll('span');
            for (const span of spans) {
              const text = span.textContent?.trim() || '';
              // Location usually contains comma-separated place names
              if (text.includes(',') && !text.includes('@') && !text.includes('|') &&
                  text.length < 100 && text.length > 5) {
                // Check if it looks like a location (contains country/city patterns)
                if (/(?:United|Kingdom|States|England|Germany|France|India|Canada|Australia|California|New York|London|Manchester)/i.test(text)) {
                  location = text;
                  break;
                }
              }
            }
          }

          return {
            name,
            headline,
            location,
            profile_url: window.location.href
          };
        })()
      `)) as ProfileInfo;

      if (!info.name) {
        return null;
      }

      return info;
    } catch (error) {
      console.error(
        '[LinkedInConnectionTool] Error extracting profile info:',
        error
      );
      return null;
    }
  }
}
