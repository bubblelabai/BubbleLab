import type { BubbleTriggerEventRegistry } from '../bubble-trigger/types.js';
import type { BubbleFlowOperationResult } from '../types/bubble.js';
import type { BubbleLogger } from '../logging/BubbleLogger.js';

export abstract class BubbleFlow<
  TEventType extends keyof BubbleTriggerEventRegistry,
> {
  public readonly name: string;
  public readonly description: string;
  protected logger?: BubbleLogger;

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
}
