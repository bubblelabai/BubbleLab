# Bubble Creation Guide for AI Agents

This document serves as a comprehensive guide for AI agents to understand the codebase and create new Bubbles following established patterns and best practices.

## Core Principles

1. **Type Safety First**: All input/output types must be strictly typed using Zod schemas
2. **Developer Experience**: Ensure TypeScript errors when parameters are missing, provide autocompletion and hints
3. **Comprehensive Documentation**: Every parameter and operation must be thoroughly documented with `.describe()` calls
4. **Consistency**: Follow established naming conventions and patterns
5. **Optimized Defaults**: Provide sensible defaults for 90% of use cases

## 📚 Quick Reference: Key Concepts

### Standard Folder Structure

**Always use folder structure for all bubbles:**

```
{service-name}/
├─ {service-name}.schema.ts  # All Zod schemas (with preprocessing if needed)
├─ {service-name}.utils.ts   # Utility functions (optional, if needed)
├─ {service-name}.ts         # Main bubble class
├─ index.ts                  # Exports
└─ {service-name}.test.ts    # Unit tests
```

**Benefits:**

- ✅ Clean separation of concerns
- ✅ Easy to add preprocessing later
- ✅ Consistent structure across all bubbles
- ✅ Better organization for multi-operation bubbles
- ✅ Examples: `google-sheets/`, `apify/`, `google-drive/`

### Type System Quick Guide

| Type                      | When to Use                                                 | Example                                                         |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `ParamsInput = z.input<>` | Constructor parameter, generic constraint, user-facing APIs | `class Bubble<T extends ParamsInput>`, `constructor(params: T)` |
| `Params = z.output<>`     | Internal methods after validation, stored data              | `this.params as Params`                                         |
| `Result = z.output<>`     | Always output (after validation)                            | `Promise<Result>`                                               |

**Key Rules:**

1. **Generic constraint uses INPUT type** for discriminated union inference
2. **Internal methods use OUTPUT type** (cast `this.params` when needed)
3. **Result is always OUTPUT type**

### z.transform vs z.preprocess - CRITICAL DIFFERENCE

**⚠️ PREFER `z.transform()` over `z.preprocess()` for better type inference!**

| Feature          | `z.preprocess()`                         | `z.transform()`           |
| ---------------- | ---------------------------------------- | ------------------------- |
| **When it runs** | Before validation                        | After validation          |
| **Input type**   | `unknown` (loses type info)              | Preserves original type   |
| **Use case**     | Accept ANY input (null, undefined, etc.) | Transform validated input |

**Why this matters:**

```typescript
// ❌ BAD: z.preprocess makes input type `unknown`
const rangeField = z.preprocess(
  (val) => normalizeRange(val as string),
  z.string()
);
// z.input<> → unknown (appears optional in unions!)

// ✅ GOOD: z.transform preserves input type
const rangeField = z.string().transform((val) => normalizeRange(val));
// z.input<> → string (correctly required!)
```

### When to Use Each

**Use `z.transform()` when:**

- ✅ Input is already a valid type (string, array, etc.)
- ✅ You want to preserve type info in `z.input<>`
- ✅ Normalizing/transforming after validation (e.g., quoting sheet names)

**Use `z.preprocess()` ONLY when:**

- ⚠️ You MUST accept `unknown` input (e.g., sanitizing null/undefined to empty string)
- ⚠️ Input could be ANY type before validation

**Don't use preprocessing at all when:**

- ❌ Simple validation (use `.refine()`)
- ❌ Default values (use `.default()`)
- ❌ Optional fields (use `.optional()`)

### Real-World Example: Google Sheets

See `packages/bubble-core/src/bubbles/service-bubble/google-sheets/` for a complete example:

```
google-sheets/
├── google-sheets.schema.ts  # Schemas with z.transform() for type-safe transformations
├── google-sheets.utils.ts   # normalizeRange(), sanitizeValues()
├── google-sheets.ts         # Main bubble class
├── index.ts                 # Exports
└── google-sheets.test.ts    # Edge case tests
```

**Key patterns from Google Sheets:**

1. **Schema file** uses `z.transform()` for range normalization (preserves string input type)
2. **Utils file** contains reusable transformation functions
3. **Main class** uses `ParamsInput = z.input<>` for generic constraint (enables discriminated union inference)
4. **Constructor** accepts generic `T` for type inference at instantiation
5. **Internal methods** cast `this.params` to output type when needed (after validation)
6. **Result type** uses `Extract<Result, { operation: T['operation'] }>` for operation-specific results

## Bubble Architecture

### File Structure

**Standard folder structure for all bubbles:**

```
src/bubbles/
├── service-bubble/
│   ├── {service-name}/              # Folder for organized structure
│   │   ├── {service-name}.schema.ts # All Zod schemas (with preprocessing if needed)
│   │   ├── {service-name}.utils.ts  # Utility functions (optional, only if needed)
│   │   ├── {service-name}.ts        # Main bubble class
│   │   ├── index.ts                 # Exports
│   │   └── {service-name}.test.ts   # Unit tests
```

**File responsibilities:**

- **`{service-name}.schema.ts`** - All Zod schemas, type definitions, preprocessing
- **`{service-name}.utils.ts`** - Helper functions (optional, can be empty or contain placeholder comments if not needed)
- **`{service-name}.ts`** - Main bubble class implementation
- **`index.ts`** - Exports for external use
- **`{service-name}.test.ts`** - Unit tests

