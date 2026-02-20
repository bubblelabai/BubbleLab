import type { ZodTypeAny } from 'zod';

export interface PendingApproval {
  id: string;
  action: string;
  targetFlowId: number;
  expiresAt: number;
  /** Display enrichments (optional, for richer approval messages) */
  targetFlowName?: string;
  aiReasoning?: string;
  toolInputSummary?: string;
}

export interface MemoryToolDef {
  name: string;
  description: string;
  schema: ZodTypeAny;
  func: (input: Record<string, unknown>) => Promise<string>;
}

export interface ExecutionMeta {
  // Core (set by runtime)
  flowId?: number;
  executionId?: number;
  studioBaseUrl?: string;
  // Thinking message
  _thinkingMessageTs?: string;
  _thinkingMessageChannel?: string;
  // Slack context
  _slackChannel?: string;
  _slackThreadTs?: string;
  _slackTriggerCredentialId?: number;
  _isSlackBot?: boolean;
  // Approval system
  _originalTriggerPayload?: Record<string, unknown>;
  _resumeAgentState?: Array<Record<string, unknown>>;
  _pendingApproval?: PendingApproval;
  // Conversation history
  triggerConversationHistory?: Array<{ role: string; content: string }>;
  // Agent memory
  memoryTools?: MemoryToolDef[];
  memorySystemPrompt?: string;
  memoryCallLLMInit?: (callLLM: (prompt: string) => Promise<string>) => void;
  memoryReflectionCallback?: (
    messages: Array<{ role: string; content: string }>
  ) => Promise<void>;
  // Agent lifecycle callbacks (set by Pro, consumed by ai-agent bubble)
  _onToolCallStart?: (toolName: string, toolInput: unknown) => void;
  _onToolCallError?: (detail: {
    toolName: string;
    toolInput: unknown;
    error: string;
    errorType: string;
    variableId?: number;
    model?: string;
  }) => void;
  _onAgentError?: (detail: {
    error: string;
    model: string;
    iterations: number;
    toolCalls: Array<{ tool: string; input?: unknown; output?: unknown }>;
    conversationHistory?: Array<{ role: string; content: string }>;
    variableId?: number;
  }) => void;
  // Forward compat
  [key: string]: unknown;
}
