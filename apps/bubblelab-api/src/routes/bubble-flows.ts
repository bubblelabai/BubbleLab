import { OpenAPIHono, z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { db } from '../db/index.js';
import {
  bubbleFlows,
  webhooks,
  bubbleFlowExecutions,
  users,
} from '../db/schema.js';
import { type StreamingEvent } from '@bubblelab/shared-schemas';
import { validateBubbleFlow } from '../services/validation.js';
import { processUserCode } from '../services/code-processor.js';
import { getWebhookUrl, generateWebhookPath } from '../utils/webhook.js';
import {
  extractRequiredCredentials,
  generateDisplayedBubbleParameters,
  mergeCredentialsIntoBubbleParameters,
} from '../services/bubble-flow-parser.js';
import {
  CredentialType,
  type ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { getUserId, getAppType } from '../middleware/auth.js';
import { eq, and, count } from 'drizzle-orm';
import { isValidBubbleTriggerEvent } from '@bubblelab/shared-schemas';
import { BubbleFlowGeneratorWorkflow } from '@bubblelab/bubble-core';
import {
  createBubbleFlowRoute,
  executeBubbleFlowRoute,
  executeBubbleFlowStreamRoute,
  getBubbleFlowRoute,
  updateBubbleFlowRoute,
  updateBubbleFlowNameRoute,
  listBubbleFlowsRoute,
  activateBubbleFlowRoute,
  deleteBubbleFlowRoute,
  listBubbleFlowExecutionsRoute,
  validateBubbleFlowCodeRoute,
  generateBubbleFlowCodeRoute,
} from '../schemas/routes.js';

import { createBubbleFlowResponseSchema } from '../schemas/index.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { verifyMonthlyLimit } from '../services/subscription-validation.js';
import {
  executeBubbleFlowWithLiveStreaming,
  executeBubbleFlowWithTracking,
} from '../services/bubble-flow-execution.js';
import { BubbleScript, validateAndExtract } from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from '../services/bubble-factory-instance.js';
import { BubbleLogger } from '@bubblelab/bubble-core';
import { trackModelTokenUsage } from '../services/token-tracking.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

app.openapi(listBubbleFlowsRoute, async (c) => {
  const userId = getUserId(c);

  console.log('listBubbleFlowsRoute', userId);
  // Fetch both bubble flows and user data in parallel
  const [flows, userData] = await Promise.all([
    db.query.bubbleFlows.findMany({
      where: eq(bubbleFlows.userId, userId),
      columns: {
        id: true,
        name: true,
        description: true,
        eventType: true,
        webhookExecutionCount: true,
        webhookFailureCount: true,
        createdAt: true,
        updatedAt: true,
        originalCode: true,
        bubbleParameters: true,
      },
      with: {
        webhooks: {
          columns: {
            isActive: true,
          },
        },
      },
    }),
    db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: {
        monthlyUsageCount: true,
      },
    }),
  ]);

  // Get execution counts for all flows
  const flowIds = flows.map((flow) => flow.id);
  const executionCounts = await Promise.all(
    flowIds.map(async (flowId) => {
      const result = await db
        .select({ count: count() })
        .from(bubbleFlowExecutions)
        .where(eq(bubbleFlowExecutions.bubbleFlowId, flowId));
      return { flowId, count: result[0]?.count || 0 };
    })
  );

  // Create a map for quick lookup
  const executionCountMap = new Map(
    executionCounts.map((item) => [item.flowId, item.count])
  );

  const bubbleFlowsData = flows.map((flow) => {
    // Extract bubble information from bubbleParameters
    const bubbleParameters = flow.bubbleParameters as Record<
      string,
      ParsedBubbleWithInfo
    > | null;
    const bubbles = bubbleParameters
      ? Object.values(bubbleParameters).map((bubble) => ({
          bubbleName: bubble.bubbleName,
          className: bubble.className,
        }))
      : [];

    return {
      id: flow.id,
      name: flow.name,
      description: flow.description || undefined,
      eventType: flow.eventType,
      isActive: flow.webhooks[0]?.isActive ?? false,
      webhookExecutionCount: flow.webhookExecutionCount,
      webhookFailureCount: flow.webhookFailureCount,
      executionCount: executionCountMap.get(flow.id) || 0,
      bubbles,
      createdAt: flow.createdAt.toISOString(),
      updatedAt: flow.updatedAt.toISOString(),
    };
  });

  const response = {
    bubbleFlows: bubbleFlowsData,
    userMonthlyUsage: {
      count: userData?.monthlyUsageCount ?? 0,
    },
  };

  return c.json(response, 200);
});

