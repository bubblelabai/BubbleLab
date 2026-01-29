import type { BubbleOperationResult } from '@bubblelab/shared-schemas';
import type { ServiceBubbleParams, BubbleContext } from '../types/bubble.js';
import { ToolBubble } from '../types/tool-bubble-class.js';
import type {
  RecordingContext,
  RecordableBubbleContext,
  RecordedStep,
  RecordStepOptions,
} from './types.js';

/**
 * Base class for tool bubbles that support step recording.
 *
 * Extends ToolBubble with recording capabilities:
 * - Tracks recorded steps with timing information
 * - Captures artifacts (screenshots, HTML, URLs) before/after each step
 * - Supports nested step tracking via step stack
 *
 * To use recording:
 * 1. Extend this class instead of ToolBubble
 * 2. Implement getActiveSessionId() to return the browser session ID
 * 3. Decorate methods with @RecordableStep
 * 4. Pass a RecordingContext via BubbleContext when recording is needed
 */
export abstract class RecordableToolBubble<
  TParams extends ServiceBubbleParams = ServiceBubbleParams,
  TResult extends BubbleOperationResult = BubbleOperationResult,
> extends ToolBubble<TParams, TResult> {
  /** Internal step storage for when no RecordingContext is provided */
  private _recordedSteps: RecordedStep[] = [];

  /** Stack for tracking nested steps */
  private _stepStack: string[] = [];

  constructor(params: unknown, context?: BubbleContext, instanceId?: string) {
    super(params, context, instanceId);
  }

  /** Get recording context from bubble context */
  protected get recordingContext(): RecordingContext | undefined {
    return (this.context as RecordableBubbleContext | undefined)
      ?.recordingContext;
  }

  /** Check if recording is enabled - used by decorator */
  public get isRecordingEnabled(): boolean {
    return this.recordingContext?.enabled ?? false;
  }

  /** Get all recorded steps */
  public getRecordedSteps(): RecordedStep[] {
    if (this.recordingContext) {
      return this.recordingContext.getSteps();
    }
    return [...this._recordedSteps];
  }

  /** Clear all recorded steps */
  public clearRecordedSteps(): void {
    if (this.recordingContext) {
      this.recordingContext.clearSteps();
    }
    this._recordedSteps = [];
  }

  /**
   * Subclasses must implement to provide browser session ID.
   * This is used to capture screenshots and other artifacts.
   * Return null if no browser session is active.
   */
  protected abstract getActiveSessionId(): string | null;

  // --- Internal methods used by the @RecordableStep decorator ---

  /** @internal Push step onto stack for nested tracking */
  public _pushStep(stepId: string): void {
    this._stepStack.push(stepId);
  }

  /** @internal Pop step from stack */
  public _popStep(): string | undefined {
    return this._stepStack.pop();
  }

  /** @internal Get current parent step ID (top of stack) */
  public _getCurrentParentStepId(): string | undefined {
    return this._stepStack.length > 0
      ? this._stepStack[this._stepStack.length - 1]
      : undefined;
  }

  /** @internal Store a completed step */
  public _storeStep(step: RecordedStep): void {
    // Set parent if nested
    if (this._stepStack.length > 0) {
      step.parentStepId = this._stepStack[this._stepStack.length - 1];
    }

    if (this.recordingContext) {
      this.recordingContext.storeStep(step);
    } else {
      this._recordedSteps.push(step);
    }
  }

  /** @internal Capture artifacts for a step */
  public async _captureArtifacts(
    step: RecordedStep,
    phase: 'before' | 'after',
    options: RecordStepOptions
  ): Promise<void> {
    const ctx = this.recordingContext;
    if (!ctx) return;

    const sessionId = this.getActiveSessionId();
    if (!sessionId) return;

    const artifacts =
      phase === 'before' ? step.beforeArtifacts : step.afterArtifacts;
    const label = `${step.name}-${phase}`;

    // Capture URL
    const captureUrl =
      phase === 'before' ? options.urlBefore : options.urlAfter;
    if (captureUrl) {
      const url = await ctx.captureUrl(sessionId);
      if (url) {
        artifacts.push({
          type: 'url',
          label: `${label}-url`,
          data: url,
          timestamp: new Date(),
        });
      }
    }

    // Capture screenshot
    const captureScreenshot =
      phase === 'before' ? options.screenshotBefore : options.screenshotAfter;
    if (captureScreenshot) {
      const screenshot = await ctx.captureScreenshot(sessionId, label);
      if (screenshot) {
        artifacts.push({
          type: 'screenshot',
          label: `${label}-screenshot`,
          data: screenshot,
          timestamp: new Date(),
        });
      }
    }

    // Capture HTML
    const captureHtml =
      phase === 'before' ? options.htmlBefore : options.htmlAfter;
    if (captureHtml) {
      const html = await ctx.captureHtml(sessionId, label);
      if (html) {
        artifacts.push({
          type: 'html',
          label: `${label}-html`,
          data: html,
          timestamp: new Date(),
        });
      }
    }
  }
}
