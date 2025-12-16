import { ParsedWorkflow } from '@bubblelab/shared-schemas';

export interface DisplayBubble {
  variableName: string;
  bubbleName: string;
  variableId: number;
}
/**
 * Display readable all bubbles and its clones inside a workflow
 * @param workflow
 */
export function displayBubbles(workflow: ParsedWorkflow): {
  bubbles: DisplayBubble[];
  clonedBubbles: DisplayBubble[];
} {
  const bubbles: DisplayBubble[] = [];
  const clonedBubbles: DisplayBubble[] = [];

  for (const bubble of Object.values(workflow.bubbles)) {
    if (bubble.clonedFromVariableId) {
      clonedBubbles.push({
        variableName: bubble.variableName,
        bubbleName: bubble.bubbleName,
        variableId: bubble.clonedFromVariableId,
      });
    } else {
      bubbles.push({
        variableName: bubble.variableName,
        bubbleName: bubble.bubbleName,
        // Find the cloned id from the clonedBubbles array
        variableId: bubble.variableId,
      });
    }
  }
  return {
    bubbles: bubbles,
    clonedBubbles: clonedBubbles,
  };
}
