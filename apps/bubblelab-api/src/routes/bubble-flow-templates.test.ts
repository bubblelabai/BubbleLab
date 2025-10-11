// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import { db } from '../db/index.js';
import '../config/env.js';
import type {
  GenerateBubbleFlowTemplateRequest,
  BubbleFlowTemplateResponse,
} from '@bubblelab/shared-schemas';
import { TestApp } from '../test/test-app.js';

describe('BubbleFlow Template Generation', () => {
  // Test setup.ts already handles cleanup before each test

  describe('POST /bubbleflow-template/data-analyst', () => {
    it('should generate a valid Slack data scientist template', async () => {
      const templateRequest: GenerateBubbleFlowTemplateRequest = {
        name: 'Test Data Scientist Bot',
        description:
          'A Slack bot that helps analyze user engagement data and provides insights',
        roles:
          'Be prepared to answer any question on user engagement and come up with proactive insights. You should be able to query the database, analyze trends, and provide actionable recommendations.',
        useCase: 'slack-data-scientist',
      };

      const response = await TestApp.post(
        '/bubbleflow-template/data-analyst',
        templateRequest
      );

      expect(response.status).toBe(201);

      const data = (await response.json()) as BubbleFlowTemplateResponse;

      // Verify response structure
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name', templateRequest.name);
      expect(data).toHaveProperty('description', templateRequest.description);
      expect(data).toHaveProperty('eventType', 'slack/bot_mentioned');
      expect(data).toHaveProperty('bubbleParameters');
      expect(data).toHaveProperty('requiredCredentials');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');

      // Verify bubble parameters structure
      expect(typeof data.bubbleParameters).toBe('object');
      expect(Object.keys(data.bubbleParameters).length).toBeGreaterThan(0);

      // Verify required credentials
      expect(typeof data.requiredCredentials).toBe('object');
      expect(data.requiredCredentials).not.toBe(null);
      expect(Object.keys(data.requiredCredentials!).length).toBeGreaterThan(0);

      // Should include expected credential types for data scientist workflow
      // Note: AI credentials (GOOGLE_GEMINI_CRED, OPENAI_CRED, ANTHROPIC_CRED) are system-managed
      const expectedCredentialTypes = ['DATABASE_CRED', 'SLACK_CRED'];
      const credTypes = Object.values(data.requiredCredentials!).flat();
      expectedCredentialTypes.forEach((credType) => {
        expect(credTypes).toContain(credType);
      });

      console.log('✅ Data Scientist created successfully');
      console.log('  - ID:', data.id);
      console.log('  - Required credentials:', data.requiredCredentials);
      console.log(
        '  - Bubble parameters keys:',
        Object.keys(data.bubbleParameters)
      );
    });

    it('should validate required fields', async () => {
      const invalidRequests = [
        // Missing name
        {
          description: 'A test bot',
          roles: 'Test roles',
          useCase: 'slack-data-scientist',
        },
        // Missing description
        {
          name: 'Test Bot',
          roles: 'Test roles',
          useCase: 'slack-data-scientist',
        },
        // Missing roles
        {
          name: 'Test Bot',
          description: 'A test bot',
          useCase: 'slack-data-scientist',
        },
        // Missing useCase
        {
          name: 'Test Bot',
          description: 'A test bot',
          roles: 'Test roles',
        },
        // Invalid useCase
        {
          name: 'Test Bot',
          description: 'A test bot',
          roles: 'Test roles',
          useCase: 'invalid-use-case',
        },
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await TestApp.post(
          '/bubbleflow-template/data-analyst',
          invalidRequest
        );
        expect(response.status).toBe(400);

        const errorData = await response.json();
        expect(errorData).toHaveProperty('error');
        console.log(
          `✅ Validation failed as expected for:`,
          Object.keys(invalidRequest)
        );
      }
    });

    it('should return 400 when no body is provided', async () => {
      // Test with no body at all
      const response = await TestApp.post('/bubbleflow-template/data-analyst');

      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
      console.log('✅ Validation failed as expected for empty body');
    });

    it('should generate unique BubbleFlow IDs for multiple requests', async () => {
      const templateRequest: GenerateBubbleFlowTemplateRequest = {
        name: 'Bot 1',
        description: 'First test bot',
        roles: 'Test roles for bot 1',
        useCase: 'slack-data-scientist',
      };

      const response1 = await TestApp.post(
        '/bubbleflow-template/data-analyst',
        templateRequest
      );
      const data1 = (await response1.json()) as BubbleFlowTemplateResponse;

      const response2 = await TestApp.post(
        '/bubbleflow-template/data-analyst',
        {
          ...templateRequest,
          name: 'Bot 2',
          description: 'Second test bot',
        }
      );
      const data2 = (await response2.json()) as BubbleFlowTemplateResponse;

      expect(data1.id).not.toBe(data2.id);
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);

      console.log('✅ Generated unique IDs:', data1.id, 'and', data2.id);
    });

    it('should generate valid TypeScript code in the template', async () => {
      const templateRequest: GenerateBubbleFlowTemplateRequest = {
        name: 'Code Test Bot',
        description: 'A bot to test code generation',
        roles:
          'Analyze database queries and provide insights with comprehensive reporting',
        useCase: 'slack-data-scientist',
      };

      const response = await TestApp.post(
        '/bubbleflow-template/data-analyst',
        templateRequest
      );

      if (response.status !== 201) {
        const errorData = await response.json();
        console.error('Template generation failed:', errorData);
      }

      expect(response.status).toBe(201);

      const data = (await response.json()) as BubbleFlowTemplateResponse;
      expect(data.id).toBeDefined();

      // Verify the generated code is stored in the database
      const storedFlow = await db.query.bubbleFlows.findFirst({
        where: (bubbleFlows, { eq }) => eq(bubbleFlows.id, data.id),
      });

      expect(storedFlow).toBeDefined();
      expect(storedFlow?.originalCode).toContain('class');
      expect(storedFlow?.originalCode).toContain('extends BubbleFlow');
      expect(storedFlow?.originalCode).toContain('SlackDataAssistantWorkflow');

      console.log('✅ Generated code contains expected components');
    });

    it('should handle special characters in names correctly', async () => {
      const templateRequest: GenerateBubbleFlowTemplateRequest = {
        name: "Sam Dix's Data Bot & Analytics",
        description: 'A bot with special characters in name',
        roles:
          'Handle complex data analysis tasks with special character support in naming',
        useCase: 'slack-data-scientist',
      };

      const response = await TestApp.post(
        '/bubbleflow-template/data-analyst',
        templateRequest
      );

      if (response.status !== 201) {
        const errorData = await response.json();
        console.error('Special characters test failed:', errorData);
      }

      expect(response.status).toBe(201);

      const data = (await response.json()) as BubbleFlowTemplateResponse;
      expect(data.id).toBeDefined();

      // Verify the name is stored correctly
      expect(data.name).toBe(templateRequest.name);

      // Verify the generated class name is sanitized
      const storedFlow = await db.query.bubbleFlows.findFirst({
        where: (bubbleFlows, { eq }) => eq(bubbleFlows.id, data.id),
      });

      expect(storedFlow?.originalCode).toContain('SamDixsDataBotAnalytics');

      console.log('✅ Special characters handled correctly');
    });
  });
});
