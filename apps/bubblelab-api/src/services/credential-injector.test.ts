// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import { extractToolCredentials } from './bubble-flow-parser.js';
import {
  injectCredentials,
  type UserCredential,
} from './credential-injector.js';
import type { ParsedBubble } from '@bubblelab/shared-schemas';
import { BubbleParameterType, CredentialType } from '@bubblelab/shared-schemas';

describe('Credential Injector - Tool Credential Detection', () => {
  describe('extractToolCredentials', () => {
    it('should extract credentials from AI agent with web-search-tool', () => {
      const aiAgentBubble: ParsedBubble = {
        bubbleName: 'ai-agent',
        className: 'AIAgent',
        variableName: 'myAgent',
        hasAwait: false,
        hasActionCall: true,
        parameters: [
          { name: 'message', value: 'Hello', type: BubbleParameterType.STRING },
          {
            name: 'tools',
            value: '[{"name": "web-search-tool"}]',
            type: BubbleParameterType.ARRAY,
          },
        ],
      };

      const result = extractToolCredentials(aiAgentBubble);

      expect(result).toContain(CredentialType.FIRECRAWL_API_KEY);
    });

    it('should handle AI agent with multiple tools requiring different credentials', () => {
      const aiAgentBubble: ParsedBubble = {
        bubbleName: 'ai-agent',
        className: 'AIAgent',
        variableName: 'myAgent',
        hasAwait: false,
        hasActionCall: true,
        parameters: [
          { name: 'message', value: 'Hello', type: BubbleParameterType.STRING },
          {
            name: 'tools',
            value: '[{"name": "web-search-tool"}, {"name": "sql-query-tool"}]',
            type: BubbleParameterType.ARRAY,
          },
        ],
      };

      const result = extractToolCredentials(aiAgentBubble);

      expect(result).toContain(CredentialType.FIRECRAWL_API_KEY);
    });

    it('should return empty array for non-ai-agent bubbles', () => {
      const postgresqlBubble: ParsedBubble = {
        bubbleName: 'postgresql',
        className: 'PostgreSQLBubble',
        variableName: 'db',
        hasAwait: false,
        hasActionCall: true,
        parameters: [],
      };

      const result = extractToolCredentials(postgresqlBubble);

      expect(result).toEqual([]);
    });

    it('should handle AI agent without tools parameter', () => {
      const aiAgentBubble: ParsedBubble = {
        bubbleName: 'ai-agent',
        className: 'AIAgent',
        variableName: 'myAgent',
        hasAwait: false,
        hasActionCall: true,
        parameters: [
          { name: 'message', value: 'Hello', type: BubbleParameterType.STRING },
        ],
      };

      const result = extractToolCredentials(aiAgentBubble);

      expect(result).toEqual([]);
    });
  });

  describe('injectCredentials with tool credentials', () => {
    it('should inject both AI and tool credentials for AI agent with web-search-tool', async () => {
      const originalCode = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';

export class TestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    const agent = new AIAgentBubble({
      message: "Search for information",
      tools: [{"name": "web-search-tool"}]
    }).action();
    
    return agent;
  }
}`;

      const bubbleParameters = {
        agent: {
          bubbleName: 'ai-agent',
          className: 'AIAgentBubble',
          variableName: 'agent',
          hasAwait: false,
          hasActionCall: true,
          parameters: [
            {
              name: 'message',
              value: '"Search for information"',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'tools',
              value: '[{"name": "web-search-tool"}]',
              type: BubbleParameterType.ARRAY,
            },
          ],
        },
      };

      const userCredentials: UserCredential[] = [
        {
          bubbleVarName: 'agent',
          secret: 'test-firecrawl-key',
          credentialType: 'FIRECRAWL_API_KEY',
        },
      ];

      const result = await injectCredentials(
        originalCode,
        bubbleParameters,
        userCredentials
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain('FIRECRAWL_API_KEY: "test-firecrawl-key"');
    });
  });
});
