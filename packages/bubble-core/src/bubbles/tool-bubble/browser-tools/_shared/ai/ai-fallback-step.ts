import type { z } from 'zod';
import { AIBrowserAgent } from './ai-browser-agent.js';

/**
 * Options for the AI fallback decorator.
 */
interface AIFallbackStepOptions {
  taskDescription?: string;
  extractionSchema?: z.ZodType<unknown>;
}

/**
 * Interface for the target class — needs session, context, and credentials.
 */
interface AIFallbackTarget {
  sessionId: string | null;
  context?: unknown;
  params: { credentials?: Record<string, string> };
}

/**
 * Lightweight decorator that wraps a method with AI fallback error recovery.
 * This is the OSS-compatible version of @RecordableStep — no recording,
 * just AI-powered recovery when selectors/actions fail.
 *
 * When the decorated method throws, the decorator:
 * 1. Creates an AIBrowserAgent with the active session
 * 2. If extractionSchema is provided: uses AI vision to extract data
 * 3. Otherwise: asks AI to suggest a recovery action (click, type, scroll, etc.)
 * 4. Executes the suggested action
 * 5. For wait/scroll: retries the original method
 * 6. For click/type/click_coordinates: returns true (action completed)
 *
 * @param stepName - Human-readable name for logging
 * @param options - Task description and optional extraction schema
 */
export function AIFallbackStep(
  stepName: string,
  options: AIFallbackStepOptions = {}
) {
  return function <This, Args extends unknown[], Return>(
    originalMethod: (this: This, ...args: Args) => Promise<Return>,
    _context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Promise<Return>
    >
  ) {
    return async function (this: This, ...args: Args): Promise<Return> {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const self = this as unknown as AIFallbackTarget;
        const errorMsg = error instanceof Error ? error.message : String(error);
        const sessionId = self.sessionId;
        if (!sessionId) throw error;

        const aiAgent = new AIBrowserAgent({
          sessionId,
          context: self.context,
          credentials: self.params?.credentials,
        });

        const taskDesc = options.taskDescription || stepName;

        if (options.extractionSchema) {
          console.log(`[AIFallback] Extracting data for "${stepName}"`);
          const extracted = await aiAgent.extractData(
            options.extractionSchema,
            taskDesc
          );
          if (extracted !== null) {
            console.log(`[AIFallback] Extraction succeeded for "${stepName}"`);
            return extracted as Return;
          }
        } else {
          console.log(`[AIFallback] Suggesting recovery for "${stepName}"`);
          const action = await aiAgent.suggestRecoveryAction(
            taskDesc,
            errorMsg
          );
          console.log(`[AIFallback] AI suggested:`, action);

          if (action.action !== 'none') {
            const success = await aiAgent.executeAction(action);
            if (success) {
              if (action.action === 'wait' || action.action === 'scroll') {
                console.log(
                  `[AIFallback] Retrying "${stepName}" after ${action.action}`
                );
                try {
                  return await originalMethod.apply(this, args);
                } catch (retryError) {
                  console.log(
                    `[AIFallback] Retry failed for "${stepName}":`,
                    retryError
                  );
                }
              } else if (
                action.action === 'click' ||
                action.action === 'type' ||
                action.action === 'click_coordinates'
              ) {
                console.log(`[AIFallback] Action completed for "${stepName}"`);
                return true as Return;
              }
            }
          } else {
            console.log(`[AIFallback] AI could not help: ${action.reason}`);
          }
        }

        throw error;
      }
    };
  };
}
