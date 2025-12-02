import { useCallback } from 'react';
import {
  BubbleScript,
  BubbleInjector,
} from '@bubblelab/bubble-runtime/analysis';
import { BrowserBubbleFactory } from '../utils/browser-bubble-factory';
import { useBubbleFlow } from './useBubbleFlow';
import type {
  ParsedWorkflow,
  ParsedBubbleWithInfo,
  CredentialType,
} from '@bubblelab/shared-schemas';

interface UseSyncCodeOptions {
  flowId: number | null;
}

interface UseSyncCodeResult {
  syncCode: (code: string) => Promise<void>;
  isSyncing: boolean;
  error: Error | null;
}

/**
 * Hook that uses client-side BubbleScript to parse code and update useBubbleFlow cache
 * This provides instant feedback without waiting for backend validation
 */
export function useSyncCode({ flowId }: UseSyncCodeOptions): UseSyncCodeResult {
  const {
    updateWorkflow,
    updateBubbleParameters,
    updateRequiredCredentials,
    updateInputSchema,
    updateEventType,
  } = useBubbleFlow(flowId);

  const syncCode = useCallback(
    async (code: string) => {
      if (!flowId) {
        throw new Error('Flow ID is required');
      }

      try {
        // Initialize browser-safe factory
        const factory = new BrowserBubbleFactory();
        await factory.registerDefaults();

        // Parse code with BubbleScript
        const bubbleScript = new BubbleScript(code, factory as any);

        // Extract workflow
        const workflow: ParsedWorkflow = bubbleScript.getWorkflow();
        updateWorkflow(workflow);
        console.log('workflow', workflow);

        // Extract bubble parameters
        // Convert from Record<number, ParsedBubbleWithInfo> to Record<string, ParsedBubbleWithInfo>
        const parsedBubbles = bubbleScript.getParsedBubbles();
        const bubbleParameters: Record<string, ParsedBubbleWithInfo> = {};
        for (const [varId, bubble] of Object.entries(parsedBubbles)) {
          // Use bubble name as key, or variable ID as fallback
          bubbleParameters[bubble.bubbleName] = bubble;
        }
        updateBubbleParameters(bubbleParameters);

        // Extract required credentials using BubbleInjector (no need to reimplement!)
        const injector = new BubbleInjector(bubbleScript);
        const credentialsByVarId = injector.findCredentials();

        // Map credentials from variable IDs to bubble names
        const requiredCredentials: Record<string, CredentialType[]> = {};
        for (const [varIdStr, credentialTypes] of Object.entries(
          credentialsByVarId
        )) {
          const varId = Number(varIdStr);
          const bubble = parsedBubbles[varId];
          if (bubble && credentialTypes.length > 0) {
            requiredCredentials[bubble.bubbleName] = credentialTypes;
          }
        }

        if (Object.keys(requiredCredentials).length > 0) {
          updateRequiredCredentials(requiredCredentials);
        } else {
          updateRequiredCredentials({});
        }

        // Extract input schema (payload JSON schema)
        const inputSchema = bubbleScript.getPayloadJsonSchema() || {};
        updateInputSchema(inputSchema);

        // Extract trigger event type
        const trigger = bubbleScript.getBubbleTriggerEventType();
        if (trigger) {
          updateEventType(trigger.type);
        }
      } catch (error) {
        console.error('[useSyncCode] Failed to sync code:', error);
        throw error;
      }
    },
    [
      flowId,
      updateWorkflow,
      updateBubbleParameters,
      updateRequiredCredentials,
      updateInputSchema,
      updateEventType,
    ]
  );

  return {
    syncCode,
    isSyncing: false, // Could be enhanced with loading state if needed
    error: null, // Could be enhanced with error state if needed
  };
}
