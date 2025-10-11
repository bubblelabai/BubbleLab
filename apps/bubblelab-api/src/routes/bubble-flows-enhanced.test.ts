// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import '../config/env.js';
import type { CreateBubbleFlowResponse } from '@bubblelab/shared-schemas';
import { TestApp } from '../test/test-app.js';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('Enhanced BubbleFlow Creation with Required Credentials', () => {
  // Test setup.ts already handles cleanup before each test

  describe('POST /bubble-flow with credential extraction', () => {
    it('should extract required credentials from PostgreSQL bubble', async () => {
      const bubbleFlowCode = `
import { BubbleFlow, PostgreSQLBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  queryResult?: unknown;
}

export class PostgresTestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('postgres-test-flow', 'A flow that tests PostgreSQL bubble');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const postgres = new PostgreSQLBubble({
      query: "SELECT 'Hello World' as greeting",
      ignoreSSL: true
    });
    
    try {
      const result = await postgres.action();
      return {
        message: 'PostgreSQL query executed successfully',
        queryResult: result,
      };
    } catch (error) {
      return {
        message: \`PostgreSQL query failed: \${error instanceof Error ? error.message : String(error)}\`,
      };
    }
  }
}`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'PostgreSQL Test Flow',
        description: 'Testing credential extraction',
        code: bubbleFlowCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as CreateBubbleFlowResponse;

      // Verify required credentials are extracted
      expect(data).toHaveProperty('requiredCredentials');
      expect(typeof data.requiredCredentials).toBe('object');
      expect(data.requiredCredentials).not.toBe(null);

      // Check that at least one bubble requires DATABASE_CRED
      const credTypes = Object.values(data.requiredCredentials!).flat();
      expect(credTypes).toContain('DATABASE_CRED');

      console.log(
        '✅ PostgreSQL credentials extracted:',
        data.requiredCredentials
      );
    });

    it('should extract required credentials from Slack bubble', async () => {
      const bubbleFlowCode = `
import { BubbleFlow, SlackBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class SlackTestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('slack-test-flow', 'A flow that tests Slack bubble');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const slack = new SlackBubble({
      operation: 'send_message',
      channel: 'test-channel',
      text: 'Hello from test!'
    });
    
    try {
      const result = await slack.action();
      return {
        message: 'Slack message sent successfully',
      };
    } catch (error) {
      return {
        message: \`Slack message failed: \${error instanceof Error ? error.message : String(error)}\`,
      };
    }
  }
}`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'Slack Test Flow',
        description: 'Testing Slack credential extraction',
        code: bubbleFlowCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as CreateBubbleFlowResponse;

      // Verify required credentials are extracted
      expect(data).toHaveProperty('requiredCredentials');
      expect(typeof data.requiredCredentials).toBe('object');
      expect(data.requiredCredentials).not.toBe(null);

      // Check that at least one bubble requires SLACK_CRED
      const credTypes = Object.values(data.requiredCredentials!).flat();
      expect(credTypes).toContain('SLACK_CRED');

      console.log('✅ Slack credentials extracted:', data.requiredCredentials);
    });

    it('should extract required credentials from AI Agent bubble', async () => {
      const bubbleFlowCode = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class AITestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('ai-test-flow', 'A flow that tests AI Agent bubble');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const aiAgent = new AIAgentBubble({
      message: 'Hello, how are you?',
      systemPrompt: 'You are a helpful assistant',
      model: {
        model: 'google/gemini-2.5-pro',
      },
    });
    
    try {
      const result = await aiAgent.action();
      return {
        message: 'AI Agent executed successfully',
      };
    } catch (error) {
      return {
        message: \`AI Agent failed: \${error instanceof Error ? error.message : String(error)}\`,
      };
    }
  }
}`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'AI Test Flow',
        description: 'Testing AI Agent credential extraction',
        code: bubbleFlowCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as CreateBubbleFlowResponse;

      // Verify required credentials are extracted
      expect(data).toHaveProperty('requiredCredentials');
      expect(typeof data.requiredCredentials).toBe('object');
      expect(data.requiredCredentials).not.toBe(null);

      // AI Agent bubble has default web-search-tool, so should require FIRECRAWL_API_KEY
      const credTypes = Object.values(data.requiredCredentials!).flat();
      expect(credTypes).toContain('FIRECRAWL_API_KEY');

      // Should have FIRECRAWL_API_KEY since AI Agent has default web-search-tool
      expect(Object.keys(data.requiredCredentials!)).toHaveLength(1);

      console.log(
        '✅ AI Agent system credentials filtered out:',
        data.requiredCredentials
      );
    });

    it('should extract multiple credential types from complex workflow', async () => {
      const bubbleFlowCode = `
import { BubbleFlow, DatabaseAnalyzerWorkflowBubble, AIAgentBubble, SlackNotifierWorkflowBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class ComplexTestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('complex-test-flow', 'A complex workflow with multiple bubbles');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    // Database analysis
    const schemaAnalysis = await new DatabaseAnalyzerWorkflowBubble({
      dataSourceType: 'postgresql',
      ignoreSSLErrors: true,
      includeMetadata: true,
    }).action();

    // AI processing
    const aiResult = await new AIAgentBubble({
      message: 'Analyze this data',
      systemPrompt: 'You are a data analyst',
      model: {
        model: 'google/gemini-2.5-pro',
      },
    }).action();

    // Slack notification
    const slackResult = await new SlackNotifierWorkflowBubble({
      contentToFormat: 'Analysis complete',
      targetChannel: 'results',
      messageStyle: 'professional',
    }).action();

    return {
      message: 'Complex workflow completed',
    };
  }
}`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'Complex Test Flow',
        description: 'Testing multiple credential extraction',
        code: bubbleFlowCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as CreateBubbleFlowResponse;

      // Verify multiple required credentials are extracted
      expect(data).toHaveProperty('requiredCredentials');
      expect(typeof data.requiredCredentials).toBe('object');
      expect(data.requiredCredentials).not.toBe(null);

      // Check that bubbles require the expected credential types
      const credTypes = Object.values(data.requiredCredentials!).flat();

      // AI credentials are system-managed, so only DATABASE_CRED and SLACK_CRED should appear
      expect(credTypes.length).toBeGreaterThanOrEqual(2);

      // Should include only non-system credential types
      const expectedCredentialTypes = ['DATABASE_CRED', 'SLACK_CRED'];
      expectedCredentialTypes.forEach((credType) => {
        expect(credTypes).toContain(credType);
      });

      //Show all the possible credential types for the AI Agent bubble
      expect(credTypes).toContain('GOOGLE_GEMINI_CRED');
      expect(credTypes).toContain('OPENAI_CRED');
      expect(credTypes).toContain('ANTHROPIC_CRED');

      console.log(
        '✅ Complex workflow credentials extracted:',
        data.requiredCredentials
      );
    });

    it('should handle BubbleFlow with no credentials gracefully', async () => {
      const bubbleFlowCode = `
import { BubbleFlow } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class NoCredentialTestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('no-credential-test-flow', 'A flow that uses no credentials');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    return {
      message: 'No credentials needed for this flow',
    };
  }
}`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'No Credential Test Flow',
        description: 'Testing flow with no credentials',
        code: bubbleFlowCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as CreateBubbleFlowResponse;

      // Verify required credentials is empty object
      expect(data).toHaveProperty('requiredCredentials');
      expect(typeof data.requiredCredentials).toBe('object');
      expect(data.requiredCredentials).not.toBe(null);
      expect(Object.keys(data.requiredCredentials!)).toHaveLength(0);

      console.log('✅ No credentials flow handled correctly');
    });

    it('should extract required credentials from AI agent with web-search-tool', async () => {
      const bubbleFlowCode = `
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  aiResponse?: string;
}

export class AIAgentWithToolsTestBubbleFlow extends BubbleFlow<'webhook/http'> {
  constructor() {
    super('ai-agent-tools-test-flow', 'A flow that tests AI agent with tools');
  }
  
  async handle(
    payload: BubbleTriggerEventRegistry['webhook/http']
  ): Promise<Output> {
    const aiAgent = new AIAgentBubble({
      message: "Search for the latest news about AI",
      tools: [{"name": "web-search-tool"}],
      model: { model: "google/gemini-2.5-flash" }
    });
    
    try {
      const result = await aiAgent.action();
      return {
        message: 'AI agent with tools executed successfully',
        aiResponse: 'AI response would be here',
      };
    } catch (error) {
      return {
        message: \`AI agent failed: \${error instanceof Error ? error.message : String(error)}\`,
      };
    }
  }
}`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'AI Agent with Tools Test Flow',
        description: 'Testing credential extraction for AI agent tools',
        code: bubbleFlowCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as CreateBubbleFlowResponse;
      console.log(data);

      // Verify required credentials are extracted
      expect(data).toHaveProperty('requiredCredentials');
      expect(typeof data.requiredCredentials).toBe('object');
      expect(data.requiredCredentials).not.toBe(null);

      // Check that the AI agent bubble requires FIRECRAWL_API_KEY from its web-search-tool
      const credTypes = Object.values(data.requiredCredentials!).flat();
      expect(credTypes).toContain('FIRECRAWL_API_KEY');

      // Verify the specific bubble has the correct credentials
      const aiAgentBubble = Object.keys(data.requiredCredentials!).find((key) =>
        data.requiredCredentials![key].includes(
          CredentialType.FIRECRAWL_API_KEY
        )
      );
      expect(aiAgentBubble).toBeDefined();

      console.log(
        '✅ AI agent tool credentials extracted:',
        data.requiredCredentials
      );
    });
  });
});
