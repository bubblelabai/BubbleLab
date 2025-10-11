import { BubbleFlow } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class AIAnalysisFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('ai-analysis-flow', 'Analyzes text using AI');
  }

  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    const text = payload.body?.text || 'Hello, AI!';

    try {
      // Mock AI response for testing
      // In real implementation, this would call AIAgentBubble
      const mockAIResponse = {
        analysis: 'This is a greeting message',
        sentiment: 'positive',
        wordCount: (text as string).split(' ').length,
      };

      return {
        success: true,
        input: text,
        analysis: mockAIResponse,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
