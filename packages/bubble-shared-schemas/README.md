# @bubblelab/shared-schemas

This package contains shared Zod schemas and TypeScript types that are used by both the frontend (nodex-dashboard) and backend (bubblelab-api) applications.

**IMPORTANT**: All new API schemas should be written in this shared package to ensure type safety and consistency between frontend and backend applications.

## Usage

### Backend (bubblelab-api)

```typescript
// Import schemas for validation
import {
  createBubbleFlowSchema,
  createCredentialSchema,
} from '@bubblelab/shared-schemas';

// Import types for TypeScript
import type {
  CreateBubbleFlowRequest,
  CreateCredentialRequest,
} from '@bubblelab/shared-schemas';
```

### Frontend (nodex-dashboard)

```typescript
// Import types for API calls
import type {
  CreateBubbleFlowRequest,
  CreateBubbleFlowResponse,
  CredentialResponse,
} from '@bubblelab/shared-schemas';

// Use in API service functions
const createBubbleFlow = async (
  data: CreateBubbleFlowRequest
): Promise<CreateBubbleFlowResponse> => {
  // API call implementation
};
```

## Available Schemas

### BubbleFlow Schemas

- `createBubbleFlowSchema` - Create new BubbleFlow
- `executeBubbleFlowSchema` - Execute BubbleFlow
- `updateBubbleFlowParametersSchema` - Update BubbleFlow parameters
- `createBubbleFlowResponseSchema` - Create BubbleFlow response
- `executeBubbleFlowResponseSchema` - Execute BubbleFlow response
- `bubbleFlowDetailsResponseSchema` - Get BubbleFlow details response
- `listBubbleFlowsResponseSchema` - List BubbleFlows response

### Credential Schemas

- `createCredentialSchema` - Create new credential
- `credentialResponseSchema` - Credential response
- `createCredentialResponseSchema` - Create credential response

### Webhook Schemas

- `webhookResponseSchema` - Webhook response
- `webhookExecutionResponseSchema` - Webhook execution response
- `slackUrlVerificationSchema` - Slack URL verification
- `slackUrlVerificationResponseSchema` - Slack URL verification response

### Common Schemas

- `errorResponseSchema` - Error response
- `successMessageResponseSchema` - Success message response

## Development

### Building

To build the package:

```bash
pnpm build
```

### Auto-rebuild Options

**Option 1: Watch Mode (Recommended for Development)**

```bash
# From root directory
pnpm build:core:watch

# Or from shared-schemas directory
pnpm dev
```

**Option 2: Development Mode**

```bash
# Watch both core and schemas
pnpm dev:core

# Watch all packages
pnpm dev:all
```

**Option 3: Pre-commit Hook (Automatic)**
The pre-commit hook automatically builds schemas when they change:

```bash
# Make the script executable (one-time setup)
chmod +x scripts/pre-commit.sh
```

**Option 4: VS Code Extension**
Install "File Watcher" extension to automatically run build commands when files change.

## Adding New Schemas

1. **Define the Zod schema** in `src/routes.ts` with proper OpenAPI metadata
2. **Export the schema** for validation
3. **Export the TypeScript type** using `z.infer<typeof schemaName>`
4. **Update the documentation** at the top of `src/routes.ts`
5. **Rebuild the package**: `pnpm build:core` (from root)

## Schema Organization

The schemas are organized into sections in `src/routes.ts`:

- **Request Schemas**: Input validation for API endpoints
- **Response Schemas**: Output types for API responses
- **Webhook Schemas**: Special schemas for webhook handling
- **TypeScript Types**: Derived types for use in both frontend and backend

## Benefits

1. **Type Safety**: Shared types ensure frontend and backend are always in sync
2. **Single Source of Truth**: All API schemas are defined in one place
3. **Consistency**: Both applications use the same validation rules
4. **Maintainability**: Changes to schemas automatically propagate to both apps
