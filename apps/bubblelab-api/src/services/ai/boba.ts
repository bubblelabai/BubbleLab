/**
 * Boba - BubbleFlow Code Generation Service
 *
 * A service that wraps BubbleFlowGeneratorWorkflow to generate BubbleFlow code
 * from natural language prompts with streaming support.
 */

import {
  type GenerationResult,
  CREDENTIAL_ENV_MAP,
  CredentialType,
} from '@bubblelab/shared-schemas';
import { BubbleLogger, type StreamingCallback } from '@bubblelab/bubble-core';
import { validateAndExtract } from '@bubblelab/bubble-runtime';
import { env } from 'src/config/env.js';
import { getPricingTable } from 'src/config/pricing.js';
import { getBubbleFactory } from '../bubble-factory-instance.js';
import { BubbleFlowGeneratorWorkflow } from './bubbleflow-generator.workflow.js';
export interface BobaRequest {
  prompt: string;
  credentials?: Partial<Record<CredentialType, string>>;
}

export interface BobaResponse extends GenerationResult {
  // Extends GenerationResult with any additional fields if needed
}

/**
 * Merges the extracted schema (from TypeScript) with the original schema (from summarizeAgent),
 * preserving canBeFile flags and other metadata from the original schema.
 */
function mergeInputSchemas(
  originalSchema: string | undefined,
  extractedSchema: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!extractedSchema) {
    return {};
  }

  // If no original schema, return extracted as-is
  if (!originalSchema) {
    return extractedSchema;
  }

  try {
    const original = JSON.parse(originalSchema) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };

    // If original doesn't have properties, return extracted
    if (!original.properties || typeof original.properties !== 'object') {
      return extractedSchema;
    }

    const extracted = extractedSchema as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };

    // If extracted doesn't have properties, return original
    if (!extracted.properties || typeof extracted.properties !== 'object') {
      return original;
    }

    // Merge properties, preserving canBeFile from original
    const mergedProperties: Record<string, unknown> = {
      ...extracted.properties,
    };

    for (const [key, originalProp] of Object.entries(original.properties)) {
      if (key in mergedProperties) {
        const extractedProp = mergedProperties[key] as Record<string, unknown>;
        const originalPropObj = originalProp as Record<string, unknown>;

        // Preserve canBeFile from original if it exists
        if ('canBeFile' in originalPropObj) {
          mergedProperties[key] = {
            ...extractedProp,
            canBeFile: originalPropObj.canBeFile,
          };
        }

        // Also preserve canBeFile in nested items for arrays
        if (
          originalPropObj.items &&
          typeof originalPropObj.items === 'object' &&
          extractedProp.items &&
          typeof extractedProp.items === 'object'
        ) {
          const originalItems = originalPropObj.items as Record<
            string,
            unknown
          >;
          const extractedItems = extractedProp.items as Record<string, unknown>;

          if ('canBeFile' in originalItems) {
            const currentProp = mergedProperties[key] as Record<
              string,
              unknown
            >;
            mergedProperties[key] = {
              ...currentProp,
              items: {
                ...extractedItems,
                canBeFile: originalItems.canBeFile,
              },
            };
          }

          // Handle nested properties in array items
          if (
            originalItems.properties &&
            typeof originalItems.properties === 'object' &&
            extractedItems.properties &&
            typeof extractedItems.properties === 'object'
          ) {
            const mergedItemProperties: Record<string, unknown> = {
              ...(extractedItems.properties as Record<string, unknown>),
            };

            for (const [propKey, originalNestedProp] of Object.entries(
              originalItems.properties
            )) {
              if (propKey in mergedItemProperties) {
                const originalNestedPropObj = originalNestedProp as Record<
                  string,
                  unknown
                >;
                if ('canBeFile' in originalNestedPropObj) {
                  mergedItemProperties[propKey] = {
                    ...(mergedItemProperties[propKey] as Record<
                      string,
                      unknown
                    >),
                    canBeFile: originalNestedPropObj.canBeFile,
                  };
                }
              }
            }

            const currentProp = mergedProperties[key] as Record<
              string,
              unknown
            >;
            const currentItems = (currentProp.items || {}) as Record<
              string,
              unknown
            >;
            mergedProperties[key] = {
              ...currentProp,
              items: {
                ...currentItems,
                properties: mergedItemProperties,
              },
            };
          }
        }
      }
    }

    return {
      ...extracted,
      properties: mergedProperties,
      // Use required from extracted (more accurate from TypeScript)
      required: extracted.required || original.required,
    };
  } catch (error) {
    console.warn(
      '[Boba] Failed to merge input schemas, using extracted schema:',
      error
    );
    return extractedSchema;
  }
}

