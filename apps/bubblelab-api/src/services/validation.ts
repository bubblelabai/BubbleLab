import type { ParsedBubbleWithInfo } from '@bubblelab/shared-schemas';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { getBubbleFactory } from './bubble-factory-instance.js';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  bubbleParameters: Record<number, ParsedBubbleWithInfo>;
  inputSchema: Record<string, unknown>;
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
    };
  } catch (error) {
    return {
      valid: false,
      bubbleParameters: {},
      inputSchema: {},
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
