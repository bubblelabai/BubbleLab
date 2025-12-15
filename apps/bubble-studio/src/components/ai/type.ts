import type {
  ParsedBubbleWithInfo,
  ClarificationQuestion,
  CoffeePlanEvent,
  CoffeeRequestExternalContextEvent,
  CoffeeContextAnswer,
} from '@bubblelab/shared-schemas';

// ============================================================================
// Chat Message Types - Discriminated Union
// ============================================================================

interface BaseChatMessage {
  id: string;
  timestamp: Date;
}

/** Regular user text message */
export interface UserChatMessage extends BaseChatMessage {
  type: 'user';
  content: string;
}

/** Regular assistant text message */
export interface AssistantChatMessage extends BaseChatMessage {
  type: 'assistant';
  content: string;
  code?: string;
  resultType?: 'code' | 'question' | 'answer' | 'reject';
  bubbleParameters?: Record<string, ParsedBubbleWithInfo>;
}

/** Coffee asking clarification questions */
export interface ClarificationRequestMessage extends BaseChatMessage {
  type: 'clarification_request';
  questions: ClarificationQuestion[];
}

/** User's answers to clarification questions */
export interface ClarificationResponseMessage extends BaseChatMessage {
  type: 'clarification_response';
  answers: Record<string, string[]>;
  originalQuestions?: ClarificationQuestion[];
}

/** Coffee requesting external context */
export interface ContextRequestMessage extends BaseChatMessage {
  type: 'context_request';
  request: CoffeeRequestExternalContextEvent;
}

/** User's response to context request */
export interface ContextResponseMessage extends BaseChatMessage {
  type: 'context_response';
  answer: CoffeeContextAnswer;
  credentialTypes?: string[];
}

/** Coffee's generated plan */
export interface PlanChatMessage extends BaseChatMessage {
  type: 'plan';
  plan: CoffeePlanEvent;
}

/** User's plan approval */
export interface PlanApprovalMessage extends BaseChatMessage {
  type: 'plan_approval';
  approved: boolean;
  comment?: string;
}

/** System message (for retries, errors, etc.) */
export interface SystemChatMessage extends BaseChatMessage {
  type: 'system';
  content: string;
}

/** Tool result message - persists successful tool call results */
export interface ToolResultChatMessage extends BaseChatMessage {
  type: 'tool_result';
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
  duration: number;
  success: boolean;
}

/** Union of all chat message types */
export type ChatMessage =
  | UserChatMessage
  | AssistantChatMessage
  | ClarificationRequestMessage
  | ClarificationResponseMessage
  | ContextRequestMessage
  | ContextResponseMessage
  | PlanChatMessage
  | PlanApprovalMessage
  | SystemChatMessage
  | ToolResultChatMessage;

// ============================================================================
// Helper Functions to Derive Pending State from Messages
// ============================================================================

/** Find pending clarification request (no response yet) */
export function getPendingClarificationRequest(
  messages: ChatMessage[]
): ClarificationRequestMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'clarification_response') return null;
    if (msg.type === 'clarification_request') return msg;
  }
  return null;
}

/** Find pending context request (no response yet) */
export function getPendingContextRequest(
  messages: ChatMessage[]
): ContextRequestMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'context_response') return null;
    if (msg.type === 'context_request') return msg;
  }
  return null;
}

/** Find pending plan (no approval yet) */
export function getPendingPlan(
  messages: ChatMessage[]
): PlanChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'plan_approval') return null;
    if (msg.type === 'plan') return msg;
  }
  return null;
}
