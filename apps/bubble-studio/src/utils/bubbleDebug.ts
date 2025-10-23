/**
 * Clear, readable debugging utilities for bubble positions and view state
 */

export interface BubbleDebugInfo {
  flowId: number | null;
  bubbleCount: number;
  bubbleKeys: string[];
  bubblePositions: Record<string, { x: number; y: number }>;
  viewState: {
    isExecuting: boolean;
    isValidating: boolean;
    highlightedBubble: string | null;
    bubbleWithError: string | null;
    lastExecutingBubble: string | null;
    completedBubbles: string[];
  };
  cacheState: {
    hasFlowData: boolean;
    hasBubbleParameters: boolean;
    bubbleParametersKeys: string[];
  };
}

export function logBubbleDebugInfo(
  flowId: number | null,
  bubbleParameters: Record<string, any>,
  executionState: any,
  currentFlow: any,
  flowNodes?: any[] // Add flowNodes parameter to get actual positions
): BubbleDebugInfo {
  const bubbleKeys = Object.keys(bubbleParameters);
  const bubbleCount = bubbleKeys.length;

  // Extract bubble positions from ReactFlow nodes (not bubble data)
  const bubblePositions: Record<string, { x: number; y: number }> = {};

  if (flowNodes && Array.isArray(flowNodes)) {
    // Debug: Log flowNodes structure
    console.log('🔍 FlowNodes structure:', {
      count: flowNodes.length,
      nodes: flowNodes.map((node) => ({
        id: node.id,
        hasPosition: !!node.position,
        position: node.position,
        type: node.type,
      })),
    });

    // Get positions from ReactFlow nodes
    flowNodes.forEach((node) => {
      if (node.id && node.position) {
        bubblePositions[node.id] = {
          x: node.position.x,
          y: node.position.y,
        };
      }
    });
  } else {
    // Fallback: try to get positions from bubble data (though they're not stored there)
    bubbleKeys.forEach((key) => {
      const bubble = bubbleParameters[key];
      if (bubble?.position) {
        bubblePositions[key] = {
          x: bubble.position.x || 0,
          y: bubble.position.y || 0,
        };
      }
    });
  }

  const debugInfo: BubbleDebugInfo = {
    flowId,
    bubbleCount,
    bubbleKeys,
    bubblePositions,
    viewState: {
      isExecuting: executionState?.isRunning || false,
      isValidating: executionState?.isValidating || false,
      highlightedBubble: executionState?.highlightedBubble || null,
      bubbleWithError: executionState?.bubbleWithError || null,
      lastExecutingBubble: executionState?.lastExecutingBubble || null,
      completedBubbles: Object.keys(executionState?.completedBubbles || {}),
    },
    cacheState: {
      hasFlowData: !!currentFlow?.data,
      hasBubbleParameters: !!currentFlow?.data?.bubbleParameters,
      bubbleParametersKeys: Object.keys(
        currentFlow?.data?.bubbleParameters || {}
      ),
    },
  };

  // Clear, readable console output
  console.group('🔍 BUBBLE DEBUG INFO');
  console.log('📍 Flow ID:', flowId);
  console.log('📊 Bubble Count:', bubbleCount);
  console.log('🔑 Bubble Keys:', bubbleKeys);

  if (bubbleCount > 0) {
    console.log('📍 Bubble Positions:');
    bubbleKeys.forEach((key) => {
      const pos = bubblePositions[key];
      if (pos) {
        console.log(`  ${key}: (${pos.x}, ${pos.y})`);
      } else {
        console.log(`  ${key}: No position data`);
      }
    });
  }

  console.log('🎯 View State:');
  console.log('  Executing:', debugInfo.viewState.isExecuting);
  console.log('  Validating:', debugInfo.viewState.isValidating);
  console.log('  Highlighted:', debugInfo.viewState.highlightedBubble);
  console.log('  With Error:', debugInfo.viewState.bubbleWithError);
  console.log('  Last Executing:', debugInfo.viewState.lastExecutingBubble);
  console.log('  Completed:', debugInfo.viewState.completedBubbles);

  console.log('💾 Cache State:');
  console.log('  Has Flow Data:', debugInfo.cacheState.hasFlowData);
  console.log(
    '  Has Bubble Parameters:',
    debugInfo.cacheState.hasBubbleParameters
  );
  console.log('  Cache Keys:', debugInfo.cacheState.bubbleParametersKeys);

  console.groupEnd();

  return debugInfo;
}

export function logBubbleDisappearance(
  before: BubbleDebugInfo,
  after: BubbleDebugInfo,
  reason?: string
) {
  console.group('🚨 BUBBLE DISAPPEARANCE DETECTED');
  console.log('Reason:', reason || 'Unknown');
  console.log('Before:', before.bubbleCount, 'bubbles');
  console.log('After:', after.bubbleCount, 'bubbles');

  if (before.bubbleCount > after.bubbleCount) {
    const lostBubbles = before.bubbleKeys.filter(
      (key) => !after.bubbleKeys.includes(key)
    );
    console.log('Lost bubbles:', lostBubbles);
  }

  console.log(
    'Cache changed:',
    before.cacheState.hasBubbleParameters !==
      after.cacheState.hasBubbleParameters
  );

  console.groupEnd();
}
