import type { z } from 'zod';
import type { BubbleContext } from '../../../../../types/bubble.js';
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
  context?: BubbleContext;
  params: { credentials?: Record<string, string> };
}

/**
 * Log AI fallback events to both console and context.logger (if available).
 * context.logger feeds into the BubbleFlow execution trace UI.
 */
function logAIFallback(message: string, context?: BubbleContext): void {
  const prefixed = `[AIFallback] ${message}`;
  console.log(prefixed);
  if (context?.logger) {
    context.logger.info(prefixed, {
      bubbleName: 'ai-fallback',
      operationType: 'bubble_execution',
    });
  }
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

        const ctx = self.context;
        const aiAgent = new AIBrowserAgent({
          sessionId,
          context: ctx,
          credentials: self.params?.credentials,
        });

        const taskDesc = options.taskDescription || stepName;

        if (options.extractionSchema) {
          logAIFallback(`Extracting data for "${stepName}"`, ctx);
          const extracted = await aiAgent.extractData(
            options.extractionSchema,
            taskDesc
          );
          if (extracted !== null) {
            logAIFallback(`Extraction succeeded for "${stepName}"`, ctx);
            return extracted as Return;
          }
        } else {
          logAIFallback(`Suggesting recovery for "${stepName}"`, ctx);
          logAIFallback(`Error: ${errorMsg}`, ctx);
          const action = await aiAgent.suggestRecoveryAction(
            taskDesc,
            errorMsg
          );
          logAIFallback(`AI suggested: ${JSON.stringify(action)}`, ctx);

          if (action.action !== 'none') {
            const success = await aiAgent.executeAction(action);
            if (success) {
              if (action.action === 'wait' || action.action === 'scroll') {
                logAIFallback(
                  `Retrying "${stepName}" after ${action.action}`,
                  ctx
                );
                try {
                  return await originalMethod.apply(this, args);
                } catch (retryError) {
                  const retryMsg =
                    retryError instanceof Error
                      ? retryError.message
                      : String(retryError);
                  logAIFallback(
                    `Retry failed for "${stepName}": ${retryMsg}`,
                    ctx
                  );
                }
              } else if (
                action.action === 'click' ||
                action.action === 'type' ||
                action.action === 'click_coordinates'
              ) {
                logAIFallback(`Action completed for "${stepName}"`, ctx);
                return true as Return;
              }
            }
          } else {
            logAIFallback(`AI could not help: ${action.reason}`, ctx);
          }
        }

        throw error;
      }
    };
  };
}
