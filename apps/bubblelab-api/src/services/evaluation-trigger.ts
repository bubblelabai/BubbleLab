/**
 * Evaluation Trigger Service
 *
 * Handles the logic for determining when to run Rice evaluation
 * and storing evaluation results in the database.
 */

import { db } from '../db/index.js';
import { bubbleFlowEvaluations } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { RiceEvaluationResult } from '@bubblelab/shared-schemas';

/**
 * Result of evaluation trigger check
 */
export interface EvaluationTriggerResult {
  shouldEvaluate: boolean;
  reason:
    | 'first_execution'
    | 'previous_had_issues'
    | 'skip_no_issues'
    | 'eval_disabled';
}

/**
 * Determines if an execution should be evaluated by Rice
 *
 * Logic:
 * - If evalPerformance option is off (default), skip evaluation
 * - First execution of a flow (no previous evaluation): Always evaluate
 * - Subsequent executions: Only evaluate if previous evaluation had issues (working=false)
 *
 * @param bubbleFlowId - The ID of the BubbleFlow being executed
 * @param evalPerformance - Whether performance evaluation is enabled
 * @returns Whether to evaluate and the reason
 */
export async function shouldEvaluateExecution(
  bubbleFlowId: number,
  evalPerformance: boolean = false
): Promise<EvaluationTriggerResult> {
  // If evalPerformance option is off (default), skip evaluation
  if (!evalPerformance) {
    return { shouldEvaluate: false, reason: 'eval_disabled' };
  }

  // Get the most recent evaluation for this flow
  const lastEvaluation = await db.query.bubbleFlowEvaluations.findFirst({
    where: eq(bubbleFlowEvaluations.bubbleFlowId, bubbleFlowId),
    orderBy: [desc(bubbleFlowEvaluations.evaluatedAt)],
    columns: {
      working: true,
    },
  });

  // First execution - no previous evaluation exists
  if (!lastEvaluation) {
    return { shouldEvaluate: true, reason: 'first_execution' };
  }

  // If previous evaluation had issues (working=false), evaluate again
  if (!lastEvaluation.working) {
    return { shouldEvaluate: true, reason: 'previous_had_issues' };
  }

  // Previous evaluation was successful, skip evaluation
  return { shouldEvaluate: false, reason: 'skip_no_issues' };
}

/**
 * Stores an evaluation result in the database
 *
 * @param executionId - The ID of the execution being evaluated
 * @param bubbleFlowId - The ID of the BubbleFlow
 * @param evaluation - The evaluation result from Rice
 * @param executionLogs - The execution logs that were analyzed
 * @param modelUsed - The model used for evaluation
 * @returns The ID of the created evaluation record
 */
export async function storeEvaluation(
  executionId: number,
  bubbleFlowId: number,
  evaluation: RiceEvaluationResult,
  executionLogs: unknown[],
  modelUsed: string
): Promise<number> {
  const [inserted] = await db
    .insert(bubbleFlowEvaluations)
    .values({
      executionId,
      bubbleFlowId,
      working: evaluation.working,
      issue: evaluation.issue || null,
      rating: evaluation.rating,
      executionLogs: executionLogs,
      modelUsed,
    })
    .returning({ id: bubbleFlowEvaluations.id });

  return inserted.id;
}

/**
 * Get the most recent evaluation for a flow
 *
 * @param bubbleFlowId - The ID of the BubbleFlow
 * @returns The most recent evaluation or null if none exists
 */
export async function getLatestEvaluation(bubbleFlowId: number) {
  return await db.query.bubbleFlowEvaluations.findFirst({
    where: eq(bubbleFlowEvaluations.bubbleFlowId, bubbleFlowId),
    orderBy: [desc(bubbleFlowEvaluations.evaluatedAt)],
  });
}

/**
 * Get all evaluations for a flow
 *
 * @param bubbleFlowId - The ID of the BubbleFlow
 * @param limit - Maximum number of evaluations to return
 * @returns Array of evaluations ordered by date descending
 */
export async function getEvaluationsForFlow(
  bubbleFlowId: number,
  limit: number = 10
) {
  return await db.query.bubbleFlowEvaluations.findMany({
    where: eq(bubbleFlowEvaluations.bubbleFlowId, bubbleFlowId),
    orderBy: [desc(bubbleFlowEvaluations.evaluatedAt)],
    limit,
    with: {
      execution: {
        columns: {
          startedAt: true,
          status: true,
        },
      },
    },
  });
}
