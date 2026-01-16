import { db } from '../db/index.js';
import { bubbleFlowExecutions, bubbleFlows, users } from '../db/schema.js';
import {
  runBubbleFlowWithStreaming,
  type StreamingExecutionOptions,
} from './execution.js';
import {
  ParsedBubbleWithInfo,
  cleanUpObjectForDisplayAndStorage,
  type StreamingLogEvent,
  type StreamCallback,
  CredentialType,
} from '@bubblelab/shared-schemas';
import type { ExecutionResult } from '@bubblelab/shared-schemas';

import { eq, and, sql } from 'drizzle-orm';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import { AppType } from '../config/clerk-apps.js';
import { getPricingTable } from '../config/pricing.js';
import {
  shouldEvaluateExecution,
  storeEvaluation,
} from './evaluation-trigger.js';
import { runRice, getRiceModelUsed } from './ai/rice.js';
import { env } from '../config/env.js';

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
 * Optionally runs Rice evaluation after execution if evalPerformance is enabled.
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

  // Always collect streaming events for storage in executionLogs
  // This ensures logs are available for history replay regardless of streaming
  const collectedEvents: StreamingLogEvent[] = [];
  const originalCallback = options.streamCallback;

  // Create a collection callback that always captures events
  // If streaming is enabled, also forward to the original callback
  const collectionCallback: StreamCallback = async (
    event: StreamingLogEvent
  ) => {
    collectedEvents.push(event);
    if (originalCallback) {
      await originalCallback(event);
    }
  };

  try {
    // Always use streaming execution to capture logs
    // The collectionCallback will collect events regardless of whether
    // we're streaming to a client (webhook, cron, manual all get logged)
    const result = await runBubbleFlowWithStreaming(
      flow.originalCode!, // Use original TypeScript code
      flow.bubbleParameters as Record<string, ParsedBubbleWithInfo>,
      payload,
      {
        userId: options.userId,
        streamCallback: collectionCallback,
        useWebhookLogger: options.useWebhookLogger,
        pricingTable: getPricingTable(),
        appType: appType,
      }
    );

    // Update execution record with result and collected logs
    await db
      .update(bubbleFlowExecutions)
      .set({
        result: cleanUpObjectForDisplayAndStorage({
          data: result.data,
          ...result.summary,
        }),
        error: result.success ? null : result.error,
        status: result.success ? 'success' : 'error',
        executionLogs: collectedEvents.length > 0 ? collectedEvents : null,
        completedAt: new Date(),
      })
      .where(eq(bubbleFlowExecutions.id, execResult[0].id));

    // Run Rice evaluation if enabled and conditions are met
    if (originalCallback && options.evalPerformance) {
      await runEvaluationIfNeeded(
        execResult[0].id,
        bubbleFlowId,
        flow.originalCode!,
        collectedEvents,
        originalCallback
      );
    }

    return {
      executionId: execResult[0].id,
      success: result.success,
      data: originalCallback
        ? result.summary || 'Execution completed without logging'
        : result.data,
      error: result.error,
    };
  } catch (error) {
    // Update execution record with error and collected logs
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(bubbleFlowExecutions)
      .set({
        result: null,
        error: errorMessage,
        status: 'error',
        executionLogs: collectedEvents.length > 0 ? collectedEvents : null,
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
 * Run Rice evaluation if conditions are met
 */
async function runEvaluationIfNeeded(
  executionId: number,
  bubbleFlowId: number,
  workflowCode: string,
  executionLogs: StreamingLogEvent[],
  streamCallback: StreamCallback
): Promise<void> {
  try {
    // Check if we should evaluate
    const evalTrigger = await shouldEvaluateExecution(bubbleFlowId, true);

    if (!evalTrigger.shouldEvaluate) {
      return;
    }

    // Stream start_evaluating event
    await streamCallback({
      type: 'start_evaluating',
      timestamp: new Date().toISOString(),
      message: 'Evaluating workflow execution quality...',
    });

    // Build Rice request
    const riceRequest = {
      executionLogs,
      workflowCode,
      executionId,
      bubbleFlowId,
    };

    // Run Rice evaluation
    const riceResult = await runRice(riceRequest, {
      [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY || '',
      [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY || '',
    });

    if (riceResult.success && riceResult.evaluation) {
      // Store evaluation result (execution logs are stored in the execution record)
      await storeEvaluation(
        executionId,
        bubbleFlowId,
        riceResult.evaluation,
        getRiceModelUsed(riceRequest)
      );

      // Stream end_evaluating event with result
      await streamCallback({
        type: 'end_evaluating',
        timestamp: new Date().toISOString(),
        message: riceResult.evaluation.working
          ? 'Workflow evaluation passed'
          : 'Workflow evaluation found issues',
        evaluationResult: riceResult.evaluation,
      });
    } else {
      // Evaluation failed - stream error but don't fail the execution
      console.error('[Evaluation] Rice evaluation failed:', riceResult.error);
      await streamCallback({
        type: 'end_evaluating',
        timestamp: new Date().toISOString(),
        message: `Evaluation failed: ${riceResult.error}`,
      });
    }
  } catch (error) {
    // Non-blocking: log error but don't fail the execution
    console.error('[Evaluation] Error during evaluation:', error);
    await streamCallback({
      type: 'end_evaluating',
      timestamp: new Date().toISOString(),
      message: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
