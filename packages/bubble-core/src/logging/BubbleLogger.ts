import { BubbleError } from '../types/bubble-errors';
import type { TokenUsage, ExecutionSummary } from '@bubblelab/shared-schemas';

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata: LogMetadata;
  duration?: number; // Duration from previous log entry in milliseconds
}

export interface LogMetadata {
  flowName: string;
  variableId?: number;
  lineNumber?: number;
  functionName?: string;
  bubbleName?: string;
  variableName?: string;
  operationType?:
    | 'bubble_instantiation'
    | 'bubble_execution'
    | 'variable_assignment'
    | 'condition'
    | 'loop_iteration'
    | 'script'
    | 'bubble_execution_complete';
  memoryUsage?: NodeJS.MemoryUsage;
  stackTrace?: string;
  additionalData?: Record<string, unknown>;
  tokenUsage?: TokenUsage;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableTiming: boolean;
  enableMemoryTracking: boolean;
  enableStackTraces: boolean;
  maxLogEntries: number;
  bufferSize: number;
  flushInterval?: number; // Auto-flush interval in milliseconds
}

export class BubbleLogger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private startTime: number;
  private lastLogTime: number;
  private executionId: string;
  private lineTimings: Map<
    number,
    {
      min: number;
      max: number;
      sum: number;
      count: number;
    }
  > = new Map();
  private lineLogCounts: Map<number, number> = new Map();
  private peakMemoryUsage?: NodeJS.MemoryUsage;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  // Track cumulative token usage per model
  private cumulativeTokenUsageByModel: Map<
    string,
    Omit<TokenUsage, 'modelName'>
  > = new Map();

  constructor(
    private flowName: string,
    config: Partial<LoggerConfig> = {}
  ) {
    this.config = {
      minLevel: LogLevel.INFO,
      enableTiming: true,
      enableMemoryTracking: true,
      enableStackTraces: false,
      maxLogEntries: 10000,
      bufferSize: 100,
      flushInterval: 1000,
      ...config,
    };

    this.startTime = Date.now();
    this.lastLogTime = this.startTime;
    this.executionId = `${flowName}-${this.startTime}-${Math.random().toString(36).substring(7)}`;

    if (this.config.flushInterval) {
      this.flushTimer = setInterval(
        () => this.flush(),
        this.config.flushInterval
      );
    }
  }

  /**
   * Log execution at a specific line with timing information
   * Returns the message for backward compatibility, use shouldLogLine() to check if logging occurred
   */
  logLine(
    lineNumber: number,
    message: string,
    additionalData?: Record<string, unknown>
  ): string {
    const MAX_LOGS_PER_LINE = 5;

    // Track how many times this line has been logged
    const logCount = this.lineLogCounts.get(lineNumber) ?? 0;

    // Only log if under the limit
    if (logCount < MAX_LOGS_PER_LINE) {
      this.log(LogLevel.INFO, message, {
        lineNumber,
        operationType: 'script',
        additionalData,
      });
      this.lineLogCounts.set(lineNumber, logCount + 1);
    }

    // Track line execution timing (always track, even if not logging)
    const now = Date.now();
    const duration = now - this.lastLogTime;

    // Update timing statistics for this line
    const stats = this.lineTimings.get(lineNumber);
    if (!stats) {
      this.lineTimings.set(lineNumber, {
        min: duration,
        max: duration,
        sum: duration,
        count: 1,
      });
    } else {
      stats.min = Math.min(stats.min, duration);
      stats.max = Math.max(stats.max, duration);
      stats.sum += duration;
      stats.count++;
    }

    return message;
  }

  /**
   * Check if a line should be logged (hasn't exceeded the limit)
   */
  protected shouldLogLine(lineNumber: number): boolean {
    const MAX_LOGS_PER_LINE = 5;
    const logCount = this.lineLogCounts.get(lineNumber) ?? 0;
    return logCount < MAX_LOGS_PER_LINE;
  }

  /**
   * Log bubble instantiation
   */
  logBubbleInstantiation(
    variableId: number,
    bubbleName: string,
    variableName: string,
    parameters?: Record<string, unknown>
  ): string {
    const message = (parameters as Record<string, unknown>)?.message as string;
    const messagePreview = message ? message.substring(0, 200) : '';
    const logMessage = `Instantiating bubble ${bubbleName} as ${variableName}${messagePreview ? ` with message: ${messagePreview}` : ''}`;
    this.log(LogLevel.DEBUG, logMessage, {
      variableId,
      bubbleName,
      variableName,
      operationType: 'bubble_instantiation',
      additionalData: { parameters },
    });
    return logMessage;
  }

  /**
   * Log bubble execution
   */
  logBubbleExecution(
    variableId: number,
    bubbleName: string,
    variableName: string,
    parameters?: Record<string, unknown>
  ): string {
    // Try to find the message from the parameters
    const message = (parameters as Record<string, unknown>)?.message as string;
    const messagePreview = message ? message.substring(0, 200) : '';
    const logMessage = `Executing bubble ${bubbleName} as ${variableName}${messagePreview ? ` with message: ${messagePreview}` : ''}`;
    this.log(LogLevel.DEBUG, logMessage, {
      variableId,
      bubbleName,
      variableName,
      operationType: 'bubble_execution',
      additionalData: { parameters },
    });
    return logMessage;
  }

  /**
   * Log bubble execution completion
   */
  logBubbleExecutionComplete(
    variableId: number,
    bubbleName: string,
    variableName: string,
    result?: unknown
  ): string {
    const logMessage = `Bubble execution completed: ${bubbleName} ${result && typeof result === 'object' && 'data' in result ? ` - Result: ${JSON.stringify(result.data).substring(0, 200)}` : ''}`;
    this.log(LogLevel.DEBUG, logMessage, {
      variableId,
      bubbleName,
      variableName,
      operationType: 'bubble_execution_complete',
      additionalData: { result },
    });
    return logMessage;
  }

  /**
   * Log variable assignment
   */
  logVariableAssignment(
    lineNumber: number,
    variableName: string,
    value: unknown
  ): void {
    this.log(LogLevel.TRACE, `Assigning variable ${variableName}`, {
      lineNumber,
      variableName,
      operationType: 'variable_assignment',
      additionalData: { value: typeof value === 'object' ? '[Object]' : value },
    });
  }

  /**
   * Log control flow operations
   */
  logControlFlow(
    lineNumber: number,
    type: 'condition' | 'loop_iteration',
    condition: string,
    result?: boolean
  ): void {
    this.log(LogLevel.TRACE, `${type}: ${condition}`, {
      lineNumber,
      operationType: type,
      additionalData: { condition, result },
    });
  }

  /**
   * Add token usage to cumulative tracking per model
   */
  addTokenUsage(tokenUsage: TokenUsage): void {
    const modelName = tokenUsage.modelName || 'unknown';

    // Get or create entry for this model
    const existing = this.cumulativeTokenUsageByModel.get(modelName) || {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    // Add to the cumulative usage for this model
    existing.inputTokens += tokenUsage.inputTokens;
    existing.outputTokens += tokenUsage.outputTokens;
    existing.totalTokens += tokenUsage.totalTokens;

    this.cumulativeTokenUsageByModel.set(modelName, existing);
  }

  /**
   * Get current cumulative token usage (aggregated across all models)
   */
  getTokenUsage(): TokenUsage {
    // Aggregate token usage across all models
    const aggregated = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    for (const usage of this.cumulativeTokenUsageByModel.values()) {
      aggregated.inputTokens += usage.inputTokens;
      aggregated.outputTokens += usage.outputTokens;
    }

    // Recalculate total instead of summing reported totals
    // This ensures accuracy when models (like Gemini) report incorrect totalTokens
    aggregated.totalTokens = aggregated.inputTokens + aggregated.outputTokens;

    return aggregated;
  }

  /**
   * Get cumulative token usage broken down by model
   */
  getTokenUsageByModel(): Map<string, Omit<TokenUsage, 'modelName'>> {
    // Create a new map with recalculated totalTokens for each model
    const recalculated = new Map<string, Omit<TokenUsage, 'modelName'>>();

    for (const [
      modelName,
      usage,
    ] of this.cumulativeTokenUsageByModel.entries()) {
      recalculated.set(modelName, {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        // Recalculate total for consistency
        totalTokens: usage.inputTokens + usage.outputTokens,
      });
    }

    return recalculated;
  }

  /**
   * Log token usage
   */
  logTokenUsage(
    tokenUsage: TokenUsage,
    message?: string,
    metadata?: Partial<LogMetadata>
  ): string {
    const modelName = tokenUsage.modelName || 'unknown';
    const logMessage =
      message ||
      `Token usage (${modelName}): ${tokenUsage.inputTokens} input + ${tokenUsage.outputTokens} output = ${tokenUsage.totalTokens} total`;

    // Add token usage to cumulative tracking per model
    this.addTokenUsage(tokenUsage);

    // Convert Map to object for logging
    const tokenUsageByModel = Object.fromEntries(
      this.cumulativeTokenUsageByModel.entries()
    );

    this.info(logMessage, {
      ...metadata,
      tokenUsage,
      operationType: metadata?.operationType || 'bubble_execution',
      additionalData: {
        ...metadata?.additionalData,
        tokenUsage,
        cumulativeTokenUsage: this.getTokenUsage(), // Aggregated total
        cumulativeTokenUsageByModel: tokenUsageByModel, // Per-model breakdown
      },
    });

    return logMessage;
  }

  /**
   * Log AI agent tool call start
   */
  logToolCallStart(
    toolCallId: string,
    toolName: string,
    toolInput: unknown,
    message?: string
  ): string {
    const logMessage = message || `Starting tool call: ${toolName}`;

    this.debug(logMessage, {
      bubbleName: 'ai-agent',
      operationType: 'bubble_execution',
      additionalData: {
        toolCallId,
        toolName,
        toolInput,
        phase: 'tool_call_start',
      },
    });

    return logMessage;
  }

  /**
   * Log AI agent tool call completion
   */
  logToolCallComplete(
    toolCallId: string,
    toolName: string,
    toolInput: unknown,
    toolOutput: unknown,
    duration: number,
    message?: string
  ): string {
    const logMessage =
      message || `Completed tool call: ${toolName} (${duration}ms)`;

    this.debug(logMessage, {
      bubbleName: 'ai-agent',
      operationType: 'bubble_execution',
      additionalData: {
        toolCallId,
        toolName,
        toolInput,
        toolOutput,
        duration,
        phase: 'tool_call_complete',
      },
    });

    return logMessage;
  }

  /**
   * General logging method with different levels
   */
  log(
    level: LogLevel,
    message: string,
    metadata: Partial<LogMetadata> = {}
  ): void {
    if (level < this.config.minLevel) {
      return;
    }

    const now = Date.now();
    const duration = now - this.lastLogTime;

    const entry: LogEntry = {
      id: `${this.executionId}-${this.logs.length}`,
      timestamp: now,
      level,
      message,
      duration,
      metadata: {
        flowName: this.flowName,
        ...metadata,
        memoryUsage: this.config.enableMemoryTracking
          ? process.memoryUsage()
          : undefined,
        stackTrace: this.config.enableStackTraces
          ? this.captureStackTrace()
          : undefined,
      },
    };

    // Update peak memory usage
    if (this.config.enableMemoryTracking && entry.metadata.memoryUsage) {
      if (
        !this.peakMemoryUsage ||
        entry.metadata.memoryUsage.heapUsed > this.peakMemoryUsage.heapUsed
      ) {
        this.peakMemoryUsage = entry.metadata.memoryUsage;
      }
    }

    this.buffer.push(entry);
    this.lastLogTime = now;

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  /**
   * Convenience methods for different log levels
   */
  trace(message: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  debug(message: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Partial<LogMetadata>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(
    message: string,
    error?: BubbleError,
    metadata?: Partial<LogMetadata>
  ): void {
    const errorMetadata = error
      ? {
          additionalData: {
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
          },
        }
      : {};

    this.log(LogLevel.ERROR, message, {
      ...metadata,
      ...errorMetadata,
      variableId: error?.variableId,
      bubbleName: error?.bubbleName,
    });
  }

  fatal(
    message: string,
    error?: BubbleError,
    metadata?: Partial<LogMetadata>
  ): void {
    const errorMetadata = error
      ? {
          additionalData: {
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
          },
        }
      : {};

    this.log(LogLevel.FATAL, message, {
      ...metadata,
      ...errorMetadata,
      variableId: error?.variableId,
      bubbleName: error?.bubbleName,
    });
  }

  /**
   * Flush buffered logs to main log array
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    this.logs.push(...this.buffer);
    this.buffer = [];

    // Trim logs if exceeding max entries
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Get execution summary with analytics
   */
  getExecutionSummary(): ExecutionSummary {
    this.flush(); // Ensure all logs are included

    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    const MAX_LOG_ENTRIES = 1000;

    const errorLogs = this.logs.filter((log) => log.level >= LogLevel.ERROR);
    const warningLogs = this.logs.filter((log) => log.level === LogLevel.WARN);
    const lineLogs = this.logs.filter(
      (log) => log.metadata.lineNumber !== undefined
    );

    // Calculate average line execution time from statistics
    let totalExecutionTime = 0;
    let totalExecutionCount = 0;

    for (const stats of this.lineTimings.values()) {
      totalExecutionTime += stats.sum;
      totalExecutionCount += stats.count;
    }

    const averageLineExecutionTime =
      totalExecutionCount > 0 ? totalExecutionTime / totalExecutionCount : 0;
    // Find slowest lines using max from statistics
    const slowestLines: Array<{
      lineNumber: number;
      duration: number;
      message: string;
    }> = [];

    for (const [lineNumber, stats] of this.lineTimings.entries()) {
      if (slowestLines.length >= MAX_LOG_ENTRIES) break;

      const maxDuration = stats.max;
      const logEntry = this.logs.find(
        (log) =>
          log.metadata.lineNumber === lineNumber && log.duration === maxDuration
      );

      if (logEntry) {
        slowestLines.push({
          lineNumber,
          duration: maxDuration,
          message: logEntry.message,
        });
      }
    }
    slowestLines.sort((a, b) => b.duration - a.duration);

    // Convert Map to plain object for tokenUsageByModel (with recalculated totals)
    const tokenUsageByModel: Record<string, Omit<TokenUsage, 'modelName'>> = {};
    for (const [modelName, usage] of this.getTokenUsageByModel().entries()) {
      tokenUsageByModel[modelName] = usage;
    }

    return {
      totalDuration,
      lineExecutionCount: lineLogs.length,
      bubbleExecutionCount: this.logs.filter(
        (log) => log.metadata.operationType === 'bubble_execution'
      ).length,
      errorCount: errorLogs.length,
      warningCount: warningLogs.length,
      averageLineExecutionTime,
      slowestLines: slowestLines.slice(0, 10), // Top 10 slowest lines
      memoryPeakUsage: this.peakMemoryUsage,
      startTime: this.startTime,
      endTime,
      tokenUsage: this.getTokenUsage(), // Aggregated token usage across all models
      tokenUsageByModel, // Per-model breakdown
    };
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    this.flush();
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.getLogs().filter((log) => log.level === level);
  }

  /**
   * Get logs for a specific line number
   */
  getLogsByLine(lineNumber: number): LogEntry[] {
    return this.getLogs().filter(
      (log) => log.metadata.lineNumber === lineNumber
    );
  }

  /**
   * Export logs in various formats
   */
  exportLogs(format: 'json' | 'csv' | 'table'): string {
    const logs = this.getLogs();

    switch (format) {
      case 'json': {
        return JSON.stringify(
          {
            executionId: this.executionId,
            summary: this.getExecutionSummary(),
            logs,
          },
          null,
          2
        );
      }

      case 'csv': {
        const headers =
          'ID,Timestamp,Level,Message,Duration,LineNumber,Operation,BubbleName,VariableName';
        const rows = logs.map((log) =>
          [
            log.id,
            new Date(log.timestamp).toISOString(),
            LogLevel[log.level],
            `"${log.message.replace(/"/g, '""')}"`,
            log.duration || 0,
            log.metadata.lineNumber || '',
            log.metadata.operationType || '',
            log.metadata.bubbleName || '',
            log.metadata.variableName || '',
          ].join(',')
        );
        return [headers, ...rows].join('\n');
      }

      case 'table':
        return this.formatAsTable(logs);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  private captureStackTrace(): string {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(3).join('\n') : '';
  }

  private formatAsTable(logs: LogEntry[]): string {
    if (logs.length === 0) return 'No logs to display';

    const headers = ['Time', 'Level', 'Line', 'Duration', 'Message'];
    const rows = logs.map((log) => [
      new Date(log.timestamp).toISOString().substring(11, 23),
      LogLevel[log.level].padEnd(5),
      (log.metadata.lineNumber || '').toString().padEnd(4),
      `${log.duration || 0}ms`.padEnd(8),
      log.message.substring(0, 80),
    ]);

    const columnWidths = headers.map((header, i) =>
      Math.max(header.length, ...rows.map((row) => row[i].length))
    );

    const separator = columnWidths
      .map((width) => '-'.repeat(width))
      .join('-+-');
    const headerRow = headers
      .map((header, i) => header.padEnd(columnWidths[i]))
      .join(' | ');
    const dataRows = rows.map((row) =>
      row.map((cell, i) => cell.padEnd(columnWidths[i])).join(' | ')
    );

    return [headerRow, separator, ...dataRows].join('\n');
  }
}
