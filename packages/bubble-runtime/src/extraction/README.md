# Bubble Parsing and Cloning System

This document explains how bubbles are parsed from TypeScript source code, how dependency graphs are built, and how per-invocation cloning works to give each method call its own isolated bubble instances.

## Overview

The parsing and cloning system:

1. Parses TypeScript code to extract bubble instantiations
2. Builds dependency graphs for each bubble
3. Clones bubbles per method invocation so each call site gets its own `variableId` and `uniqueId`
4. Handles bubbles inside `customTools` (AI agent tools) the same way as top-level bubbles

## Key Concepts

### Variable ID (`variableId`)

A unique numeric identifier for each bubble instance. Used for:

- Tracking execution in logs
- Mapping credentials to bubbles
- Identifying bubbles in the dependency graph

**Design-time IDs** are assigned during parsing (e.g., `421`, `425`, `433`).

**Runtime IDs** are computed per invocation using a hash:

```typescript
hashToVariableId(`${originalVariableId}:${invocationCallSiteKey}`);
// e.g., hashToVariableId("421:runDentalAssistant#1") → 280668
```

### Unique ID (`uniqueId`)

A string identifier that encodes the bubble's position in the dependency tree:

- Design-time: `"421"`, `"425"`, `"433"`
- Per-invocation: `"421@runDentalAssistant#1"`, `"425@runDentalAssistant#1"`

### Invocation Call Site Key

A string identifying which method call a bubble belongs to:

- Format: `"{methodName}#{ordinal}"` (e.g., `"runDentalAssistant#1"`, `"sendTelegramReply#1"`)
- Set by the injected flow wrapper code before each method call
- Used to differentiate bubbles when the same method is called multiple times

### Dependency Graph

A tree structure representing how bubbles relate to each other:

```typescript
{
  name: "ai-agent",
  uniqueId: "421",
  variableId: 421,
  variableName: "agent",
  nodeType: "service",
  dependencies: [...],
  functionCallChildren: [
    {
      type: "function_call",
      functionName: "checkAvailability",
      children: [
        { type: "bubble", variableId: 425 }
      ]
    }
  ]
}
```

## The Parsing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BubbleParser.parse()                         │
│                                                                     │
│  1. Parse TypeScript AST using @typescript-eslint/parser           │
│  2. Walk AST to find `new XyzBubble(...)` instantiations           │
│  3. Extract parameters, locations, and variable names              │
│  4. Build dependency graphs for each bubble                        │
│  5. Identify bubbles inside customTools (mark isInsideCustomTool)  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      buildWorkflowTree()                            │
│                                                                     │
│  1. Walk handle() method to build workflow node tree               │
│  2. For each method call, create invocation clones                 │
│  3. Clone bubbles referenced in the method with per-invocation IDs │
│  4. Store clones in invocationBubbleCloneCache                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Final Output: ParsedBubbles                       │
│                                                                     │
│  - Original design-time bubbles (421, 425, 433, ...)               │
│  - Invocation clones (280668, 798456, ...) with:                   │
│      • clonedFromVariableId pointing to original                   │
│      • invocationCallSiteKey set                                   │
│      • Cloned dependencyGraph with suffixed uniqueIds              │
└─────────────────────────────────────────────────────────────────────┘
```

## Per-Invocation Cloning

### Why Clone?

When the same bubble definition appears in multiple method calls, each call needs its own identity for:

- Correct credential injection per call site
- Accurate execution logging with distinct IDs
- Proper token/usage tracking per invocation

### How Cloning Works

```
Original Code:
┌────────────────────────────────────────────────────────────────┐
│ class DentalClinicFlow extends BubbleFlow {                    │
│   async runDentalAssistant(message) {                          │
│     const agent = new AIAgentBubble({ ... });  // variableId: 421
│   }                                                            │
│                                                                │
│   async handle(payload) {                                      │
│     await this.runDentalAssistant(msg1);  // Call site #1      │
│     await this.runDentalAssistant(msg2);  // Call site #2      │
│   }                                                            │
│ }                                                              │
└────────────────────────────────────────────────────────────────┘

