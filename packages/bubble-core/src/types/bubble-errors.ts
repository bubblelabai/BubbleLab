/**
 * Custom error classes for bubble operations
 * These errors carry metadata like variableId to enable better error tracking and logging
 */

/**
 * Base error class for all bubble-related errors
 * Includes variableId and bubbleName for context tracking
 */
export class BubbleError extends Error {
  public readonly variableId?: number;
  public readonly bubbleName?: string;

  constructor(
    message: string,
    options?: {
      variableId?: number;
      bubbleName?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'BubbleError';
    this.variableId = options?.variableId;
    this.bubbleName = options?.bubbleName;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Attach the original cause if provided
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when bubble parameter validation fails
 * Used in BaseBubble constructor when schema.parse() fails
 */
export class BubbleValidationError extends BubbleError {
  public readonly validationErrors?: string[];

  constructor(
    message: string,
    options?: {
      variableId?: number;
      bubbleName?: string;
      validationErrors?: string[];
      cause?: Error;
    }
  ) {
    super(message, options);
    this.name = 'BubbleValidationError';
    this.validationErrors = options?.validationErrors;
  }
}

/**
 * Thrown when bubble execution fails during performAction
 * Used in BaseBubble.action() when the operation fails
 */
export class BubbleExecutionError extends BubbleError {
  public readonly executionPhase?: 'instantiation' | 'execution' | 'validation';

  constructor(
    message: string,
    options?: {
      variableId?: number;
      bubbleName?: string;
      executionPhase?: 'instantiation' | 'execution' | 'validation';
      cause?: Error;
    }
  ) {
    super(message, options);
    this.name = 'BubbleExecutionError';
    this.executionPhase = options?.executionPhase;
  }
}
