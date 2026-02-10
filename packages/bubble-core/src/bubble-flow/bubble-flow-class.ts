import type { BubbleTriggerEventRegistry } from '@bubblelab/shared-schemas';
import { hashToVariableId } from '@bubblelab/shared-schemas';
import type { BubbleFlowOperationResult } from '../types/bubble.js';
import type { BubbleLogger } from '../logging/BubbleLogger.js';

export abstract class BubbleFlow<
  TEventType extends keyof BubbleTriggerEventRegistry,
> {
  public readonly name: string;
  public readonly description: string;
  protected logger?: BubbleLogger;
  private __currentInvocationCallSiteKey?: string;
  __executionMeta__?: {
    flowId?: number;
    executionId?: number;
    studioBaseUrl?: string;
  };
  __triggerConversationHistory__?: Array<{ role: string; content: string }>;

  /**
   * Cron schedule expression for schedule/cron event types.
   * Required for flows that extend BubbleFlow<'schedule/cron'>.
   * Uses standard 5-part cron format: minute hour day month day-of-week
   *
   * @example
   * ```typescript
   * readonly cronSchedule = '0 0 * * *'; // Daily at midnight
   * readonly cronSchedule = '0 9 * * 1-5'; // Weekdays at 9am
   * readonly cronSchedule = '*\/15 * * * *'; // Every 15 minutes
   * ```
   *
   * Note: This property is enforced by the ESLint rule 'bubble-core/require-cron-schedule'
   * for flows with event type 'schedule/cron'.
   */
  readonly cronSchedule?: string;

  constructor(name: string, description: string, logger?: BubbleLogger) {
    this.name = name;
    this.description = description;
    this.logger = logger;
  }

  abstract handle(
    payload: BubbleTriggerEventRegistry[TEventType]
  ): Promise<BubbleFlowOperationResult>;

  /**
   * Get the logger instance if available
   */
  getLogger(): BubbleLogger | undefined {
    return this.logger;
  }

  /**
   * Set a logger for this flow instance
   */
  setLogger(logger: BubbleLogger): void {
    this.logger = logger;
  }

  __setInvocationCallSiteKey(key?: string): string | undefined {
    const previous = this.__currentInvocationCallSiteKey;
    this.__currentInvocationCallSiteKey = key || undefined;
    return previous;
  }

  __restoreInvocationCallSiteKey(previous?: string | undefined): void {
    this.__currentInvocationCallSiteKey = previous || undefined;
  }

  __getInvocationCallSiteKey(): string | undefined {
    return this.__currentInvocationCallSiteKey;
  }

  __computeInvocationVariableId(
    originalVariableId?: number
  ): number | undefined {
    if (
      typeof originalVariableId !== 'number' ||
      !this.__currentInvocationCallSiteKey
    ) {
      return originalVariableId;
    }
    return hashToVariableId(
      `${originalVariableId}:${this.__currentInvocationCallSiteKey}`
    );
  }
}
