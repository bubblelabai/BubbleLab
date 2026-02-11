import { ToolBubble } from '../../../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../../../types/bubble.js';
import {
  BrowserBaseBubble,
  type CDPCookie,
} from '../../../service-bubble/browserbase/index.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { parseBrowserSessionData, buildProxyConfig } from '../_shared/utils.js';
import {
  LinkedInAcceptInvitationsToolParamsSchema,
  LinkedInAcceptInvitationsToolResultSchema,
  type LinkedInAcceptInvitationsToolParamsInput,
  type LinkedInAcceptInvitationsToolResult,
  type AcceptedInvitationInfo,
} from './schema.js';

export class LinkedInAcceptInvitationsTool<
  T extends
    LinkedInAcceptInvitationsToolParamsInput = LinkedInAcceptInvitationsToolParamsInput,
> extends ToolBubble<T, LinkedInAcceptInvitationsToolResult> {
  static readonly bubbleName = 'linkedin-accept-invitations-tool' as const;
  static readonly schema = LinkedInAcceptInvitationsToolParamsSchema;
  static readonly resultSchema = LinkedInAcceptInvitationsToolResultSchema;
  static readonly shortDescription =
    'Accept top N LinkedIn connection invitations';
  static readonly longDescription =
    'Recordable tool that navigates to the LinkedIn invitation manager page and accepts the top N received connection invitations.';
  static readonly alias = 'linkedin-accept-invitations';
  static readonly type = 'tool';

  private sessionId: string | null = null;
  private contextId: string | null = null;
  private cookies: CDPCookie[] | null = null;

  constructor(
    params: T = { operation: 'accept_invitations' } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };
    return credentials?.[CredentialType.LINKEDIN_CRED];
  }

  private async stepStartBrowserSession(): Promise<void> {
    if (this.sessionId) return;
    const sessionData = parseBrowserSessionData(this.chooseCredential());
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
        timeout_seconds: 1200,
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
    if (result.data.context_id) this.contextId = result.data.context_id;
    console.log(`[AcceptInvitations] Session started: ${this.sessionId}`);
    const ip = await this.detectIPAddress();
    if (ip) console.log(`[AcceptInvitations] Browser IP: ${ip}`);
  }

  private async stepNavigateToInvitationManager(): Promise<void> {
    if (!this.sessionId) throw new Error('No active session');
    const browserbase = new BrowserBaseBubble(
      {
        operation: 'navigate' as const,
        session_id: this.sessionId,
        url: 'https://www.linkedin.com/mynetwork/invitation-manager/',
        wait_until: 'domcontentloaded',
        timeout: 30000,
      },
      this.context,
      'navigate'
    );
    const result = await browserbase.action();
    if (!result.data.success)
      throw new Error(result.data.error || 'Navigation failed');
  }

  private async stepWaitForInvitationsPage(): Promise<boolean> {
    const checkScript = `(() => {
      const buttons = document.querySelectorAll('button');
      let hasAcceptButton = false;
      for (const btn of buttons) {
        if ((btn.innerText || btn.textContent || '').trim().toLowerCase() === 'accept') {
          hasAcceptButton = true;
          break;
        }
      }
      const peopleLabel = document.body.innerText.match(/People\\s*\\(\\d+\\)/i);
      return hasAcceptButton || !!peopleLabel;
    })()`;
    for (let attempt = 1; attempt <= 15; attempt++) {
      const found = await this.evaluate(checkScript);
      if (found) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  private async stepAcceptTopInvitations(): Promise<{
    accepted: AcceptedInvitationInfo[];
    skipped: number;
    availableCount: number;
  }> {
    const count = (this.params as { count?: number }).count ?? 5;
    const accepted: AcceptedInvitationInfo[] = [];
    let skipped = 0;
    let availableCount = 0;
    const TEMP_ID = '__bubblelab_accept_target__';
    const MAX_CLICK_RETRIES = 2;
    const POST_ACCEPT_SETTLE_MS = 1500;

    for (let i = 0; i < count; i++) {
      // Step 1: Find first visible Accept button, extract card info, tag it with a temp ID
      const extractResult = (await this.evaluate(`
        (() => {
          // Clean up any previous temp ID
          const prev = document.getElementById('${TEMP_ID}');
          if (prev) prev.removeAttribute('id');

          const acceptButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            return text === 'accept' && btn.offsetParent !== null && !btn.disabled;
          });
          if (acceptButtons.length === 0) return { done: true, buttonCount: 0 };

          const acceptBtn = acceptButtons[0];

          // Tag the button with a temp ID so Puppeteer can click it precisely
          acceptBtn.id = '${TEMP_ID}';

          // Scroll the button into view
          acceptBtn.scrollIntoView({ block: 'center', behavior: 'instant' });

          // Walk up to find the invitation card container
          let container = acceptBtn.parentElement;
          for (let j = 0; j < 10 && container; j++) {
            const text = container.innerText || '';
            const hasProfileLink = !!container.querySelector('a[href*="/in/"]');
            const hasTimeText = !!(text.match(/\\d+\\s+(hour|day|week|month|minute|second)s?\\s+ago/i) || text.match(/Yesterday/i));
            if (hasProfileLink && hasTimeText) break;
            container = container.parentElement;
          }

          let name = '';
          let headline = '';
          let mutual_connections = '';
          let profile_url = '';

          if (container) {
            const links = container.querySelectorAll('a[href*="/in/"]');
            for (const link of links) {
              const href = link.getAttribute('href') || '';
              if (href.includes('/in/')) {
                profile_url = href.startsWith('http') ? href : 'https://www.linkedin.com' + href;
                break;
              }
            }
            for (const link of links) {
              const linkText = (link.innerText || link.textContent || '').trim();
              if (linkText && linkText.length > 1 && linkText.length < 100) {
                name = linkText;
                break;
              }
            }
            if (!name) {
              const spans = container.querySelectorAll('span');
              for (const span of spans) {
                const spanText = (span.innerText || span.textContent || '').trim();
                if (spanText && spanText.length > 2 && spanText.length < 50 &&
                    !spanText.includes('Accept') && !spanText.includes('Ignore') &&
                    !spanText.includes('mutual') && !spanText.includes('ago') &&
                    !spanText.includes('Yesterday')) {
                  name = spanText;
                  break;
                }
              }
            }

            const containerText = container.innerText || '';
            const mutualMatch = containerText.match(/(.+?(?:mutual connection|mutual connections))/i);
            if (mutualMatch) mutual_connections = mutualMatch[0].trim();

            const lines = containerText.split('\\n').map(l => l.trim()).filter(l => l);
            let nameLineIdx = -1, endLineIdx = -1;
            for (let k = 0; k < lines.length; k++) {
              if (lines[k] === name) nameLineIdx = k;
              if (endLineIdx === -1 && (
                lines[k].match(/\\d+\\s+(hour|day|week|month|minute|second)s?\\s+ago/i) ||
                lines[k].match(/Yesterday/i) ||
                lines[k].match(/mutual connection/i)
              )) endLineIdx = k;
            }
            if (nameLineIdx >= 0 && endLineIdx > nameLineIdx + 1) {
              headline = lines.slice(nameLineIdx + 1, endLineIdx)
                .filter(l => l.toLowerCase() !== 'accept' && l.toLowerCase() !== 'ignore' && l.length > 3)
                .join(' ').trim();
            }
            if (!headline) {
              for (const line of lines) {
                if (line === name || line.toLowerCase() === 'accept' || line.toLowerCase() === 'ignore' ||
                    line.match(/\\d+\\s+(hour|day|week|month|minute|second)s?\\s+ago/i) ||
                    line.match(/Yesterday/i) || line.match(/mutual connection/i) ||
                    line.match(/^People\\s*\\(/i) || line.match(/^Message$/i)) continue;
                if (line.length > 10 && line.length < 300) { headline = line; break; }
              }
            }
          }

          return {
            done: false,
            buttonCount: acceptButtons.length,
            info: {
              name: name || 'Unknown',
              headline: headline || undefined,
              mutual_connections: mutual_connections || undefined,
              profile_url: profile_url || undefined,
            }
          };
        })()
      `)) as {
        done: boolean;
        buttonCount: number;
        info?: AcceptedInvitationInfo;
      };

      if (extractResult.done) {
        console.log(
          `[AcceptInvitations] No more invitations to accept after ${accepted.length}`
        );
        break;
      }

      // Track available invitations on first iteration
      if (i === 0) availableCount = extractResult.buttonCount;

      const prevButtonCount = extractResult.buttonCount;

      // Step 2: Click the tagged button with retries (re-tag on failure)
      if (!this.sessionId) throw new Error('No active session');
      let clickSucceeded = false;
      for (let retry = 0; retry <= MAX_CLICK_RETRIES; retry++) {
        // On retry, wait for DOM to settle then re-tag the button
        if (retry > 0) {
          console.log(
            `[AcceptInvitations] Retrying click for invitation ${i + 1} (attempt ${retry + 1})`
          );
          await new Promise((r) => setTimeout(r, 1500));
          await this.evaluate(`
            (() => {
              const prev = document.getElementById('${TEMP_ID}');
              if (prev) prev.removeAttribute('id');
              const btns = Array.from(document.querySelectorAll('button')).filter(btn => {
                const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                return text === 'accept' && btn.offsetParent !== null && !btn.disabled;
              });
              if (btns.length === 0) return false;
              btns[0].id = '${TEMP_ID}';
              btns[0].scrollIntoView({ block: 'center', behavior: 'instant' });
              return true;
            })()
          `);
        }

        const clickBubble = new BrowserBaseBubble(
          {
            operation: 'click' as const,
            session_id: this.sessionId,
            selector: `#${TEMP_ID}`,
            wait_for_navigation: false,
            timeout: 5000,
          },
          this.context,
          'clickaccept'
        );
        const clickResult = await clickBubble.action();
        if (clickResult.data.success) {
          clickSucceeded = true;
          break;
        }
      }

      if (!clickSucceeded) {
        console.log(
          `[AcceptInvitations] Click failed for invitation ${i + 1} after ${MAX_CLICK_RETRIES + 1} attempts, skipping`
        );
        skipped++;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (extractResult.info) {
        accepted.push(extractResult.info);
        console.log(
          `[AcceptInvitations] Accepted ${i + 1}/${count}: ${extractResult.info.name}`
        );
      }

      // Step 3: Wait for DOM to update — poll until Accept button count decreases
      const MAX_WAIT_POLLS = 15;
      for (let poll = 0; poll < MAX_WAIT_POLLS; poll++) {
        await new Promise((r) => setTimeout(r, 500));
        const currentCount = (await this.evaluate(`
          Array.from(document.querySelectorAll('button')).filter(btn => {
            const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            return text === 'accept' && btn.offsetParent !== null && !btn.disabled;
          }).length
        `)) as number;
        if (currentCount < prevButtonCount) break;
      }

      // Extra settle time for LinkedIn UI animations before next iteration
      await new Promise((r) => setTimeout(r, POST_ACCEPT_SETTLE_MS));
    }

    return { accepted, skipped, availableCount };
  }

  private async stepEndBrowserSession(): Promise<void> {
    if (!this.sessionId) return;
    const browserbase = new BrowserBaseBubble(
      { operation: 'end_session' as const, session_id: this.sessionId },
      this.context,
      'endsession'
    );
    await browserbase.action();
    console.log(`[AcceptInvitations] Session ended: ${this.sessionId}`);
    this.sessionId = null;
  }

  private async evaluate(script: string): Promise<unknown> {
    if (!this.sessionId) throw new Error('No active session');
    const browserbase = new BrowserBaseBubble(
      { operation: 'evaluate' as const, session_id: this.sessionId, script },
      this.context,
      'evaluate'
    );
    const result = await browserbase.action();
    if (!result.data.success)
      throw new Error(result.data.error || 'Evaluation failed');
    return result.data.result;
  }

  private async detectIPAddress(): Promise<string | null> {
    if (!this.sessionId) return null;
    try {
      return (await this.evaluate(`
        (async () => {
          try {
            const r = await fetch('https://api.ipify.org?format=json');
            const d = await r.json();
            return d.ip;
          } catch { return null; }
        })()
      `)) as string | null;
    } catch {
      return null;
    }
  }

  async performAction(): Promise<LinkedInAcceptInvitationsToolResult> {
    try {
      await this.stepStartBrowserSession();
      await this.stepNavigateToInvitationManager();
      const pageReady = await this.stepWaitForInvitationsPage();
      if (!pageReady)
        console.log('[AcceptInvitations] Page slow to load, continuing');

      const { accepted, skipped, availableCount } =
        await this.stepAcceptTopInvitations();
      const count = (this.params as { count?: number }).count ?? 5;

      // Success if we accepted all requested, OR if fewer were available than requested
      const allAvailableAccepted =
        availableCount < count
          ? accepted.length >= availableCount
          : accepted.length >= count;

      return {
        operation: 'accept_invitations',
        success: allAvailableAccepted,
        accepted,
        accepted_count: accepted.length,
        skipped_count: skipped,
        message: allAvailableAccepted
          ? `Accepted ${accepted.length} invitation(s)${availableCount < count ? ` (only ${availableCount} available)` : ''}`
          : `Accepted ${accepted.length}/${count} invitation(s), ${skipped} failed`,
        error: allAvailableAccepted
          ? ''
          : `Failed to accept ${skipped} invitation(s)`,
      };
    } catch (error) {
      return {
        operation: 'accept_invitations',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.stepEndBrowserSession();
    }
  }
}
