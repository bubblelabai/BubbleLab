import { z } from 'zod';
import { AvailableModels } from './ai-models.js';
import { ParsedBubbleWithInfoSchema } from './bubble-definition-schema.js';
import { CredentialType } from './types.js';

// Reuse the ConversationMessageSchema from milk-tea to avoid duplication
const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

/**
 * Request schema for Pearl agent
 * Pearl helps users build complete workflows without requiring specific bubbles
 */
export const PearlRequestSchema = z.object({
  userRequest: z
    .string()
    .min(1, 'User request is required')
    .describe('The user request or question about building a workflow'),

  currentCode: z
    .string()
    .optional()
    .describe('The current workflow code for context and modification'),

  userName: z.string().describe('Name of the user making the request'),
  availableVariables: z
    .array(z.any())
    .describe('List of available variables in the current code'),
  conversationHistory: z
    .array(ConversationMessageSchema)
    .optional()
    .default([])
    .describe(
      'Previous conversation messages for multi-turn interactions (frontend manages state)'
    ),

  model: AvailableModels.default('google/gemini-2.5-pro').describe(
    'AI model to use for Pearl agent'
  ),
});

/**
 * Response schema for Pearl agent
 */
export const PearlResponseSchema = z.object({
  type: z
    .enum(['code', 'question', 'reject'])
    .describe(
      'Type of response: code (generated workflow), question (needs clarification), reject (infeasible request)'
    ),

  message: z
    .string()
    .describe(
      'Human-readable message: explanation for code, question text, or rejection reason'
    ),

  snippet: z
    .string()
    .optional()
    .describe(
      'Generated TypeScript code for complete workflow (only present when type is "code")'
    ),

  bubbleParameters: z
    .record(z.number(), ParsedBubbleWithInfoSchema)
    .optional()
    .describe(
      'Parsed bubble parameters from the generated workflow (only present when type is "code")'
    ),

  inputSchema: z
    .record(z.unknown())
    .optional()
    .describe(
      'Input schema for the generated workflow (only present when type is "code")'
    ),

  requiredCredentials: z
    .record(z.string(), z.array(z.nativeEnum(CredentialType)))
    .optional()
    .describe(
      'Required credentials for the bubbles in the workflow (only present when type is "code")'
    ),

  success: z.boolean().describe('Whether the operation completed successfully'),

  error: z
    .string()
    .optional()
    .describe('Error message if the operation failed'),
});

/**
 * Internal agent response format (JSON mode output from AI)
 */
export const PearlAgentOutputSchema = z.object({
  type: z.enum(['code', 'question', 'reject']),
  message: z.string(),
  snippet: z.string().optional(),
});

// Export inferred TypeScript types
export type PearlRequest = z.infer<typeof PearlRequestSchema>;
export type PearlResponse = z.infer<typeof PearlResponseSchema>;
export type PearlAgentOutput = z.infer<typeof PearlAgentOutputSchema>;
// Note: ConversationMessage type is exported from milk-tea.ts to avoid duplication
