import type {
  ParsedBubbleWithInfo,
  CredentialType,
  BubbleTrigger,
  ParsedWorkflow,
} from '@bubblelab/shared-schemas';
import { validateScript } from './BubbleValidator.js';
import { BubbleScript } from '../parse/BubbleScript.js';
import { BubbleInjector } from '../injection/BubbleInjector.js';
import { BubbleFactory } from '@bubblelab/bubble-core';
import { validateCronExpression } from '@bubblelab/shared-schemas';
import { defaultLintRuleRegistry } from './lint-rules.js';
import ts from 'typescript';

export interface ValidationResult {
  valid: boolean;
  errors?: string[]; // All errors combined (backward compatible)
  syntaxErrors?: string[]; // Syntax, structural, and bubble usage errors (excludes lint errors)
  lintErrors?: string[]; // Lint rule errors only
}

export interface ValidationAndExtractionResult extends ValidationResult {
  bubbleParameters?: Record<number, ParsedBubbleWithInfo>;
  workflow?: ParsedWorkflow;
  inputSchema?: Record<string, unknown>;
  trigger?: BubbleTrigger;
  requiredCredentials?: Record<string, CredentialType[]>;
}

/**
 * Validates a BubbleFlow TypeScript code
 * This focuses purely on validation without extraction
 *
 * @param code - The TypeScript code to validate
 * @returns ValidationResult with success status and errors
 */
