import type {
  IWorkflowBubble,
  BubbleOperationResult,
  ServiceBubbleParams,
  BubbleContext,
} from '@bubblelab/bubble-core';
import { BaseBubble } from './base-bubble-class.js';

/**
 * WorkflowBubble - Higher-level abstraction that orchestrates ServiceBubbles
 * to create common, reusable workflow patterns.
 *
 * Key principles:
 * - User-friendly parameter names with clear purpose
 * - TypeScript type safety with helpful intellisense
 * - Composable patterns that reduce BubbleFlow complexity
 * - Error handling and validation at workflow level
 */
export abstract class WorkflowBubble<
    TParams extends ServiceBubbleParams = ServiceBubbleParams,
    TResult extends BubbleOperationResult = BubbleOperationResult,
  >
  extends BaseBubble<TParams, TResult>
  implements IWorkflowBubble<TResult>
{
  public readonly type = 'workflow' as const;

  constructor(params: unknown, context?: BubbleContext) {
    super(params, context);
  }

  /**
   * Get the current parameters
   */
  get currentParams(): TParams {
    return this.params;
  }

  /**
   * Get the current context
   */
  get currentContext(): BubbleContext | undefined {
    return this.context;
  }
}
