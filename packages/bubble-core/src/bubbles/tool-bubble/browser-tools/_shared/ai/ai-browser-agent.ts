import type { z } from 'zod';
import { AIAgentBubble } from '../../../../service-bubble/ai-agent.js';
import { BrowserBaseBubble } from '../../../../service-bubble/browserbase/index.js';
import type { BubbleContext } from '../../../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import type {
  AIBrowserAction,
  AIBrowserAgentConfig,
} from './ai-browser-agent.types.js';

/**
 * System prompt for the AI browser agent when suggesting recovery actions.
 * Screenshot-only approach — AI looks at the page and decides coordinates.
 */
const RECOVERY_SYSTEM_PROMPT = `You are an AI browser automation assistant. You analyze screenshots to help recover from failed browser automation steps.

When a step fails, you receive:
1. A screenshot of the current page state
2. The task that was being attempted
3. The error that occurred
4. The current page URL

Your job is to look at the screenshot and suggest ONE action to recover. Choose from:

- click_coordinates: Click at x,y pixel coordinates on the screenshot
- type: Click at x,y coordinates then type text
- scroll: Scroll the page up or down
- wait: Wait for content to load
- none: If you cannot help, explain why

Look at the screenshot carefully. Identify the element visually and return the coordinates of its center.

Respond ONLY with valid JSON in one of these exact formats:
{"action": "click_coordinates", "coordinates": [500, 300]}
{"action": "type", "coordinates": [500, 300], "value": "text to type"}
{"action": "scroll", "direction": "down", "amount": 500}
{"action": "wait", "milliseconds": 2000}
{"action": "none", "reason": "explanation here"}`;

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
 * Uses vision AI to analyze screenshots and suggest recovery actions
 * or extract structured data. No DOM inspection needed — the AI
 * looks at the screenshot and decides coordinates directly.
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
   * Takes a screenshot and lets the AI decide what to do.
   */
  async suggestRecoveryAction(
    task: string,
    error: string
  ): Promise<AIBrowserAction> {
    try {
      const screenshot = await this.captureScreenshot();
      if (!screenshot) {
        return { action: 'none', reason: 'Could not capture screenshot' };
      }

      const currentUrl = await this.getCurrentUrl();

      const userMessage = `Task: ${task}

Error: ${error}

Current URL: ${currentUrl}

Look at the screenshot and suggest ONE action to recover from this error.`;

      console.log(`[AIBrowserAgent] Requesting recovery for: "${task}"`);
      console.log(`[AIBrowserAgent] Error: ${error}`);

      const response = await this.callAI(
        userMessage,
        screenshot,
        RECOVERY_SYSTEM_PROMPT
      );

      console.log(`[AIBrowserAgent] AI response: ${response}`);

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
   */
  async extractData<T>(schema: z.ZodType<T>, task: string): Promise<T | null> {
    try {
      const screenshot = await this.captureScreenshot();
      if (!screenshot) {
        console.error(
          '[AIBrowserAgent] Could not capture screenshot for extraction'
        );
        return null;
      }

      const schemaDescription = this.describeZodSchema(schema);

      const userMessage = `Task: ${task}

Extract the following data from the screenshot:
${schemaDescription}

Respond with ONLY valid JSON matching this structure.`;

      const response = await this.callAI(
        userMessage,
        screenshot,
        EXTRACTION_SYSTEM_PROMPT
      );

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
          // Legacy selector-based click — shouldn't happen but handle gracefully
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
          if ('coordinates' in action) {
            const [tx, ty] = action.coordinates;
            await page.mouse.click(tx, ty);
            // Triple-click to select all, then type to replace
            await page.mouse.click(tx, ty, { clickCount: 3 });
            await page.keyboard.type(action.value, { delay: 50 });
          } else {
            // Legacy selector-based
            await page.waitForSelector(action.selector, { timeout: 5000 });
            await page.click(action.selector);
            const clearScript = `
              (() => {
                const el = document.querySelector(${JSON.stringify(action.selector)});
                if (el && 'value' in el) el.value = '';
              })()
            `;
            await page.evaluate(clearScript);
            await page.type(action.selector, action.value, { delay: 50 });
          }
          return true;
        }

        case 'scroll': {
          const amount =
            action.direction === 'down' ? action.amount : -action.amount;
          const scrollScript = `window.scrollBy({ top: ${amount}, behavior: 'smooth' })`;
          await page.evaluate(scrollScript);
          await new Promise((r) => setTimeout(r, 500));
          return true;
        }

        case 'wait': {
          await new Promise((r) => setTimeout(r, action.milliseconds));
          return true;
        }

        case 'extract':
        case 'none':
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

  private async getCurrentUrl(): Promise<string> {
    const session = BrowserBaseBubble.getSession(this.sessionId);
    if (!session) return '';

    try {
      return session.page.url();
    } catch {
      return '';
    }
  }

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
   * Parse the AI response into a typed action.
   */
  private parseRecoveryAction(response: string): AIBrowserAction {
    try {
      const parsed = JSON.parse(response);

      switch (parsed.action) {
        case 'click':
        case 'click_coordinates':
          // Both map to click_coordinates — AI should always return coordinates
          if (this.hasValidCoordinates(parsed.coordinates)) {
            return {
              action: 'click_coordinates',
              coordinates: parsed.coordinates as [number, number],
            };
          }
          break;

        case 'type':
          if (typeof parsed.value === 'string') {
            if (this.hasValidCoordinates(parsed.coordinates)) {
              return {
                action: 'type',
                coordinates: parsed.coordinates as [number, number],
                value: parsed.value,
              };
            }
            // Legacy selector fallback
            if (typeof parsed.selector === 'string') {
              return {
                action: 'type',
                selector: parsed.selector,
                value: parsed.value,
              };
            }
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

  private hasValidCoordinates(
    coordinates: unknown
  ): coordinates is [number, number] {
    return (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number'
    );
  }

  /**
   * Generate a human-readable description of a Zod schema.
   */
  private describeZodSchema(schema: z.ZodType<unknown>): string {
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
