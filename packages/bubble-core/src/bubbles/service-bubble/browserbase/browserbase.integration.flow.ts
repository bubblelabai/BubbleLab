import {
  BubbleFlow,
  BrowserBaseBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  sessionId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the BrowserBase Integration Test workflow.
 */
export interface BrowserBaseTestPayload extends WebhookEvent {
  /**
   * URL to navigate to for testing
   * @canBeFile false
   */
  testUrl?: string;
  /**
   * Selector to click for testing
   * @canBeFile false
   */
  testSelector?: string;
}

export class BrowserBaseIntegrationTest extends BubbleFlow<'webhook/http'> {
  private sessionId: string | null = null;

  // Starts a new browser session
  private async startSession() {
    const result = await new BrowserBaseBubble({
      operation: 'start_session',
      viewport_width: 1280,
      viewport_height: 900,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'start_session' ||
      !result.data.session_id
    ) {
      throw new Error(`Failed to start session: ${result.error}`);
    }

    this.sessionId = result.data.session_id;
    return result.data;
  }

  // Navigates to a URL
  private async navigateTo(url: string) {
    if (!this.sessionId) throw new Error('No active session');

    const result = await new BrowserBaseBubble({
      operation: 'navigate',
      session_id: this.sessionId,
      url: url,
      wait_until: 'domcontentloaded',
      timeout: 30000,
    }).action();

    if (!result.success || result.data?.operation !== 'navigate') {
      throw new Error(`Failed to navigate: ${result.error}`);
    }

    return result.data;
  }

  // Gets page content
  private async getContent(selector?: string) {
    if (!this.sessionId) throw new Error('No active session');

    const result = await new BrowserBaseBubble({
      operation: 'get_content',
      session_id: this.sessionId,
      selector: selector,
      content_type: 'text',
    }).action();

    if (!result.success || result.data?.operation !== 'get_content') {
      throw new Error(`Failed to get content: ${result.error}`);
    }

    return result.data;
  }

  // Evaluates JavaScript in the page
  private async evaluate(script: string) {
    if (!this.sessionId) throw new Error('No active session');

    const result = await new BrowserBaseBubble({
      operation: 'evaluate',
      session_id: this.sessionId,
      script: script,
    }).action();

    if (!result.success || result.data?.operation !== 'evaluate') {
      throw new Error(`Failed to evaluate: ${result.error}`);
    }

    return result.data;
  }

  // Takes a screenshot
  private async screenshot() {
    if (!this.sessionId) throw new Error('No active session');

    const result = await new BrowserBaseBubble({
      operation: 'screenshot',
      session_id: this.sessionId,
      format: 'png',
      full_page: false,
    }).action();

    if (!result.success || result.data?.operation !== 'screenshot') {
      throw new Error(`Failed to take screenshot: ${result.error}`);
    }

    return result.data;
  }

  // Waits for a selector
  private async waitForSelector(selector: string, timeout: number) {
    if (!this.sessionId) throw new Error('No active session');

    const result = await new BrowserBaseBubble({
      operation: 'wait',
      session_id: this.sessionId,
      wait_type: 'selector',
      selector: selector,
      timeout: timeout,
    }).action();

    if (!result.success || result.data?.operation !== 'wait') {
      throw new Error(`Failed to wait for selector: ${result.error}`);
    }

    return result.data;
  }

  // Gets cookies from the browser
  private async getCookies(domainFilter?: string) {
    if (!this.sessionId) throw new Error('No active session');

    const result = await new BrowserBaseBubble({
      operation: 'get_cookies',
      session_id: this.sessionId,
      domain_filter: domainFilter,
    }).action();

    if (!result.success || result.data?.operation !== 'get_cookies') {
      throw new Error(`Failed to get cookies: ${result.error}`);
    }

    return result.data;
  }

  // Ends the browser session
  private async endSession() {
    if (!this.sessionId) return;

    const result = await new BrowserBaseBubble({
      operation: 'end_session',
      session_id: this.sessionId,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to end session: ${result.error}`);
    }

    return result.data;
  }

  async handle(payload: BrowserBaseTestPayload): Promise<Output> {
    const { testUrl = 'https://www.example.com' } = payload;
    const results: Output['testResults'] = [];

    try {
      // 1. Start browser session
      const startData = await this.startSession();
      results.push({
        operation: 'start_session',
        success: true,
        details: `Session: ${startData.session_id}, Context: ${startData.context_id}`,
      });

      // 2. Navigate to test URL
      const navData = await this.navigateTo(testUrl);
      results.push({
        operation: 'navigate',
        success: true,
        details: `Navigated to: ${navData.url}`,
      });

      // 3. Wait for body to be present
      await this.waitForSelector('body', 5000);
      results.push({
        operation: 'wait_for_selector',
        success: true,
        details: 'Body element found',
      });

      // 4. Get page title via evaluate
      const evalData = await this.evaluate('document.title');
      results.push({
        operation: 'evaluate',
        success: true,
        details: `Page title: ${evalData.result}`,
      });

      // 5. Get page content
      const contentData = await this.getContent('body');
      const contentPreview = (contentData.content || '').substring(0, 100);
      results.push({
        operation: 'get_content',
        success: true,
        details: `Content preview: ${contentPreview}...`,
      });

      // 6. Take screenshot
      const screenshotData = await this.screenshot();
      const screenshotSize = screenshotData.data?.length || 0;
      results.push({
        operation: 'screenshot',
        success: true,
        details: `Screenshot taken, format: ${screenshotData.format}, size: ${screenshotSize} chars`,
      });

      // 7. Get cookies
      const cookiesData = await this.getCookies();
      results.push({
        operation: 'get_cookies',
        success: true,
        details: `Found ${cookiesData.cookies?.length || 0} cookies`,
      });

      // 8. End session
      await this.endSession();
      results.push({
        operation: 'end_session',
        success: true,
        details: 'Session closed successfully',
      });

      return {
        sessionId: this.sessionId || '',
        testResults: results,
      };
    } catch (error) {
      // Ensure session is cleaned up on error
      if (this.sessionId) {
        try {
          await this.endSession();
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }
}
