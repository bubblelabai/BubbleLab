import type { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from './bubble-factory-instance.js';
import { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  bubbleParameters: Record<number, ParsedBubbleWithInfo>;
  inputSchema: Record<string, unknown>;
  eventType: keyof BubbleTriggerEventRegistry;
}

export async function validateBubbleFlow(
  code: string
): Promise<ValidationResult> {
  try {
    const bubbleFactory = await getBubbleFactory();
    const result = await validateAndExtract(code, bubbleFactory);

    return {
      valid: result.valid,
      errors: result.errors,
      bubbleParameters: result.bubbleParameters || {},
      inputSchema: result.inputSchema || {},
      eventType: result.trigger?.type || 'webhook/http',
    };
  } catch (error) {
    return {
      valid: false,
      bubbleParameters: {},
      inputSchema: {},
      eventType: 'webhook/http',
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
