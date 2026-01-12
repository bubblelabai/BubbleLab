import { OpenAPIHono, z } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { db } from '../db/index.js';
import {
  bubbleFlows,
  webhooks,
  bubbleFlowExecutions,
  users,
} from '../db/schema.js';
import { ServiceUsage, type StreamingEvent } from '@bubblelab/shared-schemas';
import { validateBubbleFlow } from '../services/validation.js';
import { processUserCode } from '../services/code-processor.js';
import { getWebhookUrl, generateWebhookPath } from '../utils/webhook.js';
import { getFlowNameFromCode } from '../utils/code-parser.js';
import {
  extractRequiredCredentials,
  generateDisplayedBubbleParameters,
  mergeCredentialsIntoBubbleParameters,
} from '../services/bubble-flow-parser.js';
import { injectCredentialsIntoBubbleParameters } from '../utils/bubble-parameters.js';
import {
  CredentialType,
  type ParsedBubbleWithInfo,
  type ParsedWorkflow,
} from '@bubblelab/shared-schemas';
import { getUserId, getAppType } from '../middleware/auth.js';
import { eq, and, count } from 'drizzle-orm';
import { isValidBubbleTriggerEvent } from '@bubblelab/shared-schemas';
import { runBoba } from '../services/ai/boba.js';
import { runCoffee } from '../services/ai/coffee.js';
import {
  createBubbleFlowRoute,
  createEmptyBubbleFlowRoute,
  executeBubbleFlowRoute,
  executeBubbleFlowStreamRoute,
  getBubbleFlowRoute,
  updateBubbleFlowRoute,
  updateBubbleFlowNameRoute,
  listBubbleFlowsRoute,
  activateBubbleFlowRoute,
  deactivateBubbleFlowRoute,
  deleteBubbleFlowRoute,
  listBubbleFlowExecutionsRoute,
  getBubbleFlowExecutionDetailRoute,
  validateBubbleFlowCodeRoute,
  generateBubbleFlowCodeRoute,
  runContextFlowRoute,
} from '../schemas/bubble-flows.js';

import { createBubbleFlowResponseSchema } from '../schemas/index.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { getCurrentWebhookUsage } from '../services/subscription-validation.js';
import { executeBubbleFlowWithTracking } from '../services/bubble-flow-execution.js';
import { runBubbleFlow } from '../services/execution.js';
import {
  BubbleScript,
  validateAndExtract,
  ValidationResult,
} from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from '../services/bubble-factory-instance.js';
import { trackServiceUsages } from '../services/service-usage-tracking.js';
import { posthog } from 'src/services/posthog.js';
import { BubbleResult } from '@bubblelab/bubble-core';
import { PRICING_TABLE } from '../config/pricing.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

