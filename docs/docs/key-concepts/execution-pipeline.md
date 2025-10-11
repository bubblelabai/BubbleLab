# Bubble Flow Execution Pipeline

> **How your TypeScript code becomes a running workflow** - from validation to execution with full traceability.

---

## Overview

When you write a Bubble Flow, it goes through a sophisticated pipeline that ensures safety, security, and reliability. Here's what happens behind the scenes:

```
Code → Validate → Extract → Inject → Execute → Output
```

---

## 1. Code Definition

You write TypeScript code that defines your workflow:

```ts
import {
  BubbleFlow,
  SlackBubble,
  AIAgentBubble,
  GmailBubble,
} from '@bubblelab/bubble-core';

export class CustomerOnboardingFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookPayload): Promise<WorkflowResult> {
    // Send Slack notification
    const slackResult = await new SlackBubble({
      operation: 'sendMessage',
      channel: '#new-customers',
      text: `🎉 New customer: ${payload.customer.name}`,
    }).action();

    // Use AI agent for analysis
    const aiResult = await new AIAgentBubble({
      message: `Analyze this customer data: ${JSON.stringify(payload.customer)}`,
      tools: ['web-search-tool', 'sql-query-tool'],
    }).action();

    // Send welcome email
    const emailResult = await new GmailBubble({
      operation: 'send',
      to: payload.customer.email,
      subject: 'Welcome!',
      body: 'Thanks for joining us!',
    }).action();

    return { success: true, customerId: payload.customer.id };
  }
}
```

---

## 2. Validation

The system validates your code to ensure safety and correctness:

✅ **TypeScript Compiler checks:**

- Only valid bubbles are used
- Only Node.js default libraries (no arbitrary imports)
- Strict type checking for safety
- Proper parameter types and required fields

✅ **Security validation:**

- No dangerous operations
- Proper error handling
- Safe credential usage

---

## 3. Extract & Parse

The system analyzes your code to understand what it does:

🔍 **AST (Abstract Syntax Tree) Processing:**

- Extracts bubble parameters and configurations
- Identifies nested bubbleflows and sub-bubbles
- Parses control flow (if/for/try-catch statements)
- Maps dependencies between bubbles

🔍 **AI Agent Integration:**

- Detects when AI agents use tools
- Maps tool dependencies (web-scrape-tool, web-search-tool, etc.)
- Prepares for dynamic tool orchestration

---

## 4. Credential Injection

Security and runtime preparation:

🔐 **Secure credential handling:**

- Credentials are injected at runtime (never stored in code)
- Hidden parameters added for execution context
- Environment variables and user credentials managed separately
- SQL injection protection and input sanitization

---

## 5. Execution

Your workflow runs with enterprise-grade features:

⚡ **Runtime Management:**

- **State storage** - tracks execution progress
- **Queue/load balancing** - handles scale and performance
- **Retry/failure management** - ensures reliability
- **Step saving** - enables resumability and auditing

⚡ **Orchestration:**

- Integration with platforms like **Inngest** or **Temporal**
- Reliable message queuing and task scheduling
- Horizontal scaling and fault tolerance

---

## 6. Output & Traceability

Complete visibility into execution:

📊 **Execution Results:**

- Success/failure status
- Execution timestamps and duration
- Detailed error messages (with credentials masked)
- Performance metrics and resource usage

📊 **Full Traceability:**

- Every bubble execution is logged
- Data flow between bubbles is tracked
- Easy debugging and monitoring
- Audit trail for compliance

---

## Key Benefits

### 🛡️ **Security First**

- Credentials never stored in code
- Sandboxed execution environment
- Input validation and sanitization
- SQL injection protection

### 🔍 **Full Observability**

- Complete execution trace
- Performance monitoring
- Error tracking and debugging
- Audit logs for compliance

### ⚡ **Production Ready**

- Enterprise orchestration
- Automatic retries and failure handling
- Horizontal scaling
- Load balancing and queuing

### 🎯 **Developer Experience**

- TypeScript errors catch issues early
- Clear error messages and debugging info
- Visual workflow representation
- Easy testing and iteration

---

## Why This Matters

Unlike simple tool integration protocols, Bubble Lab provides a **complete execution platform** that handles:

- **Safety** - Your code is validated and sandboxed
- **Security** - Credentials are managed securely
- **Reliability** - Enterprise-grade orchestration and retry logic
- **Observability** - Full traceability and monitoring
- **Scalability** - Built-in load balancing and queuing

This means you can focus on building your workflow logic while Bubble Lab handles all the production concerns.
