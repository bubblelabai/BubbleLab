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
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.1-flash-lite-preview',
  // Anthropic models
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-5',
  'anthropic/claude-opus-4-6',
  'anthropic/claude-haiku-4-5',
  // OpenRouter models
  'openrouter/x-ai/grok-code-fast-1',
  'openrouter/z-ai/glm-4.6',
  'openrouter/z-ai/glm-4.7',
  'openrouter/anthropic/claude-sonnet-4.5',
  'openrouter/anthropic/claude-sonnet-4.6',
  'openrouter/anthropic/claude-opus-4.5',
  'openrouter/anthropic/claude-opus-4.6',
  'openrouter/google/gemini-3-pro-preview',
  'openrouter/morph/morph-v3-large',
  'openrouter/openai/gpt-oss-120b',
  'openrouter/openai/o3-deep-research',
  'openrouter/openai/o4-mini-deep-research',
  // Fireworks AI models
  'fireworks/accounts/fireworks/models/kimi-k2p6',
]);

export type AvailableModel = z.infer<typeof AvailableModels>;

// Recommended models by tier — Best (premium/reasoning), Flagship (strong general), Fast (fast/cheap)
export const RECOMMENDED_MODELS = {
  // Best — premium/reasoning: Pro, Opus, GPT-o
  GOOGLE_BEST: 'google/gemini-3.1-pro-preview',
  ANTHROPIC_BEST: 'anthropic/claude-opus-4-6',
  OPENAI_BEST: 'openai/gpt-5.2',
  // Flagship — strong general: Flash, Sonnet, GPT-5
  GOOGLE_FLAGSHIP: 'google/gemini-3-flash-preview',
  ANTHROPIC_FLAGSHIP: 'anthropic/claude-sonnet-4-6',
  OPENAI_FLAGSHIP: 'openai/gpt-5',
  // Fast — fast/cheap: Flash Lite, Haiku, GPT-5-mini
  GOOGLE_FAST: 'google/gemini-2.5-flash-lite',
  ANTHROPIC_FAST: 'anthropic/claude-haiku-4-5',
  OPENAI_FAST: 'openai/gpt-5-mini',
  // Provider-specific recommended pick
  KIMI: 'fireworks/accounts/fireworks/models/kimi-k2p6',
  // Special-purpose
  IMAGE: 'google/gemini-3-pro-image-preview',
  // Legacy aliases (unchanged behavior)
  FLAGSHIP: 'google/gemini-3-flash-preview',
  BEST: 'google/gemini-3-pro-preview',
  BEST_ALT: 'openai/gpt-5.2',
  PRO: 'google/gemini-3-flash-preview',
  PRO_ALT: 'anthropic/claude-sonnet-4-5',
  FAST: 'google/gemini-2.5-flash-lite',
  FAST_ALT: 'anthropic/claude-haiku-4-5',
  LITE: 'google/gemini-2.5-flash-lite',
  // Per-purpose presets — pick the right model based on tradeoff (latency
  // vs. quality). CHAT is the multi-cap master in capability-pipeline.
  CHAT: {
    FAST: 'fireworks/accounts/fireworks/models/kimi-k2p6',
    THOROUGH: 'anthropic/claude-sonnet-4-6',
  },
} as const;