app.openapi(listBubbleFlowsRoute, async (c) => {
  const userId = getUserId(c);
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
        cronActive: true,
        createdAt: true,
        cron: true,
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
      cronActive: flow.cronActive || false,
      cronSchedule: flow.cron || undefined,
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
  const validationResult = await validateBubbleFlow(data.code, false);

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
      workflow: validationResult.workflow || null,
      inputSchema: validationResult.inputSchema || {},
      eventType: validationResult.trigger?.type || 'webhook/http',
      cron: validationResult.trigger?.cronSchedule || null,
      cronActive: false,
      defaultInputs: {},
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
    workflow: validationResult.workflow,
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

// POST /bubble-flow/empty - Create empty BubbleFlow (for async code generation)
app.openapi(createEmptyBubbleFlowRoute, async (c) => {
  const data = c.req.valid('json');

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

  const userId = getUserId(c);

  // Create empty flow with no code
  const [inserted] = await db
    .insert(bubbleFlows)
    .values({
      userId,
      name: data.name,
      description: data.description,
      prompt: data.prompt,
      code: '', // Empty code - will be generated asynchronously
      originalCode: '', // Empty original code
      bubbleParameters: {}, // Empty bubble parameters
      workflow: null,
      inputSchema: {},
      eventType: data.eventType,
      cron: null,
      cronActive: false,
      defaultInputs: {},
      generationError: null, // No error initially
    })
    .returning({ id: bubbleFlows.id });

  // Always create webhook entry for all BubbleFlows
  const webhookPath = data.webhookPath || generateWebhookPath();

  try {
    const [webhookInserted] = await db
      .insert(webhooks)
      .values({
        userId,
        path: webhookPath,
        bubbleFlowId: inserted.id,
        isActive: data.webhookActive || false, // Usually false for empty flows
      })
      .returning({ id: webhooks.id });

    const response = {
      id: inserted.id,
      message:
        'BubbleFlow created successfully. Code generation in progress...',
      webhook: {
        id: webhookInserted.id,
        url: getWebhookUrl(userId, webhookPath),
        path: webhookPath,
        active: data.webhookActive || false,
      },
    };

    return c.json(response, 201);
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
});

app.openapi(executeBubbleFlowRoute, async (c) => {
  const id = parseInt(c.req.param('id'));
  const userPayload = c.req.valid('json') ?? {}; // Handle empty payloads gracefully

  const userId = getUserId(c);

  try {
    const triggerEvent = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      executionId: crypto.randomUUID(),
      path: `/${id}/execute`,
      body: userPayload,
      ...userPayload,
    };

    const appType = getAppType(c);
    const result = await executeBubbleFlowWithTracking(id, triggerEvent, {
      userId,
      appType,
      pricingTable: PRICING_TABLE,
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
  // Check for evalPerformance query param
  const evalPerformance = c.req.query('evalPerformance') === 'true';

  try {
    const triggerEvent = {
      type: 'webhook/http' as const,
      timestamp: new Date().toISOString(),
      executionId: crypto.randomUUID(),
      path: `/${id}/execute-stream`,
      body: userPayload,
      ...userPayload,
    };

    return streamSSE(c, async (stream) => {
      try {
        await executeBubbleFlowWithTracking(id, triggerEvent, {
          userId,
          appType,
          evalPerformance,
          streamCallback: async (event) => {
            await stream.writeSSE({
              data: JSON.stringify(event),
              event: event.type,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
          },
          pricingTable: PRICING_TABLE,
        });

        // Save inputs to defaultInputs after successful execution
        // Filter out empty values (undefined, empty strings, empty arrays)
        // Keep null values as they may be explicitly set by the user
        const filteredInputs = Object.fromEntries(
          Object.entries(userPayload).filter(([_, value]) => {
            if (value === undefined) return false;
            if (typeof value === 'string' && value.trim() === '') return false;
            if (Array.isArray(value) && value.length === 0) return false;
            return true;
          })
        );

        // Only save if there are actual inputs
        if (Object.keys(filteredInputs).length > 0) {
          try {
            await db
              .update(bubbleFlows)
              .set({
                defaultInputs: filteredInputs,
                updatedAt: new Date(),
              })
              .where(
                and(eq(bubbleFlows.id, id), eq(bubbleFlows.userId, userId))
              );
          } catch (saveError) {
            console.error(
              `[API] Error saving inputs to flow ${id} defaultInputs:`,
              saveError
            );
            // Non-blocking: continue even if save fails
          }
        }

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
  let workflow: ParsedWorkflow | undefined =
    (flow.workflow as ParsedWorkflow) || undefined;

  if (!bubbleParameters || Object.keys(bubbleParameters).length === 0) {
    //Parse parameters
    const bubbleFactory = await getBubbleFactory();
    const script = new BubbleScript(flow.originalCode!, bubbleFactory);
    //Update db with parsed parameters
    bubbleParameters = script.getParsedBubbles();
    const inputSchema = script.getPayloadJsonSchema();
    workflow = script.getWorkflow();
    await db
      .update(bubbleFlows)
      .set({
        bubbleParameters: bubbleParameters,
        workflow: workflow,
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
    code: flow.originalCode ?? '', // Return empty string if null/undefined, preserve empty string
    generationError: flow.generationError || undefined,
    displayedBubbleParameters:
      generateDisplayedBubbleParameters(bubbleParameters),
    bubbleParameters: bubbleParameters,
    workflow: workflow,
    inputSchema: flow.inputSchema || {},
    metadata: flow.metadata || {},
    isActive: flow.webhooks[0]?.isActive ?? false,
    cron: flow.cron || null,
    cronActive: flow.cronActive || false,
    defaultInputs: flow.defaultInputs || {},
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

  // Check if webhook is already active (skip limit check if already active)
  if (!webhook.isActive) {
    // Check webhook limit before activating
    const webhookUsage = await getCurrentWebhookUsage(userId);
    console.log('[activateBubbleFlowRoute] Webhook usage:', webhookUsage);
    if (webhookUsage.currentUsage >= webhookUsage.limit) {
      return c.json(
        {
          error:
            'Webhook limit exceeded, please deactivate some webhooks or crons, or upgrade your plan to activate more.',
          details: `You have reached your limit of ${webhookUsage.limit} active webhooks/crons. You currently have ${webhookUsage.currentUsage} active. Please deactivate some webhooks or crons, or upgrade your plan to activate more.`,
        },
        403
      );
    }
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

app.openapi(deactivateBubbleFlowRoute, async (c) => {
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

  // Find the associated webhook and deactivate it
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

  // Deactivate the webhook
  await db
    .update(webhooks)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, webhook.id));

  return c.json(
    {
      success: true,
      message: 'Webhook deactivated successfully',
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
    code: execution.code || undefined,
  }));

  return c.json(response, 200);
});

// GET /bubble-flow/:id/executions/:executionId - Get single execution with logs
app.openapi(getBubbleFlowExecutionDetailRoute, async (c) => {
  const userId = getUserId(c);
  const id = parseInt(c.req.param('id'));
  const executionId = parseInt(c.req.param('executionId'));

  if (isNaN(id) || isNaN(executionId)) {
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

  // Get the specific execution
  const execution = await db.query.bubbleFlowExecutions.findFirst({
    where: and(
      eq(bubbleFlowExecutions.id, executionId),
      eq(bubbleFlowExecutions.bubbleFlowId, id)
    ),
  });

  if (!execution) {
    return c.json(
      {
        error: 'Execution not found',
      },
      404
    );
  }

  const response = {
    id: execution.id,
    status: execution.status as 'running' | 'success' | 'error',
    payload: execution.payload as Record<string, unknown>,
    result: execution.result,
    error: execution.error || undefined,
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt?.toISOString(),
    webhook_url: getWebhookUrl(userId, flow.webhooks[0]?.path || ''),
    code: execution.code || undefined,
    executionLogs: execution.executionLogs || undefined,
  };

  return c.json(response, 200);
});

// Validate BubbleFlow code
app.openapi(validateBubbleFlowCodeRoute, async (c) => {
  try {
    const { code, options, flowId, credentials, defaultInputs, activateCron } =
      c.req.valid('json');
    const userId = getUserId(c);
    const bubbleFactory = await getBubbleFactory();

    // If flowId is provided, verify user owns the flow
    let existingFlow;

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
        columns: {
          id: true,
          cron: true,
          cronActive: true,
          defaultInputs: true,
          bubbleParameters: true,
          eventType: true,
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

    // Only take the shortcut path if we're NOT syncing with flow
    // When syncInputsWithFlow is true, we need to validate and sync the code first
    if (
      flowId &&
      options &&
      activateCron !== undefined &&
      !options.syncInputsWithFlow
    ) {
      // Check if cron is already active (skip limit check if already active)
      if (activateCron && !existingFlow?.cronActive) {
        // Check webhook limit before activating cron
        const webhookUsage = await getCurrentWebhookUsage(userId);
        if (webhookUsage.currentUsage >= webhookUsage.limit) {
          return c.json(
            {
              error:
                'Webhook limit exceeded, please deactivate some webhooks or crons, or upgrade your plan to activate more.',
              details: `You have reached your limit of ${webhookUsage.limit} active webhooks/crons. You currently have ${webhookUsage.currentUsage} active. Please deactivate some webhooks or crons, or upgrade your plan to activate more.`,
            },
            403
          );
        }
      }

      // Just update the activation state of the cron
      await db
        .update(bubbleFlows)
        .set({
          cronActive: activateCron,
        })
        .where(eq(bubbleFlows.id, flowId));

      return c.json(
        {
          valid: true,
          success: true,
          cronActive: activateCron,
          error: '',
          errors: [],
          inputSchema: {},
          bubbles: {},
          eventType: existingFlow?.eventType || 'webhook/http',
          webhookPath: getWebhookUrl(
            userId,
            existingFlow?.webhooks?.[0]?.path || ''
          ),
          cron: existingFlow?.cron || null,
          metadata: {
            validatedAt: new Date().toISOString(),
            codeLength: code?.length || 0,
            strictMode: options?.strictMode ?? true,
            flowUpdated: flowId ? true : false,
          },
          defaultInputs: existingFlow?.defaultInputs || {},
          requiredCredentials: extractRequiredCredentials(
            existingFlow?.bubbleParameters as Record<
              string,
              ParsedBubbleWithInfo
            >
          ),
        },
        200
      );
    }

    // Create a new BubbleFlowValidationTool instance
    const result = await validateAndExtract(code, bubbleFactory, false);

    // If validation is successful and flowId is provided, update the flow as well before returning the result
    if (
      result.valid &&
      existingFlow &&
      flowId &&
      options?.syncInputsWithFlow === true
    ) {
      // Check webhook limit before activating cron (if activating)
      if (activateCron && !existingFlow?.cronActive) {
        const webhookUsage = await getCurrentWebhookUsage(userId);
        if (webhookUsage.currentUsage >= webhookUsage.limit) {
          return c.json(
            {
              error:
                'Webhook limit exceeded, please deactivate some webhooks or crons, or upgrade your plan to activate more.',
              details: `You have reached your limit of ${webhookUsage.limit} active webhooks/crons. You currently have ${webhookUsage.currentUsage} active. Please deactivate some webhooks or crons, or upgrade your plan to activate more.`,
            },
            403
          );
        }
      }

      // Prepare bubble parameters with credentials if provided
      let finalBubbleParameters = result.bubbleParameters || {};
      // If credentials are provided in the request, merge them into the bubble parameters
      if (credentials && Object.keys(credentials).length > 0) {
        finalBubbleParameters = mergeCredentialsIntoBubbleParameters(
          finalBubbleParameters,
          credentials
        );
      }
      const cronExpression = result.trigger?.cronSchedule || null;

      // Prepare update object
      const updateData: Partial<typeof bubbleFlows.$inferSelect> = {
        originalCode: code,
        bubbleParameters: finalBubbleParameters,
        workflow: result.workflow || null,
        inputSchema: result.inputSchema || {},
        eventType: result.trigger?.type,
        updatedAt: new Date(),
        cron: cronExpression,
        cronActive: activateCron,
      };

      // Only include defaultInputs if it's provided and not empty
      if (defaultInputs && Object.keys(defaultInputs).length > 0) {
        updateData.defaultInputs = defaultInputs;
      }
      await db
        .update(bubbleFlows)
        .set(updateData)
        .where(eq(bubbleFlows.id, flowId));
    }

    // Return the validation result based on if code itself is valid
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
          cron: result.trigger?.cronSchedule || null,
          cronActive: activateCron,
          defaultInputs: defaultInputs || existingFlow?.defaultInputs || {},
          workflow: result.workflow,
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
          cron: result.trigger?.cronSchedule || null,
          cronActive: existingFlow?.cronActive || false,
          workflow: result.workflow,
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
// Supports two phases: 'planning' (Coffee agent) and 'building' (Boba agent)
app.openapi(generateBubbleFlowCodeRoute, async (c) => {
  const userId = getUserId(c);
  try {
    const { prompt, flowId, messages, planContext } = c.req.valid('json');
    const { phase } = c.req.valid('query');

    // If flowId is provided, verify the flow exists and user owns it
    if (flowId) {
      const existingFlow = await db.query.bubbleFlows.findFirst({
        where: and(eq(bubbleFlows.id, flowId), eq(bubbleFlows.userId, userId)),
        columns: { id: true },
      });

      if (!existingFlow) {
        return c.json(
          {
            error: 'Flow not found or access denied',
            details: `Flow with ID ${flowId} not found or you don't have access to it`,
          },
          404
        );
      }
    }

    return streamSSE(c, async (stream) => {
      // Set up keep-alive interval to prevent connection timeout
      // Send a heartbeat every 15 seconds to keep the connection alive
      const HEARTBEAT_INTERVAL = 15000; // 15 seconds
      let lastEventTime = Date.now();

      const heartbeatInterval = setInterval(async () => {
        const timeSinceLastEvent = Date.now() - lastEventTime;
        // Only send heartbeat if no events have been sent recently
        if (timeSinceLastEvent >= HEARTBEAT_INTERVAL - 1000) {
          try {
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
              }),
              event: 'heartbeat',
              id: `heartbeat-${Date.now()}`,
            });
          } catch (error) {
            // If we can't write to stream, it's likely closed
            console.error(
              '[API] Heartbeat failed, stream may be closed:',
              error
            );
            clearInterval(heartbeatInterval);
          }
        }
      }, HEARTBEAT_INTERVAL);

      // Credentials for both Coffee and Boba
      const credentials = {
        [CredentialType.OPENROUTER_CRED]: process.env.OPENROUTER_API_KEY || '',
        [CredentialType.OPENAI_CRED]: process.env.OPENAI_API_KEY || '',
        [CredentialType.ANTHROPIC_CRED]: process.env.ANTHROPIC_API_KEY || '',
        [CredentialType.FIRECRAWL_API_KEY]:
          process.env.FIRE_CRAWL_API_KEY || '',
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY || '',
      };

      // Streaming callback for SSE events
      const streamingCallback = async (event: StreamingEvent) => {
        lastEventTime = Date.now();
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: event.type,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        });
      };

      try {
        // PLANNING PHASE: Run Coffee agent for clarification and plan generation
        if (phase === 'planning') {
          console.log('[API] Running Coffee agent (planning phase)');

          const coffeeResult = await runCoffee(
            {
              prompt,
              flowId,
              messages,
            },
            credentials,
            streamingCallback
          );

          // Save conversation messages to flow metadata for persistence
          if (flowId && messages && messages.length > 0) {
            try {
              // Fetch current metadata to merge with existing data
              const currentFlow = await db.query.bubbleFlows.findFirst({
                where: and(
                  eq(bubbleFlows.id, flowId),
                  eq(bubbleFlows.userId, userId)
                ),
                columns: { metadata: true },
              });

              const existingMetadata =
                (currentFlow?.metadata as Record<string, unknown>) || {};

              await db
                .update(bubbleFlows)
                .set({
                  metadata: {
                    ...existingMetadata,
                    conversationMessages: messages,
                    lastUpdatedPhase: 'planning',
                  },
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(bubbleFlows.id, flowId),
                    eq(bubbleFlows.userId, userId)
                  )
                );

              console.log(
                `[API] Saved ${messages.length} conversation messages to flow ${flowId} metadata (planning phase)`
              );
            } catch (saveError) {
              console.error(
                `[API] Error saving conversation messages to flow ${flowId}:`,
                saveError
              );
              // Non-blocking: continue even if save fails
            }
          }

          // Clear heartbeat and send stream completion
          clearInterval(heartbeatInterval);

          await stream.writeSSE({
            data: JSON.stringify({
              type: 'stream_complete',
              timestamp: new Date().toISOString(),
              coffeeResult,
            }),
            event: 'stream_complete',
          });

          return;
        }

        // BUILDING PHASE: Run Boba agent for code generation
        // Pass messages and planContext to runBoba - it will build the full context internally
        const generationResult = await runBoba(
          {
            prompt,
            credentials,
            messages,
            planContext,
          },
          async (event: StreamingEvent) => {
            // Update last event time to track activity
            lastEventTime = Date.now();

            // Capture validation events for analytics
            if (
              event.type === 'tool_complete' &&
              event.data.tool === 'bubbleflow-validation-tool'
            ) {
              try {
                const output = event.data
                  .output as BubbleResult<ValidationResult>;
                // Check if validation failed
                if (output.data.errors && output.data.errors.length > 0) {
                  posthog.captureValidationError({
                    userId,
                    code: event.data.input.input
                      ? JSON.parse(event.data.input.input).code
                      : '',
                    errorMessages: output.data.errors || [],
                    source: 'ai_generation',
                  });
                }
              } catch (error) {
                console.error('[API] Error capturing validation event:', error);
              }
            }
            // Stream events to client
            await stream.writeSSE({
              data: JSON.stringify(event),
              event: event.type,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            });
          }
        );

        // Clear heartbeat interval once generation is complete
        clearInterval(heartbeatInterval);

        // If flowId is provided and generation is successful, update the flow
        if (
          flowId &&
          generationResult.isValid &&
          generationResult.generatedCode
        ) {
          try {
            // Validate and extract metadata from generated code
            const bubbleFactory = await getBubbleFactory();
            const validationResult = await validateAndExtract(
              generationResult.generatedCode,
              bubbleFactory
            );

            if (validationResult.valid) {
              // Process and transpile the code for execution
              const processedCode = processUserCode(
                generationResult.generatedCode
              );

              // Extract flow name from the generated code
              const flowName = getFlowNameFromCode(
                generationResult.generatedCode
              );

              // Fetch current metadata to merge with existing data (including conversation messages)
              const currentFlow = await db.query.bubbleFlows.findFirst({
                where: and(
                  eq(bubbleFlows.id, flowId),
                  eq(bubbleFlows.userId, userId)
                ),
                columns: { metadata: true },
              });

              const existingMetadata =
                (currentFlow?.metadata as Record<string, unknown>) || {};

              // Build updated metadata with conversation messages
              const updatedMetadata = {
                ...existingMetadata,
                ...(messages && messages.length > 0
                  ? {
                      conversationMessages: messages,
                      lastUpdatedPhase: 'building',
                    }
                  : {}),
              };

              // Update the flow with generated code
              await db
                .update(bubbleFlows)
                .set({
                  name: flowName,
                  code: processedCode,
                  originalCode: generationResult.generatedCode,
                  bubbleParameters: validationResult.bubbleParameters || {},
                  workflow: validationResult.workflow || null,
                  inputSchema: validationResult.inputSchema || {},
                  eventType: validationResult.trigger?.type || 'webhook/http',
                  cron: validationResult.trigger?.cronSchedule || null,
                  generationError: null, // Clear any previous errors
                  metadata: updatedMetadata,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(bubbleFlows.id, flowId),
                    eq(bubbleFlows.userId, userId)
                  )
                );

              console.debug(
                `[API] Successfully updated flow ${flowId} with generated code and name: ${flowName}${messages?.length ? ` (${messages.length} conversation messages saved)` : ''}`
              );
            } else {
              // Validation failed - update with error
              await db
                .update(bubbleFlows)
                .set({
                  generationError:
                    validationResult.errors?.join('; ') ||
                    'Code validation failed',
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(bubbleFlows.id, flowId),
                    eq(bubbleFlows.userId, userId)
                  )
                );

              console.error(
                `[API] Flow ${flowId} validation failed:`,
                validationResult.errors
              );
            }
          } catch (updateError) {
            console.error(`[API] Error updating flow ${flowId}:`, updateError);
            // Update with error message
            await db
              .update(bubbleFlows)
              .set({
                generationError:
                  updateError instanceof Error
                    ? updateError.message
                    : 'Unknown error during flow update',
                updatedAt: new Date(),
              })
              .where(
                and(eq(bubbleFlows.id, flowId), eq(bubbleFlows.userId, userId))
              );
          }
        } else if (flowId && !generationResult.isValid) {
          // Generation failed - update with error
          try {
            await db
              .update(bubbleFlows)
              .set({
                generationError:
                  generationResult.error || 'Code generation failed',
                updatedAt: new Date(),
              })
              .where(
                and(eq(bubbleFlows.id, flowId), eq(bubbleFlows.userId, userId))
              );

            console.error(
              `[API] Flow ${flowId} generation failed:`,
              generationResult.error
            );
          } catch (updateError) {
            console.error(
              `[API] Error updating flow ${flowId} with error:`,
              updateError
            );
          }
        }

        // Send final result with code generation summary and extracted bubble parameters
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'generation_complete',
            data: generationResult,
          }),
          event: 'generation_complete',
        });

        // Send stream completion
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'stream_complete',
            timestamp: new Date().toISOString(),
          }),
          event: 'stream_complete',
        });
        let serviceUsages: ServiceUsage[] = [];
        if (generationResult.serviceUsage) {
          serviceUsages = generationResult.serviceUsage.map((serviceUsage) => ({
            service: serviceUsage.service,
            subService: serviceUsage.subService + '_pearl_generation',
            unit: serviceUsage.unit,
            usage: serviceUsage.usage,
            unitCost: 0,
            totalCost: serviceUsage.totalCost,
          }));
          if (generationResult.serviceUsage) {
            // Fetch user's created date for billing period calculation
            const user = await db.query.users.findFirst({
              where: eq(users.clerkId, userId),
              columns: { createdAt: true },
            });
            await trackServiceUsages(userId, serviceUsages, user?.createdAt);
          }
          if (generationResult.isValid) {
            posthog.captureEvent(
              {
                userId,
                prompt: prompt,
                code: generationResult.generatedCode,
              },
              'bubble_flow_generation_success'
            );
          } else {
            posthog.captureErrorEvent(
              generationResult.error,
              {
                userId,
                prompt: prompt,
                code: generationResult.generatedCode,
                error: generationResult.error,
              },
              'bubble_flow_generation_failed'
            );
          }
        }
      } catch (error) {
        console.error('[API] Streaming generation error:', error);
        posthog.captureErrorEvent(
          error,
          {
            userId,
            requestPath: c.req.path,
            requestMethod: c.req.method,
            prompt: prompt,
          },
          'bubble_flow_generation_error'
        );

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

// POST /generate/run-context-flow - Execute a context-gathering flow for Coffee agent
// This is a simplified execution path for context-gathering flows used during planning
app.openapi(runContextFlowRoute, async (c) => {
  const userId = getUserId(c);
  try {
    const { flowCode, credentials } = c.req.valid('json');

    console.log('[API] Running context-gathering flow for user:', userId);

    // Validate the flow code
    const bubbleFactory = await getBubbleFactory();
    const validationResult = await validateAndExtract(
      flowCode,
      bubbleFactory,
      false
    );

    if (!validationResult.valid) {
      return c.json(
        {
          error: `Flow validation failed: ${validationResult.errors?.join(', ') || 'Unknown error'}`,
        },
        400
      );
    }

    // Get parsed bubbles from validation result
    // Convert number keys to strings (validateAndExtract returns Record<number, ...>)
    const parsedBubbles: Record<string, ParsedBubbleWithInfo> = {};
    for (const [varId, bubble] of Object.entries(
      validationResult.bubbleParameters || {}
    )) {
      parsedBubbles[String(varId)] = bubble;
    }

    // Build bubbleParameters with credentials injected
    // For each bubble variable, we need to add the user-provided credential IDs
    // to the credentials parameter so runBubbleFlow can fetch and decrypt them
    const bubbleParametersWithCreds = injectCredentialsIntoBubbleParameters(
      parsedBubbles,
      validationResult.requiredCredentials || {},
      credentials
    );

    console.log(
      '[API] Bubble parameters with credentials:',
      JSON.stringify(bubbleParametersWithCreds, null, 2)
    );

    // Execute the flow using the standard execution path
    const executionResult = await runBubbleFlow(
      flowCode,
      bubbleParametersWithCreds,
      {
        type: 'webhook/http',
        timestamp: new Date().toISOString(),
        path: '/context-gathering',
        method: 'POST',
        executionId: `ctx-${Date.now()}`,
        body: {},
      },
      {
        userId,
        pricingTable: PRICING_TABLE,
      }
    );

    console.log(
      '[API] Context flow executed successfully with result:',
      executionResult.data
    );

    return c.json(
      {
        success: executionResult.success,
        result: executionResult.data,
        error: executionResult.error,
      },
      200
    );
  } catch (error) {
    console.error('[API] Context flow execution error:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
