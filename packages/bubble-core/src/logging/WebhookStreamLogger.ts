import {
  BubbleLogger,
  LogLevel,
  type LoggerConfig,
  type LogMetadata,
} from './BubbleLogger.js';
import type {
  StreamingLogEvent,
  StreamCallback,
} from '@bubblelab/shared-schemas';
import { BubbleError } from '../types/bubble-errors';
import {
  sanitizeErrorMessage,
  sanitizeErrorStack,
} from '../utils/error-sanitizer.js';

interface WebhookStreamLoggerConfig extends Partial<LoggerConfig> {
  streamCallback?: StreamCallback;
}

/**
 * Helper function to format data for webhook stream display
 * Truncates large objects/strings for terminal readability
 */
function formatForWebhookStream(data: unknown, maxLength = 200): string {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';

  // Handle strings
  if (typeof data === 'string') {
    if (data.length <= maxLength) return data;
    return data.substring(0, maxLength) + '...';
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return String(data);
  }

  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';
    const preview = `[${data.length} items]`;
    if (data.length <= 3) {
      const items = data
        .map((item) => formatForWebhookStream(item, 50))
        .join(', ');
      return items.length <= maxLength ? `[${items}]` : preview;
    }
    return preview;
  }

  // Handle objects
  try {
    const stringified = JSON.stringify(data);
    if (stringified.length <= maxLength) return stringified;

    // Show object keys as preview
    const keys = Object.keys(data);
    if (keys.length === 0) return '{}';
    if (keys.length <= 3) {
      return `{${keys.join(', ')}}`;
    }
    return `{${keys.slice(0, 3).join(', ')}, ... +${keys.length - 3} more}`;
  } catch {
    return '[Complex Object]';
  }
}

/**
 * Webhook-optimized streaming logger for terminal-friendly output
 * Designed specifically for webhook streaming endpoints
 * Shows only essential information with truncated data for readability
 */
export class WebhookStreamLogger extends BubbleLogger {
  private streamCallback?: StreamCallback;

  constructor(flowName: string, options: WebhookStreamLoggerConfig = {}) {
    const { streamCallback, ...loggerConfig } = options;
    super(flowName, loggerConfig);
    this.streamCallback = streamCallback;
  }

  /**
   * Override logBubbleExecution to emit clean, truncated events
   */
  override logBubbleExecution(
    variableId: number,
    bubbleName: string,
    variableName: string,
    parameters?: Record<string, unknown>
  ): string {
    // Call parent method and use the returned message
    const logMessage = super.logBubbleExecution(
      variableId,
      bubbleName,
      variableName,
      parameters
    );

    // Format parameters for webhook display - truncate to be terminal-friendly
    const formattedParams = parameters
      ? formatForWebhookStream(parameters, 150)
      : undefined;

    this.emitStreamEvent({
      type: 'bubble_execution',
      timestamp: new Date().toISOString(),
      variableId,
      message: logMessage,
      bubbleName,
      variableName,
      additionalData: {
        parameters: formattedParams,
        variableId,
      },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
    });

    return logMessage;
  }

  /**
   * Override logBubbleExecutionComplete to emit clean results
   */
  override logBubbleExecutionComplete(
    variableId: number,
    bubbleName: string,
    variableName: string,
    result?: unknown
  ): string {
    // Get individual bubble execution time BEFORE calling parent method
    const individualExecutionTime = this.getBubbleExecutionTime(variableId);

    // Call parent method and use the returned message
    const logMessage = super.logBubbleExecutionComplete(
      variableId,
      bubbleName,
      variableName,
      result
    );

    // Truncate result for webhook display
    const formattedResult = result
      ? formatForWebhookStream(result, 200)
      : undefined;

    this.emitStreamEvent({
      type: 'bubble_execution_complete',
      timestamp: new Date().toISOString(),
      message: logMessage,
      variableId,
      bubbleName,
      variableName,
      additionalData: {
        result: formattedResult,
        variableId,
      },
      executionTime: individualExecutionTime,
      memoryUsage: this.getCurrentMemoryUsage(),
    });

    return logMessage;
  }

