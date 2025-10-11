# Bubbles Overview

Bubbles are the **fundamental building blocks** of the Bubble Lab platform. They represent modular, reusable components that can be composed together to create powerful automations and workflows.

## What are Bubbles?

Think of Bubbles as **Lego blocks for automation** - each Bubble has a specific purpose and can be connected with others to build complex systems. Every Bubble is:

- **Self-contained** - Has its own configuration, inputs, and outputs
- **Reusable** - Can be used across multiple workflows
- **Composable** - Can be combined with other Bubbles
- **Type-safe** - Fully typed with TypeScript for better development experience

## The Two Types of Bubbles

### 🟦 Service Bubbles

**Direct API wrappers** for external services and systems.

- **Purpose**: Connect to third-party APIs and services
- **Examples**: Slack, PostgreSQL, Gmail, Google Calendar
- **Use when**: You need to interact with external systems

### 🟩 Tool Bubbles

**Capabilities and actions** built on top of Service Bubbles.

- **Purpose**: Encapsulate specific functionality or workflows
- **Examples**: SQL Query Tool, Chart.js Tool, Research Agent Tool
- **Use when**: You need to perform specific tasks or operations

## AI Agent Orchestration

The **AI Agent** acts as an intelligent orchestrator that can use both Service Bubbles and Tool Bubbles in various ways:

### How the AI Agent Works

```
AI Agent (Orchestrator)
├── Uses Service Bubbles directly
│   ├── SlackBubble → Send messages
│   ├── PostgreSQLBubble → Query database
│   └── WebSearchBubble → Search the web
└── Uses Tool Bubbles as capabilities
    ├── sql-query-tool → (uses PostgreSQLBubble internally)
    ├── chart-js-tool → (creates visualizations)
    └── research-agent-tool → (orchestrates multiple web services)
```

### Flexible Usage Patterns

**1. AI Agent Orchestration**

- The AI Agent can intelligently choose and combine Bubbles
- Mix and match Service Bubbles and Tool Bubbles as needed
- Make decisions about which Bubbles to use based on the task

**2. Individual Usage**

- Service Bubbles can be used directly without the AI Agent
- Tool Bubbles can be used independently in your own code
- Each Bubble works as a standalone component

**3. Mixed Usage**

- Combine AI orchestration with direct Bubble usage
- Use AI Agent for complex decisions, direct calls for simple tasks
- Create hybrid workflows that leverage both approaches

## Example Usage Patterns

### Direct Service Bubble Usage

```typescript
// Use Slack Bubble directly
import { CredentialType } from '@bubblelab/shared-schemas';

await new SlackBubble({
  operation: 'send_message',
  channel: '#general',
  text: 'Hello from Bubble Lab!',
  credentials: {
    [CredentialType.SLACK_CRED]: process.env.SLACK_TOKEN as string,
  },
}).action();
```

### Direct Tool Bubble Usage

```typescript
// Use SQL Query Tool directly
import { CredentialType } from '@bubblelab/shared-schemas';

const result = await new SQLQueryTool({
  query: 'SELECT * FROM users WHERE active = true',
  reasoning: 'Getting active users for the dashboard',
  credentials: {
    [CredentialType.DATABASE_CRED]: process.env.DATABASE_URL as string,
  },
}).action();
```

### AI Agent Orchestration

```typescript
// AI Agent uses multiple Bubbles intelligently
const aiAgent = new AIAgentBubble({
  tools: [sqlTool, chartTool, researchTool],
  services: [slack, postgresql, webSearch],
});

const result = await aiAgent.action({
  task: 'Analyze user growth and create a report',
  // AI Agent decides which Bubbles to use and how
});
```

## Key Benefits

- **🔄 Composable**: Mix and match Bubbles to create custom solutions
- **🧠 Intelligent**: AI Agent can orchestrate Bubbles automatically
- **⚡ Flexible**: Use Bubbles individually or with AI orchestration
- **📦 Reusable**: Use the same Bubble across multiple workflows
- **🛠️ Transparent**: Every Bubble is strongly typed and debuggable

## Next Steps

- [Slack Bubble](./service-bubbles/slack-bubble.mdx) - Learn about Service Bubbles
- [SQL Query Tool](./tool-bubbles/sql-query-tool.mdx) - Learn about Tool Bubbles