After Cloning:
┌────────────────────────────────────────────────────────────────┐
│ Design-time bubble:                                            │
│   421 → AIAgentBubble (original)                               │
│                                                                │
│ Invocation clones:                                             │
│   280668 → AIAgentBubble                                       │
│            clonedFromVariableId: 421                           │
│            invocationCallSiteKey: "runDentalAssistant#1"       │
│            uniqueId: "421@runDentalAssistant#1"                │
│                                                                │
│   395821 → AIAgentBubble                                       │
│            clonedFromVariableId: 421                           │
│            invocationCallSiteKey: "runDentalAssistant#2"       │
│            uniqueId: "421@runDentalAssistant#2"                │
└────────────────────────────────────────────────────────────────┘
```

### Cloning Bubbles Inside CustomTools

Bubbles instantiated inside AI agent `customTools` are also cloned per invocation:

```
Original customTools bubble:
┌────────────────────────────────────────────────────────────────┐
│ customTools: [{                                                │
│   name: 'checkAvailability',                                   │
│   func: async (input) => {                                     │
│     const result = await new GoogleCalendarBubble({            │
│       operation: 'list_events',  // variableId: 425            │
│     }).action();                                               │
│   }                                                            │
│ }]                                                             │
└────────────────────────────────────────────────────────────────┘

