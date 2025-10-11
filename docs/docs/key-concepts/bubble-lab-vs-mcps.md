# Bubble Lab vs Model Context Protocols (MCPs)

> **TL;DR**: Bubble Lab is a complete workflow orchestration platform, while MCPs are a tool integration protocol. Choose Bubble Lab when you need full-featured AI workflows; choose MCPs for simple tool connectivity.

---

## What's the Difference?

### Bubble Lab: Complete Workflow Platform

- **Full-stack automation** with visual workflow building
- **TypeScript-native** with complete type safety
- **Imperative programming** - you write actual executable code
- **Multi-layered architecture** (Service, Tool, Workflow, UI, Infra bubbles)
- **Built-in security** with credential management and sandboxed execution
- **Enterprise orchestration** with platforms like Inngest/Temporal

### MCPs: Tool Integration Protocol

- **Tool integration standard** for connecting AI models to external tools
- **Protocol specification** rather than a complete platform
- **Declarative approach** - you define tools and their schemas
- **Focused on tool discovery and invocation**
- **Language-agnostic** protocol

---

## When to Choose Bubble Lab

✅ **Choose Bubble Lab when you need:**

- **Complete workflow orchestration** beyond just tool integration
- **TypeScript-first development** with full type safety
- **Visual workflow building** and natural language to code generation
- **Complex multi-step workflows** with conditional logic and data flow
- **Built-in security and credential management**
- **Production-ready execution** with retry, monitoring, and scaling

**Example Use Case:**

```ts
export class CustomerOnboardingFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookPayload): Promise<WorkflowResult> {
    // 1. Validate customer data
    const validation = await new ValidationBubble({
      schema: customerSchema,
      data: payload.customer,
    }).action();

    // 2. Create database record
    const dbResult = await new PostgreSQLBubble({
      query: 'INSERT INTO customers (name, email) VALUES (?, ?)',
      parameters: [payload.customer.name, payload.customer.email],
    }).action();

    // 3. Send welcome email
    const emailResult = await new GmailBubble({
      operation: 'send',
      to: payload.customer.email,
      subject: 'Welcome!',
      body: 'Thanks for joining us!',
    }).action();

    // 4. Notify team via Slack
    await new SlackBubble({
      operation: 'sendMessage',
      channel: '#new-customers',
      text: `🎉 New customer: ${payload.customer.name}`,
    }).action();

    return { success: true, customerId: dbResult.data?.id };
  }
}
```

---

## When to Choose MCPs

✅ **Choose MCPs when you need:**

- **Simple tool integration** without complex workflows
- **Multi-language environments** where TypeScript isn't preferred
- **Existing MCP ecosystem** with many compatible tools
- **Minimal overhead** for basic tool connectivity
- **Standard protocol** for tool discovery and invocation

**Example Use Case:**

```json
{
  "tools": [
    {
      "name": "send_slack_message",
      "description": "Send a message to a Slack channel",
      "inputSchema": {
        "type": "object",
        "properties": {
          "channel": { "type": "string" },
          "message": { "type": "string" }
        },
        "required": ["channel", "message"]
      }
    }
  ]
}
```

---

## Technical Comparison

| Feature                    | Bubble Lab                                                  | MCPs                                      |
| -------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| **Type Safety**            | Complete TypeScript + Zod validation                        | JSON schema validation only               |
| **Execution Model**        | Full compilation → transpilation → execution                | Tool discovery → invocation               |
| **Security**               | Built-in credential management, SQL injection protection    | Relies on individual tool implementations |
| **Workflow Complexity**    | Complex multi-step with conditionals, loops, error handling | Individual tool invocation                |
| **Development Experience** | Visual builder, IntelliSense, debugging                     | Manual tool definition                    |
| **Orchestration**          | Built-in with enterprise platforms                          | External orchestration required           |
| **AI Integration**         | Native AI agent support with tool orchestration             | Tool integration only                     |

---

## The Bottom Line

**Bubble Lab** is like having a complete development platform for AI workflows - you get the IDE, the runtime, the security, and the orchestration all in one.

**MCPs** are like having a standard connector - great for plugging tools together, but you need to build everything else yourself.

Choose the tool that matches your needs: **Bubble Lab for full-featured workflows**, **MCPs for simple tool integration**.
