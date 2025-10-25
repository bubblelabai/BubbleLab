import { db } from '../db/index.js';
import { bubbleFlowExecutions, bubbleFlows, users } from '../db/schema.js';
import {
  executeBubbleFlow,
  runBubbleFlow,
  runBubbleFlowWithStreaming,
  type StreamingExecutionOptions,
} from './execution.js';
import { ParsedBubble, ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import type { ExecutionResult } from '@bubblelab/shared-schemas';
import { eq, and, sql } from 'drizzle-orm';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { verifyMonthlyLimit } from './subscription-validation.js';
import { AppType } from '../config/clerk-apps.js';

export interface ExecutionPayload {
  type: keyof BubbleTriggerEventRegistry;
  timestamp: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown; // Allow additional properties for BubbleTriggerEvent compatibility
}

export interface ExecutionOptions {
  userId: string;
  systemCredentials?: Record<string, string>;
  appType?: AppType;
}

/**
 * Executes a BubbleFlow triggered by webhook and updates execution counters
 */
export async function executeBubbleFlowViaWebhook(
  bubbleFlowId: number,
  payload: ExecutionPayload,
  options: ExecutionOptions
): Promise<ExecutionResult> {
  const result = await executeBubbleFlowWithTracking(
    bubbleFlowId,
    payload,
    options
  );

  // Update webhook execution counters
  if (result.success) {
    await db
      .update(bubbleFlows)
      .set({
        webhookExecutionCount: sql`${bubbleFlows.webhookExecutionCount} + 1`,
      })
      .where(eq(bubbleFlows.id, bubbleFlowId));
  } else {
    await db
      .update(bubbleFlows)
      .set({
        webhookExecutionCount: sql`${bubbleFlows.webhookExecutionCount} + 1`,
        webhookFailureCount: sql`${bubbleFlows.webhookFailureCount} + 1`,
      })
      .where(eq(bubbleFlows.id, bubbleFlowId));
  }

  return result;
}

/**
 * Executes a BubbleFlow and handles the database operations
 */
export async function executeBubbleFlowWithTracking(
  bubbleFlowId: number,
  payload: ExecutionPayload,
  options: ExecutionOptions
): Promise<ExecutionResult> {
  // find the user in the user table and get the app type of the user
  const user = await db.query.users.findFirst({
    where: and(eq(users.clerkId, options.userId)),
  });

  if (!user) {
    throw new Error('Invalid user');
  }

  const { allowed, currentUsage, limit } = await verifyMonthlyLimit(
    options.userId,
    (user.appType as AppType) || AppType.BUBBLE_LAB
  );

  // Get BubbleFlow from database (only if it belongs to the user)
  const flow = await db.query.bubbleFlows.findFirst({
    where: and(
      eq(bubbleFlows.id, bubbleFlowId),
      eq(bubbleFlows.userId, options.userId)
    ),
  });

  if (!flow) {
    throw new Error(
      'Something went wrong, please recreate the flow. If the problem persists, please contact Nodex support.'
    );
  }
  if (!allowed) {
    //Create a new execution record with error
    // Execute flow with special payload that includes the monthly limit error message
    const specialPayload = {
      ...payload,
      monthlyLimitError:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
    };
    await executeBubbleFlow(
      flow.code, // Processed code
      specialPayload,
      {
        userId: options.userId,
      },
      flow.originalCode!, // Original TypeScript code for credential injection
      flow.bubbleParameters as Record<string, ParsedBubble> // Pass stored bubble parameters
    );
    await db.insert(bubbleFlowExecutions).values({
      bubbleFlowId,
      payload,
      status: 'error',
      error:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
      code: flow.originalCode,
    });

    return {
      executionId: 0,
      success: false,
      error:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
    };
  }

  // Create execution record
  const execResult = await db
    .insert(bubbleFlowExecutions)
    .values({
      bubbleFlowId,
      payload,
      status: 'running',
      code: flow.originalCode,
    })
    .returning();

  try {
    // Execute the flow using the pre-processed code from database
    const result = await executeBubbleFlow(
      flow.code, // Processed code
      payload,
      {
        userId: options.userId,
      },
      flow.originalCode!, // Original TypeScript code for credential injection
      flow.bubbleParameters as Record<string, ParsedBubble> // Pass stored bubble parameters
    );

    // Update execution record
    await db
      .update(bubbleFlowExecutions)
      .set({
        result: 'Message has been successfully sent',
        error: result.success ? null : result.error,
        status: result.success ? 'success' : 'error',
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    // Increase monthly usage count
    await db
      .update(users)
      .set({
        monthlyUsageCount: sql`${users.monthlyUsageCount} + 1`,
      })
      .where(eq(users.clerkId, options.userId));

    return {
      executionId: execResult[0].id,
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error) {
    // Update execution record with error
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(bubbleFlowExecutions)
      .set({
        result: null,
        error: errorMessage,
        status: 'error',
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    return {
      executionId: execResult[0].id,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Executes a BubbleFlow with live streaming and handles the database operations
 */
export async function executeBubbleFlowWithLiveStreaming(
  bubbleFlowId: number,
  payload: ExecutionPayload,
  options: StreamingExecutionOptions
): Promise<ExecutionResult> {
  const { allowed, currentUsage, limit } = await verifyMonthlyLimit(
    options.userId,
    options.appType ?? AppType.NODEX
  );

  // Get BubbleFlow from database (only if it belongs to the user)
  const flow = await db.query.bubbleFlows.findFirst({
    where: and(
      eq(bubbleFlows.id, bubbleFlowId),
      eq(bubbleFlows.userId, options.userId)
    ),
  });

  if (!flow) {
    throw new Error(
      'Something went wrong, please recreate the flow. If the problem persists, please contact Nodex support.'
    );
  }

  if (!allowed) {
    // Create a new execution record with error
    await db.insert(bubbleFlowExecutions).values({
      bubbleFlowId,
      payload,
      status: 'error',
      error:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
      code: flow.originalCode,
    });

    return {
      executionId: 0,
      success: false,
      error:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
    };
  }

  // Create execution record
  const execResult = await db
    .insert(bubbleFlowExecutions)
    .values({
      bubbleFlowId,
      payload,
      status: 'running',
      code: flow.originalCode,
    })
    .returning();

  try {
    // Execute the flow using streaming execution
    const result = await runBubbleFlowWithStreaming(
      flow.originalCode!, // Use original TypeScript code
      flow.bubbleParameters as Record<string, ParsedBubbleWithInfo>,
      payload,
      {
        userId: options.userId,
        streamCallback: options.streamCallback,
      }
    );

    // Update execution record
    await db
      .update(bubbleFlowExecutions)
      .set({
        result: result?.summary || 'Execution completed without logging',
        error: result.success ? null : result.error,
        status: result.success ? 'success' : 'error',
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    // Increase monthly usage count
    await db
      .update(users)
      .set({
        monthlyUsageCount: sql`${users.monthlyUsageCount} + 1`,
      })
      .where(eq(users.clerkId, options.userId));

    return {
      executionId: execResult[0].id,
      success: result.success,
      data: result.summary || 'Execution completed without logging',
      error: result.error,
    };
  } catch (error) {
    // Update execution record with error
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(bubbleFlowExecutions)
      .set({
        result: null,
        error: errorMessage,
        status: 'error',
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    return {
      executionId: execResult[0].id,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Executes a BubbleFlow and handles the database operations
 */
export async function executeBubbleFlowWithLog(
  bubbleFlowId: number,
  payload: ExecutionPayload,
  options: ExecutionOptions
): Promise<ExecutionResult> {
  const { allowed, currentUsage, limit } = await verifyMonthlyLimit(
    options.userId,
    options.appType ?? AppType.NODEX
  );

  // Get BubbleFlow from database (only if it belongs to the user)
  const flow = await db.query.bubbleFlows.findFirst({
    where: and(
      eq(bubbleFlows.id, bubbleFlowId),
      eq(bubbleFlows.userId, options.userId)
    ),
  });

  if (!flow) {
    throw new Error(
      'Something went wrong, please recreate the flow. If the problem persists, please contact Nodex support.'
    );
  }
  if (!allowed) {
    //Create a new execution record with error
    // Execute flow with special payload that includes the monthly limit error message
    const specialPayload = {
      ...payload,
      monthlyLimitError:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
    };
    await runBubbleFlow(
      flow.originalCode!, // Processed code
      flow.bubbleParameters as Record<string, ParsedBubbleWithInfo>,
      specialPayload,
      {
        userId: options.userId,
      }
    );
    await db.insert(bubbleFlowExecutions).values({
      bubbleFlowId,
      payload,
      status: 'error',
      error:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
      code: flow.originalCode,
    });

    return {
      executionId: 0,
      success: false,
      error:
        'Monthly limit exceeded, current usage, please upgrade plan or wait until next month: ' +
        currentUsage +
        ', limit: ' +
        limit,
    };
  }

  // Create execution record
  const execResult = await db
    .insert(bubbleFlowExecutions)
    .values({
      bubbleFlowId,
      payload,
      status: 'running',
      code: flow.originalCode,
    })
    .returning();

  try {
    // Execute the flow using the pre-processed code from database
    const result = await runBubbleFlow(
      flow.originalCode!, // Processed code
      flow.bubbleParameters as Record<string, ParsedBubbleWithInfo>,
      payload,
      {
        userId: options.userId,
      }
    );

    // Update execution record
    await db
      .update(bubbleFlowExecutions)
      .set({
        result: result.summary || 'Execution completed without logging',
        error: result.success ? null : result.error,
        status: result.success ? 'success' : 'error',
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    // Increase monthly usage count
    await db
      .update(users)
      .set({
        monthlyUsageCount: sql`${users.monthlyUsageCount} + 1`,
      })
      .where(eq(users.clerkId, options.userId));

    return {
      executionId: execResult[0].id,
      success: result.success,
      data: result.data || 'Execution completed without logging',
      error: result.error,
    };
  } catch (error) {
    // Update execution record with error
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(bubbleFlowExecutions)
      .set({
        result: null,
        error: errorMessage,
        status: 'error',
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    return {
      executionId: execResult[0].id,
      success: false,
      error: errorMessage,
    };
  }
}
