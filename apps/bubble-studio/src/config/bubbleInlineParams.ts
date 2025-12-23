import type { BubbleName } from '@bubblelab/shared-schemas';

/**
 * Configuration for inline parameters displayed on BubbleNode cards
 * and special handling in BubbleDetailsOverlay.
 *
 * Each entry maps a bubble name to an array of parameter configs:
 * - paramName: The parameter name as defined in the bubble schema
 * - paramPath: The path to extract the value (for nested params like model.model)
 * - isModel: If true, displays as a model dropdown in the overlay's Model section
 *            and editability is determined by whether value is a valid model
 * - inlineDisplay: How to display inline on the BubbleNode card
 *   - 'dropdown': Show as a dropdown selector (for model params)
 *   - 'preview': Show as truncated text preview (for prompts)
 *   - 'none': Don't show inline, only in overlay
 */
export interface InlineParamConfig {
  paramName: string;
  paramPath: string;
  isModel: boolean;
  inlineDisplay: 'dropdown' | 'preview' | 'none';
  label?: string; // Optional display label (defaults to paramName)
}

export type BubbleInlineParamsConfig = Partial<
  Record<BubbleName, InlineParamConfig[]>
>;

export const BUBBLE_INLINE_PARAMS: BubbleInlineParamsConfig = {
  'ai-agent': [
    {
      paramName: 'model',
      paramPath: 'model.model',
      isModel: true,
      inlineDisplay: 'dropdown',
      label: 'Model',
    },
    {
      paramName: 'systemPrompt',
      paramPath: 'systemPrompt',
      isModel: false,
      inlineDisplay: 'preview',
      label: 'System Prompt',
    },
  ],
  'research-agent-tool': [
    {
      paramName: 'model',
      paramPath: 'model',
      isModel: true,
      inlineDisplay: 'dropdown',
      label: 'Model',
    },
  ],
};

/**
 * Check if a param is configured as a model selector.
 * This is used by extractParamValue to determine editability rules.
 */
export function isModelParam(
  bubbleName: string | undefined,
  paramName: string
): { isModel: boolean; paramPath: string } | undefined {
  if (!bubbleName) return undefined;
  const configs = BUBBLE_INLINE_PARAMS[bubbleName as BubbleName];
  if (!configs) return undefined;
  const config = configs.find((c) => c.paramName === paramName && c.isModel);
  if (!config) return undefined;
  return { isModel: true, paramPath: config.paramPath };
}

/**
 * Get inline param configs for a bubble name
 */
export function getInlineParamConfigs(
  bubbleName: string | undefined
): InlineParamConfig[] {
  if (!bubbleName) return [];
  return BUBBLE_INLINE_PARAMS[bubbleName as BubbleName] ?? [];
}

/**
 * Get model param config for a bubble (if any)
 */
export function getModelParamConfig(
  bubbleName: string | undefined
): InlineParamConfig | undefined {
  const configs = getInlineParamConfigs(bubbleName);
  return configs.find((c) => c.isModel);
}

/**
 * Check if a bubble has a model param
 */
export function hasModelParam(bubbleName: string | undefined): boolean {
  return getModelParamConfig(bubbleName) !== undefined;
}

/**
 * Get params that should be excluded from the Parameters section
 * (because they're shown in the Model section or inline)
 */
export function getExcludedParamNames(
  bubbleName: string | undefined
): string[] {
  const configs = getInlineParamConfigs(bubbleName);
  // Exclude model params from the Parameters section (they have their own section)
  return configs.filter((c) => c.isModel).map((c) => c.paramName);
}