export async function validateBubbleFlow(
  code: string,
  requireLintErrors: boolean = true
): Promise<ValidationResult> {
  const syntaxErrors: string[] = [];
  const lintErrors: string[] = [];

  try {
    // Step 1: Basic syntax and structure validation
    const validationResult = validateScript(code);
    if (!validationResult.success) {
      if (validationResult.errors) {
        const scriptErrors = Object.entries(validationResult.errors).map(
          ([lineNumber, errorMessage]) => `line ${lineNumber}: ${errorMessage}`
        );
        syntaxErrors.push(...scriptErrors);
      }
    }

    // Step 2: Validate BubbleFlow class requirements
    const structuralErrors = validateBubbleFlowStructure(code);
    syntaxErrors.push(...structuralErrors);

    // Step 3: Validate bubble usage (only registered bubbles)
    const bubbleErrors = validateBubbleUsage(code);
    syntaxErrors.push(...bubbleErrors);

    // Step 4: Run lint rules
    try {
      const sourceFile = ts.createSourceFile(
        'bubbleflow.ts',
        code,
        ts.ScriptTarget.Latest,
        true
      );
      const lintRuleErrors = defaultLintRuleRegistry.validateAll(sourceFile);
      const lintErrorMessages = lintRuleErrors.map(
        (err) => `line ${err.line}: ${err.message}`
      );
      console.log('Lint error messages:', lintErrorMessages);
      lintErrors.push(...lintErrorMessages);
    } catch (error) {
      // If lint rule execution fails, log but don't fail validation
      console.error('Error running lint rules:', error);
    }

    // Combine all errors for backward compatibility
    const allErrors = requireLintErrors
      ? [...syntaxErrors, ...lintErrors]
      : syntaxErrors;

    return {
      valid: allErrors.length === 0,
      errors: allErrors.length > 0 ? allErrors : undefined,
      syntaxErrors: syntaxErrors.length > 0 ? syntaxErrors : undefined,
      lintErrors: lintErrors.length > 0 ? lintErrors : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown validation error';
    return {
      valid: false,
      errors: [errorMessage],
      syntaxErrors: [errorMessage],
    };
  }
}

/**
 * Validates a BubbleFlow TypeScript code and extracts bubble parameters
 * This is the main entry point for bubble runtime validation with extraction
 *
 * @param code - The TypeScript code to validate
 * @returns ValidationAndExtractionResult with success status, errors, and extracted parameters
 */
export async function validateAndExtract(
  code: string,
  bubbleFactory: BubbleFactory,
  requireLintErrors: boolean = true
): Promise<ValidationAndExtractionResult> {
  // First validate the code
  const validationResult = await validateBubbleFlow(code, requireLintErrors);

  // If validation fails, return early
  if (!validationResult.valid) {
    return validationResult;
  }

  // After script validation passes, extract bubble parameters and validate trigger event
  try {
    const script = new BubbleScript(code, bubbleFactory);

    // Step 4: Validate trigger event
    const triggerEventErrors = validateTriggerEvent(script);
    if (triggerEventErrors.length > 0) {
      return {
        valid: false,
        errors: triggerEventErrors,
      };
    }
    const bubbleParameters = script.getParsedBubbles();

    // Extract required credentials from bubble parameters
    const requiredCredentials: Record<string, CredentialType[]> = {};

    const injector = new BubbleInjector(script);
    const credentials = injector.findCredentials();

    for (const [varId, credentialTypes] of Object.entries(credentials)) {
      const bubble = bubbleParameters[Number(varId)];
      if (bubble && credentialTypes.length > 0) {
        requiredCredentials[bubble.bubbleName] = credentialTypes;
      }
    }

    return {
      ...validationResult,
      bubbleParameters,
      workflow: script.getWorkflow(),
      inputSchema: script.getPayloadJsonSchema() || {},
      trigger: script.getBubbleTriggerEventType() || undefined,
      requiredCredentials:
        Object.keys(requiredCredentials).length > 0
          ? requiredCredentials
          : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Extraction failed';
    return {
      valid: false,
      errors: [errorMessage],
    };
  }
}

function validateTriggerEvent(bubbleScript: BubbleScript): string[] {
  const errors: string[] = [];

  const triggerEvent = bubbleScript.getBubbleTriggerEventType();
  if (!triggerEvent) {
    errors.push('Missing trigger event');
  }
  if (triggerEvent?.type === 'schedule/cron') {
    if (!triggerEvent.cronSchedule) {
      errors.push(
        "Missing cron schedule, please define it with the readonly cronSchedule property inside the BubbleFlow class. Ex. readonly cronSchedule = '0 0 * * *';"
      );
    }
    if (!validateCronExpression(triggerEvent.cronSchedule!).valid) {
      errors.push(
        "Invalid cron schedule, please define it with the readonly cronSchedule property inside the BubbleFlow class. Ex. readonly cronSchedule = '0 0 * * *';"
      );
    }
  }

  return errors;
}

/**
 * Validates BubbleFlow class structure requirements
 */
function validateBubbleFlowStructure(code: string): string[] {
  const errors: string[] = [];

  // Check for BubbleFlow import
  if (
    !code.includes("from '@bubblelab/bubble-core'") &&
    !code.includes('from "@bubblelab/bubble-core"')
  ) {
    errors.push('Missing BubbleFlow import from @bubblelab/bubble-core');
  }

  // Check for class that extends BubbleFlow
  const bubbleFlowClassRegex = /class\s+(\w+)\s+extends\s+BubbleFlow/;
  const bubbleFlowMatch = bubbleFlowClassRegex.exec(code);

  if (!bubbleFlowMatch) {
    errors.push('Code must contain a class that extends BubbleFlow');
    return errors;
  }

  const className = bubbleFlowMatch[1];

  // Check for handle method in the BubbleFlow class
  const handleMethodRegex = new RegExp(
    `class\\s+${className}\\s+extends\\s+BubbleFlow[\\s\\S]*?async\\s+handle\\s*\\(`,
    's'
  );

  if (!handleMethodRegex.test(code)) {
    // Align with test that looks for abstract member implementation errors
    errors.push('does not implement inherited abstract member');
  }

  // Check for export
  if (!code.includes(`export class ${className}`)) {
    errors.push(`Class ${className} must be exported`);
  }

  return errors;
}

/**
 * Validates that only registered bubbles are used
 */
function validateBubbleUsage(code: string): string[] {
  const errors: string[] = [];

  // Extract imported bubble types
  const importRegex = /import\s*{([^}]+)}\s*from\s*['"]@nodex\/bubble-core['"]/;
  const importMatch = importRegex.exec(code);

  if (!importMatch) {
    return errors; // No bubble imports found, which is fine
  }

  const importedBubbles = importMatch[1]
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.endsWith('Bubble'))
    .map((item) => item.replace(/\s+as\s+\w+/, '')) // Remove aliases
    .filter((item) => item !== 'BubbleFlow');

  // Find all bubble instantiations
  const bubbleInstantiationRegex = /new\s+(\w+Bubble)\s*\(/g;
  let match;

  while ((match = bubbleInstantiationRegex.exec(code)) !== null) {
    const bubbleClass = match[1];
    if (!importedBubbles.includes(bubbleClass)) {
      errors.push(
        `Unregistered bubble class: ${bubbleClass}. All bubble classes must be imported from @bubblelab/bubble-core`
      );
    }
  }

  return errors;
}