app.openapi(createBubbleFlowRoute, async (c) => {
  const data = c.req.valid('json');

  // Validate TypeScript code
  const validationResult = await validateBubbleFlow(data.code);

  if (!validationResult.valid) {
    console.debug('Validation failed:', validationResult.errors);
    return c.json(
      {
        error: 'TypeScript validation failed',
        details:
          validationResult.errors?.join('; ') || 'Unknown validation error',
      },
      400
    );
  }

  // Validate that eventType is a valid BubbleTriggerEventRegistry key
  if (!isValidBubbleTriggerEvent(data.eventType)) {
    return c.json(
      {
        error: 'Invalid event type for webhook',
        details: `Event type '${data.eventType}' is not a valid BubbleTriggerEventRegistry key`,
      },
      400
    );
  }

  // Process and transpile the code for execution
  const processedCode = processUserCode(data.code);

  const userId = getUserId(c);
  const [inserted] = await db
    .insert(bubbleFlows)
    .values({
      userId,
      name: data.name,
      description: data.description,
      prompt: data.prompt,
      code: processedCode,
      originalCode: data.code,
      bubbleParameters: validationResult.bubbleParameters || {},
      inputSchema: validationResult.inputSchema || {},
      eventType: validationResult.trigger?.type || 'webhook/http',
    })
    .returning({ id: bubbleFlows.id });

  // Extract required credentials from bubble parameters
  const requiredCredentials = validationResult.bubbleParameters
    ? extractRequiredCredentials(validationResult.bubbleParameters)
    : {};

  const response: z.infer<typeof createBubbleFlowResponseSchema> = {
    id: inserted.id,
    message: 'BubbleFlow created successfully',
    inputSchema: validationResult.inputSchema || {},
    bubbleParameters: validationResult.bubbleParameters || {},
    eventType: validationResult.trigger?.type || 'webhook/http',
    requiredCredentials,
  };

  // Always create webhook entry for all BubbleFlows
  const webhookPath = data.webhookPath || generateWebhookPath();

  try {
    const [webhookInserted] = await db
      .insert(webhooks)
      .values({
        userId,
        path: webhookPath,
        bubbleFlowId: inserted.id,
        isActive: data.webhookActive,
      })
      .returning({ id: webhooks.id });

    response.webhook = {
      id: webhookInserted.id,
      url: getWebhookUrl(userId, webhookPath),
      path: webhookPath,
      active: data.webhookActive || false,
    };
  } catch (error: unknown) {
    // Handle duplicate webhook path error
    const errorObj = error as {
      message?: string;
      cause?: { message?: string; code?: string };
      code?: string;
    };
    const errorMessage = errorObj?.message || String(error);
    const causeMessage = errorObj?.cause?.message || '';
    const errorCode = errorObj?.code || errorObj?.cause?.code;

    if (
      errorMessage.includes('UNIQUE constraint failed') ||
      errorMessage.includes('SQLITE_CONSTRAINT_UNIQUE') ||
      causeMessage.includes('UNIQUE constraint failed') ||
      causeMessage.includes('SQLITE_CONSTRAINT_UNIQUE') ||
      errorCode === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      return c.json(
        {
          error: 'Webhook path already exists',
          details: `Path '${webhookPath}' is already in use for this user`,
        },
        400
      );
    }
    throw error;
  }

  return c.json(response, 201);
});