**Note:** All bubbles use this structure for consistency. The `utils.ts` file can be minimal or contain placeholder comments if no utilities are needed.

### Core Components

1. **Base Classes**:
   - `ServiceBubble<T, R>` - For API integrations and single operations
   - `WorkflowBubble<T, R>` - For multi-step workflows
   - `ToolBubble<T, R>` - For AI agent tools
2. **Zod Schemas**: Define input validation and type inference
3. **TypeScript Types**: Provide compile-time type safety
4. **BubbleFactory**: Central registry for all bubble types
5. **Implementation Methods**: Handle the actual service operations

## Step-by-Step Bubble Creation

### 1. Choose Your Bubble Type

**Service Bubble** - for external API integrations:

- Database connections (PostgreSQL, MongoDB)
- AI model integrations (OpenAI, Google)
- Third-party APIs (Slack, GitHub)
- File operations, HTTP requests

**Workflow Bubble** - for multi-step processes:

- Data analysis pipelines
- Multi-service orchestration
- Complex business logic flows

**Tool Bubble** - for AI agent tools:

- SQL query execution
- File system operations
- API calls that AI agents can use

### 2. Choose Your Pattern

**Use Single Operation Pattern when:**

- Your service has only one main function (like AI chat, file upload, etc.)
- All parameters relate to the same operation
- You want the simplest possible API

**Use Multi-Operation Pattern when:**

- Your service has multiple distinct operations (like Slack: send message, list channels, etc.)
- Each operation has different required parameters
- You want type safety across different operations

### 3. Data Transformation with `z.transform()` (Preferred)

**⚠️ IMPORTANT: Prefer `z.transform()` over `z.preprocess()` for better type inference!**

**When to use `z.transform()`:**

- ✅ Normalizing user input (e.g., quoting sheet names with spaces)
- ✅ Transforming data after validation
- ✅ Preserving input type information for discriminated unions
- ✅ Handling edge cases with known input types

**When to use `z.preprocess()` (rarely):**

- ⚠️ Input could be `null`, `undefined`, or any type that needs sanitization BEFORE validation
- ⚠️ You explicitly want `unknown` as the input type

**When NOT to use either:**

- ❌ Simple validation (use `.refine()` instead)
- ❌ Default values (use `.default()` instead)
- ❌ Optional fields (use `.optional()` instead)

#### Transform Pattern (PREFERRED)

```typescript
// Example: Google Sheets range normalization with z.transform
import { normalizeRange, sanitizeValues } from './{service-name}.utils.js';

// ✅ GOOD: Use z.transform to preserve string input type
const createRangeField = (description: string) =>
  z
    .string()
    .min(1, 'Range is required')
    .transform((val) => normalizeRange(val))
    .describe(description);

// ✅ GOOD: Use z.transform for arrays with known structure
const createRangesField = (description: string) =>
  z
    .array(z.string())
    .min(1, 'At least one range is required')
    .transform((val) => val.map((r) => normalizeRange(r)))
    .describe(description);

// ⚠️ Only use preprocess when input can be null/undefined/any type
// This is for sanitizing unknown input (e.g., converting null → "")
const createValuesField = (description: string) =>
  z
    .array(z.array(z.unknown()))
    .min(1, 'Values array cannot be empty')
    .transform((val) => sanitizeValues(val))
    .describe(description);

// Use in schema
const {ServiceName}ParamsSchema = z.object({
  range: createRangeField('A1 notation range (automatically normalized)'),
  values: createValuesField('Data values (null/undefined automatically converted)'),
});
```

**Important:** Always define both INPUT and OUTPUT types:

```typescript
// INPUT TYPE: For generic constraint and constructor (user-facing)
export type {ServiceName}ParamsInput = z.input<typeof {ServiceName}ParamsSchema>;

// OUTPUT TYPE: For internal methods (after validation/transformation)
export type {ServiceName}Params = z.output<typeof {ServiceName}ParamsSchema>;

// Use INPUT for generic constraint (enables discriminated union inference)
export class {ServiceName}Bubble<
  T extends {ServiceName}ParamsInput = {ServiceName}ParamsInput
> extends ServiceBubble<T, Extract<{ServiceName}Result, { operation: T['operation'] }>> {
  // Cast to OUTPUT type inside methods:
  // const params = this.params as {ServiceName}Params;
}
```

### 4. Define Zod Schemas (Updated Pattern)

#### Modern Parameters Schema

```typescript
// MODERN PATTERN: Include credentials field for all bubbles
const {ServiceName}ParamsSchema = z.object({
  // Your actual parameters
  name: z.string().min(1, 'Name is required'),
  message: z.string().optional().default('Hello from NodeX!'),

  // REQUIRED: Credentials field (automatically injected by runtime)
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Object mapping credential types to values (injected at runtime)'),
});

// For multi-operation bubbles, use discriminated union:
const {ServiceName}ParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('operation_name').describe('Clear description of what this operation does'),
    // Your parameters here
    api_key: z.string().min(1, 'API key is required').describe('Service API key'),
    limit: z.number().min(1).max(1000).optional().default(50).describe('Maximum number of results'),

    // REQUIRED: Credentials field for each operation
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Object mapping credential types to values (injected at runtime)'),
  }),
]);
```

#### Modern Result Schema

