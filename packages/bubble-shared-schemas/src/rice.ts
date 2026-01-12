import { z } from 'zod';
import { AvailableModels, type AvailableModel } from './ai-models.js';
import { RECOMMENDED_MODELS } from './bubbleflow-generation-prompts.js';

// Default model for Rice evaluation agent
export const RICE_DEFAULT_MODEL: AvailableModel = RECOMMENDED_MODELS.FAST;

/**
 * Issue type categories for Rice evaluation
 * - setup: Configuration/credential issues (user can fix in settings, not workflow code)
 * - workflow: Logic/code issues in the workflow itself (fixable with Pearl)
 * - input: Issues with input data (user needs to provide different input)
 * - null: No issues (working=true)
 */
export const RiceIssueTypeSchema = z
  .enum(['setup', 'workflow', 'input'])
  .nullable();

export type RiceIssueType = z.infer<typeof RiceIssueTypeSchema>;

/**
 * Evaluation result schema from Rice agent
 * This represents the AI's assessment of workflow execution quality
 */
export const RiceEvaluationResultSchema = z.object({
  working: z
    .boolean()
    .describe(
      'Whether the workflow is functioning correctly (true if no errors and expected behavior)'
    ),

  issueType: RiceIssueTypeSchema.describe(
    'Category of issue: "setup" (config/credentials), "workflow" (code logic), "input" (bad input data), or null if working'
  ),

  summary: z
    .string()
    .describe(
      'Brief summary of the execution. If working: what happened and any external changes made. If not working: description of the issue.'
    ),

  rating: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe(
      'Quality rating 1-10: 1-3=severe issues, 4-6=partial functionality, 7-8=working with minor issues, 9-10=excellent'
    ),
});

/**
 * Request schema for Rice evaluation agent
 * Rice evaluates workflow execution quality based on logs and code
 */
export const RiceRequestSchema = z.object({
  executionLogs: z
    .array(z.unknown())
    .describe('StreamingLogEvent[] from execution'),

  workflowCode: z
    .string()
    .describe('The original workflow code that was executed'),

  executionId: z.number().describe('ID of the execution being evaluated'),

  bubbleFlowId: z.number().describe('ID of the BubbleFlow being evaluated'),

  model: AvailableModels.optional()
    .default(RICE_DEFAULT_MODEL)
    .describe('AI model to use for Rice evaluation'),
});

/**
 * Response schema for Rice evaluation agent
 */
export const RiceResponseSchema = z.object({
  success: z
    .boolean()
    .describe('Whether the evaluation completed successfully'),

  evaluation: RiceEvaluationResultSchema.optional().describe(
    'Evaluation result (only present if success=true)'
  ),

  error: z
    .string()
    .optional()
    .describe('Error message if the evaluation failed'),
});

// Export inferred TypeScript types
export type RiceEvaluationResult = z.infer<typeof RiceEvaluationResultSchema>;

// Use z.input for RiceRequest to make optional fields with defaults truly optional for callers
// z.infer would include the model field (since default is applied during parsing)
// z.input represents what callers need to provide (before transforms/defaults are applied)
export type RiceRequest = z.input<typeof RiceRequestSchema>;

export type RiceResponse = z.infer<typeof RiceResponseSchema>;