app.openapi(executeBubbleFlowRoute, async (c) => {
  const id = parseInt(c.req.param('id'));
  const userPayload = c.req.valid('json') ?? {}; // Handle empty payloads gracefully

  const userId = getUserId(c);

  try {
    const triggerEvent = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      path: `/execute-bubble-flow/${id}`,
      body: userPayload,
      ...userPayload,
    };

    const appType = getAppType(c);
    const result = await executeBubbleFlowWithTracking(id, triggerEvent, {
      userId,
      appType,
    });

    if (!result.success) {
      return c.json(
        {
          error: result.error || 'Execution failed',
          details: result.error,
        },
        400
      );
    }

    return c.json(result, 200);
  } catch (error) {
    // Return 404 for "BubbleFlow not found" errors like the original implementation
    if (
      error instanceof Error &&
      (error.message === 'BubbleFlow not found' ||
        error.message ===
          'Something went wrong, please recreate the flow. If the problem persists, please contact Nodex support.')
    ) {
      return c.json({ error: 'BubbleFlow not found' }, 404);
    }
    throw error; // Let global error handler deal with other errors
  }
});

app.openapi(executeBubbleFlowStreamRoute, async (c) => {
  const id = parseInt(c.req.param('id'));
  const userPayload = c.req.valid('json') ?? {}; // Handle empty payloads gracefully
  const userId = getUserId(c);
  const appType = getAppType(c);

  try {
    const triggerEvent = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      path: `/execute-bubble-flow/${id}`,
      body: userPayload,
      ...userPayload,
    };

    return streamSSE(c, async (stream) => {
      try {
        await executeBubbleFlowWithLiveStreaming(id, triggerEvent, {
          userId,
          appType,
          streamCallback: async (event) => {
            await stream.writeSSE({
              data: JSON.stringify(event),
              event: event.type,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
          },
        });

        // Send stream completion
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'stream_complete',
            timestamp: new Date().toISOString(),
          }),
          event: 'stream_complete',
        });
      } catch (error) {
        console.error('[API] Streaming execution error:', error);
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Unknown streaming error',
            recoverable: false,
          }),
          event: 'error',
        });
      }
    });
  } catch (error) {
    // Return 404 for "BubbleFlow not found" errors like the original implementation
    if (
      error instanceof Error &&
      (error.message === 'BubbleFlow not found' ||
        error.message ===
          'Something went wrong, please recreate the flow. If the problem persists, please contact Nodex support.')
    ) {
      return c.json({ error: 'BubbleFlow not found' }, 404);
    }
    throw error; // Let global error handler deal with other errors
  }
});

app.openapi(getBubbleFlowRoute, async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID format' }, 400);
  }

  const flow = await db.query.bubbleFlows.findFirst({
    where: and(eq(bubbleFlows.id, id), eq(bubbleFlows.userId, userId)),
    with: {
      webhooks: {
        columns: {
          isActive: true,
          path: true,
        },
      },
    },
  });

  if (!flow) {
    return c.json({ error: 'BubbleFlow not found' }, 404);
  }

  let bubbleParameters = flow.bubbleParameters as Record<
    string,
    ParsedBubbleWithInfo
  >;

  if (!bubbleParameters || Object.keys(bubbleParameters).length === 0) {
    console.log('Updating bubble parameters from flow code');
    //Parse parameters
    const bubbleFactory = await getBubbleFactory();
    const script = new BubbleScript(flow.originalCode!, bubbleFactory);
    //Update db with parsed parameters
    bubbleParameters = script.getParsedBubbles();
    const inputSchema = script.getPayloadJsonSchema();
    await db
      .update(bubbleFlows)
      .set({
        bubbleParameters: bubbleParameters,
        inputSchema: inputSchema,
      })
      .where(eq(bubbleFlows.id, flow.id));
  }

  const response = {
    id: flow.id,
    name: flow.name,
    description: flow.description || undefined,
    prompt: flow.prompt || undefined,
    eventType: flow.eventType,
    requiredCredentials: extractRequiredCredentials(bubbleParameters),
    code: flow.originalCode || 'Unable to retrieve code',
    displayedBubbleParameters:
      generateDisplayedBubbleParameters(bubbleParameters),
    bubbleParameters: bubbleParameters,
    inputSchema: flow.inputSchema || {},
    metadata: flow.metadata || {},
    isActive: flow.webhooks[0]?.isActive ?? false,
    createdAt: flow.createdAt.toISOString(),
    updatedAt: flow.updatedAt.toISOString(),
    webhook_url: getWebhookUrl(userId, flow.webhooks[0]?.path || ''),
  };

  return c.json(response, 200);
});

