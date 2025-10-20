import { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string; // For user messages, this is the message. For assistant, this is the message text
  code?: string; // Optional code snippet for assistant responses
  resultType?: 'code' | 'question' | 'reject';
  timestamp: Date;
  bubbleParameters?: Record<string, ParsedBubbleWithInfo>; // Bubble parameters for code responses
}
