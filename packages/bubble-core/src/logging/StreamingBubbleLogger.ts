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

interface StreamingLoggerConfig extends Partial<LoggerConfig> {
  streamCallback?: StreamCallback;
}

/**
 * Streaming version of BubbleLogger that emits real-time events
 * Extends BubbleLogger to maintain all existing functionality
 */
export class StreamingBubbleLogger extends BubbleLogger {
  private streamCallback?: StreamCallback;

  constructor(flowName: string, options: StreamingLoggerConfig = {}) {
    const { streamCallback, ...loggerConfig } = options;
    super(flowName, loggerConfig);
    this.streamCallback = streamCallback;
  }

  /**
   * Override logLine to emit streaming events
   */
  override logLine(
    lineNumber: number,
    message: string,
    additionalData?: Record<string, unknown>
  ): string {
    // Check if this line should be logged before emitting
    const shouldLog = this.shouldLogLine(lineNumber);

    // Call parent method to maintain existing functionality and get the message
    const logMessage = super.logLine(lineNumber, message, additionalData);

    // Only emit streaming event if the line was actually logged
    if (shouldLog) {
      this.emitStreamEvent({
        type: 'log_line',
        timestamp: new Date().toISOString(),
        lineNumber,
        message: logMessage,
        additionalData,
        executionTime: this.getCurrentExecutionTime(),
        memoryUsage: this.getCurrentMemoryUsage(),
      });
    }

    return logMessage;
  }

  /**
   * Override logBubbleInstantiation to emit streaming events
   */
  override logBubbleInstantiation(
    variableId: number,
    bubbleName: string,
    variableName: string,
    parameters?: Record<string, unknown>
  ): string {
    // Call parent method and use the returned message
    const logMessage = super.logBubbleInstantiation(
      variableId,
      bubbleName,
      variableName,
      parameters
    );

    this.emitStreamEvent({
      type: 'bubble_instantiation',
      timestamp: new Date().toISOString(),
      variableId,
      message: logMessage,
      bubbleName,
      variableName,
      additionalData: { parameters, variableId },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
    });

    return logMessage;
  }

  /**
   * Override logBubbleExecution to emit streaming events
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

    this.emitStreamEvent({
      type: 'bubble_execution',
      timestamp: new Date().toISOString(),
      variableId,
      message: logMessage,
      bubbleName,
      variableName,
      additionalData: { parameters, variableId },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
    });

    return logMessage;
  }

  override logBubbleExecutionComplete(
    variableId: number,
    bubbleName: string,
    variableName: string,
    result?: unknown
  ): string {
    // Call parent method and use the returned message
    const logMessage = super.logBubbleExecutionComplete(
      variableId,
      bubbleName,
      variableName,
      result
    );

    this.emitStreamEvent({
      type: 'bubble_execution_complete',
      timestamp: new Date().toISOString(),
      message: logMessage,
      variableId,
      bubbleName,
      variableName,
      additionalData: { result, variableId },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
    });

    return logMessage;
  }
  /**
   * Log execution completion
   */
  logExecutionComplete(
    success: boolean,
    finalResult?: unknown,
    error?: string
  ): void {
    const message = success
      ? 'Execution completed successfully in ' +
        (this.getCurrentExecutionTime() / 1000).toFixed(2) +
        's. Total tokens used: ' +
        this.getTokenUsage().inputTokens +
        ' input + ' +
        this.getTokenUsage().outputTokens +
        ' output = ' +
        this.getTokenUsage().totalTokens +
        ' total tokens.'
      : `Execution failed: ${error || 'Unknown error'}`;

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
        finalResult,
        error,
        summary: this.getExecutionSummary(),
      },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
    });
  }

  /**
   * Override trace method to emit streaming events
   */
  override trace(message: string, metadata?: Partial<LogMetadata>): void {
    super.trace(message, metadata);
    this.emitStreamEvent({
      type: 'trace',
      timestamp: new Date().toISOString(),
      message,
      lineNumber: metadata?.lineNumber,
      bubbleName: metadata?.bubbleName,
      variableName: metadata?.variableName,
      additionalData: metadata?.additionalData,
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.TRACE],
    });
  }

  /**
   * Override debug method to emit streaming events
   */
  override debug(message: string, metadata?: Partial<LogMetadata>): void {
    super.debug(message, metadata);
    this.emitStreamEvent({
      type: 'debug',
      timestamp: new Date().toISOString(),
      message,
      lineNumber: metadata?.lineNumber,
      bubbleName: metadata?.bubbleName,
      variableName: metadata?.variableName,
      additionalData: metadata?.additionalData,
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.DEBUG],
    });
  }

  /**
   * Override info method to emit streaming events
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
   * Override warn method to emit streaming events
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
   * Override error method to emit streaming events
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
              message: error.message,
              stack: error.stack,
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
   * Override fatal method to emit streaming events
   */
  override fatal(
    message: string,
    error?: BubbleError,
    metadata?: Partial<LogMetadata>
  ): void {
    super.fatal(message, error, metadata);
    this.emitStreamEvent({
      type: 'fatal',
      timestamp: new Date().toISOString(),
      message,
      lineNumber: metadata?.lineNumber,
      bubbleName: error?.bubbleName,
      variableId: error?.variableId,
      additionalData: {
        ...metadata?.additionalData,
        error: error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : undefined,
      },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.FATAL],
    });
  }

  /**
   * Override logToolCallStart to add streaming events
   */
  override logToolCallStart(
    toolCallId: string,
    toolName: string,
    toolInput: unknown,
    message?: string
  ): string {
    // Call parent method to maintain existing functionality and get the message
    const logMessage = super.logToolCallStart(
      toolCallId,
      toolName,
      toolInput,
      message
    );

    // Emit streaming event using the returned message
    this.emitStreamEvent({
      type: 'tool_call_start',
      timestamp: new Date().toISOString(),
      message: logMessage,
      bubbleName: 'ai-agent',
      toolCallId,
      toolName,
      toolInput,
      additionalData: { toolCallId, toolName, toolInput },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.DEBUG],
    });

    return logMessage;
  }

  /**
   * Override logToolCallComplete to add streaming events
   */
  override logToolCallComplete(
    toolCallId: string,
    toolName: string,
    toolInput: unknown,
    toolOutput: unknown,
    duration: number,
    message?: string
  ): string {
    // Call parent method to maintain existing functionality and get the message
    const logMessage = super.logToolCallComplete(
      toolCallId,
      toolName,
      toolInput,
      toolOutput,
      duration,
      message
    );

    // Emit streaming event using the returned message
    this.emitStreamEvent({
      type: 'tool_call_complete',
      timestamp: new Date().toISOString(),
      message: logMessage,
      bubbleName: 'ai-agent',
      toolCallId,
      toolName,
      toolInput,
      toolOutput,
      toolDuration: duration,
      additionalData: { toolCallId, toolName, toolInput, toolOutput, duration },
      executionTime: this.getCurrentExecutionTime(),
      memoryUsage: this.getCurrentMemoryUsage(),
      logLevel: LogLevel[LogLevel.DEBUG],
    });

    return logMessage;
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