app.openapi(updateBubbleFlowRoute, async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));
  const { bubbleParameters } = c.req.valid('json');

  if (isNaN(id)) {
    return c.json(
      {
        error: 'Invalid ID format',
      },
      400
    );
  }

  // Get existing flow (only if it belongs to the user)
  const existingFlow = await db.query.bubbleFlows.findFirst({
    where: and(eq(bubbleFlows.id, id), eq(bubbleFlows.userId, userId)),
  });

  if (!existingFlow) {
    return c.json(
      {
        error: 'BubbleFlow not found',
      },
      404
    );
  }

  // Basic validation - ensure we still have the same bubble variables
  const existingParams =
    (existingFlow.bubbleParameters as Record<string, ParsedBubbleWithInfo>) ||
    {};
  const newParams = bubbleParameters as Record<string, ParsedBubbleWithInfo>;

  // Check that no variable names were removed
  const existingVarNames = Object.keys(existingParams);
  const newVarNames = Object.keys(newParams);

  const missingVars = existingVarNames.filter(
    (name) => !newVarNames.includes(name)
  );
  if (missingVars.length > 0) {
    return c.json(
      {
        error: 'Cannot remove existing bubble variables',
        details: `Missing variables: ${missingVars.join(', ')}`,
      },
      400
    );
  }

  // Update the bubble parameters
  await db
    .update(bubbleFlows)
    .set({
      bubbleParameters: newParams,
      updatedAt: new Date(),
    })
    .where(eq(bubbleFlows.id, id));

  return c.json(
    {
      message: 'BubbleFlow parameters updated successfully',
      bubbleParameters: newParams,
    },
    200
  );
});

app.openapi(updateBubbleFlowNameRoute, async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));
  const { name } = c.req.valid('json');

  if (isNaN(id)) {
    return c.json(
      {
        error: 'Invalid ID format',
      },
      400
    );
  }

  // Get existing flow (only if it belongs to the user)
  const existingFlow = await db.query.bubbleFlows.findFirst({
    where: and(eq(bubbleFlows.id, id), eq(bubbleFlows.userId, userId)),
  });

  if (!existingFlow) {
    return c.json(
      {
        error: 'BubbleFlow not found',
      },
      404
    );
  }

  // Update the flow name
  await db
    .update(bubbleFlows)
    .set({
      name: name,
      updatedAt: new Date(),
    })
    .where(eq(bubbleFlows.id, id));

  return c.json(
    {
      message: 'BubbleFlow name updated successfully',
    },
    200
  );
});

app.openapi(activateBubbleFlowRoute, async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json(
      {
        error: 'Invalid ID format',
      },
      400
    );
  }

  // Get the bubble flow to ensure it exists and belongs to the user
  const flow = await db.query.bubbleFlows.findFirst({
    where: and(eq(bubbleFlows.id, id), eq(bubbleFlows.userId, userId)),
  });

  if (!flow) {
    return c.json(
      {
        error: 'BubbleFlow not found',
      },
      404
    );
  }

  // Find the associated webhook and activate it
  const webhook = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.bubbleFlowId, id), eq(webhooks.userId, userId)),
  });

  if (!webhook) {
    return c.json(
      {
        error: 'No webhook found for this BubbleFlow',
      },
      404
    );
  }

  // Activate the webhook
  await db
    .update(webhooks)
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhook.id));

  // Generate the webhook URL
  const webhookUrl = getWebhookUrl(userId, webhook.path);

  return c.json(
    {
      success: true,
      webhookUrl,
      message:
        'BubbleFlow activated successfully! Your Slack bot is now ready to respond to mentions.',
    },
    200
  );
});

app.openapi(deleteBubbleFlowRoute, async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.json(
      {
        error: 'Invalid ID format',
      },
      400
    );
  }

  // Check if BubbleFlow exists and belongs to the user
  const flow = await db.query.bubbleFlows.findFirst({
    where: and(eq(bubbleFlows.id, id), eq(bubbleFlows.userId, userId)),
  });

  if (!flow) {
    return c.json(
      {
        error: 'BubbleFlow not found',
      },
      404
    );
  }

  // Delete the BubbleFlow (cascade will handle webhooks and executions)
  await db.delete(bubbleFlows).where(eq(bubbleFlows.id, id));

  return c.json({ message: 'BubbleFlow deleted successfully' }, 200);
});