```typescript
// MODERN PATTERN: Simple result schema with success/error pattern
const {ServiceName}ResultSchema = z.object({
  // Your actual result data
  greeting: z.string(),

  // REQUIRED: Standard result fields
  success: z.boolean(),
  error: z.string(),
});

// For multi-operation bubbles:
const {ServiceName}ResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('operation_name'),
    // Your result data
    data: z.array({ServiceName}DataSchema).optional(),
    // REQUIRED: Standard result fields
    success: z.boolean(),
    error: z.string(),
  }),
]);
```

### 2. Understanding Input vs Output Types

**CRITICAL CONCEPT:** Zod schemas have two type phases:

- **Input Type** (`z.input<>`) - What users pass to constructor (before validation/transformation)
- **Output Type** (`z.output<>`) - What's stored internally (after validation/transformation)

#### When to Use Each Type

**Input Type (`ParamsInput`):**

- ✅ **Generic constraint** - `class Bubble<T extends ParamsInput>` (enables discriminated union inference!)
- ✅ Constructor default values cast
- ✅ User-facing APIs and exports

**Output Type (`Params`):**

- ✅ Internal method parameters (after validation)
- ✅ Type extraction for specific operations - `Extract<Params, { operation: 'x' }>`
- ✅ Casting `this.params` inside bubble methods

#### Type Definition Pattern

```typescript
// ============================================================================
// TYPE DEFINITIONS - Understanding Input vs Output
// ============================================================================

// INPUT TYPE: What users pass (before transformation)
// Use for: Generic constraint, constructor, user-facing APIs
export type {ServiceName}ParamsInput = z.input<typeof {ServiceName}ParamsSchema>;

// OUTPUT TYPE: What's stored internally (after transformation)
// Use for: Internal methods, type extraction for operations
export type {ServiceName}Params = z.output<typeof {ServiceName}ParamsSchema>;

// RESULT TYPE: Always output (after validation)
export type {ServiceName}Result = z.output<typeof {ServiceName}ResultSchema>;

// Operation-specific types (for internal method parameters)
export type {ServiceName}OperationNameParams = Extract<
  {ServiceName}Params,  // ✅ Use OUTPUT type for extraction
  { operation: 'operation_name' }
>;
```

#### Why Use INPUT Type for Generic Constraint?

**The Problem with OUTPUT type:**

```typescript
// ❌ BAD: Using output type for generic constraint
class Bubble<T extends Params = Params> {
  constructor(params: ParamsInput) { ... }
}

// When you do this:
const bubble = new Bubble({ operation: 'read_values', ... });
// T is inferred as the full union (Params), not the specific operation!
// Result type is also the full union, not narrowed.
```

**The Solution with INPUT type:**

```typescript
// ✅ GOOD: Using input type for generic constraint
class Bubble<T extends ParamsInput = ParamsInput> {
  constructor(params: T) { ... }
}

// When you do this:
const bubble = new Bubble({ operation: 'read_values', ... });
// T is inferred as { operation: 'read_values', ... }
// Result type is correctly narrowed: Extract<Result, { operation: 'read_values' }>
```

#### Why This Matters

**Without Transformations (z.transform/z.preprocess):**

- Input and Output types are usually the same
- Use INPUT type for generic constraint for consistency

**With `z.transform()` (PREFERRED):**

- Input type is **preserved** (e.g., `string` stays `string`)
- Output type may differ (after transformation)
- Discriminated union inference works correctly!
- Example: `range: z.string().transform(normalizeRange)` → input is `string`, output is normalized `string`

**With `z.preprocess()` (USE SPARINGLY):**

- Input type becomes `unknown` (loses type information!)
- ⚠️ This can make required fields appear optional in discriminated unions
- Only use when you MUST accept any input type before validation
- Example: `values: z.preprocess(sanitizeValues, z.array(...))` → accepts null/undefined, outputs clean array

#### Type Flow Example

```typescript
// 1. User passes INPUT type
const bubble = new GoogleSheetsBubble({
  operation: 'update_values',
  range: 'My Sheet!A1',        // Input: string (z.transform preserves type)
  values: [['Name', null]],    // Input: may have null (z.preprocess accepts unknown)
} as GoogleSheetsParamsInput); // ✅ Constructor accepts INPUT

// 2. BaseBubble validates and preprocesses
//    - Range: 'My Sheet!A1' → "'My Sheet'!A1" (normalized via z.transform)
//    - Values: [['Name', null]] → [['Name', '']] (sanitized via z.preprocess)

// 3. Stored internally - this.params is typed as T (INPUT type)
//    But ACTUALLY contains OUTPUT values (after validation)

// 4. In performAction, cast to OUTPUT type for internal use:
protected async performAction(): Promise<...> {
  const params = this.params as GoogleSheetsParams; // Cast to OUTPUT

  switch (params.operation) {
    case 'update_values':
      return await this.updateValues(
        params as Extract<GoogleSheetsParams, { operation: 'update_values' }>
      );
  }
}

// 5. Internal methods receive OUTPUT type (correctly typed after casting)
private async updateValues(
  params: Extract<GoogleSheetsParams, { operation: 'update_values' }> // ✅ OUTPUT type
) {
  // params.range is string (normalized)
  // params.values has no null/undefined (sanitized)
}
```

### 6. Create Data Schemas

Define schemas for API response objects:

```typescript
const {ServiceName}DataSchema = z.object({
  id: z.string().describe('Unique identifier'),
  name: z.string().describe('Human-readable name'),
  created_at: z.string().datetime().describe('ISO datetime when created'),
  // Use .optional() for nullable fields
  description: z.string().optional().describe('Optional description'),
})
```

