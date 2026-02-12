import { ToolBubble } from '../../../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../../../types/bubble.js';
import { AIFallbackStep } from '../_shared/ai/ai-fallback-step.js';
import {
  BrowserBaseBubble,
  type CDPCookie,
} from '../../../service-bubble/browserbase/index.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { z } from 'zod';
import { parseBrowserSessionData, buildProxyConfig } from '../_shared/utils.js';
import {
  LinkedInReceivedInvitationsToolParamsSchema,
  LinkedInReceivedInvitationsToolResultSchema,
  ReceivedInvitationInfoSchema,
  type LinkedInReceivedInvitationsToolParamsInput,
  type LinkedInReceivedInvitationsToolResult,
  type ReceivedInvitationInfo,
} from './schema.js';

export class LinkedInReceivedInvitationsTool<
  T extends
    LinkedInReceivedInvitationsToolParamsInput = LinkedInReceivedInvitationsToolParamsInput,
> extends ToolBubble<T, LinkedInReceivedInvitationsToolResult> {
  static readonly bubbleName = 'linkedin-received-invitations-tool' as const;
  static readonly schema = LinkedInReceivedInvitationsToolParamsSchema;
  static readonly resultSchema = LinkedInReceivedInvitationsToolResultSchema;
  static readonly shortDescription =
    'Extract received LinkedIn connection invitations';
  static readonly longDescription =
    'Recordable LinkedIn Received Invitations Tool. Supports pagination via scrolling and "View more" / "Load more" button clicks.';
  static readonly alias = 'linkedin-received-invitations';
  static readonly type = 'tool';

  private sessionId: string | null = null;
  private contextId: string | null = null;
  private cookies: CDPCookie[] | null = null;

  constructor(
    params: T = { operation: 'get_received_invitations' } as T,
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
        timeout_seconds: 1200, // 10 minutes for full session (navigate + scroll + extract)
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
    console.log(
      `[RecordableReceivedInvitations] Session started: ${this.sessionId}`
    );
    const ip = await this.detectIPAddress();
    if (ip) console.log(`[RecordableReceivedInvitations] Browser IP: ${ip}`);
  }

  @AIFallbackStep('Navigate to received invitations', {
    taskDescription: 'Navigate to the LinkedIn received invitations page',
  })
  private async stepNavigateToReceivedInvitations(): Promise<void> {
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

  @AIFallbackStep('Wait for invitations to load', {
    taskDescription: 'Wait for the received invitations list to fully load',
  })
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

  @AIFallbackStep('Extract all received invitations', {
    taskDescription:
      'Extract all received connection invitations by scrolling and clicking View more',
    extractionSchema: z.array(ReceivedInvitationInfoSchema),
  })
  private async stepExtractAllInvitations(): Promise<{
    invitations: ReceivedInvitationInfo[];
    total: number;
  }> {
    const MAX_SCROLL_ITERATIONS = 500;
    const MAX_STALE_ROUNDS = 10;
    const SCROLL_STEP = 1200;
    const SCROLL_WAIT_MS = 2200;

    let prevAcceptCount = 0;
    let staleRounds = 0;

    for (let iteration = 0; iteration < MAX_SCROLL_ITERATIONS; iteration++) {
      const scrollResult = (await this.evaluate(`
        (() => {
          const acceptCount = Array.from(document.querySelectorAll('button')).filter(btn =>
            (btn.innerText || btn.textContent || '').trim().toLowerCase() === 'accept'
          ).length;
          const scrollStep = ${SCROLL_STEP};
          const viewMoreLabels = ['view more', 'load more', 'see more', 'show more'];
          let viewMoreClicked = false;
          for (const el of document.querySelectorAll('button, span, div[role="button"], a')) {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
            const isViewMore = viewMoreLabels.some(l => text === l || ariaLabel === l);
            if (isViewMore && el.offsetParent !== null && !el.disabled) {
              el.click();
              viewMoreClicked = true;
              break;
            }
          }
          window.scrollBy(0, scrollStep);
          if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 100) {
            window.scrollTo(0, document.body.scrollHeight);
          }
          const scrollableSet = new Set();
          document.querySelectorAll('button').forEach(btn => {
            if ((btn.innerText || btn.textContent || '').trim().toLowerCase() !== 'accept') return;
            let parent = btn.parentElement;
            for (let i = 0; i < 20 && parent; i++) {
              if (parent instanceof HTMLElement && parent.scrollHeight > parent.clientHeight + 100) {
                const s = window.getComputedStyle(parent);
                const oy = s.overflowY, o = s.overflow;
                if (oy === 'auto' || oy === 'scroll' || o === 'auto' || o === 'scroll') {
                  scrollableSet.add(parent);
                  break;
                }
              }
              parent = parent.parentElement;
            }
          });
          document.querySelectorAll('main, [role="main"]').forEach(el => scrollableSet.add(el));
          for (const el of scrollableSet) {
            if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight && el.scrollHeight > 500) {
              const maxScroll = el.scrollHeight - el.clientHeight;
              el.scrollTop = Math.min(el.scrollTop + scrollStep, maxScroll);
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
                el.scrollTop = maxScroll;
              }
            }
          }
          return { acceptCount, viewMoreClicked };
        })()
      `)) as { acceptCount: number; viewMoreClicked: boolean };

      const currentCount = scrollResult.acceptCount;
      if (scrollResult.viewMoreClicked) {
        console.log(
          `[RecordableReceivedInvitations] Clicked "View more" at scroll ${iteration + 1}`
        );
      }
      if (currentCount > prevAcceptCount) {
        staleRounds = 0;
      } else {
        staleRounds++;
        if (staleRounds >= MAX_STALE_ROUNDS) break;
      }
      prevAcceptCount = currentCount;
      const waitMs = scrollResult.viewMoreClicked ? 3200 : SCROLL_WAIT_MS;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const result = (await this.evaluate(`
      (() => {
        const invitations = [];
        const acceptButtons = Array.from(document.querySelectorAll('button')).filter(btn =>
          (btn.innerText || btn.textContent || '').trim().toLowerCase() === 'accept'
        );
        for (const acceptBtn of acceptButtons) {
          let container = acceptBtn.parentElement;
          for (let i = 0; i < 10 && container; i++) {
            const text = container.innerText || '';
            const hasProfileLink = !!container.querySelector('a[href*="/in/"]');
            const hasTimeText = !!(text.match(/\\d+\\s+(hour|day|week|month|minute|second)s?\\s+ago/i) || text.match(/Yesterday/i));
            if (hasProfileLink && hasTimeText) break;
            container = container.parentElement;
          }
          if (!container) continue;
          let profile_url = '';
          const links = container.querySelectorAll('a[href*="/in/"]');
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('/in/')) {
              profile_url = href.startsWith('http') ? href : 'https://www.linkedin.com' + href;
              break;
            }
          }
          let name = '';
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
          let received_date = '';
          const timeMatch = containerText.match(/(\\d+\\s+(hour|day|week|month|minute|second)s?\\s+ago|Yesterday)/i);
          if (timeMatch) received_date = timeMatch[0];
          let mutual_connections = '';
          const mutualMatch = containerText.match(/(.+?(?:mutual connection|mutual connections))/i);
          if (mutualMatch) mutual_connections = mutualMatch[0].trim();
          const lines = containerText.split('\\n').map(l => l.trim()).filter(l => l);
          let headline = '';
          let nameLineIdx = -1, endLineIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i] === name) nameLineIdx = i;
            if (endLineIdx === -1 && (
              lines[i].match(/\\d+\\s+(hour|day|week|month|minute|second)s?\\s+ago/i) ||
              lines[i].match(/Yesterday/i) ||
              lines[i].match(/mutual connection/i)
            )) endLineIdx = i;
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
                  line.match(/^People\\s*\\(/i)) continue;
              if (line.length > 10 && line.length < 300) { headline = line; break; }
            }
          }
          if (name) {
            invitations.push({
              name,
              headline: headline || undefined,
              mutual_connections: mutual_connections || undefined,
              received_date: received_date || 'Unknown',
              profile_url: profile_url || undefined,
            });
          }
        }
        let total = invitations.length;
        const allMatch = document.body.innerText.match(/All\\s*\\((\\d+)\\)/i);
        if (allMatch) total = parseInt(allMatch[1], 10);
        else {
          const peopleMatch = document.body.innerText.match(/People\\s*\\((\\d+)\\)/i);
          if (peopleMatch) total = parseInt(peopleMatch[1], 10);
        }
        const seen = new Set();
        const unique = [];
        for (const inv of invitations) {
          const key = inv.profile_url || inv.name;
          if (!seen.has(key)) { seen.add(key); unique.push(inv); }
        }
        return { invitations: unique, total };
      })()
    `)) as { invitations: ReceivedInvitationInfo[]; total: number };

    return result;
  }

  private async stepEndBrowserSession(): Promise<void> {
    if (!this.sessionId) return;
    const browserbase = new BrowserBaseBubble(
      { operation: 'end_session' as const, session_id: this.sessionId },
      this.context,
      'endsession'
    );
    await browserbase.action();
    console.log(
      `[RecordableReceivedInvitations] Session ended: ${this.sessionId}`
    );
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

  async performAction(): Promise<LinkedInReceivedInvitationsToolResult> {
    try {
      await this.stepStartBrowserSession();
      await this.stepNavigateToReceivedInvitations();
      const pageReady = await this.stepWaitForInvitationsPage();
      if (!pageReady)
        console.log(
          '[RecordableReceivedInvitations] Page slow to load, continuing'
        );
      const { invitations, total } = await this.stepExtractAllInvitations();
      return {
        operation: 'get_received_invitations',
        success: true,
        invitations,
        total_count: total,
        message: `Found ${invitations.length} received invitations`,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_received_invitations',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.stepEndBrowserSession();
    }
  }
}
