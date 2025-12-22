# Bubble Injection Process

This document explains how credential injection and bubble parameter reinitialization works in the BubbleInjector.

## Overview

The injection process takes a parsed BubbleScript and:

1. Injects credentials (API keys, tokens) into bubble parameters
2. Rewrites bubble instantiations in the source code with updated parameters
3. Injects logging and dependency tracking metadata

## Key Classes

### `BubbleInjector`

The main orchestrator for credential injection and parameter reinitialization.

### `BubbleScript`

Holds the parsed TypeScript source code and extracted bubble information.

## The Injection Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        injectCredentials()                          │
│                                                                     │
│  1. For each bubble, determine required credentials                 │
│  2. Add credentials to bubble.parameters array                      │
│  3. Call reapplyBubbleInstantiations() to rewrite source           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   reapplyBubbleInstantiations()                     │
│                                                                     │
│  Phase 1: Process NESTED bubbles (bottom-to-top)                   │
│    - Bubbles inside customTools of AI agents                        │
│    - Rewrite each with their new credentials                        │
│                                                                     │
│  Phase 2: Refresh PARENT bubble parameters                          │
│    - Re-read customTools from updated source lines                  │
│    - Now contains the rewritten nested bubbles                      │
│                                                                     │
│  Phase 3: Process NON-NESTED bubbles (top-to-bottom)               │
│    - Rewrite each bubble with updated parameters                    │
│    - Track line shifts from deletions                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    replaceBubbleInstantiation()                     │
│                    (in parameter-formatter.ts)                      │
│                                                                     │
│  - Takes a bubble and the lines array                               │
│  - Builds new parameters string via buildParametersObject()         │
│  - Replaces the multi-line instantiation with single-line format   │
│  - Deletes extra lines that were removed                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Methods

### `injectCredentials(userCredentials, systemCredentials)`

**Purpose:** Main entry point for injecting credentials into bubbles.

**Process:**

1. Iterates through all parsed bubbles
2. For each bubble, determines what credentials it needs (from `BUBBLE_CREDENTIAL_OPTIONS`)
3. For AI agents, also checks model type to optimize which API keys are needed
4. Adds a `credentials` parameter to each bubble's parameters array
5. Calls `reapplyBubbleInstantiations()` to update the source code

**Parameters:**

- `userCredentials`: User-specific credentials (OAuth tokens, etc.) mapped to specific bubble variable IDs
- `systemCredentials`: System-wide credentials (API keys from environment variables)

### `reapplyBubbleInstantiations()`

**Purpose:** Rewrites all bubble instantiations in the source code to reflect updated parameters.

**The Challenge:**
When an AI agent has `customTools` containing nested bubble instantiations, we need to:

1. First update the nested bubbles (so their credentials appear in the source)
2. Then update the parent AI agent (which reads the now-updated customTools from source)

**Process:**

```
Original Source:
┌────────────────────────────────────────────────────────────┐
│ const agent = new AIAgentBubble({                          │  Line 71
│   model: {...},                                            │
│   customTools: [                                           │  Line 106
│     {                                                      │
│       func: async () => {                                  │
│         const result = await new GoogleCalendarBubble({    │  Line 121 ← Nested
│           operation: 'list_events',                        │
│         }).action();                                       │  Line 127
│       }                                                    │
│     }                                                      │
│   ]                                                        │  Line 195
│ });                                                        │  Line 196
└────────────────────────────────────────────────────────────┘

Phase 1: Process nested bubbles (bottom-to-top)
─────────────────────────────────────────────────
- Process GoogleCalendarBubble at L121-127
- Rewrite it with credentials: { GOOGLE_CALENDAR_CRED: "..." }
- Lines 121-127 become a single line with credentials
- Source now has updated nested bubble code

Phase 2: Refresh parent parameters
───────────────────────────────────
- AI agent's customTools parameter still holds ORIGINAL source string
- Call refreshBubbleParametersFromSource()
- Re-read customTools from the NOW-UPDATED lines array
- customTools value now contains the nested bubble with credentials

Phase 3: Process non-nested bubbles (top-to-bottom)
────────────────────────────────────────────────────
- Process AIAgentBubble at L71-196 (adjusted for line shifts)
- Build parameters including updated customTools
- Rewrite the entire AI agent instantiation
```

