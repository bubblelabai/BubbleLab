import type { BubbleTriggerEventRegistry } from '../bubble-trigger/types.js';
import type { BubbleFlowOperationResult } from '../types/bubble.js';
import type { BubbleLogger } from '../logging/BubbleLogger.js';

export abstract class BubbleFlow<
  TEventType extends keyof BubbleTriggerEventRegistry,
> {
  public readonly name: string;
  public readonly description: string;
  protected logger?: BubbleLogger;

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
