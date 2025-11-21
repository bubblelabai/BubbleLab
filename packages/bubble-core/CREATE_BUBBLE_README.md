# Bubble Creation Guide for AI Agents

This document serves as a comprehensive guide for AI agents to understand the codebase and create new Bubbles following established patterns and best practices.

## Core Principles

1. **Type Safety First**: All input/output types must be strictly typed using Zod schemas
2. **Developer Experience**: Ensure TypeScript errors when parameters are missing, provide autocompletion and hints
3. **Comprehensive Documentation**: Every parameter and operation must be thoroughly documented with `.describe()` calls
4. **Consistency**: Follow established naming conventions and patterns
5. **Optimized Defaults**: Provide sensible defaults for 90% of use cases

## Bubble Architecture

### File Structure

```
src/bubbles/
├── service-bubble/             # Service bubbles (API integrations, etc.)
│   ├── {service-name}.ts       # Main bubble implementation
│   └── {service-name}.test.ts  # Unit tests
├── workflow-bubble/            # Workflow bubbles (multi-step processes)
│   ├── {workflow-name}.workflow.ts
│   └── {workflow-name}.workflow.test.ts
├── tool-bubble/                # Tool bubbles (AI agent tools)
│   ├── {tool-name}-tool.ts
│   └── {tool-name}-tool.test.ts
└── bubble-factory.ts           # Registration of all bubbles
```

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

### 3. Define Zod Schemas (Updated Pattern)

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

### 2. Define TypeScript Types

```typescript
// Export the input type for external usage
export type {ServiceName}ParamsInput = z.input<typeof {ServiceName}ParamsSchema>;

// Internal types for implementation
type {ServiceName}Params = z.input<typeof {ServiceName}ParamsSchema>;
type {ServiceName}ParamsParsed = z.output<typeof {ServiceName}ParamsSchema>;
type {ServiceName}Result = z.output<typeof {ServiceName}ResultSchema>;

// Exported specific operation types for better DX
export type {ServiceName}OperationNameParams = Extract<
  {ServiceName}Params,
  { operation: 'operation_name' }
>;
```

### 3. Create Data Schemas

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

### 4. Implement the Bubble Class (Modern Pattern)

```typescript
// MODERN PATTERN: Simpler class structure following hello-world example
export class {ServiceName}Bubble extends ServiceBubble<
  {ServiceName}ParamsParsed,
  {ServiceName}Result
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

  constructor(params: {ServiceName}Params, context?: BubbleContext) {
    super(params, context);
  }

  // REQUIRED: Implement credential selection logic
  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    // Return the appropriate credential for your service
    return credentials[CredentialType.API_KEY_CRED]; // or whatever you need
  }

  protected async performAction(context?: BubbleContext): Promise<{ServiceName}Result> {
    void context; // Mark as intentionally unused if not needed

    try {
      // Your implementation logic here
      const result = await this.doSomething();

      return {
        // Your result data
        data: result,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        data: undefined,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
```

### 5. Implement Operation Methods

```typescript
private async handleOperationName(
  params: Extract<{ServiceName}Params, { operation: 'operation_name' }>
): Promise<Extract<{ServiceName}Result, { operation: 'operation_name' }>> {
  // Parse params to apply defaults
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

// Can use parsed type as generic parameter
export class AIAgentBubble extends ServiceBubble<
  AIAgentParamsParsed, // ✅ Uses parsed type directly
  AIAgentResult
> {
  // No manual parsing needed - defaults are already applied!
}
```

**Pattern B: Multi-Operation Bubble (like Slack)**

