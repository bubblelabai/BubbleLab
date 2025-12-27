import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import type { CredentialType } from '@bubblelab/shared-schemas';
import type { BubbleFlowDetailsResponse } from '@bubblelab/shared-schemas';
import { getExecutionStore } from '../stores/executionStore';

export interface ValidationResult {
  isValid: boolean;
  reasons: string[];
  bubbleVariableId?: string;
}

/**
 * Validates that all required input fields are provided
 */
export function validateInputs(
  flowId: number | null,
  currentFlow: BubbleFlowDetailsResponse | undefined,
  executionInputs?: Record<string, unknown>
): ValidationResult {
  if (!flowId) {
    return { isValid: false, reasons: ['No flow selected'] };
  }
  const reasons: string[] = [];

  if (!currentFlow) {
    reasons.push('No flow selected');
    return { isValid: false, reasons };
  }

  try {
    let schema = currentFlow.inputSchema;
    if (typeof schema === 'string') {
      schema = JSON.parse(schema);
    }
    const requiredFields: string[] = Array.isArray(schema?.required)
      ? schema.required
      : [];

    const inputs = executionInputs ?? getExecutionStore(flowId).executionInputs;

    requiredFields.forEach((fieldName: string) => {
      if (inputs[fieldName] === undefined || inputs[fieldName] === '') {
        reasons.push(`Missing required input: ${fieldName}`);
      }
    });
  } catch {
    // If schema parsing fails, assume valid
    return { isValid: true, reasons: [] };
  }

  return { isValid: reasons.length === 0, reasons };
}

/**
 * Validates that all required credentials are configured
 */
export function validateCredentials(
  flowId: number | null,
  currentFlow: BubbleFlowDetailsResponse | undefined,
  pendingCredentials?: Record<string, Record<string, number>>
): ValidationResult {
  const reasons: string[] = [];
  let bubbleVariableId: string | undefined = undefined;

  if (!currentFlow || !flowId) {
    reasons.push('No flow selected');
    return { isValid: false, reasons };
  }

  const required = currentFlow.requiredCredentials || {};
  const requiredEntries = Object.entries(required) as Array<[string, string[]]>;

  const credentials =
    pendingCredentials ?? getExecutionStore(flowId).pendingCredentials;

  for (const [bubbleKey, credTypes] of requiredEntries) {
    for (const credType of credTypes) {
      if (SYSTEM_CREDENTIALS.has(credType as CredentialType)) continue;

      const selectedForBubble = credentials[bubbleKey] || {};
      const selectedId = selectedForBubble[credType];

      if (selectedId === undefined || selectedId === null) {
        reasons.push(`Missing credential for ${bubbleKey}: ${credType}`);

        // Capture the first bubble with missing credentials for navigation
        if (!bubbleVariableId) {
          bubbleVariableId = bubbleKey;
        }
      }
    }
  }

  return { isValid: reasons.length === 0, reasons, bubbleVariableId };
}

/**
 * Validates both inputs and credentials for a flow
 */
export function validateFlow(
  flowId: number | null,
  currentFlow: BubbleFlowDetailsResponse | undefined,
  options?: {
    executionInputs?: Record<string, unknown>;
    pendingCredentials?: Record<string, Record<string, number>>;
    checkRunning?: boolean;
    checkValidating?: boolean;
  }
): ValidationResult {
  if (!flowId) {
    return { isValid: false, reasons: ['No flow selected'] };
  }

  const reasons: string[] = [];

  if (!currentFlow) {
    reasons.push('No flow selected');
    return { isValid: false, reasons };
  }

  if (options?.checkRunning && getExecutionStore(flowId).isRunning) {
    reasons.push('Already executing');
  }

  if (options?.checkValidating && getExecutionStore(flowId).isValidating) {
    reasons.push('Currently validating');
  }

  const inputValidation = validateInputs(
    flowId,
    currentFlow,
    options?.executionInputs
  );
  if (!inputValidation.isValid) {
    reasons.push(...inputValidation.reasons);
  }

  const credentialValidation = validateCredentials(
    flowId,
    currentFlow,
    options?.pendingCredentials
  );
  if (!credentialValidation.isValid) {
    reasons.push(...credentialValidation.reasons);
  }

  return { isValid: reasons.length === 0, reasons };
}
