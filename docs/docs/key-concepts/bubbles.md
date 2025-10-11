# Bubbles

Bubbles are the **building blocks of Bubble Lab**. Every automation is made up of Bubbles that can be composed, extended, and reused.

There are three main types of Bubbles:

> 🟦 **Service Bubble** → API wrapper / external system  
> 🟩 **Tool Bubble** → Action built on top of services  
> 🟨 **Workflow Bubble** → Full automation flow

---

## 1. Service Bubbles

**What they are**  
Wrappers around external services or APIs (e.g., Slack, Google Sheets, OpenAI).

**When to use**

- Connect to third-party services
- Authenticate with external APIs
- Provide reusable primitives for tools and workflows

**Example**

```ts
const slack = new SlackBubble({
  token: process.env.SLACK_TOKEN,
});
```

---

## 2. Tool Bubbles

**What they are**  
Reusable units of functionality — often built on top of one or more Service Bubbles. Think of them as opinionated functions with clear inputs/outputs.

**When to use**

- Encapsulate a common action (e.g., “Send Slack Message”, “Query Database”)
- Compose multiple services into one logical step
- Share functionality across different workflows

**Example**

```ts
const sendSlackMessage = new ToolBubble({
  service: slack,
  action: 'sendMessage',
  params: { channel: '#general', text: 'Hello world!' },
});
```

---

## 3. Workflow Bubbles

**What they are**  
Top-level flows of logic that connect Tools and Services into an end-to-end automation. A Workflow Bubble is what you run, test, and deploy.

**When to use**

- Define full automations (Slack bot, research agent, data pipeline, etc.)
- Combine multiple Tool Bubbles into a sequence or branching logic
- Deploy as APIs, webhooks, or scheduled jobs

**Example**

```ts
export class OnboardingWorkflow extends WorkflowBubble {
  async run(newUser: User) {
    await sendSlackMessage.action();
    await addUserToSheet.action();
  }
}
```

---

## ✨ Why This Structure?

- **Composable** → Small pieces you can mix and match
- **Extensible** → Add new services, tools, or workflows without breaking existing ones
- **Transparent** → Every layer is strongly typed, debuggable, and version-controlled