After Cloning (for runDentalAssistant#1):
┌────────────────────────────────────────────────────────────────┐
│ Design-time:                                                   │
│   425 → GoogleCalendarBubble (original)                        │
│                                                                │
│ Invocation clone:                                              │
│   748291 → GoogleCalendarBubble                                │
│            clonedFromVariableId: 425                           │
│            invocationCallSiteKey: "runDentalAssistant#1"       │
│            uniqueId: "425@runDentalAssistant#1"                │
│            dependencyGraph: { uniqueId: "425@runDentalAssistant#1", ... }
└────────────────────────────────────────────────────────────────┘
```

## Context Propagation at Runtime

### How `variableId` is Recomputed in `BaseBubble`

When a bubble is constructed at runtime, `BaseBubble` recomputes the context:

```typescript
// In BaseBubble constructor
if (normalizedContext?.dependencyGraph && normalizedContext?.currentUniqueId) {
  const next = this.computeChildContext(normalizedContext);
  this.context = next;
}
```

The `computeChildContext` method:

1. Finds the current node in the dependency graph by `currentUniqueId`
2. If this bubble matches the current node, uses its `variableId`
3. Otherwise, walks to the correct child node and inherits that child's `variableId`

```
Example Trace:
┌────────────────────────────────────────────────────────────────┐
│ Incoming context:                                              │
│   dependencyGraph: { name: "ai-agent", uniqueId: "421@run#1",  │
│                      variableId: 280668, ... }                 │
│   currentUniqueId: "421@runDentalAssistant#1"                  │
│   variableId: undefined  (not yet computed)                    │
│                                                                │
│ computeChildContext() runs:                                    │
│   1. Find node where uniqueId === "421@runDentalAssistant#1"   │
│   2. Node.name === "ai-agent" === this.name ✓                  │
│   3. Use node.variableId (280668)                              │
│                                                                │
│ Result context:                                                │
│   variableId: 280668                                           │
│   currentUniqueId: "421@runDentalAssistant#1"                  │
└────────────────────────────────────────────────────────────────┘
```

### The Invocation Dependency Graph Map

Cloned dependency graphs are stored in a global map injected into the flow:

```typescript
// Injected at the top of the compiled flow
const __bubbleInvocationDependencyGraphs = Object.freeze({
  "runDentalAssistant#1": {
    "421": { name: "ai-agent", uniqueId: "421@runDentalAssistant#1", variableId: 280668, ... },
    "425": { name: "google-calendar", uniqueId: "425@runDentalAssistant#1", variableId: 748291, ... },
    "433": { name: "google-calendar", uniqueId: "433@runDentalAssistant#1", variableId: 592847, ... },
  },
  "sendTelegramReply#1": {
    "442": { name: "telegram", uniqueId: "442@sendTelegramReply#1", variableId: 798456, ... },
  }
});
globalThis["__bubbleInvocationDependencyGraphs"] = __bubbleInvocationDependencyGraphs;
```

### How Bubbles Use the Map

The injected bubble instantiations look up their per-invocation graph:

```typescript
const result = await new GoogleCalendarBubble(
  { operation: 'list_events', ... },
  {
    logger: __bubbleFlowSelf.logger,
    // Compute hashed variableId for this invocation
    variableId: (__bubbleFlowSelf.__computeInvocationVariableId(425) ?? 425),
    // Look up cloned dependency graph, fallback to static literal
    dependencyGraph: globalThis["__bubbleInvocationDependencyGraphs"]
      ?.[__bubbleFlowSelf.__getInvocationCallSiteKey() ?? ""]
      ?.["425"]
      ?? { name: "google-calendar", uniqueId: "425", variableId: 425, ... },
    // Look up cloned uniqueId
    currentUniqueId: globalThis["__bubbleInvocationDependencyGraphs"]
      ?.[__bubbleFlowSelf.__getInvocationCallSiteKey() ?? ""]
      ?.["425"]?.uniqueId
      ?? "425",
    invocationCallSiteKey: __bubbleFlowSelf.__getInvocationCallSiteKey(),
  }
).action();
```

## Key Classes and Methods

### `BubbleParser`

Main parser that extracts bubble information from TypeScript source.

#### `parseBubblesFromAST(bubbleFactory, ast, scopeManager)`

Entry point for parsing. Returns:

```typescript
{
  bubbles: Record<number, ParsedBubbleWithInfo>;  // All bubbles (original + clones)
  workflow: ParsedWorkflow;                        // Workflow tree structure
  instanceMethodsLocation: Record<...>;            // Method location info
}
```

#### `cloneBubbleForInvocation(bubble, callSiteKey, bubbleSourceMap)`

Creates a per-invocation clone of a bubble:

```typescript
private cloneBubbleForInvocation(
  bubble: ParsedBubbleWithInfo,
  callSiteKey: string,
  bubbleSourceMap: Map<number, ParsedBubbleWithInfo>
): number {
  const cacheKey = `${bubble.variableId}:${callSiteKey}`;

  // Check cache first
  const existing = this.invocationBubbleCloneCache.get(cacheKey);
  if (existing) return existing.variableId;

  // Create clone with new IDs
  const clonedBubble: ParsedBubbleWithInfo = {
    ...bubble,
    variableId: hashToVariableId(cacheKey),
    invocationCallSiteKey: callSiteKey,
    clonedFromVariableId: bubble.variableId,
    parameters: JSON.parse(JSON.stringify(bubble.parameters)),
    dependencyGraph: bubble.dependencyGraph
      ? this.cloneDependencyGraphNodeForInvocation(bubble.dependencyGraph, callSiteKey)
      : undefined,
  };

  // Also clone bubbles inside customTools (functionCallChildren)
  // ... (recursively clones nested bubbles)

  this.invocationBubbleCloneCache.set(cacheKey, clonedBubble);
  return clonedBubble.variableId;
}
```

#### `cloneDependencyGraphNodeForInvocation(node, callSiteKey)`

Clones a dependency graph node with per-invocation IDs:

```typescript
private cloneDependencyGraphNodeForInvocation(
  node: DependencyGraphNode,
  callSiteKey: string
): DependencyGraphNode {
  const uniqueId = node.uniqueId ? `${node.uniqueId}@${callSiteKey}` : undefined;
  const variableId = typeof node.variableId === 'number'
    ? hashToVariableId(`${node.variableId}:${callSiteKey}`)
    : undefined;

  return {
    ...node,
    uniqueId,
    variableId,
    dependencies: node.dependencies.map((child) =>
      this.cloneDependencyGraphNodeForInvocation(child, callSiteKey)
    ),
  };
}
```

### `BubbleFlow` (in bubble-core)

Base class for flows with invocation tracking methods.

#### `__setInvocationCallSiteKey(key)`

Sets the current invocation call site key. Called before method invocations:

```typescript
__setInvocationCallSiteKey(key?: string): string | undefined {
  const previous = this.__currentInvocationCallSiteKey;
  this.__currentInvocationCallSiteKey = key || undefined;
  return previous;
}
```

#### `__computeInvocationVariableId(originalVariableId)`

Computes the hashed variableId for the current invocation:

```typescript
__computeInvocationVariableId(originalVariableId?: number): number | undefined {
  if (typeof originalVariableId !== 'number' || !this.__currentInvocationCallSiteKey) {
    return originalVariableId;
  }
  return hashToVariableId(`${originalVariableId}:${this.__currentInvocationCallSiteKey}`);
}
```

### `BaseBubble` (in bubble-core)

Base class for all bubbles with context recomputation.

#### `computeChildContext(parentContext)`

Recomputes context (variableId, currentUniqueId) based on dependency graph:

```typescript
private computeChildContext(parentContext: BubbleContext): BubbleContext {
  const graph = parentContext.dependencyGraph;
  const currentId = parentContext.currentUniqueId || '';

  // Find current node in graph
  const parentNode = currentId ? findByUniqueId(graph, currentId) : graph;

  // If this bubble matches the current node, use its IDs
  if (parentNode && parentNode.name === this.name) {
    return {
      ...parentContext,
      variableId: parentNode.variableId ?? parentContext.variableId,
      currentUniqueId: currentId,
    };
  }

  // Otherwise, find the correct child and use its IDs
  // ... (ordinal-based matching logic)
}
```

### `BubbleInjector`

Orchestrates injection of credentials and logging.

#### `buildInvocationDependencyGraphLiteral()`

Builds the `__bubbleInvocationDependencyGraphs` map from cloned bubbles:

```typescript
private buildInvocationDependencyGraphLiteral(): string {
  const callSiteMap: Record<string, Record<string, unknown>> = {};

  for (const bubble of Object.values(this.bubbleScript.getParsedBubbles())) {
    if (!bubble.invocationCallSiteKey ||
        typeof bubble.clonedFromVariableId !== 'number' ||
        !bubble.dependencyGraph) {
      continue;
    }

    const callSiteKey = bubble.invocationCallSiteKey;
    const originalId = String(bubble.clonedFromVariableId);

    if (!callSiteMap[callSiteKey]) {
      callSiteMap[callSiteKey] = {};
    }
    callSiteMap[callSiteKey][originalId] = bubble.dependencyGraph;
  }

  return JSON.stringify(callSiteMap, null, 2);
}
```

## Complete Example Trace

### Source Code

```typescript
class DentalClinicFlow extends BubbleFlow<'webhook/http'> {
  private async runDentalAssistant(message: string, calendarId: string) {
    const agent = new AIAgentBubble({
      message,
      customTools: [
        {
          name: 'checkAvailability',
          func: async (input) => {
            const result = await new GoogleCalendarBubble({
              operation: 'list_events',
              calendar_id: calendarId,
            }).action();
            return result.data;
          },
        },
      ],
    });
    return await agent.action();
  }

  async handle(payload) {
    await this.runDentalAssistant(payload.message, payload.calendarId);
  }
}
```

### Parsing Result

```
Design-time bubbles:
├── 421: AIAgentBubble
│   ├── variableName: "agent"
│   └── dependencyGraph:
│       └── functionCallChildren:
│           └── checkAvailability → children: [{ variableId: 425 }]
│
└── 425: GoogleCalendarBubble
    ├── variableName: "result"
    ├── isInsideCustomTool: true
    └── containingCustomToolId: "421.checkAvailability"
```

### Cloning During Workflow Build

When `buildWorkflowTree()` encounters `this.runDentalAssistant(...)`:

```
1. Generate call site key: "runDentalAssistant#1"

2. Clone AIAgentBubble (421):
   └── New variableId: hash("421:runDentalAssistant#1") = 280668
   └── clonedFromVariableId: 421
   └── invocationCallSiteKey: "runDentalAssistant#1"
   └── dependencyGraph.uniqueId: "421@runDentalAssistant#1"

3. Clone nested GoogleCalendarBubble (425):
   └── Found in functionCallChildren of 421
   └── New variableId: hash("425:runDentalAssistant#1") = 748291
   └── clonedFromVariableId: 425
   └── invocationCallSiteKey: "runDentalAssistant#1"
   └── dependencyGraph.uniqueId: "425@runDentalAssistant#1"

4. Update cloned 421's functionCallChildren:
   └── children: [{ variableId: 748291 }]  (was 425)
```

### Injected Code

```typescript
// Invocation graph map
const __bubbleInvocationDependencyGraphs = Object.freeze({
  'runDentalAssistant#1': {
    '421': {
      name: 'ai-agent',
      uniqueId: '421@runDentalAssistant#1',
      variableId: 280668,
      functionCallChildren: [
        {
          functionName: 'checkAvailability',
          children: [{ type: 'bubble', variableId: 748291 }],
        },
      ],
    },
    '425': {
      name: 'google-calendar',
      uniqueId: '425@runDentalAssistant#1',
      variableId: 748291,
    },
  },
});

// In handle():
const __prevKey = __bubbleFlowSelf.__setInvocationCallSiteKey(
  'runDentalAssistant#1'
);
await this.runDentalAssistant(payload.message, payload.calendarId);
__bubbleFlowSelf.__restoreInvocationCallSiteKey(__prevKey);
```

### Runtime Context Flow

```
1. handle() sets invocation key to "runDentalAssistant#1"

2. AIAgentBubble construction:
   ├── Receives context with:
   │   ├── variableId: computed as 280668
   │   ├── dependencyGraph: from __bubbleInvocationDependencyGraphs["runDentalAssistant#1"]["421"]
   │   └── currentUniqueId: "421@runDentalAssistant#1"
   │
   └── computeChildContext():
       └── Finds node "421@runDentalAssistant#1" → uses variableId 280668

3. GoogleCalendarBubble construction (inside customTool):
   ├── Receives context with:
   │   ├── variableId: computed as 748291
   │   ├── dependencyGraph: from __bubbleInvocationDependencyGraphs["runDentalAssistant#1"]["425"]
   │   └── currentUniqueId: "425@runDentalAssistant#1"
   │
   └── computeChildContext():
       └── Finds node "425@runDentalAssistant#1" → uses variableId 748291

4. Logging shows:
   ├── [variableId=280668] AIAgentBubble execution started
   └── [variableId=748291] GoogleCalendarBubble execution started
```

## Debugging Tips

### Check if cloning is working

Look for these in parsed bubbles:

- `clonedFromVariableId` should be set to original ID
- `invocationCallSiteKey` should be the method call key
- `dependencyGraph.uniqueId` should have `@{callSiteKey}` suffix

### Verify invocation graph map

The `__bubbleInvocationDependencyGraphs` should contain:

- An entry for each call site key
- Under each key, entries for each cloned bubble's original ID
- Each entry should have the cloned dependency graph

### Common issues

1. **Bubble not cloned**: Check if it's reachable from the workflow tree
2. **Wrong variableId at runtime**: Verify `__getInvocationCallSiteKey()` returns expected value
3. **CustomTool bubble not cloned**: Ensure `functionCallChildren` is being processed

## Summary

| Stage          | What Happens                                | Key Method                                |
| -------------- | ------------------------------------------- | ----------------------------------------- |
| Parsing        | Extract bubbles from AST                    | `parseBubblesFromAST()`                   |
| Cloning        | Create per-invocation copies                | `cloneBubbleForInvocation()`              |
| Graph Building | Clone dependency graphs                     | `cloneDependencyGraphNodeForInvocation()` |
| Map Injection  | Insert `__bubbleInvocationDependencyGraphs` | `buildInvocationDependencyGraphLiteral()` |
| Runtime        | Recompute context per bubble                | `computeChildContext()`                   |
