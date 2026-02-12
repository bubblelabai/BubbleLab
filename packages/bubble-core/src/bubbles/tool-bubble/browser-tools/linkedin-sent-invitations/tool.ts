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
  LinkedInSentInvitationsToolParamsSchema,
  LinkedInSentInvitationsToolResultSchema,
  SentInvitationInfoSchema,
  type LinkedInSentInvitationsToolParamsInput,
  type LinkedInSentInvitationsToolResult,
  type SentInvitationInfo,
} from './schema.js';

export class LinkedInSentInvitationsTool<
  T extends
    LinkedInSentInvitationsToolParamsInput = LinkedInSentInvitationsToolParamsInput,
> extends ToolBubble<T, LinkedInSentInvitationsToolResult> {
  static readonly bubbleName = 'linkedin-sent-invitations-tool' as const;
  static readonly schema = LinkedInSentInvitationsToolParamsSchema;
  static readonly resultSchema = LinkedInSentInvitationsToolResultSchema;
  static readonly shortDescription =
    'Extract sent LinkedIn connection invitations';
  static readonly longDescription =
    'Recordable LinkedIn Sent Invitations Tool for extracting pending sent connection requests.';
  static readonly alias = 'linkedin-sent-invitations';
  static readonly type = 'tool';

  private sessionId: string | null = null;
  private contextId: string | null = null;
  private cookies: CDPCookie[] | null = null;

  constructor(
    params: T = { operation: 'get_sent_invitations' } as T,
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
      `[RecordableSentInvitations] Session started: ${this.sessionId}`
    );
    const ip = await this.detectIPAddress();
    if (ip) console.log(`[RecordableSentInvitations] Browser IP: ${ip}`);
  }

  @AIFallbackStep('Navigate to sent invitations', {
    taskDescription: 'Navigate to the LinkedIn sent invitations page',
  })
  private async stepNavigateToSentInvitations(): Promise<void> {
    if (!this.sessionId) throw new Error('No active session');
    const browserbase = new BrowserBaseBubble(
      {
        operation: 'navigate' as const,
        session_id: this.sessionId,
        url: 'https://www.linkedin.com/mynetwork/invitation-manager/sent/',
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
    taskDescription: 'Wait for the sent invitations list to load',
  })
  private async stepWaitForInvitationsPage(): Promise<boolean> {
    const checkScript = `(() => {
      const buttons = document.querySelectorAll('button');
      let sentTabFound = false, hasInvitations = false;
      for (const btn of buttons) {
        const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        if (text === 'sent') sentTabFound = true;
        if (text === 'withdraw') hasInvitations = true;
      }
      const peopleLabel = document.body.innerText.match(/People\\s*\\(\\d+\\)/i);
      return sentTabFound && (hasInvitations || peopleLabel);
    })()`;
    for (let attempt = 1; attempt <= 15; attempt++) {
      const found = await this.evaluate(checkScript);
      if (found) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  @AIFallbackStep('Extract sent invitations', {
    taskDescription: 'Extract all sent connection invitations',
    extractionSchema: z.array(SentInvitationInfoSchema),
  })
  private async stepExtractInvitations(): Promise<{
    invitations: SentInvitationInfo[];
    total: number;
  }> {
    const result = (await this.evaluate(`
      (() => {
        const invitations = [];
        const withdrawButtons = Array.from(document.querySelectorAll('button')).filter(btn =>
          (btn.innerText || btn.textContent || '').trim().toLowerCase() === 'withdraw'
        );
        for (const withdrawBtn of withdrawButtons) {
          let container = withdrawBtn.parentElement;
          for (let i = 0; i < 10 && container; i++) {
            const text = container.innerText || '';
            if (text.includes('Sent') && container.querySelector('a[href*="/in/"]')) break;
            container = container.parentElement;
          }
          if (!container) continue;
          let name = '';
          const links = container.querySelectorAll('a[href*="/in/"]');
          for (const link of links) {
            const linkText = (link.innerText || link.textContent || '').trim();
            if (linkText && linkText.length > 1 && linkText.length < 100 && !linkText.includes('Sent')) {
              name = linkText;
              break;
            }
          }
          if (!name) {
            const spans = container.querySelectorAll('span');
            for (const span of spans) {
              const spanText = (span.innerText || span.textContent || '').trim();
              if (spanText && spanText.length > 2 && spanText.length < 50 &&
                  !spanText.includes('Sent') && !spanText.includes('Withdraw') &&
                  !spanText.includes('|') && !spanText.includes('-')) {
                name = spanText;
                break;
              }
            }
          }
          const containerText = container.innerText || '';
          const lines = containerText.split('\\n').map(l => l.trim()).filter(l => l);
          let headline = '';
          let nameLineIdx = -1, sentLineIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i] === name) nameLineIdx = i;
            if (lines[i].match(/^Sent\\s+\\d+/i)) sentLineIdx = i;
          }
          if (nameLineIdx >= 0 && sentLineIdx > nameLineIdx + 1) {
            headline = lines.slice(nameLineIdx + 1, sentLineIdx)
              .filter(l => l.toLowerCase() !== 'withdraw' && l.length > 5)
              .join(' ').trim();
          }
          if (!headline) {
            for (const line of lines) {
              if (line === name || line.toLowerCase() === 'withdraw' ||
                  line.match(/^Sent\\s+\\d+/i) || line.match(/^People\\s*\\(/i)) continue;
              if (line.length > 10 && line.length < 300) { headline = line; break; }
            }
          }
          const sentMatch = containerText.match(/Sent\\s+\\d+\\s+\\w+\\s+ago/i);
          let profile_url = '';
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            if (href.includes('/in/')) {
              profile_url = href.startsWith('http') ? href : 'https://www.linkedin.com' + href;
              break;
            }
          }
          if (name) {
            invitations.push({
              name,
              headline: headline || undefined,
              sent_date: sentMatch ? sentMatch[0] : 'Unknown',
              profile_url: profile_url || undefined,
            });
          }
        }
        let total = invitations.length;
        const peopleMatch = document.body.innerText.match(/People\\s*\\((\\d+)\\)/i);
        if (peopleMatch) total = parseInt(peopleMatch[1], 10);
        return { invitations, total };
      })()
    `)) as { invitations: SentInvitationInfo[]; total: number };
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
    console.log(`[RecordableSentInvitations] Session ended: ${this.sessionId}`);
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

  async performAction(): Promise<LinkedInSentInvitationsToolResult> {
    try {
      await this.stepStartBrowserSession();
      await this.stepNavigateToSentInvitations();
      const pageReady = await this.stepWaitForInvitationsPage();
      if (!pageReady)
        console.log(
          '[RecordableSentInvitations] Page slow to load, continuing'
        );
      const { invitations, total } = await this.stepExtractInvitations();
      return {
        operation: 'get_sent_invitations',
        success: true,
        invitations,
        total_count: total,
        message: `Found ${invitations.length} sent invitations`,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_sent_invitations',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await this.stepEndBrowserSession();
    }
  }
}
