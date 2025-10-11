# NodeX API - Dynamic BubbleFlow Execution Service

A backend service that safely validates, stores, and executes user-submitted TypeScript code using the BubbleFlow framework.

## Overview

This service allows users to:

- Write TypeScript code that extends `BubbleFlow`
- Submit it for validation and storage
- Execute stored flows on-demand with custom payloads

## Architecture

### Key Components

1. **TypeScript Validation** - Uses the TypeScript compiler API to validate code
2. **Code Processing** - Transpiles TypeScript and transforms ES modules for execution
3. **Sandboxed Execution** - Runs user code in an isolated environment
4. **Database Storage** - Stores processed code ready for fast execution

### How It Works

```
User Code (TypeScript) → Validation → Processing → Storage → Execution
```

1. **User submits TypeScript code** with ES module imports
2. **Validation ensures** the code is valid TypeScript and extends BubbleFlow
3. **Processing transpiles** to JavaScript and transforms imports to work without a module system
4. **Storage saves** the processed code to database (SQLite)
5. **Execution runs** the code in a sandboxed environment with controlled dependencies

## API Endpoints

### POST /bubble-flow

Create and store a new BubbleFlow.

**Request:**

```json
{
  "name": "My Flow",
  "description": "A flow that processes webhooks",
  "code": "import { BubbleFlow } from '@bubblelab/bubble-core';\n\nexport class MyFlow extends BubbleFlow<'webhook/http'> {...}",
  "eventType": "webhook/http"
}
```

**Response:**

```json
{
  "id": 1,
  "message": "BubbleFlow created successfully"
}
```

### POST /execute-bubble-flow/:id

Execute a stored BubbleFlow with a payload.

**Request:**

```json
{
  "payload": {
    "name": "John",
    "email": "john@example.com"
  }
}
```

**Response:**

```json
{
  "executionId": 1,
  "success": true,
  "data": {
    "message": "Hello, John!"
  }
}
```

## Code Transformation

### Before (User Code):

```typescript
import { BubbleFlow, AIAgentBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class GreetingFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']) {
    const ai = new AIAgentBubble({ message: 'Hello!' });
    return { greeting: await ai.action() };
  }
}
```

### After (Processed Code):

```javascript
const { BubbleFlow, AIAgentBubble } = __bubbleCore;

class GreetingFlow extends BubbleFlow {
  async handle(payload) {
    const ai = new AIAgentBubble({ message: 'Hello!' });
    return { greeting: await ai.action() };
  }
}
```

## Security & Sandboxing

User code runs in a sandboxed environment with:

- **No filesystem access**
- **No network access** (unless through provided bubbles)
- **No require/import capabilities**
- **Only access to \_\_bubbleCore and provided payload**
- **Prefixed console output** for debugging

## Technology Stack

- **Runtime**: Bun
- **Framework**: Hono (lightweight Express alternative)
- **Database**: SQLite with Drizzle ORM
- **Validation**: TypeScript Compiler API
- **Testing**: Jest with supertest-like utilities

## Getting Started

### Prerequisites

- Bun installed
- pnpm package manager

### Installation

```bash
pnpm install
```

### Development

```bash
# Start the server
bun run src/index.ts

# Run tests
pnpm test

# Run database migrations
bun run drizzle-kit push
```

### Environment Variables

```bash
# Optional - defaults to file:./dev.db
DATABASE_URL=file:./dev.db

# For AI bubbles (if using)
GOOGLE_API_KEY=your-key-here
```

## Example Usage

```typescript
// 1. Create a flow
const response = await fetch('http://localhost:3001/bubble-flow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Email Processor',
    code: `
      import { BubbleFlow } from '@bubblelab/bubble-core';
      
      export class EmailFlow extends BubbleFlow<'webhook/http'> {
        async handle(payload) {
          return {
            processed: true,
            email: payload.body.email
          };
        }
      }
    `,
    eventType: 'webhook/http',
  }),
});

const { id } = await response.json();

// 2. Execute the flow
const result = await fetch(`http://localhost:3001/execute-bubble-flow/${id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payload: { email: 'user@example.com' },
  }),
});
```

## Performance

- **Validation**: ~50ms (one-time during creation)
- **Execution**: ~0.1ms (using pre-processed code)
- **Storage**: Processed code is stored, avoiding re-processing

## Docker Support

```bash
# Build image
docker build -t bubblelab-api .

# Run container
docker-compose up
```

## Testing

The project includes comprehensive Jest tests:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- bubble-flow.test.ts

# Test manually
bun run test-bubble-flow.ts
```

## License

[Your License Here]
