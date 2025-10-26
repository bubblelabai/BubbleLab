# Bubble System Documentation

## Overview

The Bubble system is a TypeScript-based framework for creating reusable, type-safe modules that can be executed in various contexts. Each bubble encapsulates functionality with validated parameters and structured results.

## Core Components

### 1. Bubble Base Class

The abstract `Bubble` class provides the foundation for all bubbles:

```typescript
export abstract class Bubble<TParams = unknown, TResult = unknown>
```

**Key Properties:**

- `name`: Unique identifier for the bubble
- `schema`: Zod schema for parameter validation
- `params`: Validated parameters (accessible via `this.params.attribute`)
- `shortDescription`: Brief description of the bubble's purpose
- `longDescription`: Detailed description with use cases
- `alias`: Optional short name for the bubble

### 2. Type System

The bubble system uses a dual-type approach for maximum flexibility:

```typescript
// Input type - what the constructor accepts (optional fields allowed)
type HelloWorldParamsInput = z.input<typeof HelloWorldParamsSchema>;

// Output type - what gets validated and stored (defaults applied)
type HelloWorldParams = z.output<typeof HelloWorldParamsSchema>;
```

**Constructor accepts:** Input type (with optional fields)
**Internal storage:** Output type (with defaults applied)

### 3. Parameter Validation

Parameters are validated using Zod schemas with support for:

- Required fields
- Optional fields with defaults
- Type validation
- Custom validation rules
- **Discriminated unions for operation-based bubbles (recommended for multiple operations)**

#### Simple Schema (Single Operation)

```typescript
const HelloWorldParamsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  message: z.string().optional().default('Hello from NodeX!'),
});
```

#### **Discriminated Union Schema (Multiple Operations) - RECOMMENDED**

For bubbles with multiple operations, use discriminated unions to provide **superior type safety and IntelliSense**:

```typescript
const StorageParamsSchema = z.discriminatedUnion('operation', [
  // Get upload URL operation
  z.object({
    operation: z.literal('getUploadUrl'),
    bucketName: z.string().min(1, 'Bucket name is required'),
    fileName: z.string().min(1, 'File name is required'),
    contentType: z.string().optional(),
    expirationMinutes: z.number().optional().default(60),
  }),

  // Delete file operation
  z.object({
    operation: z.literal('deleteFile'),
    bucketName: z.string().min(1, 'Bucket name is required'),
    fileName: z.string().min(1, 'File name is required'),
    // Note: no contentType needed for deletion
  }),
]);
```

**Benefits of Discriminated Unions:**

- ✅ **Perfect IntelliSense**: TypeScript knows exactly which fields are available based on the operation
- ✅ **Compile-time validation**: Catches invalid field combinations at build time
- ✅ **Better developer experience**: Auto-completion only shows relevant fields
- ✅ **Type-safe results**: Each operation returns its specific result type

## Creating a Bubble

### Step 1: Define the Schema

#### For Single-Operation Bubbles:

```typescript
const MyBubbleParamsSchema = z.object({
  requiredField: z.string(),
  optionalField: z.string().optional().default('default value'),
});

type MyBubbleParamsInput = z.input<typeof MyBubbleParamsSchema>;
type MyBubbleParams = z.output<typeof MyBubbleParamsSchema>;
type MyBubbleResult = { result: string };
```

#### **For Multi-Operation Bubbles (RECOMMENDED PATTERN):**

```typescript
// Parameters with discriminated union
const MyBubbleParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create'),
    name: z.string(),
    data: z.string(),
  }),
  z.object({
    operation: z.literal('delete'),
    id: z.string(),
    // Note: different fields per operation
  }),
]);

// Results with discriminated union
const MyBubbleResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('create'),
    success: z.boolean(),
    id: z.string().optional(),
    error: z.string(),
  }),
  z.object({
    operation: z.literal('delete'),
    success: z.boolean(),
    deleted: z.boolean().optional(),
    error: z.string(),
  }),
]);

type MyBubbleParams = z.input<typeof MyBubbleParamsSchema>;
type MyBubbleResult = z.output<typeof MyBubbleResultSchema>;

// Helper type for operation-specific results
export type MyBubbleOperationResult<T extends MyBubbleParams['operation']> =
  Extract<MyBubbleResult, { operation: T }>;
```

### Step 2: Implement the Bubble Class

#### **Multi-Operation Bubble (RECOMMENDED):**

```typescript
export class MyBubble<
  T extends MyBubbleParams = MyBubbleParams,
> extends ServiceBubble<
  T,
  Extract<MyBubbleResult, { operation: T['operation'] }>
> {
  static readonly service = 'my-service';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'my-bubble';
  static readonly schema = MyBubbleParamsSchema;
  static readonly resultSchema = MyBubbleResultSchema;

  constructor(
    params: T = { operation: 'create', name: 'default' } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<MyBubbleResult, { operation: T['operation'] }>> {
    const { operation } = this.params;

    const result = await (async (): Promise<MyBubbleResult> => {
      switch (operation) {
        case 'create':
          return await this.createItem(this.params);
        case 'delete':
          return await this.deleteItem(this.params);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    })();

    return result as Extract<MyBubbleResult, { operation: T['operation'] }>;
  }

  private async createItem(
    params: Extract<MyBubbleParams, { operation: 'create' }>
  ): Promise<Extract<MyBubbleResult, { operation: 'create' }>> {
    // TypeScript knows exactly what params are available here!
    const { name, data } = params;

    // Your implementation here...

    return {
      operation: 'create',
      success: true,
      id: 'new-id-123',
      error: '',
    };
  }

  private async deleteItem(
    params: Extract<MyBubbleParams, { operation: 'delete' }>
  ): Promise<Extract<MyBubbleResult, { operation: 'delete' }>> {
    // TypeScript knows this has 'id' but not 'name' or 'data'
    const { id } = params;

    // Your implementation here...

    return {
      operation: 'delete',
      success: true,
      deleted: true,
      error: '',
    };
  }
}
```

