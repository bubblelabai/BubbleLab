/**
 * Shared types for streaming log events between backend and frontend
 */

export interface StreamingLogEvent {
  type:
    | 'log_line'
    | 'bubble_instantiation'
    | 'bubble_execution'
    | 'bubble_start'
    | 'bubble_complete'
    | 'execution_complete'
    | 'error'
    | 'stream_complete'
    | 'info'
    | 'warn'
    | 'debug'
    | 'bubble_execution_complete'
    | 'trace'
    | 'fatal'
    | 'bubble_parameters_update' // New event for sending complete bubble parameters
    | 'tool_call_start' // New event for AI agent tool call start
    | 'tool_call_complete'; // New event for AI agent tool call completion
  timestamp: string;
  lineNumber?: number;
  variableId?: number;
  message: string;
  bubbleId?: string; // Frontend-specific: for UI tracking
  bubbleName?: string;
  variableName?: string;
  additionalData?: Record<string, unknown>;
  executionTime?: number;
  memoryUsage?: number;
  logLevel?: string; // LogLevel enum as string (e.g., 'INFO', 'WARN', 'ERROR')
  // For bubble_parameters_update events
  bubbleParameters?: Record<
    number,
    import('./bubble-definition-schema').ParsedBubbleWithInfo
  >;
  // For tool_call_start and tool_call_complete events
  toolCallId?: string; // Unique identifier for the tool call
  toolName?: string; // Name of the tool being called
  toolInput?: unknown; // Input parameters for the tool
  toolOutput?: unknown; // Output from the tool (only for tool_call_complete)
  toolDuration?: number; // Duration in milliseconds (only for tool_call_complete)
  // For token usage tracking
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cumulativeTokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}
// Define streaming event types for real-time AI agent feedback
export type StreamingEvent =
  | {
      type: 'start';
      data: { message: string; maxIterations: number; timestamp: string };
    }
  | { type: 'llm_start'; data: { model: string; temperature: number } }
  | { type: 'token'; data: { content: string; messageId: string } }
  | { type: 'think'; data: { content: string; messageId: string } }
  | { type: 'llm_complete'; data: { messageId: string; totalTokens?: number } }
  | {
      type: 'tool_start';
      data: { tool: string; input: unknown; callId: string };
    }
  | {
      type: 'tool_complete';
      data: { callId: string; output: unknown; duration: number };
    }
  | { type: 'iteration_start'; data: { iteration: number } }
  | {
      type: 'iteration_complete';
      data: { iteration: number; hasToolCalls: boolean };
    }
  | { type: 'error'; data: { error: string; recoverable: boolean } }
  | {
      type: 'complete';
      data: { result: unknown; totalDuration: number };
    };

export type StreamCallback = (event: StreamingLogEvent) => void | Promise<void>;
