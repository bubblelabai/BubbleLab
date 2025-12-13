import { z } from 'zod';
import { CredentialType } from './types.js';

// ============================================================================
// Coffee Agent - Planning Phase for BubbleFlow Generation
// ============================================================================
// Coffee runs BEFORE Boba to gather clarification and generate an
// implementation plan. This helps reduce ambiguity in user requests.

// Constants
export const COFFEE_MAX_ITERATIONS = 30;
export const COFFEE_MAX_QUESTIONS = 3;
export const COFFEE_DEFAULT_MODEL = 'google/gemini-3-pro-preview' as const;

// ============================================================================
// Clarification Schemas
// ============================================================================

/** A single choice option for a clarification question */
export const ClarificationChoiceSchema = z.object({
  id: z.string().describe('Unique identifier for this choice'),
  label: z.string().describe('Short display label for the choice'),
  description: z
    .string()
    .optional()
    .describe('Optional longer description explaining the choice'),
});

/** A clarification question with multiple choices */
export const ClarificationQuestionSchema = z.object({
  id: z.string().describe('Unique identifier for this question'),
  question: z.string().describe('The question text to display to the user'),
  choices: z
    .array(ClarificationChoiceSchema)
    .min(2)
    .max(4)
    .describe('Available choices for the user (2-4 options)'),
  context: z
    .string()
    .optional()
    .describe('Optional context explaining why this question is being asked'),
});

/** Event sent to frontend containing clarification questions */
export const CoffeeClarificationEventSchema = z.object({
  questions: z
    .array(ClarificationQuestionSchema)
    .min(1)
    .max(COFFEE_MAX_QUESTIONS)
    .describe('List of clarification questions (1-3)'),
});

// ============================================================================
// Context Gathering Schemas (Phase 2 - External Context via BubbleFlow)
// ============================================================================

/** Event for context gathering status (legacy, kept for backwards compatibility) */
export const CoffeeContextEventSchema = z.object({
  status: z
    .enum(['gathering', 'complete'])
    .describe('Current status of context gathering'),
  miniFlowDescription: z
    .string()
    .optional()
    .describe('Description of the mini flow that would run to gather context'),
  result: z.string().optional().describe('Result of context gathering'),
});

/**
 * Event sent when Coffee requests external context via running a BubbleFlow.
 * This pauses the planning process until the user provides credentials and approves execution.
 */
export const CoffeeRequestExternalContextEventSchema = z.object({
  flowId: z.string().describe('Unique ID for this context request'),
  flowCode: z
    .string()
    .describe('Validated BubbleFlow TypeScript code to execute'),
  requiredCredentials: z
    .array(z.nativeEnum(CredentialType))
    .describe('List of credential types needed to run this flow'),
  description: z
    .string()
    .describe('User-friendly description of what this flow will do'),
});

/**
 * Answer sent back to Coffee after user provides credentials and flow executes.
 * This is used to resume the planning process with enriched context.
 */
export const CoffeeContextAnswerSchema = z.object({
  flowId: z.string().describe('ID of the context request being answered'),
  status: z
    .enum(['success', 'rejected', 'error'])
    .describe(
      'Status: success (got context), rejected (user skipped), error (execution failed)'
    ),
  result: z
    .unknown()
    .optional()
    .describe('The result data from running the context-gathering flow'),
  error: z.string().optional().describe('Error message if status is error'),
  originalRequest: CoffeeRequestExternalContextEventSchema.optional().describe(
    'The original context request that triggered this answer (includes flowCode, description, etc.)'
  ),
});

/**
 * Context request info that the agent generates when it wants to run a flow.
 * This is part of the agent's output when action is 'requestContext'.
 */
export const CoffeeContextRequestInfoSchema = z.object({
  purpose: z
    .string()
    .describe(
      'Why this context is needed (e.g., "to understand your database schema")'
    ),
  flowDescription: z
    .string()
    .describe('User-facing description of what the flow will do'),
});