### 7. Implement the Bubble Class (Modern Pattern)

#### Type Parameter Guidelines

**⚠️ CRITICAL: Use INPUT type for generic constraint to enable discriminated union inference!**

**Standard pattern (always use this for multi-operation bubbles):**

```typescript
// Always define both input and output types in schema file
export type {ServiceName}Params = z.output<typeof {ServiceName}ParamsSchema>; // OUTPUT type (after validation)
export type {ServiceName}ParamsInput = z.input<typeof {ServiceName}ParamsSchema>; // INPUT type (before validation)

export class {ServiceName}Bubble<
  T extends {ServiceName}ParamsInput = {ServiceName}ParamsInput,  // ✅ INPUT type for discriminated union inference
> extends ServiceBubble<
  T,
  Extract<{ServiceName}Result, { operation: T['operation'] }>
> {
  constructor(
    params: T = {
      operation: 'default_operation',
      // ... default values
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected async performAction(context?: BubbleContext): Promise<...> {
    // Cast to OUTPUT type for internal use (base class already validated)
    const parsedParams = this.params as {ServiceName}Params;

    switch (parsedParams.operation) {
      case 'some_operation':
        return await this.someOperation(
          parsedParams as Extract<{ServiceName}Params, { operation: 'some_operation' }>
        );
      // ...
    }
  }
}
```

**Why use INPUT type for generic constraint:**

- ✅ **Discriminated union inference works** - TypeScript narrows `T` based on the `operation` field at instantiation
- ✅ **Result type is correctly narrowed** - `Extract<Result, { operation: T['operation'] }>` gives the right return type
- ✅ **Optional fields work as expected** - Users can omit fields with `.default()` values
- ✅ **Constructor accepts user-friendly partial objects** - No need for all required fields

**Why cast to OUTPUT type internally:**

- The base class validates input and applies defaults
- Internal methods need the OUTPUT type with all fields present
- Use `this.params as {ServiceName}Params` then extract specific operation types

#### Complete Class Template

```typescript
// MODERN PATTERN: Standard class structure with folder organization
export class {ServiceName}Bubble<
  T extends {ServiceName}ParamsInput = {ServiceName}ParamsInput,  // ✅ INPUT type for discriminated union inference
> extends ServiceBubble<
  T,
  Extract<{ServiceName}Result, { operation: T['operation'] }>
> {
  // REQUIRED: Static metadata for BubbleFactory
  static readonly service = 'nodex-core'; // or your service name
  static readonly authType = 'none' as const; // 'none' | 'apikey' | 'oauth' | 'basic'
  static readonly bubbleName = '{service-name}';
  static readonly type = 'service' as const;
  static readonly schema = {ServiceName}ParamsSchema;
  static readonly resultSchema = {ServiceName}ResultSchema;
  static readonly shortDescription = 'Brief description of the service integration';
  static readonly longDescription = \`
    Comprehensive description of the service integration.
    Use cases:
    - List specific use cases
    - That this bubble supports
    Security Features:
    - Authentication method used
    - Data validation and sanitization
  \`;
  static readonly alias = '{service-alias}';

  constructor(
    params: T = {
      operation: 'default_operation',
      // ... other default values
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  // REQUIRED: Implement credential selection logic
  protected chooseCredential(): string | undefined {
    // Cast to output type - base class already validated
    const params = this.params as {ServiceName}Params;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    // Return the appropriate credential for your service
    return credentials[CredentialType.API_KEY_CRED]; // or whatever you need
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<{ServiceName}Result, { operation: T['operation'] }>> {
    void context; // Mark as intentionally unused if not needed

    // ✅ Cast to OUTPUT type - base class already validated and applied defaults
    const params = this.params as {ServiceName}Params;
    const { operation } = params;

    // Switch on operation and cast params to specific operation type
    switch (operation) {
      case 'operation_name':
        return await this.handleOperationName(
          params as Extract<{ServiceName}Params, { operation: 'operation_name' }>
        );
      // ... other operations
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
```

### 5. Implement Operation Methods

```typescript
// ✅ Internal methods receive OUTPUT type (after validation)
private async handleOperationName(
  params: Extract<{ServiceName}Params, { operation: 'operation_name' }>
): Promise<Extract<{ServiceName}Result, { operation: 'operation_name' }>> {
  // No need to parse again - params already validated by base class
  const parsed = {ServiceName}ParamsSchema.parse(params);
  const { api_key, limit, include_metadata } = parsed as Extract<{ServiceName}ParamsParsed, { operation: 'operation_name' }>;

  try {
    const response = await this.makeApiCall(endpoint, {
      apiKey: api_key,
      limit,
      includeMetadata: include_metadata,
    });

    return {
      operation: 'operation_name',
      ok: true,
      data: response.data ? z.array({ServiceName}DataSchema).parse(response.data) : undefined,
    };
  } catch (error) {
    return {
      operation: 'operation_name',
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

## Best Practices

### 1. Parameter Design

#### Required Parameters

- Only make parameters required if they're absolutely necessary

#### Optional Parameters with Defaults

- Provide defaults for 90% of use cases
- Use `.optional().default(value)` pattern
- Example: `limit: z.number().min(1).max(1000).optional().default(50)`

#### Boolean Parameters

- Always provide sensible defaults for booleans
- Example: `include_archived: z.boolean().optional().default(false)`

### 2. Documentation Standards

#### Parameter Descriptions

```typescript
z.string().describe(
  'Clear, actionable description of what this parameter does'
);
```

#### Schema Descriptions

```typescript
const ItemSchema = z
  .object({
    id: z.string().describe('Unique item identifier'),
  })
  .describe('Represents a single item from the service API');
