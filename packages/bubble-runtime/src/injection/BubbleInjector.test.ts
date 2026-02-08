import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { BubbleInjector, UserCredentialWithId } from './BubbleInjector.js';
import { BubbleScript } from '../parse/BubbleScript';
import {
  CredentialType,
  ParsedBubbleWithInfo,
  BubbleParameterType,
} from '@bubblelab/shared-schemas';
import {
  BubbleFactory,
  defineCapability,
  registerCapability,
} from '@bubblelab/bubble-core';
import { z } from 'zod';
import { getFixture } from '../../tests/fixtures';

describe('BubbleInjector.findCredentials()', () => {
  let bubbleFactory: BubbleFactory;

  beforeEach(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });

  const slackBubbleScript = `
    const slack = new SlackBubble({
      channel: '#general',
      message: 'Hello world'
    });
  `;

  const aiAgentBubbleScript = `
    const aiAgent = new AIAgentBubble({
      model: 'gemini-2.0-flash-exp',
      tools: [{"name": "slack"}, {"name": "web-scrape-tool"}]
    });
  `;

  const aiAgentWithMalformedToolsBubbleScript = `
    const aiAgent = new AIAgentBubble({
      model: 'gemini-2.0-flash-exp',
      tools: 'invalid json [',
    });
  `;

  const aiAgentWithSingleToolBubbleScript = `
    const aiAgent = new AIAgentBubble({
      model: { model: 'gemini-2.0-flash-exp' },
      tools: [{"name": "slack"}],
    });
  `;

  const multiBubbleScript = `
    const slack = new SlackBubble({
      channel: '#general',
      message: 'Hello world'
    });
    const aiAgent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      tools: [{"name": "sql-query-tool"}, {"name": "web-scrape-tool"}]
    });
  `;

  describe('Slack bubble credential detection', () => {
    it('should extract Slack credentials from Slack bubble', () => {
      const mockBubbleScript = new BubbleScript(
        slackBubbleScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();
      console.log(credentials);
      expect(credentials).toBeDefined();
      expect(credentials['404']).toContain(CredentialType.SLACK_CRED);
      expect(credentials['404']).toContain(CredentialType.SLACK_API);
      expect(credentials['404']).toHaveLength(2);
    });

    it('should return all credentials including system credentials', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentBubbleScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);
      const credentials = injector.findCredentials();
      // Should return all AI agent credentials (including system ones)
      expect(Object.keys(credentials)).toHaveLength(1);
      expect(credentials['404']).toContain(CredentialType.GOOGLE_GEMINI_CRED);
    });
  });

  describe('AI agent with tools credential detection', () => {
    it('should extract credentials from AI agent tools (Slack + Firecrawl)', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentBubbleScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();

      // Should contain AI agent base credentials plus tool credentials
      expect(credentials['404']).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials['404']).toContain(CredentialType.FIRECRAWL_API_KEY); // Base + tool
      expect(credentials['404']).toContain(CredentialType.SLACK_CRED); // From tool
    });

    it('should handle malformed tools parameter gracefully', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentWithMalformedToolsBubbleScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();

      // Should return AI agent base credentials but not crash on malformed tools
      expect(Object.keys(credentials)).toHaveLength(1);
      expect(credentials['404']).toContain(CredentialType.GOOGLE_GEMINI_CRED);
    });

    it('should handle single tool object (not array)', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentWithSingleToolBubbleScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();
      expect(credentials).toBeDefined();
      expect(credentials['404']).toBeDefined();
      // Should contain AI agent base credentials plus tool credentials
      expect(credentials['404']).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials['404']).toContain(CredentialType.SLACK_CRED); // From tool
    });
  });

  describe('Complex multi-bubble scenario', () => {
    it('should extract credentials from multiple bubbles correctly', () => {
      const mockBubbleScript = new BubbleScript(
        multiBubbleScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();

      expect(credentials).toBeDefined();
      console.log(credentials);

      // Slack bubble should require Slack credentials (OAuth + API key)
      expect(credentials['404']).toContain(CredentialType.SLACK_CRED);
      expect(credentials['404']).toContain(CredentialType.SLACK_API);
      expect(credentials['404']).toHaveLength(2);

      // AI agent should require base credentials plus tool credentials
      expect(credentials['405']).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials['405']).toContain(CredentialType.DATABASE_CRED);
      expect(credentials['405']).toContain(CredentialType.FIRECRAWL_API_KEY); // Base + tool
      expect(credentials['405']).toHaveLength(3); // All AI agent credentials

      // Should have 3 different bubble IDs with credentials
      expect(Object.keys(credentials)).toHaveLength(2);
    });
  });

  describe('AI agent with capabilities credential detection', () => {
    // Register a test capability before running these tests
    beforeAll(() => {
      const testCap = defineCapability({
        id: 'test-google-doc-kb',
        name: 'Test Google Doc KB',
        description: 'Test capability for credential injection',
        requiredCredentials: [CredentialType.GOOGLE_DRIVE_CRED],
        inputs: [
          {
            name: 'docId',
            type: 'string',
            description: 'Google Doc ID',
            required: true,
          },
        ],
        tools: [
          {
            name: 'read-kb',
            description: 'Read the knowledge base',
            schema: z.object({}),
            func: () => async () => ({ success: true }),
          },
        ],
        systemPrompt: 'You have access to a knowledge base.',
      });
      registerCapability(testCap);
    });

    const aiAgentWithCapabilityScript = `
      const agent = new AIAgentBubble({
        model: { model: 'google/gemini-2.5-flash' },
        message: 'Hello',
        capabilities: [{ id: 'test-google-doc-kb', inputs: { docId: 'abc123' } }],
      });
    `;

    it('should extract capability credentials from AI agent', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentWithCapabilityScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();
      console.log('Capability credentials:', credentials);

      expect(Object.keys(credentials)).toHaveLength(1);
      // Should include GOOGLE_GEMINI_CRED (from model) + GOOGLE_DRIVE_CRED (from capability)
      expect(credentials['404']).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      expect(credentials['404']).toContain(CredentialType.GOOGLE_DRIVE_CRED);
    });

    it('should inject capability credentials into AI agent', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentWithCapabilityScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const aiAgentVarId = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((bubble) => bubble.bubbleName === 'ai-agent')?.variableId;
      expect(aiAgentVarId).toBeDefined();

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: aiAgentVarId!,
          secret: 'user-google-drive-token',
          credentialType: CredentialType.GOOGLE_DRIVE_CRED,
        },
      ];

      const systemCredentials: Partial<Record<CredentialType, string>> = {
        [CredentialType.GOOGLE_GEMINI_CRED]: 'system-gemini-key',
      };

      const result = injector.injectCredentials(
        userCredentials,
        systemCredentials
      );

      console.log('Injection result:', result.injectedCredentials);
      console.log('Final code:', result.code);

      expect(result.success).toBe(true);
      expect(result.injectedCredentials).toBeDefined();

      // Should have both GOOGLE_GEMINI_CRED and GOOGLE_DRIVE_CRED
      expect(
        result.injectedCredentials![`${aiAgentVarId}.GOOGLE_GEMINI_CRED`]
      ).toBeDefined();
      expect(
        result.injectedCredentials![`${aiAgentVarId}.GOOGLE_DRIVE_CRED`]
      ).toBeDefined();

      // Verify credentials are in the bubble parameters
      const credentialsParam = result.parsedBubbles?.[
        aiAgentVarId!
      ]?.parameters?.find((p) => p.name === 'credentials');
      expect(credentialsParam).toBeDefined();

      const credentialsObj = JSON.parse(
        credentialsParam?.value as string
      ) as Record<string, string>;
      expect(credentialsObj[CredentialType.GOOGLE_GEMINI_CRED]).toBe(
        'system-gemini-key'
      );
      expect(credentialsObj[CredentialType.GOOGLE_DRIVE_CRED]).toBe(
        'user-google-drive-token'
      );

      // Verify credentials appear in the final code
      expect(result.code).toContain('system-gemini-key');
      expect(result.code).toContain('user-google-drive-token');
    });
  });

  describe('AI agent with capability optional credentials detection', () => {
    beforeAll(() => {
      const testKb = defineCapability({
        id: 'knowledge-base',
        name: 'Knowledge Base',
        description: 'Test capability with optional credentials',
        requiredCredentials: [CredentialType.GOOGLE_GEMINI_CRED],
        optionalCredentials: [
          CredentialType.GOOGLE_DRIVE_CRED,
          CredentialType.CONFLUENCE_CRED,
        ],
        inputs: [
          {
            name: 'sources',
            type: 'string[]',
            label: 'Knowledge Sources',
            description: 'Sources for this capability.',
            required: false,
          },
        ],
        tools: [
          {
            name: 'read-knowledge-source',
            description: 'Reads a knowledge source',
            schema: z.object({
              id: z.string(),
              provider: z.enum(['google-doc', 'confluence']),
            }),
            func: () => async () => ({ success: true }),
          },
        ],
        systemPrompt: 'You are a knowledge assistant.',
      });
      registerCapability(testKb);
    });

    const aiAgentWithKnowledgeBaseScript = `
import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';

export interface Output {
  response: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  query?: string;
}

export class UntitledFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { query = 'What is the top news headline?' } = payload;
    const response = await this.askAIAgent(query);
    return { response };
  }

  private async askAIAgent(query: string) {
    const agent = new AIAgentBubble({ message: query, systemPrompt: 'You are a helpful assistant.', tools: [ { name: 'web-search-tool', config: { limit: 1, }, }, ], capabilities: [{ id: 'knowledge-base', inputs: { sources: ['confluence:196701:edit', 'google-doc:1sgRSMEE4PUkTrg0rHdewZ2Iu17LVWXx4EBaswv_GtkM:edit'] } }] })
    const result = await agent.action();
    if (!result.success) {
      throw new Error(\`AI Agent failed: \${result.error}\`);
    }
    return result.data.response;
  }
}
    `;

    it('should include CONFLUENCE_CRED and GOOGLE_DRIVE_CRED from knowledge-base optional credentials', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentWithKnowledgeBaseScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();
      console.log('Knowledge-base optional credentials:', credentials);

      // Find the ai-agent bubble's credentials
      const aiAgentBubble = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((b) => b.bubbleName === 'ai-agent');
      expect(aiAgentBubble).toBeDefined();
      const agentCreds = credentials[aiAgentBubble!.variableId];

      // Required from capability: GOOGLE_GEMINI_CRED
      expect(agentCreds).toContain(CredentialType.GOOGLE_GEMINI_CRED);
      // Optional from capability: GOOGLE_DRIVE_CRED, CONFLUENCE_CRED
      expect(agentCreds).toContain(CredentialType.GOOGLE_DRIVE_CRED);
      expect(agentCreds).toContain(CredentialType.CONFLUENCE_CRED);
      // From web-search-tool: FIRECRAWL_API_KEY
      expect(agentCreds).toContain(CredentialType.FIRECRAWL_API_KEY);
    });

    it('should inject CONFLUENCE_CRED and GOOGLE_DRIVE_CRED into ai-agent bubble', () => {
      const mockBubbleScript = new BubbleScript(
        aiAgentWithKnowledgeBaseScript,
        bubbleFactory
      );
      const injector = new BubbleInjector(mockBubbleScript);

      const aiAgentVarId = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((bubble) => bubble.bubbleName === 'ai-agent')?.variableId;
      expect(aiAgentVarId).toBeDefined();

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: aiAgentVarId!,
          secret: 'user-confluence-token',
          credentialType: CredentialType.CONFLUENCE_CRED,
        },
        {
          bubbleVarId: aiAgentVarId!,
          secret: 'user-google-drive-token',
          credentialType: CredentialType.GOOGLE_DRIVE_CRED,
        },
      ];

      const systemCredentials: Partial<Record<CredentialType, string>> = {
        [CredentialType.GOOGLE_GEMINI_CRED]: 'system-gemini-key',
        [CredentialType.FIRECRAWL_API_KEY]: 'system-firecrawl-key',
      };

      const result = injector.injectCredentials(
        userCredentials,
        systemCredentials
      );

      expect(result.success).toBe(true);
      expect(result.injectedCredentials).toBeDefined();

      // Should have all 4 credentials injected
      expect(
        result.injectedCredentials![`${aiAgentVarId}.GOOGLE_GEMINI_CRED`]
      ).toBeDefined();
      expect(
        result.injectedCredentials![`${aiAgentVarId}.GOOGLE_DRIVE_CRED`]
      ).toBeDefined();
      expect(
        result.injectedCredentials![`${aiAgentVarId}.CONFLUENCE_CRED`]
      ).toBeDefined();
      expect(
        result.injectedCredentials![`${aiAgentVarId}.FIRECRAWL_API_KEY`]
      ).toBeDefined();

      // Verify credentials are in the bubble parameters
      const credentialsParam = result.parsedBubbles?.[
        aiAgentVarId!
      ]?.parameters?.find((p) => p.name === 'credentials');
      expect(credentialsParam).toBeDefined();

      const credentialsObj = JSON.parse(
        credentialsParam?.value as string
      ) as Record<string, string>;
      expect(credentialsObj[CredentialType.GOOGLE_GEMINI_CRED]).toBe(
        'system-gemini-key'
      );
      expect(credentialsObj[CredentialType.GOOGLE_DRIVE_CRED]).toBe(
        'user-google-drive-token'
      );
      expect(credentialsObj[CredentialType.CONFLUENCE_CRED]).toBe(
        'user-confluence-token'
      );
      expect(credentialsObj[CredentialType.FIRECRAWL_API_KEY]).toBe(
        'system-firecrawl-key'
      );

      // Verify credentials appear in the final code
      expect(result.code).toContain('system-gemini-key');
      expect(result.code).toContain('user-google-drive-token');
      expect(result.code).toContain('user-confluence-token');
      expect(result.code).toContain('system-firecrawl-key');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty bubble parameters', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();

      expect(credentials).toBeDefined();
      expect(Object.keys(credentials)).toHaveLength(0);
    });

    it('should handle bubbles with no credential requirements', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const credentials = injector.findCredentials();

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

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 405,
          secret: 'slack-token-123',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const result = injector.injectCredentials(userCredentials);

      console.log('Injection result:', result);
      if (!result.success) {
        console.log('Errors:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.injectedCredentials).toBeDefined();
      console.log(result.injectedCredentials);
      expect(
        result.injectedCredentials!['405.SLACK_CRED'].credentialValue
      ).toMatch(/slac\*+-123/);

      // Check that credentials were added to bubble parameters
      expect(result.parsedBubbles?.[405]?.parameters).toHaveLength(3);
      const credentialsParam = result.parsedBubbles?.[405]?.parameters?.find(
        (p) => p.name === 'credentials'
      );
      expect(credentialsParam).toBeDefined();
      expect(credentialsParam?.type).toBe(BubbleParameterType.OBJECT);

      const credentialsObj = credentialsParam?.value as string;
      const obj = JSON.parse(credentialsObj as string) as Record<
        string,
        string
      >;
      expect(obj[CredentialType.SLACK_CRED]).toBe('slack-token-123');
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

      const result = injector.injectCredentials([], {
        [CredentialType.DATABASE_CRED]: 'dfd',
      });
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

      const systemCredentials = {
        [CredentialType.SLACK_CRED]: 'system-slack-token',
      };

      const result = injector.injectCredentials([], systemCredentials);
      expect(result.success).toBe(true);
      expect(
        result.injectedCredentials!['404.SLACK_CRED'].credentialValue
      ).toMatch(/syst\*+oken/);

      console.log('Parsed bubbles:', result.parsedBubbles);

      const credentialsObj = result.parsedBubbles?.[404]?.parameters?.find(
        (p) => p.name === 'credentials'
      )?.value as string;
      const obj = JSON.parse(credentialsObj as string) as Record<
        string,
        string
      >;
      expect(obj[CredentialType.SLACK_CRED]).toBe('system-slack-token');
    });

    it('should prioritize user credentials over system credentials', () => {
      const bubbleScript = `
        const slack = new SlackBubble({
          channel: '#general'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 404,
          secret: 'user-slack-token',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const systemCredentials = {
        [CredentialType.SLACK_CRED]: 'system-slack-token',
      };

      const result = injector.injectCredentials(
        userCredentials,
        systemCredentials
      );

      expect(result.success).toBe(true);

      // Check that user credentials override system credentials
      const credentialsParam = result.parsedBubbles?.[404]?.parameters?.find(
        (p) => p.name === 'credentials'
      );
      const credentialsObj = credentialsParam?.value as string;
      const obj = JSON.parse(credentialsObj as string) as Record<
        string,
        string
      >;
      expect(obj[CredentialType.SLACK_CRED]).toBe('user-slack-token');
    });
  });

  describe('AI agent tool credential injection', () => {
    it('should inject credentials for AI agent with tools', () => {
      const bubbleScript = `
        const aiAgent = new AIAgentBubble({
          model: {
            model: 'openai/gpt-4o',
          },
          tools: [{"name": "slack"}, {"name": "web-scrape-tool"}]
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      console.log(mockBubbleScript.getParsedBubbles());
      const aiAgentVarId = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((bubble) => bubble.bubbleName === 'ai-agent')?.variableId;
      if (!aiAgentVarId) {
        throw new Error('AI agent variable id not found');
      }

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: aiAgentVarId,
          secret: 'user-slack-token',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const systemCredentials = {
        [CredentialType.OPENAI_CRED]: 'system-openai-key',
        [CredentialType.FIRECRAWL_API_KEY]: 'system-firecrawl-key',
      };

      const result = injector.injectCredentials(
        userCredentials,
        systemCredentials
      );

      expect(result.success).toBe(true);
      expect(result.injectedCredentials).toBeDefined();

      console.log(result.injectedCredentials);
      // Should have injected multiple credentials
      expect(Object.keys(result.injectedCredentials!)).toHaveLength(3);
      expect(
        result.injectedCredentials![`${aiAgentVarId}.SLACK_CRED`]
          .credentialValue
      ).toMatch('user********oken');
      expect(
        result.injectedCredentials![`${aiAgentVarId}.OPENAI_CRED`]
          .credentialValue
      ).toMatch('syst*********-key');
      expect(
        result.injectedCredentials![`${aiAgentVarId}.FIRECRAWL_API_KEY`]
          .credentialValue
      ).toMatch('syst************-key');

      // Check bubble parameters were updated
      const credentialsParam = result.parsedBubbles?.[
        aiAgentVarId
      ]?.parameters?.find((p) => p.name === 'credentials');
      const credentialsObj = credentialsParam?.value as string;
      const obj = JSON.parse(credentialsObj as string) as Record<
        string,
        string
      >;
      expect(obj[CredentialType.SLACK_CRED]).toBe('user-slack-token');
      expect(obj[CredentialType.OPENAI_CRED]).toBe('system-openai-key');
      expect(obj[CredentialType.FIRECRAWL_API_KEY]).toBe(
        'system-firecrawl-key'
      );
    });
    it('should inject credentials for AI agent with custom tools', () => {
      const bubbleScript = getFixture('agent-with-custom-tool-flow');
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);
      const googleSheetsVarId = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((bubble) => bubble.bubbleName === 'google-calendar')?.variableId;
      if (!googleSheetsVarId) {
        throw new Error('Google Sheets variable id not found');
      }

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 434,
          secret: 'fake-google-sheets-token-12345',
          credentialType: CredentialType.GOOGLE_SHEETS_CRED,
          credentialId: 15,
          metadata: undefined,
        },
        {
          bubbleVarId: 437,
          secret: 'fake-google-sheets-token-67890',
          credentialType: CredentialType.GOOGLE_SHEETS_CRED,
          credentialId: 15,
          metadata: undefined,
        },
        {
          bubbleVarId: 425,
          secret: 'fake-google-calendar-token-abcde',
          credentialType: CredentialType.GOOGLE_CALENDAR_CRED,
          credentialId: 16,
          metadata: undefined,
        },
        {
          bubbleVarId: 433,
          secret: 'fake-google-calendar-token-fghij',
          credentialType: CredentialType.GOOGLE_CALENDAR_CRED,
          credentialId: 16,
          metadata: undefined,
        },
        {
          bubbleVarId: 442,
          secret: 'fake-telegram-bot-token-klmno',
          credentialType: CredentialType.TELEGRAM_BOT_TOKEN,
          credentialId: 17,
          metadata: undefined,
        },
        {
          bubbleVarId: 798456,
          secret: 'fake-telegram-bot-token-pqrst',
          credentialType: CredentialType.TELEGRAM_BOT_TOKEN,
          credentialId: 17,
          metadata: undefined,
        },
      ];

      const systemCredentials: Partial<Record<CredentialType, string>> = {
        [CredentialType.OPENAI_CRED]: 'fake-openai-key-system',
        [CredentialType.GOOGLE_GEMINI_CRED]: 'fake-gemini-key-system',
        [CredentialType.ANTHROPIC_CRED]: 'fake-anthropic-key-system',
        [CredentialType.FIRECRAWL_API_KEY]: 'fake-firecrawl-key-system',
        [CredentialType.DATABASE_CRED]: 'fake-database-url-system',
        [CredentialType.RESEND_CRED]: 'fake-resend-key-system',
        [CredentialType.OPENROUTER_CRED]: 'fake-openrouter-key-system',
        [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: 'fake-r2-access-key-system',
        [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: 'fake-r2-secret-key-system',
        [CredentialType.CLOUDFLARE_R2_ACCOUNT_ID]: 'fake-r2-account-id-system',
        [CredentialType.APIFY_CRED]: 'fake-apify-key-system',
      };

      const result = injector.injectCredentials(
        userCredentials,
        systemCredentials
      );

      if (!result.success) {
        console.log('Errors:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.injectedCredentials).toBeDefined();
      expect(
        Object.keys(result.injectedCredentials!).length
      ).toBeGreaterThanOrEqual(8);
      console.log(result.injectedCredentials);
      console.log(result.injectedCredentials);
      expect(
        result.injectedCredentials![`${googleSheetsVarId}.GOOGLE_CALENDAR_CRED`]
          .credentialValue
      ).toBe('fake************************bcde');
      // print final script
      // Expect final script to cotain google sheet token
      console.log('Final script:', result.code);
      expect(result.code).toContain('fake-google-calendar-token-abcde');
      expect(result.code).toContain('fake-google-calendar-token-fghij');
      expect(result.code).toContain('fake-google-sheets-token-12345');
      expect(result.code).toContain('fake-google-sheets-token-67890');
      expect(result.code).toContain('fake-telegram-bot-token-klmno');
      expect(result.code).toContain('fake-gemini-key-system');
    });

    it('should inject Google Gemini credentials for AI agent with custom tools in calendar booking flow', () => {
      const bubbleScript = getFixture('calendar-booking-flow');
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      // Find the AI agent bubble
      const aiAgentBubble = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((bubble) => bubble.bubbleName === 'ai-agent');

      expect(aiAgentBubble).toBeDefined();

      // Verify the model parameter exists and contains a comment (this is the edge case we're testing)
      // The model is: { model: 'google/gemini-3-pro-preview', temperature: 0.1 // Low temperature }
      const modelParam = aiAgentBubble?.parameters.find(
        (p) => p.name === 'model'
      );
      expect(modelParam).toBeDefined();
      // The model value should contain a comment like "// Low temperature"
      expect(String(modelParam?.value)).toContain('//');

      // Find the Google Calendar bubble (nested inside customTools)
      const googleCalendarBubble = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((bubble) => bubble.bubbleName === 'google-calendar');

      expect(googleCalendarBubble).toBeDefined();

      // Set up credentials - AI agent uses Google Gemini, nested bubble uses Google Calendar
      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: googleCalendarBubble!.variableId,
          secret: 'fake-google-calendar-token-for-booking',
          credentialType: CredentialType.GOOGLE_CALENDAR_CRED,
        },
      ];

      const systemCredentials: Partial<Record<CredentialType, string>> = {
        [CredentialType.GOOGLE_GEMINI_CRED]:
          'fake-gemini-key-for-calendar-booking',
      };

      const result = injector.injectCredentials(
        userCredentials,
        systemCredentials
      );

      expect(result.success).toBe(true);
      expect(result.injectedCredentials).toBeDefined();

      // Verify Google Gemini credential was injected for the AI agent
      const geminiCredentialKey = Object.keys(result.injectedCredentials!).find(
        (key) => key.includes('GOOGLE_GEMINI_CRED')
      );
      expect(geminiCredentialKey).toBeDefined();

      // Verify the final script contains both credentials
      expect(result.code).toContain('fake-gemini-key-for-calendar-booking');
      expect(result.code).toContain('fake-google-calendar-token-for-booking');

      // Verify the reparsed bubbles have credentials in their parameters
      const aiAgentAfterInjection = Object.values(
        mockBubbleScript.getParsedBubbles()
      ).find((b) => b.bubbleName === 'ai-agent');
      const credentialsParam = aiAgentAfterInjection?.parameters.find(
        (p) => p.name === 'credentials'
      );
      expect(credentialsParam).toBeDefined();
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

      const result = injector.injectCredentials();

      expect(result.success).toBe(true);
      expect(Object.keys(result.injectedCredentials!)).toHaveLength(0);

      // Bubble parameters should remain unchanged
      expect(httpBubbleParams.httpBubble.parameters).toHaveLength(1);
    });

    it('should handle empty bubble parameters', () => {
      const mockBubbleScript = new BubbleScript('', bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const result = injector.injectCredentials([]);

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

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 404,
          secret: 'short',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const result = injector.injectCredentials(userCredentials);

      expect(result.success).toBe(true);
      expect(
        result.injectedCredentials!['404.SLACK_CRED'].credentialValue
      ).toBe('*****');
    });

    it('should properly mask long credentials', () => {
      const bubbleScript = `
        const slack = new SlackBubble({
          channel: '#test'
        });
      `;
      const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
      const injector = new BubbleInjector(mockBubbleScript);

      const userCredentials: UserCredentialWithId[] = [
        {
          bubbleVarId: 404,
          secret: 'very-long-secret-key-that-should-be-masked',
          credentialType: CredentialType.SLACK_CRED,
        },
      ];

      const result = injector.injectCredentials(userCredentials);

      expect(result.success).toBe(true);
      console.log('Injected credentials:', result.injectedCredentials);
      expect(
        result.injectedCredentials!['404.SLACK_CRED'].credentialValue
      ).toBe('very**********************************sked');
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
      const userCredentials: UserCredentialWithId[] = [];

      const result = injector.injectCredentials(userCredentials);

      expect(result.success).toBe(true);
      console.log('Result code:', result.code);
      expect(result.code).toContain('for (let i = 0; i < 2; i++) {');
      expect(result.code).toContain('await new HelloWorldBubble({');
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

      const result = injector.injectCredentials(userCredentials);

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

describe('BubbleInjector - Model Credential Type Resolution', () => {
  let bubbleFactory: BubbleFactory;

  beforeEach(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });

  /**
   * Helper function to generate a poem using the AI agent.
   * This demonstrates what parameters the AI agent receives and how
   * model params determine the required credential type.
   */
  async function generatePoem(
    topic: string,
    model: string,
    modelName: string
  ): Promise<string> {
    // Generates a creative one-sentence poem based on the provided topic using the specified AI model
    const bubbleScript = `
      const poemAgent = new AIAgentBubble({
        model: { model: '${model}' as 'openai/gpt-5-mini' | 'google/gemini-2.5-flash' | 'openrouter/deepseek/deepseek-chat-v3.1' },
        systemPrompt: 'You are a creative poet. Write a beautiful, meaningful one-sentence poem based on the given topic. Only output the poem itself, no explanations or additional text.',
        message: 'Write a one-sentence poem about: ${topic}'
      });
    `;

    const mockBubbleScript = new BubbleScript(bubbleScript, bubbleFactory);
    const injector = new BubbleInjector(mockBubbleScript);
    const credentials = injector.findCredentials();

    console.log(`=== generatePoem test for ${modelName} ===`);
    console.log('Model string:', model);
    console.log('Parsed bubbles:', mockBubbleScript.getParsedBubbles());
    console.log('Required credentials:', credentials);

    // Get the model parameter to see what was parsed
    const aiAgentBubble = Object.values(
      mockBubbleScript.getParsedBubbles()
    ).find((b) => b.bubbleName === 'ai-agent');
    const modelParam = aiAgentBubble?.parameters.find(
      (p) => p.name === 'model'
    );
    console.log('Model param type:', modelParam?.type);
    console.log('Model param value:', modelParam?.value);

    return JSON.stringify(credentials);
  }

  it('should extract OpenAI credential type from model param', async () => {
    const result = await generatePoem(
      'sunset',
      'openai/gpt-4o-mini',
      'OpenAI GPT-4o Mini'
    );
    expect(result).toContain('OPENAI_CRED');
  });

  it('should extract Google Gemini credential type from model param', async () => {
    const result = await generatePoem(
      'ocean',
      'google/gemini-2.5-flash',
      'Google Gemini Flash'
    );
    expect(result).toContain('GOOGLE_GEMINI_CRED');
  });

  it('should extract OpenRouter credential type from model param', async () => {
    const result = await generatePoem(
      'stars',
      'openrouter/deepseek/deepseek-chat-v3-0324',
      'OpenRouter DeepSeek'
    );
    expect(result).toContain('OPENROUTER_CRED');
  });

  it('should extract Anthropic credential type from model param', async () => {
    const result = await generatePoem(
      'mountains',
      'anthropic/claude-sonnet-4-20250514',
      'Anthropic Claude'
    );
    expect(result).toContain('ANTHROPIC_CRED');
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