```typescript
// Multiple operations - discriminated union required
const SlackParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('list_channels'), // ❌ Discriminator cannot have default
    types: z.array(ChannelTypes).optional().default([...]), // ✅ Other fields can have defaults
    limit: z.number().optional().default(50), // ✅ Other fields can have defaults
  }),
  z.object({
    operation: z.literal('send_message'), // ❌ Discriminator cannot have default
    text: z.string().min(1, 'Message is required'),
  }),
]);

// Must use input type as generic parameter
export class SlackBubble<
  T extends SlackParams = SlackParams, // ✅ Uses input type
> extends ServiceBubble<T, Extract<SlackResult, { operation: T['operation'] }>> {

  // ⚠️ IMPORTANT: Cast default through Extract type to avoid "operation: any"
  constructor(
    params: T = { operation: 'list_channels' } as Extract<
      SlackParams,
      { operation: 'list_channels' }
    > as T, // ✅ Cast to specific operation type, then to T
    context?: BubbleContext
  ) {
    super(params, context);
  }

  // Manual parsing required for operations with defaults
  private async listChannels(params: Extract<SlackParams, { operation: 'list_channels' }>) {
    const parsed = SlackParamsSchema.parse(params); // ✅ Parse to apply defaults
    const { types, limit } = parsed as Extract<SlackParamsParsed, { operation: 'list_channels' }>;
  }
}
```

#### Why This Difference?

- **Discriminated unions** require the discriminator field (`operation`) to be explicitly provided to determine which branch to use
- **The discriminator cannot have a default value** - Zod needs it to choose the correct schema branch
- **Other fields within each branch CAN have defaults** and work as expected
- **Single operation schemas** don't need discriminators, so all fields can have defaults

#### Export Input Types for External Use

```typescript
// This is what users import and use
export type {ServiceName}ParamsInput = z.input<typeof {ServiceName}ParamsSchema>;
```

### 5. Testing Requirements

#### Unit Tests

- Test each operation independently
- Test validation errors
- Test default value application

#### Validation Tests

- Test schema parsing with various inputs
- Test error cases and edge conditions

#### Integration Tests (Optional)

- Test against real service APIs
- Include environment variable checks for skipping

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
- [ ] Integration tests exist (if applicable)

## File Templates

### Basic Service Bubble Template

See `src/bubbles/service-bubble/hello-world.ts` as the reference implementation that follows all modern patterns correctly.

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

### 5a. **Alternative Auth Methods (Credential Groups)** (Optional)
📍 **File:** `packages/shared-schemas/src/credential-schema.ts`

If your service supports multiple authentication methods (e.g., OAuth AND API Key), you need to configure them as a **credential group**. This tells the UI to display them as alternatives where the user only needs to provide ONE of them, not all.

```typescript
// Add to CREDENTIAL_GROUPS if your service has alternative auth methods
export const CREDENTIAL_GROUPS: Record<string, CredentialGroupConfig> = {
  // ... existing groups
  'your-service': {
    label: 'Your Service',  // Display name for the group
    types: [CredentialType.YOUR_SERVICE_OAUTH, CredentialType.YOUR_SERVICE_API_KEY],
    typeLabels: {
      [CredentialType.YOUR_SERVICE_OAUTH]: 'OAuth',
      [CredentialType.YOUR_SERVICE_API_KEY]: 'API Key',
    },
  },
};
```

**Why this matters:**
- Without this, the UI will show both credential types as **required** (user must provide both)
- With this configuration, they are shown as **alternatives** (user picks one)
- The validation will pass when ANY one of the group is selected
- The credential dropdown will show them grouped with labels like "OAuth" and "API Key"

**Example use case:** Follow Up Boss supports both OAuth and API Key authentication:
```typescript
followupboss: {
  label: 'Follow Up Boss',
  types: [CredentialType.FUB_CRED, CredentialType.FUB_API_KEY_CRED],
  typeLabels: {
    [CredentialType.FUB_CRED]: 'OAuth',
    [CredentialType.FUB_API_KEY_CRED]: 'API Key',
  },
},
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

**Why this matters:** The backend needs minimal valid parameters to instantiate your bubble for credential validation. Without this, you'll get `ZodError: expected object, received undefined` when adding credentials.

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

## 🎯 **Quick Validation Test**

```typescript
// Test your bubble registration
import { BubbleFactory } from '@bubblelab/bubble-core';

const factory = new BubbleFactory();
await factory.registerDefaults();

console.log('All bubbles:', factory.list());
console.log('Your bubble registered:', factory.list().includes('your-bubble-name'));

// Test bubble creation
const yourBubble = factory.createBubble('your-bubble-name', {
  operation: 'your-operation',
  // ... your parameters
});

console.log('✅ Bubble created successfully');
```

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
