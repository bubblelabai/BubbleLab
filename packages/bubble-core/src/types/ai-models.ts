import { z } from 'zod';

// Define available models with provider/name combinations
export const AvailableModels = z.enum([
  // OpenAI models
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-o4-mini',
  'openai/gpt-4o',
  // Google Gemini models
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash-image-preview',

  'anthropic/claude-sonnet-4-5-20250929',
]);

export type AvailableModel = z.infer<typeof AvailableModels>;
