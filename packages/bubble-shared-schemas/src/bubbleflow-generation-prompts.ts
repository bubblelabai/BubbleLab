/**
 * Recommended AI models for BubbleFlow code generation
 * This file is kept in shared-schemas for backwards compatibility
 * The full prompts have been moved to apps/bubblelab-api/src/config/bubbleflow-generation-prompts.ts
 */

import { AvailableModel } from './ai-models.js';

// Model constants for AI agent instructions
export const RECOMMENDED_MODELS = {
  BEST: 'google/gemini-2.5-flash',
  BEST_ALT: 'openai/gpt-5.2',
  PRO: 'google/gemini-2.5-flash',
  PRO_ALT: 'anthropic/claude-sonnet-4-5',
  FAST: 'google/gemini-2.5-flash',
  FAST_ALT: 'anthropic/claude-haiku-4-5',
  LITE: 'google/gemini-2.5-flash-lite',
  IMAGE: 'google/gemini-3-pro-image-preview',
} as Record<string, AvailableModel>;
