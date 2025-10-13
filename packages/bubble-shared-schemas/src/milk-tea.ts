import { z } from 'zod';
import { AvailableModels } from './ai-models.js';

/**
 * Conversation message schema for milk tea multi-turn conversations
 */
const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

/**
 * Request schema for Milk Tea agent
 * Milk Tea helps users configure bubble parameters through conversation
 */
export const MilkTeaRequestSchema = z.object({
  userRequest: z
    .string()
    .min(1, 'User request is required')
    .describe('The user request or question about configuring the bubble'),

  bubbleName: z
    .string()
    .min(1, 'Bubble name is required')
    .describe('The name of the bubble to configure (e.g., "email-tool")'),

  bubbleSchema: z
    .record(z.unknown())
    .describe(
      'The full schema/interface definition of the bubble including parameters and types'
    ),

  currentCode: z
    .string()
    .optional()
    .describe('The current workflow code context for validation'),

  availableCredentials: z
    .array(z.string())
    .default([])
    .describe('List of credential types available to the user'),

  userName: z.string().describe('Name of the user making the request'),

  insertLocation: z
    .string()
    .optional()
    .describe('Location in code where the snippet should be inserted'),

  conversationHistory: z
    .array(ConversationMessageSchema)
    .optional()
    .default([])
    .describe(
      'Previous conversation messages for multi-turn interactions (frontend manages state)'
    ),

  model: AvailableModels.default('google/gemini-2.5-pro').describe(
    'AI model to use for Milk Tea agent'
  ),
});

/**
 * Response schema for Milk Tea agent
 */
export const MilkTeaResponseSchema = z.object({
  type: z
    .enum(['code', 'question', 'reject'])
    .describe(
      'Type of response: code (generated snippet), question (needs clarification), reject (infeasible request)'
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
      'Generated TypeScript code snippet (only present when type is "code")'
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
export const MilkTeaAgentOutputSchema = z.object({
  type: z.enum(['code', 'question', 'reject']),
  message: z.string(),
  snippet: z.string().optional(),
});

// Export inferred TypeScript types
export type MilkTeaRequest = z.infer<typeof MilkTeaRequestSchema>;
export type MilkTeaResponse = z.infer<typeof MilkTeaResponseSchema>;
export type MilkTeaAgentOutput = z.infer<typeof MilkTeaAgentOutputSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
