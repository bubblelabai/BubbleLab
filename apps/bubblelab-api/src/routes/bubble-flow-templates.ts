import { OpenAPIHono, z } from '@hono/zod-openapi';
import { db } from '../db/index.js';
import { bubbleFlows, webhooks } from '../db/schema.js';
import { validateBubbleFlow } from '../services/validation.js';
import { processUserCode } from '../services/code-processor.js';
import {
  extractRequiredCredentials,
  generateDisplayedBubbleParameters,
} from '../services/bubble-flow-parser.js';
import { getUserId } from '../middleware/auth.js';
import { getWebhookUrl, generateWebhookPath } from '../utils/webhook.js';
import {
  generateBubbleFlowTemplateSchema,
  generateDocumentGenerationTemplateSchema,
  bubbleFlowTemplateResponseSchema,
} from '@bubblelab/shared-schemas';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { requireJsonContentType } from '../middleware/content-type.js';
import { generateSlackDataScientistTemplate } from '../services/templates/slack-data-scientist-template.js';
import { generateDocumentGenerationTemplate } from '../services/templates/document-generation-template.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

// Apply content-type validation middleware
app.use('*', requireJsonContentType);

// POST /bubbleflow-template/data-analyst
app.openapi(
  {
    method: 'post',
    path: '/data-analyst',
    request: {
      body: {
        content: {
          'application/json': {
            schema: generateBubbleFlowTemplateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: bubbleFlowTemplateResponseSchema,
          },
        },
        description: 'BubbleFlow template generated successfully',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
              details: z.string().optional(),
            }),
          },
        },
        description: 'Invalid input or template generation failed',
      },
    },
    tags: ['BubbleFlow Templates'],
  },
  async (c) => {
    const data = c.req.valid('json');

    // Defensive check for undefined data
    if (!data) {
      return c.json(
        {
          error: 'Invalid request body',
          details: 'Request body is required',
        },
        400
      );
    }

    // Generate template code based on user input
    const templateCode = generateSlackDataScientistTemplate(data);

    // Validate the generated code
    const validationResult = await validateBubbleFlow(templateCode);

    if (!validationResult.valid) {
      console.debug('Template validation failed:', validationResult.errors);
      return c.json(
        {
          error: 'Generated template validation failed',
          details:
            validationResult.errors?.join('; ') || 'Unknown validation error',
        },
        400
      );
    }

    // Process and transpile the code for execution
    const processedCode = processUserCode(templateCode);

    const userId = getUserId(c);
    const [inserted] = await db
      .insert(bubbleFlows)
      .values({
        userId,
        name: data.name,
        description: data.description,
        code: processedCode,
        originalCode: templateCode,
        bubbleParameters: validationResult.bubbleParameters || {},
        inputSchema: validationResult.inputSchema || {},
        eventType: 'slack/bot_mentioned',
      })
      .returning({
        id: bubbleFlows.id,
        createdAt: bubbleFlows.createdAt,
        updatedAt: bubbleFlows.updatedAt,
      });

    // Extract required credentials from bubble parameters
    const requiredCredentials = validationResult.bubbleParameters
      ? extractRequiredCredentials(validationResult.bubbleParameters)
      : {};

    // TODO: Replace with actual flow decomposition logic
    const displayedBubbleParameters = generateDisplayedBubbleParameters(
      validationResult.bubbleParameters || {}
    );

    const response: z.infer<typeof bubbleFlowTemplateResponseSchema> = {
      id: inserted.id,
      name: data.name,
      description: data.description,
      eventType: 'slack/bot_mentioned',
      displayedBubbleParameters,
      bubbleParameters: validationResult.bubbleParameters || {},
      requiredCredentials,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    };

    // Create webhook for the template
    const webhookPath = generateWebhookPath();

    try {
      const [webhookInserted] = await db
        .insert(webhooks)
        .values({
          userId,
          path: webhookPath,
          bubbleFlowId: inserted.id,
          isActive: false, // Start inactive for templates
        })
        .returning({ id: webhooks.id });

      response.webhook = {
        id: webhookInserted.id,
        url: getWebhookUrl(userId, webhookPath),
        path: webhookPath,
        active: false,
      };
    } catch (error: unknown) {
      // Log error but don't fail the template creation
      console.error('Failed to create webhook for template:', error);
    }

    return c.json(response, 201);
  }
);

// POST /bubbleflow-template/document-generation
app.openapi(
  {
    method: 'post',
    path: '/document-generation',
    request: {
      body: {
        content: {
          'application/json': {
            schema: generateDocumentGenerationTemplateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: bubbleFlowTemplateResponseSchema,
          },
        },
        description: 'Document generation template created successfully',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
              details: z.string().optional(),
            }),
          },
        },
        description: 'Invalid input or template generation failed',
      },
    },
    tags: ['BubbleFlow Templates'],
  },
  async (c) => {
    const data = c.req.valid('json');

    // Defensive check for undefined data
    if (!data) {
      return c.json(
        {
          error: 'Invalid request body',
          details: 'Request body is required',
        },
        400
      );
    }

    const templateCode = generateDocumentGenerationTemplate(data);

    // Validate the generated code
    const validationResult = await validateBubbleFlow(templateCode, false);

    if (!validationResult.valid) {
      console.debug('Template validation failed:', validationResult.errors);
      return c.json(
        {
          error: `Generated template validation failed. ${validationResult.errors?.join('; ')}`,
          details:
            validationResult.errors?.join('; ') || 'Unknown validation error',
        },
        400
      );
    }

    // Process and transpile the code for execution
    const processedCode = processUserCode(templateCode);

    const userId = getUserId(c);
    const [inserted] = await db
      .insert(bubbleFlows)
      .values({
        userId,
        name: data.name,
        description: data.description,
        code: processedCode,
        originalCode: templateCode,
        bubbleParameters: validationResult.bubbleParameters || {},
        inputSchema: validationResult.inputSchema || {},
        metadata: {
          outputDescription: data.outputDescription,
          ...((data as { metadata?: Record<string, unknown> }).metadata || {}),
        },
        eventType: 'webhook/http',
      })
      .returning({
        id: bubbleFlows.id,
        createdAt: bubbleFlows.createdAt,
        updatedAt: bubbleFlows.updatedAt,
      });

    // Extract required credentials from bubble parameters
    const requiredCredentials = validationResult.bubbleParameters
      ? extractRequiredCredentials(validationResult.bubbleParameters)
      : {};

    // Generate displayed bubble parameters
    const displayedBubbleParameters = generateDisplayedBubbleParameters(
      validationResult.bubbleParameters || {}
    );

    const response: z.infer<typeof bubbleFlowTemplateResponseSchema> = {
      id: inserted.id,
      name: data.name,
      description: data.description,
      eventType: 'webhook/http',
      displayedBubbleParameters,
      bubbleParameters: validationResult.bubbleParameters || {},
      requiredCredentials,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    };

    // Create webhook for the template
    const webhookPath = generateWebhookPath();

    try {
      const [webhookInserted] = await db
        .insert(webhooks)
        .values({
          userId,
          path: webhookPath,
          bubbleFlowId: inserted.id,
          isActive: true, // Start active for document processing templates
        })
        .returning({ id: webhooks.id });

      response.webhook = {
        id: webhookInserted.id,
        url: getWebhookUrl(userId, webhookPath),
        path: webhookPath,
        active: true,
      };
    } catch (error: unknown) {
      // Log error but don't fail the template creation
      console.error('Failed to create webhook for template:', error);
    }

    return c.json(response, 201);
  }
);

export default app;
