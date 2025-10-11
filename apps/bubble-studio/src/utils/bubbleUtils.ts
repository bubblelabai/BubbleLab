/**
 * Utility functions for working with bubble data and React Flow state
 */
import type { DependencyGraphNode } from '@bubblelab/shared-schemas';

export interface BubbleLocation {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface BubbleInfo {
  variableId: number;
  variableName: string;
  bubbleName: string;
  className: string;
  location: BubbleLocation;
  parameters: Array<{
    variableId?: number;
    name: string;
    value: unknown;
    type: string;
  }>;
}

interface ExtendedBubbleInfo extends BubbleInfo {
  dependencyGraph?: DependencyGraphNode;
}

/**
 * Recursively search through dependency graph for a specific variableId
 */
function findInDependencyGraph(
  node: DependencyGraphNode,
  targetVariableId: number,
  parentBubble: ExtendedBubbleInfo
): BubbleInfo | null {
  // Check if this node matches the target
  if (node.variableId === targetVariableId) {
    return {
      variableId: node.variableId,
      variableName: node.name,
      bubbleName: node.name,
      className: `${node.name}Bubble`,
      location: parentBubble.location, // Use parent bubble's location as fallback
      parameters: [],
    };
  }

  // Recursively search in dependencies
  for (const dependency of node.dependencies) {
    const found = findInDependencyGraph(
      dependency,
      targetVariableId,
      parentBubble
    );
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Find bubble information by variableId from the bubble parameters
 * Now also searches through dependency graphs for sub-bubbles
 */
export function findBubbleByVariableId(
  bubbleParameters: Record<string | number, unknown>,
  variableId: number
): BubbleInfo | null {
  // First try to find by direct key match
  const directMatch = bubbleParameters[variableId];
  if (directMatch && typeof directMatch === 'object') {
    const bubble = directMatch as Partial<BubbleInfo>;
    if (bubble.variableId === variableId) {
      return bubble as BubbleInfo;
    }
  }

  // Search through all bubble parameters
  for (const [, bubbleData] of Object.entries(bubbleParameters)) {
    if (bubbleData && typeof bubbleData === 'object') {
      const bubble = bubbleData as Partial<ExtendedBubbleInfo>;

      // Check if this main bubble matches
      if (bubble.variableId === variableId) {
        return bubble as BubbleInfo;
      }

      // Search through dependency graph if it exists
      if (bubble.dependencyGraph) {
        const foundInDeps = findInDependencyGraph(
          bubble.dependencyGraph,
          variableId,
          bubble as ExtendedBubbleInfo
        );
        if (foundInDeps) {
          return foundInDeps;
        }
      }
    }
  }

  return null;
}

/**
 * Get the line range for a bubble (start and end lines)
 */
export function getBubbleLineRange(bubble: BubbleInfo): {
  startLine: number;
  endLine: number;
} {
  return {
    startLine: bubble.location.startLine,
    endLine: bubble.location.endLine,
  };
}

/**
 * Check if a line number is within a bubble's range
 */
export function isLineInBubbleRange(
  lineNumber: number,
  bubble: BubbleInfo
): boolean {
  return (
    lineNumber >= bubble.location.startLine &&
    lineNumber <= bubble.location.endLine
  );
}