```

### 3. Error Handling

#### API Errors

```typescript
interface ServiceApiError {
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
}
```

#### Consistent Error Format

```typescript
return {
  operation: 'operation_name',
  ok: false,
  error: error instanceof Error ? error.message : 'Unknown error occurred',
};
```

### 4. Type Safety

#### Discriminated Union vs Single Operation Pattern

There are two different patterns depending on your bubble's complexity:

**Pattern A: Single Operation Bubble (like AI Agent)**

```typescript
// Single operation - no discriminated union needed
const AIAgentParamsSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  systemPrompt: z.string().default('You are a helpful AI assistant'), // ✅ Can have defaults
  model: ModelConfigSchema.default({ model: 'google/gemini-2.5-pro' }), // ✅ Can have defaults
});

// Can use either input or output type (no operation discriminator)
export class AIAgentBubble extends ServiceBubble<
  AIAgentParamsInput, // Either works for single operation
  AIAgentResult
> {
  // No operation-based type narrowing needed
}
```

**Pattern B: Multi-Operation Bubble (like GoogleSheets, Slack)**

```typescript
// Multiple operations - discriminated union required
const GoogleSheetsParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('read_values'),
    spreadsheet_id: z.string(),
    range: z.string().transform(normalizeRange), // ✅ z.transform preserves string input type
  }),
  z.object({
    operation: z.literal('update_values'),
    spreadsheet_id: z.string(),
    range: z.string().transform(normalizeRange),
    values: z.array(z.array(z.unknown())).transform(sanitizeValues),
  }),
]);

// ✅ MUST use INPUT type for generic constraint
export class GoogleSheetsBubble<
  T extends GoogleSheetsParamsInput = GoogleSheetsParamsInput, // ✅ INPUT type