### `refreshBubbleParametersFromSource(bubble, lines, adjustedEndLine)`

**Purpose:** Re-reads parameters containing function literals from the updated source lines.

**Why needed:**

- When a bubble is parsed, parameters like `customTools` are stored as strings
- These strings contain the ORIGINAL source code
- After nested bubbles are processed, the source lines are updated
- This method re-reads those parameters so they contain the updated code

**Process:**

1. Find parameters that contain function literals (`func:`, `=>`, etc.)
2. Calculate adjusted line numbers (accounting for deleted lines)
3. Read the parameter value from the updated lines array
4. Update the parameter's value with the fresh source

### `replaceBubbleInstantiation(lines, bubble)`

**Purpose:** Rewrites a single bubble instantiation in the source code.

**Located in:** `parameter-formatter.ts`

**Process:**

1. Build a new parameters object string via `buildParametersObject()`
2. Find the line containing `new BubbleName(`
3. Determine the pattern (variable assignment or anonymous)
4. Replace the original lines with a single-line instantiation
5. Delete any extra lines that were removed

**Before:**

```typescript
const result = await new GoogleCalendarBubble({
  operation: 'list_events',
  calendar_id: calendarId,
  time_min: timeMin,
}).action();
```

**After:**

```typescript
const result = await new GoogleCalendarBubble({ operation: 'list_events', calendar_id: calendarId, time_min: timeMin, credentials: { "GOOGLE_CALENDAR_CRED": "token" } }, {logger: __bubbleFlowSelf.logger, ...}).action()
```

### `buildParametersObject(parameters, variableId, includeLoggerConfig, ...)`

**Purpose:** Converts a bubble's parameters array into a TypeScript object literal string.

**Located in:** `parameter-formatter.ts`

**Process:**

1. Format each parameter value based on its type (string, object, variable, array)
2. Handle special cases like function literals (preserve as-is)
3. Add logger configuration and dependency graph metadata
4. Join all parameters with commas

### `injectBubbleLoggingAndReinitializeBubbleParameters()`

**Purpose:** Full pipeline for preparing a bubble script for execution.

**Process:**

1. Call `reapplyBubbleInstantiations()` to normalize bubble formats
2. Inject invocation dependency graph map (for tracking bubble execution)
3. Inject logging via `LoggerInjector`
4. Inject `__bubbleFlowSelf = this` capture for logger access

## Nested Bubbles: The Tricky Part

The most complex scenario is when bubbles are nested inside another bubble's parameters:

```typescript
new AIAgentBubble({
  customTools: [
    {
      func: async () => {
        // This GoogleCalendarBubble is NESTED inside AIAgentBubble
        await new GoogleCalendarBubble({ ... }).action();
      }
    }
  ]
})
```

**Problem:**

- Both AIAgentBubble and GoogleCalendarBubble are parsed as separate bubbles
- If we process AIAgentBubble first, its `customTools` parameter is the ORIGINAL source
- The nested GoogleCalendarBubble credentials would be lost

**Solution:**

