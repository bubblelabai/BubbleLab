import { BUBBLE_TRIGGER_EVENTS } from './trigger.js';

/**
 * Enhances TypeScript error messages with helpful hints about available options
 * for BubbleTriggerEventRegistry, BubbleError, and LogMetadata
 */
export function enhanceErrorMessage(errorMessage: string): string {
  let enhanced = errorMessage;

  // Pattern 1: BubbleTriggerEventRegistry errors
  // Matches: "Type 'X' does not satisfy the constraint 'keyof BubbleTriggerEventRegistry'"
  const triggerRegistryPattern =
    /does not satisfy the constraint 'keyof BubbleTriggerEventRegistry'/;
  if (triggerRegistryPattern.test(enhanced)) {
    const availableKeys = Object.keys(BUBBLE_TRIGGER_EVENTS);
    const hint = `\nAvailable trigger event types: ${availableKeys.map((k) => `'${k}'`).join(', ')}`;
    enhanced = enhanced + hint;
  }

  // Pattern 2: Generic "keyof BubbleTriggerEventRegistry" constraint errors
  // Matches: "Type 'X' does not satisfy the constraint 'keyof BubbleTriggerEventRegistry'"
  const keyofTriggerPattern =
    /Type '([^']+)' does not satisfy the constraint 'keyof BubbleTriggerEventRegistry'/;
  if (
    keyofTriggerPattern.test(enhanced) &&
    !enhanced.includes('Available trigger event types')
  ) {
    const availableKeys = Object.keys(BUBBLE_TRIGGER_EVENTS);
    const hint = `\nAvailable trigger event types: ${availableKeys.map((k) => `'${k}'`).join(', ')}`;
    enhanced = enhanced + hint;
  }

  // Pattern 3: BubbleError type errors
  // Matches whenever "BubbleError" appears in the error message
  const bubbleErrorPattern = /BubbleError/;
  if (bubbleErrorPattern.test(enhanced)) {
    const hint =
      `\nBubbleError is a class with the following properties:\n` +
      `- message: string (required, from Error)\n` +
      `- variableId?: number (optional)\n` +
      `- bubbleName?: string (optional)\n` +
      `- cause?: Error (optional)\n` +
      `Use: new BubbleError(message, { variableId?, bubbleName?, cause? })`;
    enhanced = enhanced + hint;
  }

  // Pattern 4: LogMetadata property errors
  // Matches: "'X' does not exist in type 'LogMetadata'" or "'X' does not exist in type 'Partial<LogMetadata>'"
  // We only allow additional data to be part of AI agent's context for simplicity
  const logMetadataPropertyPattern =
    /'(\w+)' does not exist in type '(?:Partial<)?LogMetadata(?:>)?'/;
  const logMetadataMatch = enhanced.match(logMetadataPropertyPattern);
  if (logMetadataMatch) {
    const [, propertyName] = logMetadataMatch;
    const hint =
      `\nLogMetadata does not support '${propertyName}'. Available properties:\n` +
      `- additionalData?: Record<string, unknown>`;
    enhanced = enhanced + hint;
  }

  // Pattern 5: LogMetadata type assignment errors
  // Matches whenever "LogMetadata" appears in the error message
  const logMetadataTypePattern = /LogMetadata/;
  if (
    logMetadataTypePattern.test(enhanced) &&
    !enhanced.includes('Available properties:')
  ) {
    const hint =
      `\nLogMetadata interface properties:\n` +
      `- additionalData?: Record<string, unknown> (optional)\n` +
      `\nTo add custom data, use the additionalData property.`;
    enhanced = enhanced + hint;
  }

  // Pattern 6: Module has no exported member errors
  // Matches: "Module 'X' has no exported member 'Y'"
  const noExportedMemberPattern =
    /Module '([^']+)' has no exported member '(\w+)'/;
  const noExportedMemberMatch = enhanced.match(noExportedMemberPattern);
  if (noExportedMemberMatch) {
    const [, moduleName, memberName] = noExportedMemberMatch;
    const hint =
      `\n'${memberName}' is not exported from '${moduleName}'. ` +
      `Please remove it from your import statement or check the module's exports for the correct name.`;
    enhanced = enhanced + hint;
  }

  return enhanced;
}
