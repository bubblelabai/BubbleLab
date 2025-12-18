import { z } from 'zod';

// Define available models with provider/name combinations
export const AvailableModels = z.enum([
  // OpenAI models
  'openai/gpt-5',
  'openai/gpt-5-mini',
  'openai/gpt-5.1',
  'openai/gpt-5.2',
  // Google Gemini models
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash-image-preview',
  'google/gemini-3-pro-preview',
  'google/gemini-3-pro-image-preview',
  'google/gemini-3-flash-preview',

  // Anthropic models
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-opus-4.5',
  'anthropic/claude-haiku-4-5',

  // OpenRouter models
  'openrouter/x-ai/grok-code-fast-1',
  'openrouter/z-ai/glm-4.6',
  'openrouter/anthropic/claude-sonnet-4.5',
  'openrouter/google/gemini-3-pro-preview',
  'openrouter/morph/morph-v3-large',
  'openrouter/x-ai/grok-4.1-fast',
  'openrouter/openai/gpt-oss-120b',
  'openrouter/deepseek/deepseek-chat-v3.1',
]);

export type AvailableModel = z.infer<typeof AvailableModels>;