// ============================================================================
// Plan Schemas
// ============================================================================

/** A single step in the implementation plan */
export const PlanStepSchema = z.object({
  title: z.string().describe('Short title for this step'),
  description: z
    .string()
    .describe('Detailed description of what this step does'),
  bubblesUsed: z
    .array(z.string())
    .optional()
    .describe('Names of bubbles used in this step'),
});

/** The complete implementation plan generated by Coffee */
export const CoffeePlanEventSchema = z.object({
  summary: z.string().describe('Brief overview of the workflow'),
  steps: z.array(PlanStepSchema).describe('Step-by-step implementation plan'),
  estimatedBubbles: z
    .array(z.string())
    .describe('All bubbles that will be used in the workflow'),
});

// ============================================================================
// Request/Response Schemas
// ============================================================================

/** Request to the Generate BubbleFlow */
export const CoffeeRequestSchema = z.object({
  prompt: z.string().min(1).describe('The user prompt describing the workflow'),
  flowId: z
    .number()
    .optional()
    .describe('Optional flow ID if updating existing flow'),
  clarificationAnswers: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe(
      'User answers to previous clarification questions (questionId -> choiceIds)'
    ),
  planContext: z
    .string()
    .optional()
    .describe('Previously generated plan context (for building phase)'),
  contextAnswer: CoffeeContextAnswerSchema.optional().describe(
    'Answer from a previous context-gathering flow execution'
  ),
});

/** Response from the Coffee agent */
export const CoffeeResponseSchema = z.object({
  type: z
    .enum(['clarification', 'plan', 'context_request', 'error'])
    .describe(
      'Response type: clarification (needs user input), plan (ready for approval), context_request (needs external context), error (failed)'
    ),
  clarification: CoffeeClarificationEventSchema.optional().describe(
    'Clarification questions (only when type is "clarification")'
  ),
  plan: CoffeePlanEventSchema.optional().describe(
    'Implementation plan (only when type is "plan")'
  ),
  contextRequest: CoffeeRequestExternalContextEventSchema.optional().describe(
    'Context request (only when type is "context_request")'
  ),
  error: z
    .string()
    .optional()
    .describe('Error message (only when type is "error")'),
  success: z.boolean().describe('Whether the operation completed successfully'),
});

/** Internal output format from the Coffee AI agent */
export const CoffeeAgentOutputSchema = z.object({
  action: z
    .enum(['askClarification', 'generatePlan', 'requestContext'])
    .describe('The action the agent wants to take'),
  questions: z
    .array(ClarificationQuestionSchema)
    .optional()
    .describe('Questions to ask (when action is askClarification)'),
  plan: CoffeePlanEventSchema.optional().describe(
    'Generated plan (when action is generatePlan)'
  ),
  contextRequest: CoffeeContextRequestInfoSchema.optional().describe(
    'Context request info (when action is requestContext) - the agent will then call runBubbleFlow tool'
  ),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ClarificationChoice = z.infer<typeof ClarificationChoiceSchema>;
export type ClarificationQuestion = z.infer<typeof ClarificationQuestionSchema>;
export type CoffeeClarificationEvent = z.infer<
  typeof CoffeeClarificationEventSchema
>;
export type CoffeeContextEvent = z.infer<typeof CoffeeContextEventSchema>;
export type CoffeeRequestExternalContextEvent = z.infer<
  typeof CoffeeRequestExternalContextEventSchema
>;
export type CoffeeContextAnswer = z.infer<typeof CoffeeContextAnswerSchema>;
export type CoffeeContextRequestInfo = z.infer<
  typeof CoffeeContextRequestInfoSchema
>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type CoffeePlanEvent = z.infer<typeof CoffeePlanEventSchema>;
export type CoffeeRequest = z.infer<typeof CoffeeRequestSchema>;
export type CoffeeResponse = z.infer<typeof CoffeeResponseSchema>;
export type CoffeeAgentOutput = z.infer<typeof CoffeeAgentOutputSchema>;
