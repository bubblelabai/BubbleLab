import type { ChatMessage } from '../components/ai/type';
import { ConversationMessage } from '@bubblelab/shared-schemas';

export function messagesToConversationHistory(
  messages: ChatMessage[]
): ConversationMessage[] {
  return messages
    .filter(
      (msg) =>
        msg.type === 'user' ||
        msg.type === 'assistant' ||
        msg.type === 'context_request' ||
        msg.type === 'context_response'
    )
    .map((msg) => {
      switch (msg.type) {
        case 'user':
          return { role: 'user' as const, content: msg.content };
        case 'assistant':
          return { role: 'assistant' as const, content: msg.content };
        case 'context_request':
          return {
            role: 'assistant' as const,
            content: msg.request.description,
          };
        case 'context_response':
          return {
            role: 'user' as const,
            content:
              msg.answer.status === 'success'
                ? JSON.stringify(msg.answer.result, null, 2)
                : msg.answer.status === 'rejected'
                  ? 'I chose to skip the context-gathering step.'
                  : `Context gathering failed: ${msg.answer.error}`,
          };
      }
    });
}
