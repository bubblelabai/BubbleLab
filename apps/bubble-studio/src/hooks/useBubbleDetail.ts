import { useQueryClient } from '@tanstack/react-query';
import type {
  BubbleFlowDetailsResponse,
  StreamingLogEvent,
  ParsedWorkflow,
} from '@bubblelab/shared-schemas';
import { findBubbleByVariableId, type BubbleInfo } from '../utils/bubbleUtils';

/**
 * Utility hook that provides methods to access bubble details without causing re-renders
 * Uses getQueryData instead of subscribing to query changes
 */
export function useBubbleDetail(flowId: number | null) {
  const queryClient = useQueryClient();

  /**
   * Get the current flow data from cache
   */
  function getFlowData(): BubbleFlowDetailsResponse | undefined {
    if (!flowId) return undefined;
    return queryClient.getQueryData<BubbleFlowDetailsResponse>([
      'bubbleFlow',
      flowId,
    ]);
  }

  /**
   * Get bubble parameters from the cached flow data
   */
  function getBubbleParameters(): Record<string | number, unknown> {
    const flowData = getFlowData();
    return flowData?.bubbleParameters || {};
  }

  /**
   * Get variable name for display
   * Uses bubble parameters as authoritative source with fallbacks
   */
  function getVariableNameForDisplay(
    variableId: number | string,
    events?: StreamingLogEvent[]
  ): string {
    const bubbleParameters = getBubbleParameters();
    const varIdNum =
      typeof variableId === 'string' ? Number(variableId) : variableId;

    // Try to find in bubble parameters first
    const bubble = findBubbleByVariableId(bubbleParameters, varIdNum);
    if (bubble?.variableName) {
      return bubble.variableName;
    }

    // Fallback to events if provided
    if (events) {
      const event = events.find(
        (e) =>
          e.variableId === varIdNum ||
          (e.additionalData as { variableId?: number })?.variableId === varIdNum
      );
      if (event?.bubbleName) {
        return event.bubbleName;
      }
    }

    // Final fallback
    return String(variableId);
  }

  /**
   * Get parameters for a specific variable
   */
  function getVariableParameters(
    variableId: number
  ): BubbleInfo['parameters'] | null {
    const bubbleParameters = getBubbleParameters();
    const bubble = findBubbleByVariableId(bubbleParameters, variableId);
    return bubble?.parameters || null;
  }

  /**
   * Get bubble info for a specific variable
   */
  function getBubbleInfo(variableId: number): BubbleInfo | null {
    const bubbleParameters = getBubbleParameters();
    return findBubbleByVariableId(bubbleParameters, variableId);
  }

  /**
   * Get required inputs from input schema
   */
  function getRequiredInputs(): string[] {
    const flowData = getFlowData();
    const inputSchema = flowData?.inputSchema as
      | { properties?: Record<string, unknown>; required?: string[] }
      | undefined;
    return inputSchema?.required || [];
  }

  /**
   * Get input schema
   */
  function getInputSchema(): Record<string, unknown> | undefined {
    const flowData = getFlowData();
    return flowData?.inputSchema as Record<string, unknown> | undefined;
  }

  /**
   * Get workflow structure from the cached flow data
   */
  function getWorkflow(): ParsedWorkflow | undefined {
    const flowData = getFlowData();
    return flowData?.workflow;
  }

  /**
   * Build a lookup map of variableId -> variableName
   */
  function getVariableNameMap(): Map<number, string> {
    const bubbleParameters = getBubbleParameters();
    const map = new Map<number, string>();

    for (const [, bubbleData] of Object.entries(bubbleParameters)) {
      if (bubbleData && typeof bubbleData === 'object') {
        const bubble = bubbleData as Partial<BubbleInfo>;
        if (bubble.variableId !== undefined && bubble.variableName) {
          map.set(bubble.variableId, bubble.variableName);
        }
      }
    }

    return map;
  }

  /**
   * Build a lookup map of variableId -> parameters
   */
  function getVariableParametersMap(): Map<number, BubbleInfo['parameters']> {
    const bubbleParameters = getBubbleParameters();
    const map = new Map<number, BubbleInfo['parameters']>();

    for (const [, bubbleData] of Object.entries(bubbleParameters)) {
      if (bubbleData && typeof bubbleData === 'object') {
        const bubble = bubbleData as Partial<BubbleInfo>;
        if (bubble.variableId !== undefined && bubble.parameters) {
          map.set(bubble.variableId, bubble.parameters);
        }
      }
    }

    return map;
  }

  return {
    getFlowData,
    getBubbleParameters,
    getWorkflow,
    getVariableNameForDisplay,
    getVariableParameters,
    getBubbleInfo,
    getRequiredInputs,
    getInputSchema,
    getVariableNameMap,
    getVariableParametersMap,
  };
}
