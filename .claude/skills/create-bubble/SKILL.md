---
name: create-bubble
description: Create a new Bubble integration for Bubble Lab following all established patterns and best practices from CREATE_BUBBLE_README.md
argument-hint: <service-name> [multi-operation]
disable-model-invocation: true
---

# Create Bubble Skill

Create a new Bubble integration for: **$ARGUMENTS**

Follow the CREATE_BUBBLE_README.md guide at `packages/bubble-core/CREATE_BUBBLE_README.md` exactly.

## Step 1: Gather Requirements

Before writing any code, ask the user:

1. **Service name**: What external service is this integrating with?
2. **Operations**: What operations should this bubble support? (single or multiple)
3. **Authentication**: What auth type? (`none`, `apikey`, `oauth`, `basic`)
4. **Credentials**: What credential types are needed? (API key, access token, etc.)

## Step 2: Create Folder Structure

All bubbles use this folder structure in `packages/bubble-core/src/bubbles/service-bubble/{service-name}/`:

```
{service-name}/
├── {service-name}.schema.ts           # All Zod schemas
├── {service-name}.utils.ts            # Utility functions (optional)
├── {service-name}.ts                  # Main bubble class
├── index.ts                           # Exports
├── {service-name}.test.ts             # Unit tests
└── {service-name}.integration.flow.ts # Integration flow test
```

## Step 3: Create Schema File (`{service-name}.schema.ts`)

Include:

- Parameter schema with `.describe()` on ALL fields
- Result schema with `success` and `error` fields
- Both INPUT and OUTPUT type exports
- Use `z.discriminatedUnion()` for multi-operation bubbles
- Use `z.transform()` over `z.preprocess()` for type preservation
- Always include `credentials` field

## Step 4: Create Main Bubble Class (`{service-name}.ts`)

Required static properties:

- `service`, `authType`, `bubbleName`, `type`, `schema`, `resultSchema`
- `shortDescription`, `longDescription`, `alias`

Use INPUT type for generic constraint:

```typescript
export class {ServiceName}Bubble<
  T extends {ServiceName}ParamsInput = {ServiceName}ParamsInput,
> extends ServiceBubble<T, Extract<{ServiceName}Result, { operation: T['operation'] }>>
```

Implement:

- `constructor` with default values
- `chooseCredential()` method
- `performAction()` method with operation switch

## Step 5: Create Index File (`index.ts`)

Export the bubble class and types.

## Step 6: Create Integration Flow Test (`{service-name}.integration.flow.ts`)

Integration flow tests are complete `BubbleFlow` workflows that exercise all bubble operations end-to-end.

**Requirements:**

- Exercise **all or most operations** of your bubble
- Include **edge cases** (special characters, spaces in names, unicode)
- Test **null/undefined handling** in data
- Return **structured results** tracking each operation's success/failure
- Use **realistic data** and scenarios

**Template structure:**

```typescript
import { BubbleFlow, {ServiceName}Bubble, type WebhookEvent } from '@bubblelab/bubble-core';

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

export class {ServiceName}IntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. Test first operation
    const result1 = await new {ServiceName}Bubble({
      operation: 'operation_name',
      // ... parameters with edge cases
    }).action();

    results.push({
      operation: 'operation_name',
      success: result1.success,
      details: result1.success ? `Success details` : result1.error,
    });

    // 2. Test subsequent operations...
    // Continue testing all operations

    return {
      resourceId: result1.data?.id || '',
      testResults: results,
    };
  }
}
```

**Reference:** See `packages/bubble-core/src/bubbles/service-bubble/google-sheets/google-sheets.integration.flow.ts` for a complete implementation.

## Step 7: Complete Registration Checklist

You MUST update these 12 locations:

1. **Credential Types** - `packages/bubble-shared-schemas/src/types.ts`
   - Add new `CredentialType` enum values

2. **Credential Configuration Map** - `packages/bubble-shared-schemas/src/bubble-definition-schema.ts`
   - Add to `CREDENTIAL_CONFIGURATION_MAP`

3. **Credential Environment Mapping** - `packages/bubble-shared-schemas/src/credential-schema.ts`
   - Add to `CREDENTIAL_ENV_MAP`

4. **Frontend Credential Configuration** - `apps/bubble-studio/src/pages/CredentialsPage.tsx`
   - Add to `CREDENTIAL_TYPE_CONFIG`
   - Add to `typeToServiceMap`

5. **Bubble-to-Credential Mapping** - `packages/bubble-shared-schemas/src/credential-schema.ts`
   - Add to `BUBBLE_CREDENTIAL_OPTIONS`

6. **Bubble Name Type Definition** - `packages/bubble-shared-schemas/src/types.ts`
   - Add to `BubbleName` type

7. **Backend Credential Test Parameters** - `apps/bubblelab-api/src/services/credential-validator.ts`
   - Add to `createTestParameters` method with ALL required parameters

8. **System Credential Auto-Injection** (optional) - `apps/bubblelab-api/src/services/bubble-flow-parser.ts`
   - Add to `SYSTEM_CREDENTIALS` if needed

9. **Bubble Factory Registration** - `packages/bubble-core/src/bubble-factory.ts`
   - Import and register the bubble
   - Add to boilerplate imports

10. **Code Generator List** - `packages/bubble-core/src/bubble-factory.ts`
    - Add to `listBubblesForCodeGenerator()`

11. **Main Package Export** - `packages/bubble-core/src/index.ts`
    - Export bubble class and types

12. **Logo Integration** (optional) - `apps/bubble-studio/src/lib/integrations.ts`
    - Add to `SERVICE_LOGOS`, `INTEGRATIONS`, `NAME_ALIASES`, and matchers

## Step 8: Verification

Run these commands to verify:

```bash
pnpm run typecheck
pnpm run build
```

## Quality Checklist

Before completing, ensure:

- [ ] ALL fields have `.describe()` calls
- [ ] Optional parameters have sensible defaults
- [ ] Input/output types are strictly typed with Zod
- [ ] Unit tests cover all operations
- [ ] **Integration flow test** exercises all operations end-to-end
- [ ] Error handling is consistent
- [ ] All 12 registration locations updated

## Key Patterns to Follow

**Type Safety:**

- Use INPUT type (`z.input<>`) for generic constraints and constructor
- Use OUTPUT type (`z.output<>`) for internal methods after validation
- Cast `this.params as {ServiceName}Params` inside `performAction()`

**Schema Best Practices:**

- Use `z.transform()` to preserve input types in discriminated unions
- Use `z.preprocess()` only when accepting unknown/null/undefined inputs
- All fields MUST have `.describe()` calls
- Provide sensible defaults with `.optional().default(value)`

**Error Handling:**

- Return `{ success: false, error: message }` format
- Catch and wrap errors appropriately

## Reference Implementations

Study these existing bubbles for patterns:

- Multi-operation: `packages/bubble-core/src/bubbles/service-bubble/google-sheets/`
- Single operation: `packages/bubble-core/src/bubbles/service-bubble/ai-agent/`
- Tool bubble: `packages/bubble-core/src/bubbles/tool-bubble/`
