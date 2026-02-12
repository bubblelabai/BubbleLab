import type { z } from 'zod';
import { AIAgentBubble } from '../../../../service-bubble/ai-agent.js';
import { BrowserBaseBubble } from '../../../../service-bubble/browserbase/index.js';
import type { BubbleContext } from '../../../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import type {
  AIBrowserAction,
  AIBrowserAgentConfig,
  InteractiveElement,
} from './ai-browser-agent.types.js';

/**
 * Script to extract interactive elements from the page.
 * Finds buttons, links, inputs, and other interactive elements.
 * Limited to 100 elements to avoid overwhelming the AI.
 * Only includes elements that are truly visible (not in closed dropdowns, etc.)
 */
const EXTRACT_ELEMENTS_SCRIPT = `
(() => {
  const selectors = 'button, a, input, select, textarea, [role="button"], [role="link"], [onclick]';
  const elements = document.querySelectorAll(selectors);

  // Check if element is truly visible (not just has dimensions)
  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // Check if element is within viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    if (rect.right < 0 || rect.left > window.innerWidth) return false;

    // Check computed styles
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    // Check if any parent hides it (dropdown items in closed dropdowns)
    let parent = el.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') return false;
      // Check for closed dropdown containers (common patterns)
      if (parent.classList.contains('artdeco-dropdown__content') ||
          parent.classList.contains('dropdown-menu')) {
        if (!parent.classList.contains('artdeco-dropdown__content--is-open') &&
            !parent.classList.contains('show') &&
            !parent.classList.contains('open')) {
          return false;
        }
      }
      parent = parent.parentElement;
    }

    return true;
  }

  return [...elements].filter(isElementVisible).slice(0, 100).map(el => {
    const rect = el.getBoundingClientRect();
    let selector = el.tagName.toLowerCase();
    if (el.id) {
      selector = '#' + el.id;
    } else if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\\s+/).slice(0, 3).join('.');
      if (classes) selector = el.tagName.toLowerCase() + '.' + classes;
    }
    return {
      tagName: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || undefined,
      name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 50) || undefined,
      id: el.id || undefined,
      selector,
      boundingBox: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      isVisible: true,
      isEnabled: !el.disabled
    };
  });
})()
`;

/**
 * System prompt for the AI browser agent when suggesting recovery actions.
 */
const RECOVERY_SYSTEM_PROMPT = `You are an AI browser automation assistant. You analyze screenshots and page context to help recover from failed browser automation steps.

When a step fails, you receive:
1. A screenshot of the current page state
2. The task that was being attempted
3. The error that occurred
4. A list of interactive elements on the page

Your job is to suggest ONE action to help recover from the error. Choose from:

- click: Click an element by CSS selector
- click_coordinates: Click at specific x,y coordinates (use when selector is unreliable)
- type: Type text into an input field
- scroll: Scroll the page up or down
- wait: Wait for content to load
- none: If you cannot help, explain why

Respond ONLY with valid JSON in this exact format:
{"action": "click", "selector": "#submit-btn"}
{"action": "click_coordinates", "coordinates": [500, 300]}
{"action": "type", "selector": "#email-input", "value": "test@example.com"}
{"action": "scroll", "direction": "down", "amount": 500}
{"action": "wait", "milliseconds": 2000}
{"action": "none", "reason": "explanation here"}

Be concise and precise. Analyze the screenshot carefully to find the right element.`;

/**
 * System prompt for data extraction.
 */
const EXTRACTION_SYSTEM_PROMPT = `You are an AI data extraction assistant. You analyze screenshots to extract structured data.

You will receive:
1. A screenshot of the current page
2. A description of what data to extract
3. The expected data structure (field names and types)

Your job is to extract the requested data from the screenshot and return it as valid JSON.

Rules:
- Only extract information that is clearly visible in the screenshot
- Use null for fields that cannot be determined
- Keep string values concise and accurate
- Follow the exact structure requested

Respond ONLY with valid JSON matching the requested structure.`;

/**
 * AI Browser Agent for error recovery and data extraction.
 *
 * Uses AIAgentBubble from @bubblelab/bubble-core to analyze screenshots
 * and suggest recovery actions or extract structured data.
 */
export class AIBrowserAgent {
  private sessionId: string;
  private context?: BubbleContext;
  private credentials?: Record<string, string>;

  constructor(config: AIBrowserAgentConfig) {
    this.sessionId = config.sessionId;
    this.context = config.context as BubbleContext | undefined;
    this.credentials = config.credentials;
  }

