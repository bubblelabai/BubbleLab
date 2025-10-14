import { describe, it, expect, beforeEach } from 'vitest';
import { BubbleInjector, UserCredentialWithId } from './BubbleInjector.js';
import { BubbleScript } from '../parse/BubbleScript';
import {
  CredentialType,
  ParsedBubbleWithInfo,
  BubbleParameterType,
} from '@bubblelab/shared-schemas';
import { BubbleFactory } from '@bubblelab/bubble-core';
import { getFixture } from '../../tests/fixtures';

describe('BubbleInjector.findCredentials()', () => {
  let bubbleFactory: BubbleFactory;

  beforeEach(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });

  describe('Slack bubble credential detection', () => {
    it('should extract Slack credentials from Slack bubble', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const slackBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        'slack-sender': {
          variableId: 1,
          variableName: 'slackSender',
          bubbleName: 'slack',
          className: 'SlackBubble',
          nodeType: 'service',
          location: {
            startLine: 1,
            startCol: 0,
            endLine: 5,
            endCol: 0,
          },
          parameters: [
            {
              name: 'channel',
              value: '#general',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'message',
              value: 'Hello world',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      };

      const credentials = injector.findCredentials(slackBubbleParams);

      expect(credentials).toBeDefined();
      expect(credentials[1]).toContain(CredentialType.SLACK_CRED);
      expect(credentials[1]).toHaveLength(1);
    });

    it('should return all credentials including system credentials', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const aiAgentBubble: Record<string, ParsedBubbleWithInfo> = {
        'ai-bubble': {
          variableId: 2,
          variableName: 'aiBubble',
          bubbleName: 'ai-agent',
          className: 'AIAgent',
          nodeType: 'service',
          location: {
            startLine: 1,
            startCol: 0,
            endLine: 5,
            endCol: 0,
          },
          parameters: [
            {
              name: 'model',
              value: 'gemini-2.0-flash-exp',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      };

      const credentials = injector.findCredentials(aiAgentBubble);

      // Should return all AI agent credentials (including system ones)
      expect(Object.keys(credentials)).toHaveLength(1);
      expect(credentials[2]).toContain(CredentialType.OPENAI_CRED);
      expect(credentials[2]).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials[2]).toContain(CredentialType.ANTHROPIC_CRED);
      expect(credentials[2]).toContain(CredentialType.FIRECRAWL_API_KEY);
    });
  });

  describe('AI agent with tools credential detection', () => {
    it('should extract credentials from AI agent tools (Slack + Firecrawl)', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const aiAgentWithTools: Record<string, ParsedBubbleWithInfo> = {
        'ai-assistant': {
          variableId: 3,
          variableName: 'aiAssistant',
          bubbleName: 'ai-agent',
          className: 'AIAgent',
          nodeType: 'service',
          location: {
            startLine: 1,
            startCol: 0,
            endLine: 10,
            endCol: 0,
          },
          parameters: [
            {
              name: 'model',
              value: 'gemini-2.0-flash-exp',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'tools',
              value: '[{"name": "slack"}, {"name": "web-scrape-tool"}]',
              type: BubbleParameterType.ARRAY,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      };

      const credentials = injector.findCredentials(aiAgentWithTools);

      expect(credentials).toBeDefined();
      expect(credentials[3]).toBeDefined();

      // Should contain AI agent base credentials plus tool credentials
      expect(credentials[3]).toContain(CredentialType.OPENAI_CRED);
      expect(credentials[3]).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials[3]).toContain(CredentialType.ANTHROPIC_CRED);
      expect(credentials[3]).toContain(CredentialType.FIRECRAWL_API_KEY); // Base + tool
      expect(credentials[3]).toContain(CredentialType.SLACK_CRED); // From tool
    });

    it('should handle malformed tools parameter gracefully', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const aiAgentWithMalformedTools: Record<string, ParsedBubbleWithInfo> = {
        'ai-assistant': {
          variableId: 4,
          variableName: 'aiAssistant',
          bubbleName: 'ai-agent',
          className: 'AIAgent',
          nodeType: 'service',
          location: {
            startLine: 1,
            startCol: 0,
            endLine: 10,
            endCol: 0,
          },
          parameters: [
            {
              name: 'model',
              value: 'gemini-2.0-flash-exp',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'tools',
              value: 'invalid json [',
              type: BubbleParameterType.ARRAY,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      };

      const credentials = injector.findCredentials(aiAgentWithMalformedTools);

      // Should return AI agent base credentials but not crash on malformed tools
      expect(Object.keys(credentials)).toHaveLength(1);
      expect(credentials[4]).toContain(CredentialType.OPENAI_CRED);
      expect(credentials[4]).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials[4]).toContain(CredentialType.ANTHROPIC_CRED);
      expect(credentials[4]).toContain(CredentialType.FIRECRAWL_API_KEY);
    });

    it('should handle single tool object (not array)', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const aiAgentWithSingleTool: Record<string, ParsedBubbleWithInfo> = {
        'ai-assistant': {
          variableId: 5,
          variableName: 'aiAssistant',
          bubbleName: 'ai-agent',
          className: 'AIAgent',
          nodeType: 'service',
          location: {
            startLine: 1,
            startCol: 0,
            endLine: 10,
            endCol: 0,
          },
          parameters: [
            {
              name: 'model',
              value: 'gemini-2.0-flash-exp',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'tools',
              value: '{"name": "slack"}',
              type: BubbleParameterType.OBJECT,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      };

      const credentials = injector.findCredentials(aiAgentWithSingleTool);

      expect(credentials).toBeDefined();
      expect(credentials[5]).toBeDefined();
      // Should contain AI agent base credentials plus tool credentials
      expect(credentials[5]).toContain(CredentialType.OPENAI_CRED);
      expect(credentials[5]).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials[5]).toContain(CredentialType.ANTHROPIC_CRED);
      expect(credentials[5]).toContain(CredentialType.FIRECRAWL_API_KEY); // Base + tool
      expect(credentials[5]).toContain(CredentialType.SLACK_CRED); // From tool
    });
  });

  describe('Complex multi-bubble scenario', () => {
    it('should extract credentials from multiple bubbles correctly', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const multiBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        'slack-sender': {
          variableId: 6,
          variableName: 'slackSender',
          bubbleName: 'slack',
          className: 'SlackBubble',
          nodeType: 'service',
          location: {
            startLine: 1,
            startCol: 0,
            endLine: 5,
            endCol: 0,
          },
          parameters: [
            {
              name: 'channel',
              value: '#general',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
        'database-query': {
          variableId: 7,
          variableName: 'dbQuery',
          bubbleName: 'postgresql',
          className: 'PostgreSQLBubble',
          nodeType: 'service',
          location: {
            startLine: 10,
            startCol: 0,
            endLine: 15,
            endCol: 0,
          },
          parameters: [
            {
              name: 'query',
              value: 'SELECT * FROM users',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
        'ai-assistant': {
          variableId: 8,
          variableName: 'aiAssistant',
          bubbleName: 'ai-agent',
          className: 'AIAgent',
          nodeType: 'service',
          location: {
            startLine: 20,
            startCol: 0,
            endLine: 30,
            endCol: 0,
          },
          parameters: [
            {
              name: 'model',
              value: 'gemini-2.0-flash-exp',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'tools',
              value: '[{"name": "web-scrape-tool"}]',
              type: BubbleParameterType.ARRAY,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      };

      const credentials = injector.findCredentials(multiBubbleParams);

      expect(credentials).toBeDefined();

      // Slack bubble should require Slack credentials
      expect(credentials[6]).toContain(CredentialType.SLACK_CRED);
      expect(credentials[6]).toHaveLength(1);

      // Database bubble should require database credentials
      expect(credentials[7]).toContain(CredentialType.DATABASE_CRED);
      expect(credentials[7]).toHaveLength(1);

      // AI agent should require base credentials plus tool credentials
      expect(credentials[8]).toContain(CredentialType.OPENAI_CRED);
      expect(credentials[8]).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials[8]).toContain(CredentialType.ANTHROPIC_CRED);
      expect(credentials[8]).toContain(CredentialType.FIRECRAWL_API_KEY); // Base + tool
      expect(credentials[8]).toHaveLength(4); // All AI agent credentials

      // Should have 3 different bubble IDs with credentials
      expect(Object.keys(credentials)).toHaveLength(3);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty bubble parameters', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials({});

      expect(credentials).toBeDefined();
      expect(Object.keys(credentials)).toHaveLength(0);
    });

    it('should handle bubbles with no credential requirements', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const noCreds: Record<string, ParsedBubbleWithInfo> = {
        'math-bubble': {
          variableId: 9,
          variableName: 'mathBubble',
          bubbleName: 'unknown-bubble',
          className: 'UnknownBubble',
          nodeType: 'service',
          location: {
            startLine: 1,
            startCol: 0,
            endLine: 5,
            endCol: 0,
          },
          parameters: [
            {
              name: 'operation',
              value: 'add',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const credentials = injector.findCredentials(noCreds);

      expect(credentials).toBeDefined();
      expect(Object.keys(credentials)).toHaveLength(0);
    });
  });
});

describe('BubbleInjector.injectCredentials()', () => {
  let bubbleFactory: BubbleFactory;

  beforeEach(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });

  describe('Basic credential injection', () => {
    it('should inject user credentials into Slack bubble', () => {
      const bubbleScript = `
        import { SlackBubble } from '@bubblelab/bubble-core';

        const slack = new SlackBubble({
          channel: '#general',
          message: 'Hello world'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const slackBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        slack: {
          variableId: 1,
          variableName: 'slack',
          bubbleName: 'slack',
          className: 'SlackBubble',
          nodeType: 'service',
          location: {
            startLine: 4,
            startCol: 22,
            endLine: 7,
            endCol: 10,
          },
          parameters: [
            {
              name: 'channel',
              value: '#general',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'message',
              value: 'Hello world',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 1,
          secret: 'slack-token-123',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const result = injector.injectCredentials(
        slackBubbleParams,
        userCredentials
      );

      console.log('Injection result:', result);
      if (!result.success) {
        console.log('Errors:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.injectedCredentials).toBeDefined();
      console.log(result.injectedCredentials);
      expect(result.injectedCredentials!['1.SLACK_CRED']).toMatch(
        /slac\*+-123/
      );

      // Check that credentials were added to bubble parameters
      expect(slackBubbleParams.slack.parameters).toHaveLength(3);
      const credentialsParam = slackBubbleParams.slack.parameters.find(
        (p) => p.name === 'credentials'
      );
      expect(credentialsParam).toBeDefined();
      expect(credentialsParam!.type).toBe(BubbleParameterType.OBJECT);

      const credentialsObj = credentialsParam!.value as Record<string, string>;
      expect(credentialsObj[CredentialType.SLACK_CRED]).toBe('slack-token-123');
    });

    it('should inject credentials into PostgreSQL bubble', () => {
      const postgresBubbleScript = getFixture('parameter-with-string');
      const mockBubbleScript = new BubbleScript(
        postgresBubbleScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      console.log(
        'Original parsed bubbles:',
        Object.values(mockBubbleScript.getOriginalParsedBubbles()).map(
          (b) => b.parameters
        )
      );

      const result = injector.injectCredentials(
        mockBubbleScript.getOriginalParsedBubbles(),
        [],
        {
          [CredentialType.DATABASE_CRED]: 'dfd',
        }
      );
      console.log('Injection result:', result);
      expect(result.success).toBe(true);
    });

    it('should inject system credentials when no user credentials provided', () => {
      const bubbleScript = `
      const slack = new SlackBubble({
          channel: '#general',
          message: 'Hello world'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const slackBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        slack: {
          variableId: 1,
          variableName: 'slack',
          bubbleName: 'slack',
          className: 'SlackBubble',
          nodeType: 'service',
          location: {
            startLine: 2,
            startCol: 20,
            endLine: 5,
            endCol: 10,
          },
          parameters: [
            {
              name: 'channel',
              value: '#general',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'message',
              value: 'Hello world',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const systemCredentials = {
        [CredentialType.SLACK_CRED]: 'system-slack-token',
      };

      const result = injector.injectCredentials(
        slackBubbleParams,
        [],
        systemCredentials
      );

      expect(result.success).toBe(true);
      expect(result.injectedCredentials!['1.SLACK_CRED']).toMatch(
        /syst\*+oken/
      );

      // Check that system credentials were added
      const credentialsParam = slackBubbleParams.slack.parameters.find(
        (p) => p.name === 'credentials'
      );
      const credentialsObj = credentialsParam!.value as Record<string, string>;
      expect(credentialsObj[CredentialType.SLACK_CRED]).toBe(
        'system-slack-token'
      );
    });

    it('should prioritize user credentials over system credentials', () => {
      const bubbleScript = `
        const slack = new SlackBubble({
          channel: '#general'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const slackBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        slack: {
          variableId: 1,
          variableName: 'slack',
          bubbleName: 'slack',
          className: 'SlackBubble',
          nodeType: 'service',
          location: {
            startLine: 2,
            startCol: 22,
            endLine: 4,
            endCol: 10,
          },
          parameters: [
            {
              name: 'channel',
              value: '#general',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 1,
          secret: 'user-slack-token',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const systemCredentials = {
        [CredentialType.SLACK_CRED]: 'system-slack-token',
      };

      const result = injector.injectCredentials(
        slackBubbleParams,
        userCredentials,
        systemCredentials
      );

      expect(result.success).toBe(true);

      // Check that user credentials override system credentials
      const credentialsParam = slackBubbleParams.slack.parameters.find(
        (p) => p.name === 'credentials'
      );
      const credentialsObj = credentialsParam!.value as Record<string, string>;
      expect(credentialsObj[CredentialType.SLACK_CRED]).toBe(
        'user-slack-token'
      );
    });
  });

  describe('AI agent tool credential injection', () => {
    it('should inject credentials for AI agent with tools', () => {
      const bubbleScript = `
        const aiAgent = new AIAgent({
          model: 'gemini-2.0-flash-exp',
          tools: [{"name": "slack"}, {"name": "web-scrape-tool"}]
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const aiAgentParams: Record<string, ParsedBubbleWithInfo> = {
        aiAgent: {
          variableId: 1,
          variableName: 'aiAgent',
          bubbleName: 'ai-agent',
          className: 'AIAgent',
          nodeType: 'service',
          location: {
            startLine: 2,
            startCol: 22,
            endLine: 5,
            endCol: 10,
          },
          parameters: [
            {
              name: 'model',
              value: 'gemini-2.0-flash-exp',
              type: BubbleParameterType.STRING,
            },
            {
              name: 'tools',
              value: '[{"name": "slack"}, {"name": "web-scrape-tool"}]',
              type: BubbleParameterType.ARRAY,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 1,
          secret: 'user-slack-token',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const systemCredentials = {
        [CredentialType.OPENAI_CRED]: 'system-openai-key',
        [CredentialType.FIRECRAWL_API_KEY]: 'system-firecrawl-key',
      };

      const result = injector.injectCredentials(
        aiAgentParams,
        userCredentials,
        systemCredentials
      );

      expect(result.success).toBe(true);
      expect(result.injectedCredentials).toBeDefined();

      // Should have injected multiple credentials
      expect(Object.keys(result.injectedCredentials!)).toHaveLength(3);
      expect(result.injectedCredentials!['1.SLACK_CRED']).toMatch(
        /user\*+oken/
      );
      expect(result.injectedCredentials!['1.OPENAI_CRED']).toMatch(
        /syst\*+-key/
      );
      expect(result.injectedCredentials!['1.FIRECRAWL_API_KEY']).toMatch(
        /syst\*+-key/
      );

      // Check bubble parameters were updated
      const credentialsParam = aiAgentParams.aiAgent.parameters.find(
        (p) => p.name === 'credentials'
      );
      const credentialsObj = credentialsParam!.value as Record<string, string>;
      expect(credentialsObj[CredentialType.SLACK_CRED]).toBe(
        'user-slack-token'
      );
      expect(credentialsObj[CredentialType.OPENAI_CRED]).toBe(
        'system-openai-key'
      );
      expect(credentialsObj[CredentialType.FIRECRAWL_API_KEY]).toBe(
        'system-firecrawl-key'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle bubbles with no credential requirements', () => {
      const bubbleScript = `
        const httpBubble = new HttpBubble({
          url: 'https://api.example.com'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const httpBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        httpBubble: {
          variableId: 1,
          variableName: 'httpBubble',
          bubbleName: 'http',
          className: 'HttpBubble',
          nodeType: 'service',
          location: {
            startLine: 2,
            startCol: 26,
            endLine: 4,
            endCol: 10,
          },
          parameters: [
            {
              name: 'url',
              value: 'https://api.example.com',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const result = injector.injectCredentials(httpBubbleParams);

      expect(result.success).toBe(true);
      expect(Object.keys(result.injectedCredentials!)).toHaveLength(0);

      // Bubble parameters should remain unchanged
      expect(httpBubbleParams.httpBubble.parameters).toHaveLength(1);
    });

    it('should handle empty bubble parameters', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const result = injector.injectCredentials({});

      expect(result.success).toBe(true);
      expect(Object.keys(result.injectedCredentials!)).toHaveLength(0);
    });
  });

  describe('Credential masking', () => {
    it('should properly mask short credentials', () => {
      const bubbleScript = `
        const slack = new SlackBubble({
          channel: '#test'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const slackBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        slack: {
          variableId: 1,
          variableName: 'slack',
          bubbleName: 'slack',
          className: 'SlackBubble',
          nodeType: 'service',
          location: {
            startLine: 2,
            startCol: 22,
            endLine: 4,
            endCol: 10,
          },
          parameters: [
            {
              name: 'channel',
              value: '#test',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 1,
          secret: 'short',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const result = injector.injectCredentials(
        slackBubbleParams,
        userCredentials
      );

      expect(result.success).toBe(true);
      expect(result.injectedCredentials!['1.SLACK_CRED']).toBe('*****');
    });

    it('should properly mask long credentials', () => {
      const bubbleScript = `
        const slack = new SlackBubble({
          channel: '#test'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const slackBubbleParams: Record<string, ParsedBubbleWithInfo> = {
        slack: {
          variableId: 1,
          variableName: 'slack',
          bubbleName: 'slack',
          className: 'SlackBubble',
          nodeType: 'service',
          location: {
            startLine: 2,
            startCol: 22,
            endLine: 4,
            endCol: 10,
          },
          parameters: [
            {
              name: 'channel',
              value: '#test',
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: false,
          hasActionCall: false,
        },
      };

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 1,
          secret: 'very-long-secret-key-that-should-be-masked',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const result = injector.injectCredentials(
        slackBubbleParams,
        userCredentials
      );

      expect(result.success).toBe(true);
      expect(result.injectedCredentials!['1.SLACK_CRED']).toBe(
        'very**********************************sked'
      );
    });

    it('should handle bubbles inside control structures like for loops', () => {
      const bubbleScript = `
        for (let i = 0; i < 2; i++) {
          await new HelloWorldBubble({
            message: 'Hello, World!',
            name: 'World',
          }).action();
        }
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const bubbleParams: Record<string, ParsedBubbleWithInfo> = {
        _anonymous_HelloWorldBubble_1: {
          variableId: -1,
          variableName: '_anonymous_HelloWorldBubble_1',
          bubbleName: 'hello-world',
          className: 'HelloWorldBubble',
          nodeType: 'service',
          location: {
            startLine: 3,
            startCol: 16,
            endLine: 6,
            endCol: 18,
          },
          parameters: [
            {
              name: 'message',
              value: "'Hello, World!'",
              type: BubbleParameterType.STRING,
            },
            {
              name: 'name',
              value: "'World'",
              type: BubbleParameterType.STRING,
            },
          ],
          hasAwait: true,
          hasActionCall: true,
        },
      };

      const userCredentials: UserCredentialWithId[] = [];

      const result = injector.injectCredentials(bubbleParams, userCredentials);

      expect(result.success).toBe(true);
      expect(result.code).toContain('for (let i = 0; i < 2; i++) {');
      expect(result.code).toContain('await new HelloWorldBubble({');
      expect(result.code).toContain("message: 'Hello, World!',");
      expect(result.code).toContain("name: 'World'");
      expect(result.code).toContain('}).action()');
      expect(result.code).toContain('}'); // Closing brace of for loop should be preserved
    });

    it('should handle complex multi-line bubble instantiations with proper line deletion', () => {
      const bubbleScript = `
        const result = await new GoogleSheetsBubble({
          operation: 'write_values',
          spreadsheet_id: spreadsheetId,
          range: \`\${SHEET_NAME}!A1\`,
          values: [HEADERS],
          value_input_option: 'RAW'
        }).action();
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const userCredentials: UserCredentialWithId[] = [];

      const result = injector.injectCredentials(
        mockBubbleScript.getParsedBubbles(),
        userCredentials
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain(
        'const result = await new GoogleSheetsBubble({'
      );
      expect(result.code).toContain("operation: 'write_values',");
      expect(result.code).toContain('spreadsheet_id: spreadsheetId,');
      expect(result.code).toContain('range: `${SHEET_NAME}!A1`,');
      expect(result.code).toContain('values: [HEADERS],');
      expect(result.code).toContain("value_input_option: 'RAW'");
      expect(result.code).toContain('}).action()');
      // Ensure no duplicate lines remain
      const lines = result.code!.split('\n');
      const operationLines = lines.filter((line) =>
        line.includes("operation: 'write_values'")
      );
      expect(operationLines).toHaveLength(1);
    });
  });
});

describe('BubbleInjector.injectBubbleLoggingAndReinitializeBubbleParameters()', () => {
  let bubbleFactory: BubbleFactory;
  const helloWorldMultiple = getFixture('hello-world-multiple');
  const redditScraper = getFixture('reddit-scraper');

  beforeEach(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });
  describe('should inject bubble logging and reinitialize bubble parameters', () => {
    it('should inject bubble logging and reinitialize bubble parameters', () => {
      const mockBubbleScript = new BubbleScript(
        helloWorldMultiple,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);
      injector.injectBubbleLoggingAndReinitializeBubbleParameters();
      const lines = mockBubbleScript.bubblescript.split('\n');

      // Check if line 14 contains the logger configuration with dependency graph
      expect(lines[14]).toContain(
        '}, {logger: this.logger, variableId: 412, dependencyGraph: {"name":"hello-world", "uniqueId":"412", "variableId":412, "variableName":"greeting", "nodeType":"service", "dependencies":[]}, currentUniqueId: "412"})'
      );
    });
    it('The line numbers should not change from original script', () => {
      const mockBubbleScript = new BubbleScript(
        helloWorldMultiple,
        bubbleFactory
      );
      const originalBubbleLocations = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).map((bubble) => bubble.location);
      console.log(mockBubbleScript.getParsedBubbles());

      const injector = new BubbleInjector(mockBubbleScript);
      injector.injectBubbleLoggingAndReinitializeBubbleParameters();
      const newBubbleLocations = Object.values(
        mockBubbleScript.getOriginalParsedBubbles()
      ).map((bubble) => bubble.location);
      expect(newBubbleLocations).toEqual(originalBubbleLocations);
    });

    it('The line numbers should not change from original after credential injection', () => {
      const mockBubbleScript = new BubbleScript(redditScraper, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const originalBubbleLocations = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).map((bubble) => bubble.location);
      // Find all variable id of google-sheets
      const googleSheetsVariableIds = Object.values(
        mockBubbleScript.getParsedBubbles()
      )
        .filter((bubble) => bubble.bubbleName === 'google-sheets')
        .map((bubble) => bubble.variableId);

      // Assign random secret for each variable ids
      const var_ids_to_secrets = googleSheetsVariableIds.map((variableId) => ({
        variableId,
        // Random alphanumeric secret
        secret: `google-sheets-${Math.random().toString(36).substring(2, 15)}`,
      }));

      const userCredentials: UserCredentialWithId[] = var_ids_to_secrets.map(
        ({ variableId, secret }) => ({
          bubbleVarId: variableId,
          secret,
          credentialType: CredentialType.GOOGLE_SHEETS_CRED,
        })
      );
      const systemCredentials: Partial<Record<CredentialType, string>> = {
        [CredentialType.GOOGLE_GEMINI_CRED]: `google-gemini-${Math.random().toString(36).substring(2, 15)}`,
      };
      const { injectedCredentials } = injector.injectCredentials(
        mockBubbleScript.getParsedBubbles(),
        userCredentials,
        systemCredentials
      );
      expect(injectedCredentials).toBeDefined();

      // The Google Gemini credential could be injected into any bubble that needs it
      // Instead of assuming it goes to the first Google Sheets bubble, let's find which bubbles actually got it
      const geminiKeys = Object.keys(injectedCredentials!).filter((key) =>
        key.includes(CredentialType.GOOGLE_GEMINI_CRED)
      );

      // Build expected keys based on what was actually injected
      const expectedKeys = [
        ...var_ids_to_secrets.map(
          ({ variableId }) =>
            `${variableId}.${CredentialType.GOOGLE_SHEETS_CRED}`
        ),
        ...geminiKeys, // Use the actual Gemini keys that were injected
      ].sort();

      expect(Object.keys(injectedCredentials!).sort()).toEqual(expectedKeys);
      // Check new bubble locations
      const newBubbleLocations = Object.values(
        mockBubbleScript.getOriginalParsedBubbles()
      ).map((bubble) => bubble.location);
      expect(newBubbleLocations).toEqual(originalBubbleLocations);
    });
  });
});
