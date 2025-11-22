import { db } from '../db/index.js';
import { bubbleFlowExecutions, bubbleFlows, users } from '../db/schema.js';
import {
  runBubbleFlow,
  runBubbleFlowWithStreaming,
  type StreamingExecutionOptions,
} from './execution.js';
import {
  ParsedBubbleWithInfo,
  cleanUpObjectForDisplayAndStorage,
} from '@bubblelab/shared-schemas';
import type { ExecutionResult } from '@bubblelab/shared-schemas';

import { eq, and, sql } from 'drizzle-orm';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { AppType } from '../config/clerk-apps.js';
import { getPricingTable } from '../config/pricing.js';

export interface ExecutionPayload {
  type: keyof BubbleTriggerEventRegistry;
  timestamp: string;
  path: string;
  method?: string;
  executionId: string;
  headers?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown; // Allow additional properties for BubbleTriggerEvent compatibility
}

export interface ExecutionOptions {
  userId: string;
  systemCredentials?: Record<string, string>;
  appType?: AppType;
  pricingTable: Record<string, { unit: string; unitCost: number }>;
}

// Use shared prepareForStorage for payload and result

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
 * Executes a BubbleFlow and handles the database operations.
 * Supports both streaming and non-streaming execution.
 */
export async function executeBubbleFlowWithTracking(
  bubbleFlowId: number,
  payload: ExecutionPayload,
  options: StreamingExecutionOptions
): Promise<ExecutionResult> {
  // find the user in the user table and get the app type of the user
  const user = await db.query.users.findFirst({
    where: and(eq(users.clerkId, options.userId)),
  });

  if (!user) {
    throw new Error('Invalid user');
  }

  const appType = user.appType as AppType;

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

  // Create execution record
  const execResult = await db
    .insert(bubbleFlowExecutions)
    .values({
      bubbleFlowId,
      payload: cleanUpObjectForDisplayAndStorage(payload),
      status: 'running',
      code: flow.originalCode,
    })
    .returning();

  try {
    // Execute the flow - use streaming if callback provided, otherwise standard execution
    let result: ExecutionResult;
    if (options.streamCallback) {
      result = await runBubbleFlowWithStreaming(
        flow.originalCode!, // Use original TypeScript code
        flow.bubbleParameters as Record<string, ParsedBubbleWithInfo>,
        payload,
        {
          userId: options.userId,
          streamCallback: options.streamCallback,
          useWebhookLogger: options.useWebhookLogger,
          pricingTable: getPricingTable(),
          appType: appType,
        }
      );
    } else {
      result = await runBubbleFlow(
        flow.originalCode!, // Use original TypeScript code
        flow.bubbleParameters as Record<string, ParsedBubbleWithInfo>,
        payload,
        {
          userId: options.userId,
          appType: appType,
          pricingTable: getPricingTable(),
        }
      );
    }

    // Update execution record
    await db
      .update(bubbleFlowExecutions)
      .set({
        result: cleanUpObjectForDisplayAndStorage({
          data: result.data,
          ...result.summary,
        }),
        error: result.success ? null : result.error,
        status: result.success ? 'success' : 'error',
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    return {
      executionId: execResult[0].id,
      success: result.success,
      data: options.streamCallback
        ? result.summary || 'Execution completed without logging'
        : result.data,
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
