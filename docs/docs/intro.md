---
sidebar_position: 1
---

# Welcome to Bubble Lab

> Bubble Lab is released under the **Apache 2.0 License**.  
> This project is a **work in progress** — we’re building fast, and things may change.  
> All contributions are welcome — from bug fixes and docs to new Bubbles (integrations)!

## What is Bubble Lab?

Bubble Lab is an **agentic workflow automation platform built for developers**.  
It combines the clarity of visual workflows with the reliability of typed code — giving you full control, observability, and exportability.

- ⚡ A **visual workflow** that’s easy to reason about
- 💻 **Production-ready TypeScript code** with end-to-end type safety, production-grade run, extend, and debug

Forget brittle JSON pipelines or opaque runtime loops- Bubble Lab combines the flexibility of AI-driven agents with the rigor of typed execution.

---

## Why Bubble Lab?

Existing tools like n8n, Zapier, and Make are great for quick prototypes — but they fall apart when you need **scalability, observability, and developer control**. Bubble Lab was rebuilt from the ground up to solve these pain points:

- 🛠 **TypeScript-native** → End-to-end type safety across every node and data flow
- 👀 **Transparent** → Built-in logging, tracing, and step-level introspection
- 🌐 **Open ecosystem** → Extend workflows with “Bubbles” you can own, share, or fork
- 🏗 **Production-grade runtime** → Durable, replayable, and self-hostable execution engine
- 🚀 **AI-native** → Natural language → working automation, without losing production reliability

---

## Who is Bubble Lab for?

- 👩‍💻 **Developers** who want observable and reliable workflows
- 📈 **Teams & startups** tired of fragile no-code tools that don’t scale
- 🔬 **Builders & researchers** experimenting with AI agents and APIs
- 🌍 **Community contributors** who believe automation should be open, transparent, and composable

---

## Getting Started

### 1. Hosted Bubble Studio (Fastest Way)

The quickest way to get started with BubbleLab is through our hosted Bubble Studio:

**Benefits:**

- No setup required - start building immediately
- Visual flow builder with drag-and-drop interface
- Export your flows to run on your own backend
- Follow the in-studio instructions to integrate with your application

👉 [Try Bubble Studio Now](https://app.bubblelab.ai)
_Currently in closed beta - email us at hello@bubblelab.ai for access_

### 2. Create BubbleLab App

Get started with BubbleLab in seconds using our CLI tool:

```bash
npx create-bubblelab-app
```

This will scaffold a new BubbleLab project with:

- Pre-configured TypeScript setup with core packages and runtime installed
- Sample templates (basic, reddit-scraper, etc.) you can choose
- All necessary dependencies
- Ready-to-run example workflows you fully control and customize

**Next steps after creation:**

```bash
cd my-agent
npm install
npm run dev
```

#### What You'll Get: Real-World Example

Let's look at what BubbleFlow code actually looks like using the **reddit-scraper** template:

**The Flow** (`reddit-news-flow.ts`) - Just **~50 lines** of clean TypeScript:

```typescript
export class RedditNewsFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: RedditNewsPayload) {
    const subreddit = payload.subreddit || 'worldnews';
    const limit = payload.limit || 10;

    // Step 1: Scrape Reddit for posts
    const scrapeResult = await new RedditScrapeTool({
      subreddit: subreddit,
      sort: 'hot',
      limit: limit,
    }).action();

    const posts = scrapeResult.data.posts;

    // Step 2: AI analyzes and summarizes the posts
    const summaryResult = await new AIAgentBubble({
      message: `Analyze these top ${posts.length} posts from r/${subreddit}:
        ${postsText}

        Provide: 1) Summary of top news, 2) Key themes, 3) Executive summary`,
      model: { model: 'google/gemini-2.5-flash' },
    }).action();

    return {
      subreddit,
      postsScraped: posts.length,
      summary: summaryResult.data?.response,
      status: 'success',
    };
  }
}
```

**What happens when you run it:**

```bash
$ npm run dev

✅ Reddit scraper executed successfully
{
  "subreddit": "worldnews",
  "postsScraped": 10,
  "summary": "### Top 5 News Items:\n1. China Halts US Soybean Imports...\n2. Zelensky Firm on Ukraine's EU Membership...\n3. Hamas Demands Release of Oct 7 Attackers...\n[full AI-generated summary]",
  "timestamp": "2025-10-07T21:35:19.882Z",
  "status": "success"
}

Execution Summary:
  Total Duration: 13.8s
  Bubbles Executed: 3 (RedditScrapeTool → AIAgentBubble → Return)
  Token Usage: 1,524 tokens (835 input, 689 output)
  Memory Peak: 139.8 MB
```

**What's happening under the hood:**

1. **RedditScrapeTool** scrapes 10 hot posts from r/worldnews
2. **AIAgentBubble** (using Google Gemini) analyzes the posts
3. Returns structured JSON with summary, themes, and metadata
4. Detailed execution stats show performance and token usage

**Key Features:**

- **Type-safe** - Full TypeScript support with proper interfaces
- **Simple** - Just chain "Bubbles" (tools/nodes) together with `.action()`
- **Observable** - Built-in logging shows exactly what's executing
- **Production-ready** - Error handling, metrics, and performance tracking included

### Next Steps

1. **[Understand Bubble System](./key-concepts/bubbles)** - Learn how to connect bubbles
2. Explore our **[Bubbles library](./bubbles/overview)** - Browse available service and tool bubbles
3. Try out example workflows for data pipelines, outreach tools, and more

---

## Contributing

We ❤️ contributors! Here’s how you can help:

- Report bugs or request features
- Improve docs or examples
- Create and share new Bubbles (integrations)
- Join the discussion in our community

---

## Community

💬 [Join our Discord!](https://discord.com/invite/PkJvcU2myV) Connect with other developers, share workflows, and get help

---

## License

Bubble Lab is distributed under the **[Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)**.