  /**
   * Log execution completion with beautiful, terminal-friendly formatting
   * Makes the final result super clear and easy to read
   */
  logExecutionComplete(
    success: boolean,
    finalResult?: unknown,
    error?: string
  ): void {
    const executionTime = (this.getCurrentExecutionTime() / 1000).toFixed(2);
    const tokenUsage = this.getTokenUsage();

    // Format the final result nicely for display - NO TRUNCATION
    let displayResult: string;
    if (success && finalResult !== undefined) {
      try {
        if (typeof finalResult === 'string') {
          displayResult = finalResult;
        } else {
          // For objects, extract string values and format them with actual newlines
          const formatted = JSON.stringify(finalResult, null, 2);

          // Replace escaped newlines with actual newlines for better readability
          // This makes the output much more readable in terminal
          displayResult = formatted.replace(/\\n/g, '\n');
        }
      } catch {
        displayResult = String(finalResult);
      }
    } else if (error) {
      displayResult = `Error: ${error}`;
    } else {
      displayResult = 'No result returned';
    }

    // Create a beautiful, visually distinct message with better formatting
    const separator = '═'.repeat(70);
    const thinSeparator = '─'.repeat(70);
    const message = success
      ? `\n\n${separator}\n    ✓ FLOW COMPLETED SUCCESSFULLY\n${separator}\n\n⏱️  Execution Time: ${executionTime}s\n🎯 Tokens Used: ${tokenUsage.totalTokens} total (${tokenUsage.inputTokens} in + ${tokenUsage.outputTokens} out)\n\n${thinSeparator}\n📤 FINAL RESULT:\n${thinSeparator}\n\n${displayResult}\n\n${separator}\n`
      : `\n\n${separator}\n    ✗ FLOW FAILED\n${separator}\n\n❌ Error: ${error || 'Unknown error'}\n\n${separator}\n`;

    this.logLine(0, message, {
      success,
      finalResult,
      error,
    });

    this.emitStreamEvent({
      type: 'execution_complete',
      timestamp: new Date().toISOString(),
      message,
      additionalData: {
        success,
        finalResult: displayResult,
        error,
        summary: {
          executionTime: this.getCurrentExecutionTime(),
          tokenUsage,
          success,
        },
      },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
    });
  }

  /**
   * Override error method to emit clean error events
   */
  override error(
    message: string,
    error?: BubbleError,
    metadata?: Partial<LogMetadata>
  ): void {
    super.error(message, error, metadata);
    this.emitStreamEvent({
      type: 'error',
      timestamp: new Date().toISOString(),
      message,
      lineNumber: metadata?.lineNumber,
      bubbleName: error?.bubbleName,
      variableId: error?.variableId,
      additionalData: {
        ...metadata?.additionalData,
        error: error
          ? {
              message: sanitizeErrorMessage(error.message),
              stack: sanitizeErrorStack(error),
              name: error.name,
            }
          : undefined,
      },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.ERROR],
    });
  }

  /**
   * Override warn method to emit clean warning events
   */
  override warn(message: string, metadata?: Partial<LogMetadata>): void {
    super.warn(message, metadata);
    this.emitStreamEvent({
      type: 'warn',
      timestamp: new Date().toISOString(),
      message,
      lineNumber: metadata?.lineNumber,
      bubbleName: metadata?.bubbleName,
      variableName: metadata?.variableName,
      additionalData: metadata?.additionalData,
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.WARN],
    });
  }

  /**
   * Override info method to emit clean info events
   */
  override info(message: string, metadata?: Partial<LogMetadata>): void {
    super.info(message, metadata);
    this.emitStreamEvent({
      type: 'info',
      timestamp: new Date().toISOString(),
      message,
      lineNumber: metadata?.lineNumber,
      bubbleName: metadata?.bubbleName,
      variableName: metadata?.variableName,
      additionalData: metadata?.additionalData,
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.INFO],
    });
  }

  /**
   * Set or update the stream callback
   */
  setStreamCallback(callback: StreamCallback): void {
    this.streamCallback = callback;
  }

  /**
   * Clear the stream callback
   */
  clearStreamCallback(): void {
    this.streamCallback = undefined;
  }

  /**
   * Emit a streaming event if callback is set
   */
  private emitStreamEvent(event: StreamingLogEvent): void {
    if (this.streamCallback) {
      try {
        // Handle both sync and async callbacks
        const result = this.streamCallback(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error('Stream callback error:', error);
          });
        }
      } catch (error) {
        console.error('Stream callback error:', error);
      }
    }
  }

  /**
   * Get current execution time in milliseconds
   */
  private getCurrentExecutionTime(): number {
    const summary = this.getExecutionSummary();
    return summary.totalDuration;
  }

  /**
   * Get current memory usage in bytes
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}