1. Identify nested bubbles (those whose location is inside another bubble's range)
2. Process nested bubbles FIRST (in reverse line order to handle shifts correctly)
3. Refresh parent bubble parameters from the updated source
4. Then process parent bubbles

## Line Shift Tracking

When we rewrite bubbles, we often delete lines (multi-line → single-line).
This affects the locations of subsequent bubbles.

**For nested bubbles (Phase 1):**

- Process bottom-to-top
- Deletions only affect lines AFTER the current position
- No shift tracking needed

**For non-nested bubbles (Phase 3):**

- Process top-to-bottom
- Track cumulative line shift
- Adjust each bubble's location by the current shift

```
Example:
- Bubble A at L10-15 (5 lines) → Becomes 1 line, deletes 4
- Bubble B at L20-25 → Adjusted to L16-21 (shift = -4)
- After B processed, shift updated further
```

## Error Handling

The `injectCredentials` method wraps everything in a try-catch and returns:

```typescript
{
  success: boolean;
  code?: string;           // The modified source code
  parsedBubbles?: Record;  // Updated bubble information
  errors?: string[];       // Any errors that occurred
  injectedCredentials?: Record; // Audit trail of injected credentials
}
```

Common errors:

- Syntax errors after rewriting (usually indicates a bug in the injection logic)
- Missing credentials for required bubble types

## Helper Methods for Modifying Bubble Parameters

The `BubbleInjector` class provides helper methods for programmatically modifying bubble parameters after parsing but before execution.

### `changeBubbleParameters(bubbleId, key, value)`

**Purpose:** Modifies a specific parameter value for a bubble.

**Signature:**

```typescript
changeBubbleParameters(
  bubbleId: number,
  key: string,
  value: string | number | boolean | Record<string, unknown> | unknown[]
): void
```

**Parameters:**

- `bubbleId`: The unique identifier of the bubble (from `ParsedBubbleWithInfo.variableId`)
- `key`: The parameter name to modify (e.g., `'operation'`, `'model'`, `'prompt'`)
- `value`: The new value for the parameter

**Usage:**

```typescript
const injector = new BubbleInjector(bubbleScript);

// Change a string parameter
injector.changeBubbleParameters(1, 'operation', 'create_event');

// Change an object parameter
injector.changeBubbleParameters(1, 'model', {
  provider: 'openai',
  name: 'gpt-4',
});

// Change a boolean parameter
injector.changeBubbleParameters(1, 'stream', true);
```

**Errors:**

- Throws if the bubble with the given ID is not found
- Throws if the parameter with the given key doesn't exist in the bubble

**Note:** This method modifies the in-memory parameter array. To apply these changes to the source code, call `reapplyBubbleInstantiations()` afterward.

### `changeCredentials(bubbleId, credentials)`

**Purpose:** Adds or updates credentials for a specific bubble.

**Signature:**

```typescript
changeCredentials(
  bubbleId: number,
  credentials: Record<CredentialType, string>
): void
```

**Parameters:**

- `bubbleId`: The unique identifier of the bubble
- `credentials`: An object mapping credential types to their values

**Usage:**

```typescript
const injector = new BubbleInjector(bubbleScript);

// Add credentials to a bubble
injector.changeCredentials(1, {
  GOOGLE_CALENDAR_CRED: 'oauth_token_here',
});

// Add multiple credentials
injector.changeCredentials(2, {
  OPENAI_API_KEY: 'sk-...',
  ANTHROPIC_API_KEY: 'sk-ant-...',
});
```

**Behavior:**

- If the bubble doesn't have a `credentials` parameter, one is created
- If the bubble already has a `credentials` parameter, the values are replaced
- The credential type must be a valid `CredentialType` enum value

**Errors:**

- Throws if the bubble with the given ID is not found

### `getBubble(bubbleId)`

**Purpose:** Retrieves a parsed bubble by its ID.

**Signature:**

```typescript
getBubble(bubbleId: number): ParsedBubbleWithInfo
```

**Usage:**

```typescript
const bubble = injector.getBubble(1);
console.log(bubble.bubbleName); // e.g., 'GoogleCalendarBubble'
console.log(bubble.parameters); // Array of parameters
console.log(bubble.location); // { startLine, endLine }
```

### Typical Workflow

```typescript
// 1. Parse the bubble script
const bubbleScript = new BubbleScript(sourceCode);
await bubbleScript.parse();

// 2. Create injector
const injector = new BubbleInjector(bubbleScript);

// 3. Modify parameters as needed
injector.changeBubbleParameters(1, 'operation', 'list_events');
injector.changeCredentials(1, { GOOGLE_CALENDAR_CRED: 'token' });

// 4. Apply changes to source code
injector.reapplyBubbleInstantiations();

// 5. Get the modified source
const modifiedCode = bubbleScript.currentBubbleScript;
```

### Important Notes

1. **Order matters:** Modify parameters before calling `reapplyBubbleInstantiations()`
2. **In-memory changes:** These methods modify the parsed representation, not the source code directly
3. **Use with injection:** Typically used in conjunction with `injectCredentials()` which handles the full injection flow
4. **Parameter existence:** `changeBubbleParameters()` requires the parameter to already exist; it cannot add new parameters
