import type { BubbleContext } from '../types/bubble.js';

/**
 * Represents an artifact captured during step execution.
 * Artifacts can be screenshots, HTML snapshots, URLs, or custom data.
 */
export interface StepArtifact {
  type: 'screenshot' | 'html' | 'url' | 'custom';
  label: string;
  data: string; // Base64 for screenshots, HTML string, or URL
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Represents a recorded step with timing, status, and artifacts.
 */
export interface RecordedStep {
  id: string;
  name: string;
  methodName: string; // The decorated method name
  args?: unknown[]; // Arguments passed to the method
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  beforeArtifacts: StepArtifact[];
  afterArtifacts: StepArtifact[];
  parentStepId?: string;
  childStepIds: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Options for configuring what artifacts to capture for a step.
 */
export interface RecordStepOptions {
  screenshotBefore?: boolean;
  screenshotAfter?: boolean;
  htmlBefore?: boolean;
  htmlAfter?: boolean;
  urlBefore?: boolean;
  urlAfter?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Default options for recording steps.
 * By default, captures screenshots and URLs before/after each step.
 */
export const DEFAULT_RECORD_STEP_OPTIONS: RecordStepOptions = {
  screenshotBefore: true,
  screenshotAfter: true,
  htmlBefore: false,
  htmlAfter: false,
  urlBefore: true,
  urlAfter: true,
};

/**
 * Context interface for recording operations.
 * Implementations handle artifact capture and step storage.
 */
export interface RecordingContext {
  readonly enabled: boolean;
  captureScreenshot(sessionId: string, label: string): Promise<string | null>;
  captureHtml(
    sessionId: string,
    label: string,
    selector?: string
  ): Promise<string | null>;
  captureUrl(sessionId: string): Promise<string | null>;
  storeStep(step: RecordedStep): void;
  getSteps(): RecordedStep[];
  clearSteps(): void;
}

/**
 * Extended BubbleContext that includes an optional recording context.
 */
export interface RecordableBubbleContext extends BubbleContext {
  recordingContext?: RecordingContext;
}
