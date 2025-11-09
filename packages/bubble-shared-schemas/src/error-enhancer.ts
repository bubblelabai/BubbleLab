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
      `\nBubbleLogger.error() method signature:\n` +
      `- this.logger?.error(message: string, error?: BubbleError, metadata?: Partial<LogMetadata>)\n` +
      `\nIMPORTANT: The second parameter must be a BubbleError instance, NOT a string!\n` +
      `\n❌ INCORRECT: this.logger?.error("msg1", "msg2")\n` +
      `❌ INCORRECT: this.logger?.error(msg1, msg2) // where msg2 is a string\n` +
      `\n✅ CORRECT: this.logger?.error("Error message")\n` +
      `✅ CORRECT: this.logger?.error("Error message", bubbleError)\n` +
      `✅ CORRECT: this.logger?.error("Error message", bubbleError, { variableId: 1 })\n` +
      `\nBubbleError minimal interface:\n` +
      `- message: string (from Error)\n` +
      `- variableId?: number\n` +
      `- bubbleName?: string\n` +
      `\nCreating a BubbleError:\n` +
      `- new BubbleError("Error message", { variableId?: number, bubbleName?: string })\n` +
      `- new BubbleValidationError("Validation failed", { variableId?: number, bubbleName?: string, validationErrors?: string[] })\n` +
      `- new BubbleExecutionError("Execution failed", { variableId?: number, bubbleName?: string, executionPhase?: 'instantiation' | 'execution' | 'validation' })\n` +
      `\nLogMetadata minimal interface (for metadata parameter):\n` +
      `- variableId?: number\n` +
      `- bubbleName?: string\n` +
      `- lineNumber?: number\n` +
      `- additionalData?: Record<string, unknown>\n` +
      `\nExample usage:\n` +
      `- this.logger?.error("Bubble execution failed", new BubbleError("Details", { variableId: 1, bubbleName: "MyBubble" }))\n` +
      `- this.logger?.error("Error occurred", undefined, { variableId: 1, additionalData: { custom: "data" } })`;
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