/**
 * Main Boba service function - generates BubbleFlow code from natural language
 *
 * @param request - The request containing prompt and optional credentials
 * @param apiStreamingCallback - Optional callback for streaming events
 * @returns Promise<GenerationResult> - The generation result with code, validation, and metadata
 */
export async function runBoba(
  request: BobaRequest,
  apiStreamingCallback?: StreamingCallback
): Promise<GenerationResult> {
  const { prompt, credentials } = request;

  if (!env.OPENROUTER_API_KEY) {
    return {
      summary: '',
      inputsSchema: '',
      toolCalls: [],
      generatedCode: '',
      isValid: false,
      success: false,
      error: `OpenRouter API key is required to run (for apply model), please make sure the environment variable ${CREDENTIAL_ENV_MAP[CredentialType.OPENROUTER_CRED]} is set, please obtain one https://openrouter.ai/settings/keys.`,
    };
  } else if (!env.GOOGLE_API_KEY) {
    return {
      summary: '',
      inputsSchema: '',
      toolCalls: [],
      generatedCode: '',
      isValid: false,
      success: false,
      error: `Google API key is required to run (for main generation model), please make sure the environment variable ${CREDENTIAL_ENV_MAP[CredentialType.GOOGLE_GEMINI_CRED]} is set, please obtain one https://console.cloud.google.com/apis/credentials.`,
    };
  }

  // Create logger for token tracking
  const logger = new BubbleLogger('BubbleFlowGeneratorWorkflow', {
    pricingTable: getPricingTable(),
  });

  // Merge provided credentials with default Google Gemini credential
  const mergedCredentials: Partial<Record<CredentialType, string>> = {
    [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY || '',
    [CredentialType.OPENROUTER_CRED]: process.env.OPENROUTER_API_KEY || '',

    ...credentials,
  };
  const bubbleFactory = await getBubbleFactory();

  // Create BubbleFlowGeneratorWorkflow instance
  const generator = new BubbleFlowGeneratorWorkflow(
    {
      prompt,
      credentials: mergedCredentials,
      streamingCallback: apiStreamingCallback,
    },
    bubbleFactory,
    {
      logger,
    }
  );

  // Generate the code with streaming
  const result = await generator.action();

  // Validate the generated code
  let actualIsValid = result.data.isValid;
  const validationResult = await validateAndExtract(
    result.data.generatedCode,
    bubbleFactory
  );

  if (result.data.generatedCode && result.data.generatedCode.trim()) {
    try {
      // Merge the extracted schema with the original schema from summarizeAgent
      // to preserve canBeFile flags and other metadata
      const originalSchema = result.data.inputsSchema;
      const mergedSchema = mergeInputSchemas(
        originalSchema,
        validationResult.inputSchema
      );
      result.data.inputsSchema = JSON.stringify(mergedSchema);

      if (validationResult.valid && validationResult) {
        actualIsValid = true;
      } else {
        // Keep the AI's validation result if our parsing failed
        actualIsValid = result.data.isValid;
      }
    } catch (parseError) {
      console.error('[Boba] Error parsing bubble parameters:', parseError);
      // Keep the AI's validation result if our parsing failed
      actualIsValid = result.data.isValid;
    }
  }

  // Get service usage from logger execution summary
  const executionSummary = logger.getExecutionSummary();
  const serviceUsage = executionSummary.serviceUsage;

  // Build and return final generation result

  const generationResult: GenerationResult = {
    generatedCode: result.data.generatedCode,
    summary: result.data.summary,
    inputsSchema: result.data.inputsSchema,
    isValid: actualIsValid,
    success: result.success,
    error: result.error,
    toolCalls: result.data.toolCalls,
    bubbleCount: Object.keys(validationResult.bubbleParameters ?? {}).length,
    serviceUsage,
    codeLength: result.data.generatedCode.length,
    bubbleParameters: validationResult.bubbleParameters,
  };

  console.log('[Boba] Generation result:', generationResult);

  return generationResult;
}
