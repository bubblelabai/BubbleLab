# Flow Visualizer - Node and Edge Generation Architecture

This document provides a detailed analysis of how the FlowVisualizer component generates and positions nodes and edges using React Flow.

## Table of Contents

1. [Overview](#overview)
2. [Node Types](#node-types)
3. [Layout Modes](#layout-modes)
4. [Node Generation](#node-generation)
5. [Edge Generation](#edge-generation)
6. [Positioning System](#positioning-system)
7. [Data Flow Example](#data-flow-example)

---

## Overview

The FlowVisualizer transforms a `ParsedWorkflow` and `bubbleParameters` into a visual graph using React Flow. The system supports two layout modes:

1. **Sequential (Horizontal)** - Fallback layout when workflow is missing or simple
2. **Hierarchical (Step-Based)** - Main layout for structured workflows with functions

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Flow Visualizer Pipeline                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ParsedWorkflow + BubbleParameters                                      │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────┐                                                │
│   │  extractStepGraph() │  workflowToSteps.ts                            │
│   └──────────┬──────────┘                                                │
│              │                                                           │
│              ▼                                                           │
│      StepGraph { steps[], edges[] }                                      │
│              │                                                           │
│              ▼                                                           │
│   ┌─────────────────────────────────┐                                    │
│   │   initialNodesAndEdges()        │  FlowVisualizer.tsx                │
│   │   - Sequential or Hierarchical  │                                    │
│   │   - Calculate positions         │                                    │
│   │   - Mark handle usage           │                                    │
│   └──────────┬──────────────────────┘                                    │
│              │                                                           │
│              ▼                                                           │
│      React Flow Nodes[] + Edges[]                                        │
│              │                                                           │
│              ▼                                                           │
│        <ReactFlow />                                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Node Types

The system uses 5 custom node types registered in `nodeTypes`:

```typescript
const nodeTypes = {
  bubbleNode: BubbleNode, // Tool/action execution unit
  inputSchemaNode: InputSchemaNode, // Flow input form
  cronScheduleNode: CronScheduleNode, // Cron schedule trigger
  stepContainerNode: StepContainerNode, // Function container (groups bubbles)
  transformationNode: TransformationNode, // Pure data transformation
};
```

### Node Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Node Relationships                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Entry Nodes (triggers):                                              │
│   ┌─────────────────────┐    ┌─────────────────────┐                   │
│   │  InputSchemaNode    │    │  CronScheduleNode   │                   │
│   │  (manual trigger)   │    │  (scheduled trigger)│                   │
│   └─────────────────────┘    └─────────────────────┘                   │
│             │                          │                               │
│             └──────────┬───────────────┘                               │
│                        ▼                                               │
│   Step/Function Nodes:                                                 │
│   ┌─────────────────────────────────────────────────┐                  │
│   │           StepContainerNode                     │                  │
│   │  ┌──────────────────────────────────────────┐   │                  │
│   │  │ Header: functionName(), description      │   │                  │
│   │  ├──────────────────────────────────────────┤   │                  │
│   │  │                                          │   │                  │
│   │  │   ┌──────────────┐  (child node)         │   │                  │
│   │  │   │  BubbleNode  │  parentId: step.id    │   │                  │
│   │  │   └──────────────┘                       │   │                  │
│   │  │          │                               │   │                  │
│   │  │   ┌──────────────┐                       │   │                  │
│   │  │   │  BubbleNode  │                       │   │                  │
│   │  │   └──────────────┘                       │   │                  │
│   │  │                                          │   │                  │
│   │  └──────────────────────────────────────────┘   │                  │
│   └─────────────────────────────────────────────────┘                  │
│                        │                                               │
│                        ▼                                               │
│   ┌─────────────────────────────────────────────────┐                  │
│   │         TransformationNode                      │                  │
│   │  (pure functions, no bubbles)                   │                  │
│   └─────────────────────────────────────────────────┘                  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Layout Modes

### Sequential Layout (Fallback)

Used when:

- No workflow attribute exists
- Unparsed bubbles exist outside steps
- Steps are in "step-main" (top-level bubbles)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Sequential Horizontal Layout                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│   │ InputSchema  │────▶│   Bubble 1   │────▶│   Bubble 2   │────▶ ...   │
│   │    Node      │     │              │     │              │            │
│   └──────────────┘     └──────────────┘     └──────────────┘            │
│          x=50          x=50+450=500        x=50+900=950                  │
│          y=300              y=300               y=300                   │
│                                                                         │
│   horizontalSpacing = 450px                                             │
│   baseY = 300px                                                         │
│   startX = 50px                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Hierarchical Layout (Step-Based)

Used when workflow has function calls with method definitions:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Hierarchical Step Layout                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Level 0:   ┌─────────────┐                                            │
│              │ InputSchema │                                            │
│              └──────┬──────┘                                            │
│                     │ (right→left edge)                                 │
│                     ▼                                                   │
│   Level 1:   ┌─────────────────┐                                        │
│              │ Step: scrape()  │                                        │
│              │ ┌─────────────┐ │                                        │
│              │ │  Scraper    │ │                                        │
│              │ └─────────────┘ │                                        │
│              └────────┬────────┘                                        │
│                       │ (bottom→top edge)                               │
│         ┌─────────────┴─────────────┐                                   │
│         │ if (condition)            │                                   │
│         ▼                           ▼                                   │
│   ┌───────────────┐          ┌───────────────┐                          │
│   │ Step: then()  │          │ Step: else()  │                          │
│   │ ┌───────────┐ │          │ ┌───────────┐ │                          │
│   │ │ Bubble A  │ │          │ │ Bubble B  │ │                          │
│   │ └───────────┘ │          │ └───────────┘ │                          │
│   └───────┬───────┘          └───────┬───────┘                          │
│           │                          │                                  │
│           └──────────┬───────────────┘                                  │
│                      ▼ (converge)                                       │
│              ┌─────────────────┐                                        │
│              │ Step: finish()  │                                        │
│              └─────────────────┘                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Node Generation

### 1. Entry Node Creation

```typescript
// Based on eventType
if (eventType === 'schedule/cron') {
  // Create CronScheduleNode
  node = {
    id: 'cron-schedule-node',
    type: 'cronScheduleNode',
    position: { x: startX - 520, y: baseY },
    data: { flowId, cronSchedule, isActive, ... }
  };
} else {
  // Create InputSchemaNode
  node = {
    id: 'input-schema-node',
    type: 'inputSchemaNode',
    position: { x: startX - 520, y: baseY },
    data: { flowId, flowName, schemaFields }
  };
}
```

### 2. Step Container Node Creation

```typescript
// For each step from extractStepGraph()
steps.forEach((step) => {
  if (step.isTransformation) {
    // TransformationNode for pure functions
    nodes.push({
      id: step.id,
      type: 'transformationNode',
      position: stepPositions.get(step.id),
      data: {
        transformationInfo: { functionName, code, arguments, ... }
      }
    });
  } else {
    // StepContainerNode for functions with bubbles
    nodes.push({
      id: step.id,
      type: 'stepContainerNode',
      position: stepPositions.get(step.id),
      data: {
        stepInfo: { functionName, description, ... },
        bubbleIds: step.bubbleIds,
        usedHandles: usedHandlesMap.get(step.id)
      },
      style: { zIndex: -1 }  // Behind bubbles
    });
  }
});
```

### 3. Bubble Node Creation (Inside Steps)

```typescript
step.bubbleIds.forEach((bubbleId, bubbleIndexInStep) => {
  const bubblePosition = calculateBubblePosition(
    bubbleIndexInStep,
    stepHeaderHeight
  );

  nodes.push({
    id: String(bubbleId),
    type: 'bubbleNode',
    position: bubblePosition, // Relative to parent
    parentId: step.id, // Parent relationship
    extent: [
      [padding, headerHeight],
      [width - padding, height - padding],
    ], // Constrain
    data: {
      bubble,
      bubbleKey,
      requiredCredentialTypes,
      hasSubBubbles: !!bubble.dependencyGraph?.dependencies?.length,
      usedHandles: usedHandlesMap.get(nodeId),
    },
  });
});
```

### 4. Sub-Bubble (Dependency) Node Creation

```typescript
// Recursive function for dependency graph
function createNodesFromDependencyGraph(
  dependencyNode,
  parentBubble,
  nodes, edges,
  level, parentNodeId,
  siblingIndex, siblingsTotal,
  path, rootId
) {
  // Calculate position relative to parent
  const position = calculateSubbubblePositionWithContext(
    parentNode,
    containerNode,
    allStepNodes,
    siblingIndex,
    siblingsTotal,
    persistedPosition
  );

  nodes.push({
    id: nodeId,
    type: 'bubbleNode',
    position,
    zIndex: FLOW_LAYOUT.Z_INDEX.SUBBUBBLE_BASE + level,
    data: { flowId, bubble: subBubble, ... }
  });

  // Connect to parent
  edges.push({
    id: `${parentNodeId}-${nodeId}`,
    source: parentNodeId,
    target: nodeId,
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'smoothstep'
  });

  // Recurse for children
  dependencyNode.dependencies?.forEach((childDep, idx) => {
    createNodesFromDependencyGraph(childDep, ...);
  });
}
```

---

## Edge Generation

### Edge Types and Their Purposes

| Edge Type     | Source → Target           | Handle       | Purpose              |
| ------------- | ------------------------- | ------------ | -------------------- |
| Entry to Step | InputSchema → Step        | right → left | Flow trigger         |
| Step to Step  | Step → Step               | bottom → top | Sequential flow      |
| Conditional   | Step → Step (branch)      | bottom → top | if/else branches     |
| Internal      | Bubble → Bubble (in step) | bottom → top | Within-step sequence |
| Dependency    | Bubble → SubBubble        | bottom → top | Tool dependencies    |

### Edge Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Edge Generation Pipeline                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. Mark Handle Usage (for each edge type):                            │
│      markHandleUsed(sourceId, 'bottom');                                │
│      markHandleUsed(targetId, 'top');                                   │
│                                                                         │
│   2. Entry to First Step:                                               │
│      ┌─────────────┐  right→left  ┌─────────────┐                       │
│      │ InputSchema │─────────────▶│   Step 0    │                       │
│      └─────────────┘              └─────────────┘                       │
│                                                                         │
│   3. Step-to-Step Edges (from stepGraph.edges):                         │
│      for (stepEdge of stepEdges) {                                      │
│        edges.push({                                                     │
│          source: stepEdge.sourceStepId,                                 │
│          target: stepEdge.targetStepId,                                 │
│          sourceHandle: 'bottom',                                        │
│          targetHandle: 'top',                                           │
│          label: stepEdge.label  // "if x > 0", "else", etc.             │
│        });                                                              │
│      }                                                                  │
│                                                                         │
│   4. Within-Step Internal Edges:                                        │
│      generateWithinStepEdges(steps, bubbles, completed, running)        │
│      ┌───────────────────────┐                                          │
│      │ Step Container        │                                          │
│      │  ┌─────────┐          │                                          │
│      │  │ Bubble1 │          │  Vertical flow inside step               │
│      │  └────┬────┘          │                                          │
│      │       │ (straight)    │                                          │
│      │  ┌────▼────┐          │                                          │
│      │  │ Bubble2 │          │                                          │
│      │  └─────────┘          │                                          │
│      └───────────────────────┘                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Edge Styling Based on Execution State

```typescript
const getEdgeStyle = (isHighlighted) => {
  if (isHighlighted) {
    return {
      stroke: '#22c55e', // green-500 (bright)
      strokeWidth: 4, // thick
      strokeDasharray: undefined, // solid
      strokeOpacity: 1, // fully opaque
    };
  } else {
    return {
      stroke: '#6b7280', // gray-500 (subtle)
      strokeWidth: 1.5, // thin
      strokeDasharray: '8,4', // dashed
      strokeOpacity: 0.4, // semi-transparent
    };
  }
};
```

---

## Positioning System

### Layout Constants (flowLayoutConstants.ts)

```typescript
export const FLOW_LAYOUT = {
  BUBBLE_WIDTH: 320, // w-80 class
  BUBBLE_HEIGHT: 280, // typical bubble height

  SEQUENTIAL: {
    HORIZONTAL_SPACING: 450,
    BASE_Y: 300,
    START_X: 50,
    ENTRY_NODE_OFFSET: 520,
  },

  HIERARCHICAL: {
    START_X: 50,
    START_Y: 200,
    MIN_VERTICAL_SPACING: 80,
    HORIZONTAL_SPACING: 500,
  },

  SUBBUBBLE: {
    VERTICAL_SPACING: 140,
    SIBLING_HORIZONTAL_SPACING: 200,
    HORIZONTAL_SPACING: 150,
  },
};
```

### Step Container Constants (stepContainerUtils.ts)

```typescript
export const STEP_CONTAINER_LAYOUT = {
  WIDTH: 400,
  PADDING: 20,
  INTERNAL_WIDTH: 360,
  HEADER_HEIGHT: 230,
  BUBBLE_HEIGHT: 280,
  BUBBLE_SPACING: 20,
  BUBBLE_WIDTH: 320,
  BUBBLE_X_OFFSET: 40, // (400 - 320) / 2
};
```

### Position Calculation Functions

```typescript
// Calculate bubble position within a step container
calculateBubblePosition(bubbleIndex, headerHeight) {
  return {
    x: BUBBLE_X_OFFSET,  // 40px (centered)
    y: headerHeight + PADDING +
       bubbleIndex * (BUBBLE_HEIGHT + BUBBLE_SPACING)
  };
}

// Calculate step container height
calculateStepContainerHeight(bubbleCount, headerHeight) {
  const contentHeight =
    PADDING +
    bubbleCount * BUBBLE_HEIGHT +
    (bubbleCount - 1) * BUBBLE_SPACING +
    PADDING;
  return headerHeight + contentHeight;
}

// Calculate sub-bubble position
calculateSubbubblePositionWithContext(
  parentNode, containerNode, allStepNodes,
  siblingIndex, siblingsTotal, persistedPosition
) {
  // Determine which side (left/right) based on layout
  const side = determineSubbubbleSide(containerNode, allStepNodes);

  // Calculate position
  if (side === 'right') {
    baseX = containerX + containerWidth + HORIZONTAL_SPACING;
  } else {
    baseX = containerX - HORIZONTAL_SPACING - BUBBLE_WIDTH;
  }

  // Spread siblings horizontally
  const rowWidth = (siblingsTotal - 1) * SIBLING_HORIZONTAL_SPACING;
  return {
    x: baseX - rowWidth/2 + siblingIndex * SIBLING_HORIZONTAL_SPACING,
    y: parentY + VERTICAL_SPACING
  };
}
```

### Hierarchical Layout Algorithm

```typescript
function calculateHierarchicalLayout(steps) {
  const positionMap = new Map();

  // Build parent-child relationships from step.parentStepId
  const childrenMap = buildChildrenMap(steps);
  const rootSteps = steps.filter((s) => !s.parentStepId);

  // Recursive tree layout
  function layoutSubtree(stepId, x, y, depth) {
    positionMap.set(stepId, { x, y });

    const children = childrenMap.get(stepId) || [];
    const sortedChildren = sortByBranchType(children); // then, sequential, else

    for (let i = 0; i < sortedChildren.length; i++) {
      // Spread children around parent X
      const branchOffset =
        (i - (sortedChildren.length - 1) / 2) * HORIZONTAL_SPACING;
      const childX = x + branchOffset;
      const childY = y + currentStepHeight + MIN_VERTICAL_SPACING;

      layoutSubtree(child.id, childX, childY, depth + 1);
    }
  }

  // Layout from roots
  rootSteps.forEach((root) => layoutSubtree(root.id, startX, startY, 0));

  // Post-process: center convergence points
  for (const step of steps) {
    const allParents = getAllParents(step);
    if (allParents.length > 1) {
      // Multiple parents = convergence point
      const centerX = average(allParents.map((p) => p.x));
      const bottomY = max(allParents.map((p) => p.y + p.height));
      positionMap.set(step.id, { x: centerX, y: bottomY + spacing });
    }
  }

  return positionMap;
}
```

---

## Data Flow Example

### Example: Simple Scrape Flow

**Input Code:**

```typescript
class ScrapeFlow {
  async run(inputs) {
    const scraper = new FirecrawlScrape({ url: inputs.url });
    const result = await scraper.action();
    return result;
  }
}
```

**Generated Workflow (ParsedWorkflow):**

```json
{
  "root": [{
    "type": "function_call",
    "functionName": "run",
    "methodDefinition": { "isAsync": true, "location": {...} },
    "children": [{
      "type": "bubble",
      "variableId": 1,
      "bubbleName": "FirecrawlScrape"
    }]
  }]
}
```

**extractStepGraph Output:**

```typescript
{
  steps: [{
    id: "step-0",
    functionName: "run",
    bubbleIds: [1],
    level: 0,
    parentStepId: undefined
  }],
  edges: []  // Only one step, no step-to-step edges
}
```

**Generated Nodes:**

```typescript
[
  // Entry node
  {
    id: "input-schema-node",
    type: "inputSchemaNode",
    position: { x: -470, y: 300 }
  },
  // Step container
  {
    id: "step-0",
    type: "stepContainerNode",
    position: { x: 50, y: 200 },
    data: { stepInfo: { functionName: "run" }, bubbleIds: [1] }
  },
  // Bubble inside step
  {
    id: "1",
    type: "bubbleNode",
    position: { x: 40, y: 250 },  // Relative to parent
    parentId: "step-0",
    data: { bubble: {...}, bubbleKey: "1" }
  }
]
```

**Generated Edges:**

```typescript
[
  // Entry to first step
  {
    id: 'entry-to-first-step',
    source: 'input-schema-node',
    target: 'step-0',
    sourceHandle: 'right',
    targetHandle: 'left',
  },
];
```

**Visual Result:**

```
┌─────────────────┐        ┌─────────────────────────┐
│  Flow Inputs    │───────▶│  run()                  │
│  ─────────────  │        │  ┌───────────────────┐  │
│  url: ________  │        │  │ FirecrawlScrape   │  │
│  [Execute Flow] │        │  │                   │  │
└─────────────────┘        │  └───────────────────┘  │
                           └─────────────────────────┘
```

### Example: Conditional Flow with Branches

**Generated Steps:**

```typescript
{
  steps: [
    { id: "step-0", functionName: "scrape", level: 0 },
    { id: "step-1", functionName: "handleSuccess", level: 1,
      parentStepId: "step-0", branchType: "then" },
    { id: "step-2", functionName: "handleError", level: 1,
      parentStepId: "step-0", branchType: "else" }
  ],
  edges: [
    { sourceStepId: "step-0", targetStepId: "step-1",
      label: "if success", branchType: "then" },
    { sourceStepId: "step-0", targetStepId: "step-2",
      label: "else", branchType: "else" }
  ]
}
```

**Visual Result:**

```
                    ┌───────────────────┐
                    │     scrape()      │
                    └─────────┬─────────┘
                              │
           ┌──────────────────┴──────────────────┐
           │ if success                    else  │
           ▼                                     ▼
┌───────────────────┐               ┌───────────────────┐
│  handleSuccess()  │               │   handleError()   │
└───────────────────┘               └───────────────────┘
```

---

## Key Files Reference

| File                           | Purpose                                          |
| ------------------------------ | ------------------------------------------------ |
| `FlowVisualizer.tsx`           | Main orchestrator, node/edge generation          |
| `stepContainerUtils.ts`        | Step container layout constants and calculations |
| `flowLayoutConstants.ts`       | Centralized layout constants (spacing, sizing)   |
| `nodePositioning.ts`           | Sub-bubble positioning utilities                 |
| `workflowToSteps.ts`           | Extracts StepGraph from ParsedWorkflow           |
| `nodes/BubbleNode.tsx`         | Bubble node component                            |
| `nodes/StepContainerNode.tsx`  | Step container component                         |
| `nodes/InputSchemaNode.tsx`    | Flow input entry node                            |
| `nodes/TransformationNode.tsx` | Data transformation node                         |
| `nodes/CronScheduleNode.tsx`   | Cron schedule trigger node                       |