#### Single-Operation Bubble:

```typescript
export class MySimpleBubble extends ServiceBubble<
  MyBubbleParams,
  MyBubbleResult
> {
  // ... same pattern but without operation discrimination
}
```

### Step 3: Register the Bubble

```typescript
import { BubbleRegistry } from '@bubblelab/bubble-core';
import { MyBubble } from './my-bubble.js';

// Register the bubble class
BubbleRegistry.register('my-bubble', MyBubble);
```

## Using Bubbles

### Direct Instantiation

```typescript
// Create an instance (message is optional due to default)
const bubble = new HelloWorldBubble({
  name: 'World',
  // message will default to 'Hello from NodeX!'
});

// Execute the bubble
const result = await bubble.action();
console.log(result.data?.greeting); // "Hello from NodeX! World!"
```

### Via Registry

```typescript
// Create instance through registry
const bubble = BubbleRegistry.create('hello-world', { name: 'World' });
const result = await bubble?.action();
```

### Registry Operations

```typescript
// List all registered bubbles
const bubbleNames = BubbleRegistry.list();

// Get a specific bubble class
const BubbleClass = BubbleRegistry.get('hello-world');

// Get all bubble classes
const allBubbles = BubbleRegistry.getAll();
```

## Parameter Access Patterns

### Inside Bubble Methods

```typescript
protected async performAction(): Promise<MyResult> {
  // Access individual parameters
  const userName = this.params.name;
  const message = this.params.message; // Always defined due to default

  // Destructure parameters
  const { name, message } = this.params;

  // Parameters are readonly and type-safe
  // this.params.name = 'new name'; // ❌ Compilation error

  return { greeting: `${message} ${name}!` };
}
```

### Parameter Types

```typescript
// Input type (constructor parameter)
new MyBubble({ name: 'test' }); // ✅ message is optional

// Internal type (this.params)
this.params.name; // ✅ string
this.params.message; // ✅ string (default applied)
```

## Execution Results

All bubble executions return a standardized result:

```typescript
interface BubbleResult<T> {
  success: boolean;
  data?: T; // Your bubble's return data
  error?: string; // Error message if failed
  executionId: string; // Unique execution ID
  timestamp: Date; // Execution timestamp
}
```

### Success Example

```typescript
{
  success: true,
  data: { greeting: "Hello World!" },
  executionId: "uuid-here",
  timestamp: new Date(),
  error: undefined
}
```

### Error Example

```typescript
{
  success: false,
  data: undefined,
  error: "Parameter validation failed: Name is required",
  executionId: "uuid-here",
  timestamp: new Date()
}
```

## Best Practices

### 1. Schema Design

- Use descriptive validation messages
- Provide sensible defaults for optional fields
- Use specific types rather than `any`

```typescript
z.string().min(1, 'Name cannot be empty');
z.number().positive('Count must be positive');
z.enum(['dev', 'staging', 'prod'], { message: 'Invalid environment' });
```

### 2. Type Safety

- Always use input/output type pattern
- Avoid `any` types
- Use generics for reusable bubbles

### 3. Error Handling

- Let the base class handle parameter validation
- Focus on business logic errors in `performAction`
- Return meaningful error messages

```typescript
protected async performAction(): Promise<MyResult> {
  try {
    // Your logic here
    return { result: 'success' };
  } catch (error) {
    // Let the base class handle error formatting
    throw new Error(`Failed to process: ${error.message}`);
  }
}
```

```typescript
// When developer types this...
const uploader = new StorageBubble({
  operation: 'getUploadUrl',
  bucketName: 'my-bucket',
  fileName: 'document.pdf',
  // TypeScript auto-suggests: contentType, expirationMinutes
  // TypeScript DOES NOT suggest: fileContent (only for updateFile)
});

// VS when they type this...
const deleter = new StorageBubble({
  operation: 'deleteFile',
  bucketName: 'my-bucket',
  fileName: 'document.pdf',
  // TypeScript ONLY suggests relevant fields for deletion
  // NO contentType or fileContent suggestions
});
```

### **Perfect Result Types:**

```typescript
// Result type is automatically narrowed based on operation
const uploadResult = await uploader.action();
// uploadResult.uploadUrl ✅ (available)
// uploadResult.deleted ❌ (TypeScript error - not available for upload)

const deleteResult = await deleter.action();
// deleteResult.deleted ✅ (available)
// deleteResult.uploadUrl ❌ (TypeScript error - not available for delete)
```
