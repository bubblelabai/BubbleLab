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
  /** Subagent's last AI text before approval — used as Slack response on V2 resume */
  lastAIText?: string;
}

export interface MemoryToolDef {
  name: string;
  description: string;
  schema: ZodTypeAny;
  func: (input: Record<string, unknown>) => Promise<string>;
}

/** Snapshot of the master agent's graph messages, stored on executionMeta by
 *  the `use-capability` tool so that the `beforeToolCall` hook can capture
 *  both master and subagent state when an approval interrupt is triggered. */
export interface MasterAgentSnapshot {
  messages: Array<Record<string, unknown>>;
  capabilityId: string;
  capabilityTask: string;
}

/** V2 structured resume state — stores master and subagent messages separately
 *  so each agent resumes from its own context (fixes multi-cap state leak). */
export interface ResumeAgentStateV2 {
  __version: 2;
  masterState: Array<Record<string, unknown>>;
  capabilityId: string;
  capabilityTask: string;
  subagentState: Array<Record<string, unknown>>;
}

export interface ExecutionMeta {
  // Core (set by runtime)
  flowId?: number;
  executionId?: number;
  studioBaseUrl?: string;
  apiBaseUrl?: string;
  // Thinking message
  _thinkingMessageTs?: string;
  _thinkingMessageChannel?: string;
  // Slack context
  _slackChannel?: string;
  _slackThreadTs?: string;
  _slackTriggerCredentialId?: number;
  _isSlackBot?: boolean;
  _slackBotToken?: string;
  // Approval system
  _originalTriggerPayload?: Record<string, unknown>;
  _resumeAgentState?: Array<Record<string, unknown>>;
  _resumeAgentStateV2?: ResumeAgentStateV2;
  _pendingApproval?: PendingApproval;
  /** Transient: set by use-capability, consumed by beforeToolCall hook */
  _masterAgentSnapshot?: MasterAgentSnapshot;
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
  // Bot notice metadata
  _flowName?: string;
  _ownerFirstName?: string;
  _isPearlFlow?: boolean;
  _pearlFlowId?: number;
  // Child flow link (set when a run-only skill executes via run-flow)
  _lastRunFlowId?: number;
  _lastRunFlowName?: string;
  // Forward compat
  [key: string]: unknown;
}