> extends ServiceBubble<T, Extract<GoogleSheetsResult, { operation: T['operation'] }>> {

  constructor(
    params: T = {
      operation: 'read_values',
      spreadsheet_id: '',
      range: 'Sheet1!A1',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected async performAction(): Promise<...> {
    // Cast to OUTPUT type for internal use
    const params = this.params as GoogleSheetsParams;

    switch (params.operation) {
      case 'read_values':
        return await this.readValues(
          params as Extract<GoogleSheetsParams, { operation: 'read_values' }>
        );
      // ...
    }
  }

  // Internal methods receive OUTPUT type (after validation/transformation)
  private async readValues(
    params: Extract<GoogleSheetsParams, { operation: 'read_values' }>
  ) {
    // params.range is already normalized (string type, not unknown)
    const { range, spreadsheet_id } = params;
    // ...
  }
}
```

#### Why This Pattern Works

1. **Generic constraint uses INPUT type** → TypeScript infers the specific operation from constructor
2. **Result type uses `T['operation']`** → Correctly narrowed result based on inferred operation
3. **Internal methods cast to OUTPUT type** → Get correct types after validation/transformation
4. **z.transform preserves input types** → Required fields stay required in discriminated unions

#### Common Mistake: Using OUTPUT Type for Generic

```typescript
// ❌ BAD: Using output type loses discriminated union inference
class Bubble<T extends Params = Params> { ... }

const bubble = new Bubble({ operation: 'read_values', ... });
// T is inferred as full union, not specific operation!
```

#### Export Both Types

```typescript
// Export both for different use cases
export type {ServiceName}ParamsInput = z.input<typeof {ServiceName}ParamsSchema>;
export type {ServiceName}Params = z.output<typeof {ServiceName}ParamsSchema>;
```

### 5. Testing Requirements

#### Unit Tests

- Test each operation independently
- Test validation errors
- Test default value application

#### Validation Tests

- Test schema parsing with various inputs
- Test error cases and edge conditions

#### Integration Tests

- Test against real service APIs
- Include environment variable checks for skipping

---

## 🧪 Integration Testing Guide

When creating a new bubble, you must provide comprehensive integration tests. This section covers the two main testing patterns.

### 1. Integration Flow Tests (`.integration.flow.ts`)

Integration flow tests are complete `BubbleFlow` workflows that exercise all bubble operations end-to-end in realistic scenarios.

**Requirements:**

- ✅ Exercise **all or most operations** of your bubble
- ✅ Include **edge cases** (special characters, spaces in names, unicode)
- ✅ Test **null/undefined handling** in data
- ✅ Return **structured results** tracking each operation's success/failure
- ✅ Use **realistic data** and scenarios

**File naming:** `{service-name}.integration.flow.ts`

**Example structure:**

```typescript
import {
  BubbleFlow,
  YourServiceBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  resourceId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

export class YourServiceIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. Test create operation
    const createResult = await new YourServiceBubble({
      operation: 'create',
      name: 'Test With Spaces', // Edge case: spaces in name
      data: [null, undefined, 'valid'], // Edge case: null/undefined
    }).action();

    results.push({
      operation: 'create',
      success: createResult.success,
      details: createResult.success
        ? `Created: ${createResult.data?.id}`
        : createResult.error,
    });

    // 2. Test read operation
    const readResult = await new YourServiceBubble({
      operation: 'read',
      id: createResult.data?.id,
    }).action();

    results.push({
      operation: 'read',
      success: readResult.success,
      details: `Read ${readResult.data?.items?.length || 0} items`,
    });

    // 3. Continue testing other operations...

    return {
      resourceId: createResult.data?.id || '',
      testResults: results,
    };
  }
}
```

📍 **Reference:** See `src/bubbles/service-bubble/google-sheets/google-sheets.integration.flow.ts` for a complete implementation that tests create, read, write, append, clear, and delete operations with edge cases.

---

### 2. Schema Comparison Utility (`compareMultipleWithSchema`)

For bubbles returning arrays of data from APIs, use this utility to validate responses against expected schemas.

```typescript
// In: src/bubbles/service-bubble/your-service/your-service.integration.test.ts
import { compareMultipleWithSchema } from '../../../utils/schema-comparison.js';
import { YourServiceResultSchema } from './your-service.schema.js';

// Expected schema (from bubble's schema file)
const expectedSchema = YourServiceResultSchema;

// Actual data from API
const actualItems = result.data.items;

// Compare expected vs actual
const comparison = compareMultipleWithSchema(expectedSchema, actualItems);
expect(comparison.status).toBe('PASS');
```

📍 **Reference:** See `src/bubbles/service-bubble/apify/apify.integration.test.ts` for a complete example.

---

## Common Patterns

### 1. Discriminated Union for Operations

```typescript
const ParamsSchema = z.discriminatedUnion('operation', [
  // Multiple operations here
]);
```

### 2. Consistent API Call Pattern

```typescript
private async makeApiCall(
  endpoint: string,
  params: Record<string, unknown>,
  method: 'GET' | 'POST' = 'POST'
): Promise<ApiResponse | ApiError> {
  // Implementation with proper error handling
}
```

### 3. Environment-Based Testing

```typescript
// Skip integration tests without real credentials
if (!process.env.API_KEY || process.env.API_KEY.startsWith('test-')) {
  console.log('⚠️  Skipping integration test - no real API key');
  return;
}
```

## Quality Checklist

Before submitting a new bubble, ensure:

- [ ] **ALL FIELDS** have `.describe()` calls (input/output/nested/arrays)
- [ ] Optional parameters have sensible defaults for 90% of use cases
- [ ] Input/output types are strictly typed with Zod
- [ ] TypeScript provides autocompletion and missing parameter errors
- [ ] Unit tests cover all operations
- [ ] Validation tests verify schema behavior
- [ ] Error handling is consistent and informative
- [ ] Documentation follows established patterns
- [ ] **Integration flow test** (`.integration.flow.ts`) exercises all operations end-to-end
- [ ] **Schema comparison** used for bubbles returning array data from APIs

## File Templates

### Standard Service Bubble Template

See `packages/bubble-core/src/bubbles/service-bubble/google-sheets/` as the reference implementation that follows all modern patterns correctly:

- Folder structure with separated files
- Schema with preprocessing
- Utils for helper functions
- Proper input/output type handling

### Tool Bubble Template

See `src/bubbles/tool-bubble/tool-template.ts` for creating AI agent tools.

### Workflow Bubble Template

See `src/bubbles/workflow-bubble/data-analyst.workflow.ts` for multi-step processes."

### Test Template

See `src/bubbles/slack-validation.test.ts` for validation testing patterns.

## BubbleFactory Integration (NEW REQUIREMENT)

All bubbles must be registered in the BubbleFactory to be discoverable by the system. This replaces the old manual import pattern.

### How Bubbles are Discovered

1. **BubbleFactory** - Central registry that manages all bubble types
2. **Dynamic imports** - Bubbles are loaded on-demand to improve performance
3. **Type-safe registration** - All bubbles must implement `BubbleClassWithMetadata`
4. **AI Agent integration** - Tool bubbles are automatically available to AI agents

### Registration in BubbleFactory (REQUIRED)

```typescript
// Add to src/bubble-factory.ts in the registerDefaults() method

// 1. Import your bubble
const { {ServiceName}Bubble } = await import(
  './bubbles/service-bubble/{service-name}.js'
);

// 2. Register in the factory
this.register('{service-name}', {ServiceName}Bubble as BubbleClassWithMetadata);
```

### Export from Index

````typescript
// Add to src/index.ts
export { {ServiceName}Bubble } from './bubbles/service-bubble/{service-name}.js';
export type { {ServiceName}ParamsInput } from './bubbles/service-bubble/{service-name}.js';
```"

### Manual Testing

Create manual test files in `manual-tests/` directory for testing with real API credentials.

## 🚀 **NEW BUBBLE REGISTRATION CHECKLIST**

When creating a new bubble, you must update these **12 locations** for full system integration:

### 1. **Credential Types** (if using new credentials)
📍 **File:** `packages/shared-schemas/src/types.ts`

```typescript
export enum CredentialType {
  // ... existing credentials
  // Add your new credential type
  YOUR_SERVICE_ACCESS_KEY = 'YOUR_SERVICE_ACCESS_KEY',
  YOUR_SERVICE_SECRET_KEY = 'YOUR_SERVICE_SECRET_KEY',
}
```

### 2. **Credential Configuration Map**
📍 **File:** `packages/shared-schemas/src/bubble-definition-schema.ts`

```typescript
export const CREDENTIAL_CONFIGURATION_MAP: Record<
  CredentialType,
  Record<string, BubbleParameterType>
> = {
  // ... existing mappings
  [CredentialType.YOUR_SERVICE_TOKEN]: {}, // Empty object if no special configs needed
};
```

**Note:** Most credentials just need an empty object `{}`. Only add configurations if your service needs special options (like PostgreSQL's `ignoreSSL`).

### 3. **Credential Environment Mapping**
📍 **File:** `packages/shared-schemas/src/credential-schema.ts`

```typescript
export const CREDENTIAL_ENV_MAP: Record<CredentialType, string> = {
  // ... existing mappings
  [CredentialType.YOUR_SERVICE_ACCESS_KEY]: 'YOUR_SERVICE_ACCESS_KEY',
  [CredentialType.YOUR_SERVICE_SECRET_KEY]: 'YOUR_SERVICE_SECRET_KEY',
};
```

### 4. **Frontend Credential Configuration** (Required for UI)
📍 **File:** `apps/bubble-studio/src/pages/CredentialsPage.tsx`

```typescript
// Add to CREDENTIAL_TYPE_CONFIG object:
[CredentialType.YOUR_SERVICE_TOKEN]: {
  label: 'Your Service Name',
  description: 'API key/token for Your Service (what it does)',
  placeholder: 'your_token_format...',
  namePlaceholder: 'My Service Token',
  credentialConfigurations: {},
}

// Add to typeToServiceMap in getServiceNameForCredentialType():
[CredentialType.YOUR_SERVICE_TOKEN]: 'YourService',
```

**Why this matters:** Without this, users will get `Cannot read properties of undefined (reading 'namePlaceholder')` error when adding credentials in the UI.

### 5. **Bubble-to-Credential Mapping**
📍 **File:** `packages/shared-schemas/src/credential-schema.ts`

```typescript
export const BUBBLE_CREDENTIAL_OPTIONS: Record<BubbleName, CredentialType[]> = {
  // ... existing bubbles
  'your-bubble-name': [
    CredentialType.YOUR_SERVICE_ACCESS_KEY,
    CredentialType.YOUR_SERVICE_SECRET_KEY,
  ],
};
```

### 6. **Bubble Name Type Definition**
📍 **File:** `packages/shared-schemas/src/types.ts`

```typescript
export type BubbleName =
  | 'hello-world'
  // ... existing names
  | 'your-bubble-name'; // Add your bubble name here
```

### 7. **Backend Credential Test Parameters** (Required for validation)
📍 **File:** `apps/bubblelab-api/src/services/credential-validator.ts`

```typescript
// In the createTestParameters method, add your credential type:
private static createTestParameters(
  credentialType: CredentialType
): Record<string, unknown> {
  const baseParams: Record<string, unknown> = {};
  switch (credentialType) {
    // ... existing cases
    case CredentialType.YOUR_SERVICE_TOKEN:
      baseParams.operation = 'your_test_operation'; // Use a simple operation for testing
      break;
  }
  return baseParams;
}
```

**⚠️ CRITICAL: Include ALL Required Parameters Without Defaults**

When adding test parameters for your credential type, you MUST include:

1. **All required parameters** that don't have `.optional()` or `.default()` in your bubble's Zod schema
2. **All parameters needed for instantiation** even if they have defaults (to ensure the bubble can be created)

**Common failure case:**
```typescript
// ❌ WRONG - Missing required parameters
case CredentialType.APIFY_CRED:
  // Missing actorId and input - will cause ZodError during validation!
  break;

// ✅ CORRECT - Include all required parameters
case CredentialType.APIFY_CRED:
  baseParams.actorId = 'test-actor-id';
  baseParams.input = { message: 'Hello, how are you?' };
  break;
```

**Why this matters:** The credential validator instantiates your bubble to test the credential. If your bubble's schema has required parameters without defaults, the instantiation will fail with `ZodError` before the credential can even be tested. The validator doesn't automatically parse through your schema to apply defaults - you must provide complete test parameters.

### 8. **System Credential Auto-Injection** (Optional - if credentials should be auto-injected)
📍 **File:** `apps/bubblelab-api/src/services/bubble-flow-parser.ts`

```typescript
export const SYSTEM_CREDENTIALS = new Set<CredentialType>([
  // ... existing credentials
  // Add your credentials for auto-injection (only if you want them available without user setup)
  CredentialType.YOUR_SERVICE_ACCESS_KEY,
  CredentialType.YOUR_SERVICE_SECRET_KEY,
]);
```

**Note:** Only add to SYSTEM_CREDENTIALS if the credential should be automatically available (like AI model keys). Most service-specific credentials should NOT be auto-injected.

### 9. **Bubble Factory Registration**
📍 **File:** `packages/bubble-core/src/bubble-factory.ts`

```typescript
// Import section (in registerDefaults method)
const { YourServiceBubble } = await import('./bubbles/service-bubble/your-service.js');

// Registration section (in registerDefaults method)
this.register('your-bubble-name', YourServiceBubble as BubbleClassWithMetadata);

// ⚠️ IMPORTANT: Add to code generator list (for BubbleFlow generation)
// In listBubblesForCodeGenerator() method:
listBubblesForCodeGenerator(): BubbleName[] {
  return [
    'postgresql',
    'ai-agent',
    // ... existing bubbles
    'your-bubble-name', // ✅ Add your bubble here!
  ];
}

// Boilerplate template imports (for AI code generation)
// Service Bubbles
HelloWorldBubble,
AIAgentBubble,
YourServiceBubble, // Add here too
```

### 10. **Code Generator List** (⚠️ REQUIRED for BubbleFlow generation)
📍 **File:** `packages/bubble-core/src/bubble-factory.ts`

```typescript
// In the listBubblesForCodeGenerator() method
listBubblesForCodeGenerator(): BubbleName[] {
  return [
    'postgresql',
    'ai-agent',
    'slack',
    'resend',
    // ... other bubbles
    'your-bubble-name', // ✅ Add your bubble here!
  ];
}
```

**Why this matters:** Without adding your bubble to `listBubblesForCodeGenerator()`, it won't appear in the BubbleFlow generator UI or be available when AI generates flows. Users won't be able to discover or use your bubble when building flows.

### 11. **Main Package Export**
📍 **File:** `packages/bubble-core/src/index.ts`

```typescript
// Export your bubble class and types
export { YourServiceBubble } from './bubbles/service-bubble/your-service.js';
export type { YourServiceParamsInput } from './bubbles/service-bubble/your-service.js';
```

### 12. **Logo Integration** (Optional but recommended for UI)
📍 **File:** `apps/bubble-studio/src/lib/integrations.ts`

Add your service logo to display in the credentials page and bubble UI:

```typescript
// 1. Add to SERVICE_LOGOS
export const SERVICE_LOGOS: Readonly<Record<string, string>> = Object.freeze({
  // ... existing logos
  YourService: '/integrations/your-service.svg', // Use placeholder path until logo added
});

// 2. Add to INTEGRATIONS array
export const INTEGRATIONS: IntegrationLogo[] = [
  // ... existing integrations
  { name: 'YourService', file: SERVICE_LOGOS['YourService'] },
];

// 3. Add to NAME_ALIASES (for case-insensitive matching)
const NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  // ... existing aliases
  yourservice: 'YourService',
  'your-service': 'YourService',
});

// 4. Add regex matcher to findLogoForBubble
const orderedMatchers: Array<[RegExp, string]> = [
  // ... existing matchers
  [/\byourservice\b|\byour-service\b/, 'YourService'],
];

// 5. Add docs mapping (optional - for future docs support)
const SERVICE_DOCS_BY_CLASS: Readonly<Record<string, string>> = Object.freeze({
  // ... existing docs
  yourservicebubble: 'your-service-bubble',
});
```

📍 **Logo File:** `apps/bubble-studio/public/integrations/your-service.svg`

**Note:** Use a placeholder path in `integrations.ts` first (e.g., `/integrations/placeholder.svg`). Add the actual logo SVG file later. The logo will display:
- In credentials dropdown/list
- Next to bubble instances in flows
- In documentation (future)

## 📚 **Generate Documentation**

After creating your bubble, generate its documentation:

```bash
# Generate docs for your specific bubble
pnpm tsx scripts/generate-bubble-docs.ts --only your-bubble-name

# Or update all bubble docs
pnpm tsx scripts/generate-bubble-docs.ts
```

This creates/updates MDX documentation in `docs/docs/bubbles/` with:
- Quick Start examples
- Input/Output schemas with detailed parameter descriptions
- Operation-specific documentation for multi-operation bubbles

**Note:** For existing docs, only the "Operation Details" section is updated (Quick Start is preserved). Use `--force` to regenerate everything.

## 🔧 **Environment Variables Setup**

Add these to your `.env` file:

```bash
# Your Service Credentials
YOUR_SERVICE_ACCESS_KEY=your_actual_access_key
YOUR_SERVICE_SECRET_KEY=your_actual_secret_key
```

## ✅ **Verification Checklist**

After making all updates:

- [ ] **Types compile**: Run `pnpm run typecheck`
- [ ] **Build succeeds**: Run `pnpm run build`
- [ ] **Bubble registered**: Check `factory.list()` includes your bubble name
- [ ] **Frontend credential config**: Verify you can add credential without errors in UI
- [ ] **Credentials auto-inject**: Test that credentials are automatically provided
- [ ] **BubbleFlow works**: Create test BubbleFlow using your bubble
- [ ] **AI agents can use**: Tool bubbles appear in AI agent tool list
- [ ] **Available in generator**: Bubble appears in `listBubblesForCodeGenerator()` for flow building
- [ ] **Logo displays**: Service logo appears in credentials page and bubble UI (optional)

## 🚨 **Common Integration Issues**

1. **"Cannot read properties of undefined (reading 'namePlaceholder')"** → Check frontend credential config (#4)
2. **"ZodError: expected object, received undefined" when adding credential** → Check backend test parameters (#7)
3. **"Bubble not found in factory"** → Check factory registration (#9)
4. **"Bubble not visible in flow builder"** → Check `listBubblesForCodeGenerator()` (#10)
5. **"Credentials not injected"** → Check system credentials (#8)
6. **"Build error about missing credential in CREDENTIAL_CONFIGURATION_MAP"** → Check credential config map (#2)
7. **TypeScript errors** → Check type definitions (#1, #6)
8. **Build failures** → Check all import/export statements (#9, #11)
9. **"Logo not displaying"** → Check `integrations.ts` and ensure logo file exists (#12)

---

This guide ensures consistent, type-safe, and well-documented Bubble implementations that provide excellent developer experience and maintainable code.`
````