  /**
   * Suggest a recovery action for a failed step.
   *
   * @param task - Description of what the step was trying to accomplish
   * @param error - The error message from the failed step
   * @returns The suggested recovery action
   */
  async suggestRecoveryAction(
    task: string,
    error: string
  ): Promise<AIBrowserAction> {
    try {
      // Capture current page state
      const screenshot = await this.captureScreenshot();
      if (!screenshot) {
        return { action: 'none', reason: 'Could not capture screenshot' };
      }

      const currentUrl = await this.getCurrentUrl();
      const elements = await this.extractInteractiveElements();

      // Log elements for debugging
      console.log(
        `[AIBrowserAgent] Found ${elements.length} interactive elements:`
      );
      elements.slice(0, 20).forEach((el, i) => {
        console.log(
          `  ${i + 1}. ${el.tagName}${el.id ? '#' + el.id : ''} - "${el.name?.slice(0, 40) || 'no name'}" at (${el.boundingBox.x},${el.boundingBox.y})`
        );
      });
      if (elements.length > 20) {
        console.log(`  ... and ${elements.length - 20} more elements`);
      }

      // Build the user message
      const userMessage = this.buildRecoveryPrompt(
        task,
        error,
        currentUrl,
        elements
      );

      // Call AI
      const response = await this.callAI(
        userMessage,
        screenshot,
        RECOVERY_SYSTEM_PROMPT
      );

      // Log raw AI response
      console.log(`[AIBrowserAgent] AI raw response: ${response}`);

      // Parse and validate response
      return this.parseRecoveryAction(response);
    } catch (err) {
      console.error('[AIBrowserAgent] Error suggesting recovery action:', err);
      return {
        action: 'none',
        reason: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract structured data from the page using AI vision.
   *
   * @param schema - Zod schema defining the expected data structure
   * @param task - Description of what data to extract
   * @returns The extracted data matching the schema, or null if extraction fails
   */
  async extractData<T>(schema: z.ZodType<T>, task: string): Promise<T | null> {
    try {
      // Capture screenshot
      const screenshot = await this.captureScreenshot();
      if (!screenshot) {
        console.error(
          '[AIBrowserAgent] Could not capture screenshot for extraction'
        );
        return null;
      }

      // Generate schema description for the AI
      const schemaDescription = this.describeZodSchema(schema);

      // Build user message
      const userMessage = `Task: ${task}

Extract the following data from the screenshot:
${schemaDescription}

Respond with ONLY valid JSON matching this structure.`;

      // Call AI
      const response = await this.callAI(
        userMessage,
        screenshot,
        EXTRACTION_SYSTEM_PROMPT
      );

      // Parse and validate with Zod
      const parsed = JSON.parse(response);
      const validated = schema.safeParse(parsed);

      if (validated.success) {
        return validated.data;
      }

      console.error(
        '[AIBrowserAgent] Extracted data did not match schema:',
        validated.error
      );
      return null;
    } catch (err) {
      console.error('[AIBrowserAgent] Error extracting data:', err);
      return null;
    }
  }

  /**
   * Execute the suggested recovery action on the page.
   *
   * @param action - The action to execute
   * @returns true if the action was executed successfully
   */
  async executeAction(action: AIBrowserAction): Promise<boolean> {
    try {
      const session = BrowserBaseBubble.getSession(this.sessionId);
      if (!session) {
        console.error('[AIBrowserAgent] No active session');
        return false;
      }

      const page = session.page;

      switch (action.action) {
        case 'click': {
          await page.waitForSelector(action.selector, { timeout: 5000 });
          await page.click(action.selector);
          return true;
        }

        case 'click_coordinates': {
          const [x, y] = action.coordinates;
          await page.mouse.click(x, y);
          return true;
        }

        case 'type': {
          // Clear existing content first
          await page.waitForSelector(action.selector, { timeout: 5000 });
          await page.click(action.selector);
          // Clear via evaluate with string to avoid type issues
          const clearScript = `
            (() => {
              const el = document.querySelector(${JSON.stringify(action.selector)});
              if (el && 'value' in el) el.value = '';
            })()
          `;
          await page.evaluate(clearScript);
          await page.type(action.selector, action.value, { delay: 50 });
          return true;
        }

        case 'scroll': {
          const amount =
            action.direction === 'down' ? action.amount : -action.amount;
          const scrollScript = `window.scrollBy({ top: ${amount}, behavior: 'smooth' })`;
          await page.evaluate(scrollScript);
          // Wait for scroll to complete
          await new Promise((r) => setTimeout(r, 500));
          return true;
        }

        case 'wait': {
          await new Promise((r) => setTimeout(r, action.milliseconds));
          return true;
        }

        case 'extract':
        case 'none':
          // These don't require page interaction
          return action.action === 'extract';

        default:
          return false;
      }
    } catch (err) {
      console.error('[AIBrowserAgent] Error executing action:', err);
      return false;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Capture a screenshot from the current browser session.
   */
  private async captureScreenshot(): Promise<string | null> {
    const session = BrowserBaseBubble.getSession(this.sessionId);
    if (!session) return null;

    try {
      return (await session.page.screenshot({
        encoding: 'base64',
        type: 'png',
      })) as string;
    } catch (err) {
      console.error('[AIBrowserAgent] Screenshot capture failed:', err);
      return null;
    }
  }

  /**
   * Get the current page URL.
   */
  private async getCurrentUrl(): Promise<string> {
    const session = BrowserBaseBubble.getSession(this.sessionId);
    if (!session) return '';

    try {
      return session.page.url();
    } catch {
      return '';
    }
  }

  /**
   * Extract interactive elements from the page.
   */
  private async extractInteractiveElements(): Promise<InteractiveElement[]> {
    const session = BrowserBaseBubble.getSession(this.sessionId);
    if (!session) return [];

    try {
      const elements = await session.page.evaluate(EXTRACT_ELEMENTS_SCRIPT);
      return elements as InteractiveElement[];
    } catch (err) {
      console.error('[AIBrowserAgent] Element extraction failed:', err);
      return [];
    }
  }

  /**
   * Call the AI agent with a message and optional screenshot.
   */
  private async callAI(
    message: string,
    screenshotBase64: string,
    systemPrompt: string
  ): Promise<string> {
    const geminiKey = this.credentials?.[CredentialType.GOOGLE_GEMINI_CRED];
    if (!geminiKey) {
      throw new Error('No Google Gemini credentials provided for AI fallback');
    }

    const agent = new AIAgentBubble(
      {
        name: 'Browser Recovery Agent',
        message,
        systemPrompt,
        model: {
          model: 'google/gemini-3-flash-preview',
          temperature: 0.1,
          jsonMode: true,
        },
        images: [
          {
            type: 'base64',
            data: screenshotBase64,
            mimeType: 'image/png',
          },
        ],
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: geminiKey,
        },
        // Disable tools for simple JSON responses
        tools: [],
      },
      this.context
    );

    const result = await agent.action();

    if (!result.data?.response) {
      throw new Error('No response from AI agent');
    }

    return result.data.response;
  }

  /**
   * Build the prompt for recovery action suggestion.
   */
  private buildRecoveryPrompt(
    task: string,
    error: string,
    currentUrl: string,
    elements: InteractiveElement[]
  ): string {
    // Summarize elements for context (limit to key info)
    const elementSummary = elements
      .slice(0, 30)
      .map((el) => {
        const parts = [el.tagName];
        if (el.name) parts.push(`"${el.name}"`);
        if (el.id) parts.push(`#${el.id}`);
        if (el.role) parts.push(`[role="${el.role}"]`);
        parts.push(`at (${el.boundingBox.x},${el.boundingBox.y})`);
        return parts.join(' ');
      })
      .join('\n');

    return `Task: ${task}

Error: ${error}

Current URL: ${currentUrl}

Interactive elements on page:
${elementSummary || 'No interactive elements found'}

Analyze the screenshot and suggest ONE action to help recover from this error.`;
  }

  /**
   * Parse the AI response into a typed action.
   */
  private parseRecoveryAction(response: string): AIBrowserAction {
    try {
      const parsed = JSON.parse(response);

      // Validate action type
      switch (parsed.action) {
        case 'click':
          if (typeof parsed.selector === 'string') {
            return { action: 'click', selector: parsed.selector };
          }
          break;

        case 'click_coordinates':
          if (
            Array.isArray(parsed.coordinates) &&
            parsed.coordinates.length === 2 &&
            typeof parsed.coordinates[0] === 'number' &&
            typeof parsed.coordinates[1] === 'number'
          ) {
            return {
              action: 'click_coordinates',
              coordinates: parsed.coordinates as [number, number],
            };
          }
          break;

        case 'type':
          if (
            typeof parsed.selector === 'string' &&
            typeof parsed.value === 'string'
          ) {
            return {
              action: 'type',
              selector: parsed.selector,
              value: parsed.value,
            };
          }
          break;

        case 'scroll':
          if (
            (parsed.direction === 'up' || parsed.direction === 'down') &&
            typeof parsed.amount === 'number'
          ) {
            return {
              action: 'scroll',
              direction: parsed.direction,
              amount: parsed.amount,
            };
          }
          break;

        case 'wait':
          if (typeof parsed.milliseconds === 'number') {
            return { action: 'wait', milliseconds: parsed.milliseconds };
          }
          break;

        case 'none':
          return {
            action: 'none',
            reason:
              typeof parsed.reason === 'string'
                ? parsed.reason
                : 'Unknown reason',
          };
      }

      return { action: 'none', reason: 'Invalid action format from AI' };
    } catch {
      return { action: 'none', reason: 'Failed to parse AI response' };
    }
  }

  /**
   * Generate a human-readable description of a Zod schema.
   */
  private describeZodSchema(schema: z.ZodType<unknown>): string {
    // Get the shape if it's an object schema
    const def = schema._def as {
      shape?: () => Record<string, z.ZodType<unknown>>;
      typeName?: string;
    };

    if (def.typeName === 'ZodObject' && def.shape) {
      const shape = def.shape();
      const fields = Object.entries(shape).map(([key, fieldSchema]) => {
        const fieldDef = fieldSchema._def as {
          typeName?: string;
          description?: string;
        };
        const type =
          fieldDef.typeName?.replace('Zod', '').toLowerCase() || 'unknown';
        const optional =
          fieldDef.typeName === 'ZodOptional' ? ' (optional)' : '';
        const desc = fieldDef.description ? ` - ${fieldDef.description}` : '';
        return `  "${key}": ${type}${optional}${desc}`;
      });

      return `{
${fields.join(',\n')}
}`;
    }

    return 'JSON object';
  }
}
