import type { ZodTypeAny } from 'zod';

export interface PendingApproval {
  id: string;
  action: string;
  targetFlowId: number;
  expiresAt: number;
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
  // Forward compat
  [key: string]: unknown;
}