app.openapi(listBubbleFlowExecutionsRoute, async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  if (isNaN(id)) {
    return c.json(
      {
        error: 'Invalid ID format',
      },
      400
    );
  }

  // Check if BubbleFlow exists and belongs to the user
  const flow = await db.query.bubbleFlows.findFirst({
    where: and(eq(bubbleFlows.id, id), eq(bubbleFlows.userId, userId)),
    with: {
      webhooks: {
        columns: {
          path: true,
        },
      },
    },
  });

  if (!flow) {
    return c.json(
      {
        error: 'BubbleFlow not found',
      },
      404
    );
  }

  // Get execution history for this BubbleFlow
  const executions = await db.query.bubbleFlowExecutions.findMany({
    where: eq(bubbleFlowExecutions.bubbleFlowId, id),
    limit,
    offset,
    orderBy: (table, { desc }) => [desc(table.startedAt)], // Most recent first
  });

  const response = executions.map((execution) => ({
    id: execution.id,
    status: execution.status as 'running' | 'success' | 'error',
    payload: execution.payload as Record<string, any>,
    result: execution.result,
    error: execution.error || undefined,
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt?.toISOString(),
    webhook_url: getWebhookUrl(userId, flow.webhooks[0]?.path || ''),
  }));

  return c.json(response, 200);
});

// Validate BubbleFlow code
app.openapi(validateBubbleFlowCodeRoute, async (c) => {
  try {
    const { code, options, flowId, credentials } = c.req.valid('json');
    const userId = getUserId(c);
    const bubbleFactory = await getBubbleFactory();

    // If flowId is provided, verify user owns the flow
    let existingFlow = null;
    if (flowId) {
      existingFlow = await db.query.bubbleFlows.findFirst({
        where: and(eq(bubbleFlows.id, flowId), eq(bubbleFlows.userId, userId)),
        with: {
          webhooks: {
            columns: {
              path: true,
            },
          },
        },
      });

      if (!existingFlow) {
        return c.json(
          {
            error:
              'BubbleFlow not found or you do not have permission to update it',
          },
          404
        );
      }
    }

    // Create a new BubbleFlowValidationTool instance
    console.log('Starting bubble factory....');
    const result = await validateAndExtract(code, bubbleFactory);

    // If validation is successful and flowId is provided, update the flow
    if (result.valid && flowId && existingFlow) {
      const processedCode = processUserCode(code);

      // Prepare bubble parameters with credentials if provided
      let finalBubbleParameters = result.bubbleParameters || {};

      // If credentials are provided in the request, merge them into the bubble parameters
      if (credentials && Object.keys(credentials).length > 0) {
        finalBubbleParameters = mergeCredentialsIntoBubbleParameters(
          finalBubbleParameters,
          credentials
        );
      }

      await db
        .update(bubbleFlows)
        .set({
          code: processedCode,
          originalCode: code,
          bubbleParameters: finalBubbleParameters,
          inputSchema: result.inputSchema || {},
          eventType: result.trigger?.type,
          updatedAt: new Date(),
        })
        .where(eq(bubbleFlows.id, flowId));

      console.log(`Updated BubbleFlow ${flowId} with new validation results`);
    }

    // We need to extract the actual validation result from the data property
    if (result.valid) {
      return c.json(
        {
          valid: true,
          success: true,
          inputSchema: result.inputSchema || {},
          bubbles: result.bubbleParameters,
          eventType: result.trigger?.type || 'webhook/http',
          webhookPath: getWebhookUrl(
            userId,
            existingFlow?.webhooks?.[0]?.path || ''
          ),
          error: '',
          errors: [],
          requiredCredentials: extractRequiredCredentials(
            result.bubbleParameters || {}
          ),
          metadata: {
            validatedAt: new Date().toISOString(),
            codeLength: code?.length || 0,
            strictMode: options?.strictMode ?? true,
            flowUpdated: flowId ? true : false,
          },
        },
        200
      );
    } else {
      // If validation tool failed, return error structure that matches our schema
      return c.json(
        {
          valid: false,
          success: false,
          inputSchema: result.inputSchema || {},
          eventType: result.trigger?.type || 'webhook/http',
          webhookPath: getWebhookUrl(
            userId,
            existingFlow?.webhooks?.[0]?.path || ''
          ),
          error: result.errors?.join('; ') || 'Validation failed',
          errors: [result.errors?.join('; ') || 'Validation failed'],
          metadata: {
            validatedAt: new Date().toISOString(),
            codeLength: code?.length || 0,
            strictMode: options?.strictMode ?? true,
            flowUpdated: false,
          },
        },
        200
      );
    }
  } catch (error) {
    console.error('Validation error:', error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown validation error',
      },
      500
    );
  }
});

// Generate BubbleFlow code with streaming from natural language
app.openapi(generateBubbleFlowCodeRoute, async (c) => {
  const userId = getUserId(c);
  const appType = getAppType(c);
  // Add check for api limit
  const { allowed, currentUsage, limit } = await verifyMonthlyLimit(
    userId,
    appType
  );
  if (!allowed) {
    return c.json(
      {
        error:
          'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
          currentUsage +
          ', limit: ' +
          limit,
      },
      403
    );
  }
  try {
    const { prompt } = c.req.valid('json');

    const logger = new BubbleLogger('BubbleFlowGeneratorWorkflow');

    return streamSSE(c, async (stream) => {
      try {
        // Create BubbleFlowGeneratorWorkflow instance
        const generator = new BubbleFlowGeneratorWorkflow(
          {
            prompt,
            credentials: {
              [CredentialType.GOOGLE_GEMINI_CRED]:
                process.env.GOOGLE_API_KEY || '',
            },
          },
          {
            logger: logger,
          }
        );
        // Generate the code with streaming
        const result = await generator.actionWithStreaming(
          async (event: StreamingEvent) => {
            await stream.writeSSE({
              data: JSON.stringify(event),
              event: event.type,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
          }
        );

        // Parse bubble parameters from the generated code (route responsibility)
        let bubbleParameters = {};
        let requiredCredentials = {};
        let actualIsValid = result.isValid;

        if (result.generatedCode && result.generatedCode.trim()) {
          try {
            console.log(
              '[API] Parsing bubble parameters from generated code...'
            );
            const validationResult = await validateBubbleFlow(
              result.generatedCode
            );

            result.inputsSchema = JSON.stringify(validationResult.inputSchema);

            if (validationResult.valid && validationResult.bubbleParameters) {
              bubbleParameters = validationResult.bubbleParameters;
              requiredCredentials = extractRequiredCredentials(
                validationResult.bubbleParameters
              );
              actualIsValid = true;
              console.log(
                '[API] Successfully extracted bubble parameters:',
                Object.keys(bubbleParameters).length,
                'bubbles'
              );
            } else {
              console.log('[API] Validation failed:', validationResult.errors);
              // Keep the AI's validation result if our parsing failed
              actualIsValid = result.isValid;
            }
          } catch (parseError) {
            console.error('[API] Error parsing bubble parameters:', parseError);
            // Keep the AI's validation result if our parsing failed
            actualIsValid = result.isValid;
          }
        }

        // Get token usage before sending final events
        const tokenUsage = logger.getTokenUsage();

        // Send final result with code generation summary and extracted bubble parameters
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'generation_complete',
            data: {
              generatedCode: result.generatedCode,
              summary: result.summary,
              inputsSchema: result.inputsSchema,
              isValid: actualIsValid,
              success: result.success,
              error: result.error,
              bubbleParameters,
              requiredCredentials,
              tokenUsage,
            },
          }),
          event: 'generation_complete',
        });

        console.log('[API] Generation complete:', bubbleParameters);

        // Send stream completion
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'stream_complete',
            timestamp: new Date().toISOString(),
          }),
          event: 'stream_complete',
        });

        // Track token usage
        trackModelTokenUsage(userId, 'google/gemini-2.5-pro', tokenUsage);
      } catch (error) {
        console.error('[API] Streaming generation error:', error);
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Unknown streaming error',
            recoverable: false,
          }),
          event: 'error',
        });
      }
    });
  } catch (error) {
    console.error('[API] Route error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Unknown route error',
      },
      500
    );
  }
});

export default app;
