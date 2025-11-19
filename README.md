<div align="center">

<img src="./apps/bubble-studio/public/favicon.ico" alt="Bubble Lab Logo" width="120" height="120">

# Bubble Lab

### Open-source agentic workflow automation builder with full observability and exportability.

[![Discord](https://img.shields.io/discord/1411776181476266184?color=7289da&label=Discord&logo=discord&logoColor=ffffff)](https://discord.com/invite/PkJvcU2myV)
[![Docs](https://img.shields.io/badge/Docs-📘%20Documentation-blue)](https://docs.bubblelab.ai/intro)
[![GitHub Stars](https://img.shields.io/github/stars/bubblelabai/BubbleLab?style=social)](https://github.com/bubblelabai/BubbleLab/stargazers)
[![CI Status](https://github.com/bubblelabai/BubbleLab/actions/workflows/ci.yml/badge.svg)](https://github.com/bubblelabai/BubbleLab/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE.txt)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/bubblelabai/BubbleLab/pulls)


[Try it](https://app.bubblelab.ai/) - [Demos](https://www.bubblelab.ai/demos)


---

### Editing Flows

![Editing Flow](./showcase/editing-flow.gif)

### Running Flows

![Running Flow](./showcase/running-flow.gif)

</div>

## 📋 Overview

[**Bubble Lab**](https://www.bubblelab.ai/) is an AI-native workflow automation platform built for developers who need full control, transparency, and type safety. Unlike traditional workflow builders that lock you into proprietary JSON nodes, Bubble Lab compiles everything into clean, production-ready TypeScript that you can own, debug, and deploy anywhere.

**Key Features:**

- **Prompt to Workflow**: Describe what you want in natural language, and Pearl (our AI Assistant) instantly generates working workflows using our composable bubble system (integrations, tools, and logic nodes)
- **Full Observability**: Built-in execution tracing with detailed logs, token usage tracking, and performance metrics. Debug with complete visibility into every step
- **Import from n8n**: Migrate existing workflows seamlessly. We automatically translate n8n JSON into our bubble architecture
- **Export as TypeScript**: Own your workflows completely. Export clean, production-ready code that runs anywhere—integrate with your codebase, CI/CD pipelines, and existing infrastructure


## 🚀 Quick Start

### 1. Hosted Bubble Studio (Cloud Version)

No setup required, start building immediately with managed integrations 👉 [Try Now](https://app.bubblelab.ai)

### 2. Run Locally

Run Bubble Studio locally in **2 commands**:

```bash
# 1. Install dependencies
pnpm install

# 2. Start everything
pnpm run dev
```

That's it! The setup script automatically:

- ✅ Creates `.env` files from examples
- ✅ Configures dev mode (no auth required)
- ✅ Sets up SQLite database
- ✅ Builds core packages
- ✅ Starts both frontend and backend

Open **http://localhost:3000** and start building workflows!

**⚠️ IMPORTANT: Required API Keys**

To run any flows in self-hosted mode, you **MUST** configure these API keys in `apps/bubblelab-api/.env`:

```bash
GOOGLE_API_KEY=your_google_api_key        # Required for AI flow execution
OPENROUTER_API_KEY=your_openrouter_key    # Required for AI flow execution
```

Without these keys, you can use the visual builder but cannot execute flows. Get your keys:
- Google AI API: https://aistudio.google.com/apikey
- OpenRouter: https://openrouter.ai/keys

#### Prerequisites

- **[Bun](https://bun.sh)** - Required for running the backend API server
- **[pnpm](https://pnpm.io)** - Package manager for monorepo management
- **Node.js** - v18 or higher

#### What Gets Started

- **Frontend**: http://localhost:3000 (Bubble Studio)
- **Backend**: http://localhost:3001 (API Server)

#### Development Mode (Default)

By default, the app runs in **development mode** with:

- 🔓 **No authentication required** - Uses mock user `dev@localhost.com`
- 💾 **SQLite database** - Auto-created at `apps/bubblelab-api/dev.db`
- 🎯 **Auto-seeded dev user** - Backend creates the user automatically

#### Production Mode (Optional)

To run with real authentication:

1. Get your Clerk keys at [clerk.com](https://clerk.com)
2. Update `.env` files:

**Frontend** (`apps/bubble-studio/.env`):

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_DISABLE_AUTH=false
```

**Backend** (`apps/bubblelab-api/.env`):

```bash
BUBBLE_ENV=prod
CLERK_SECRET_KEY=sk_test_...
```

3. Restart with `pnpm run dev`

#### Environment Variables

The setup script creates these files with sensible defaults:

**`apps/bubble-studio/.env`**:

```bash
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=
VITE_DISABLE_AUTH=true  # Dev mode: no auth needed
```

**`apps/bubblelab-api/.env`**:

```bash
BUBBLE_ENV=dev  # Creates mock user automatically
DATABASE_URL=file:./dev.db  # SQLite
```

#### API Keys & Credentials

**Required for Flow Execution:**

```bash
GOOGLE_API_KEY=           # Google AI API key - REQUIRED to run any flows
OPENROUTER_API_KEY=       # OpenRouter API key - REQUIRED to run any flows
```

**Optional API Keys** (enable specific features in `apps/bubblelab-api/.env`):

```bash
# AI Model Providers
OPENAI_API_KEY=           # OpenAI API key for GPT models

# Communication & Storage
RESEND_API_KEY=           # Resend API key for email notifications
FIRE_CRAWL_API_KEY=       # FireCrawl API key for web scraping

# Authentication (optional, only needed for production mode)
CLERK_SECRET_KEY_BUBBLELAB=  # Clerk secret key for authentication

# OAuth (optional)
GOOGLE_OAUTH_CLIENT_ID=      # Google OAuth client ID
GOOGLE_OAUTH_CLIENT_SECRET=  # Google OAuth client secret

# Cloud Storage (optional)
CLOUDFLARE_R2_ACCESS_KEY=    # Cloudflare R2 access key
CLOUDFLARE_R2_SECRET_KEY=    # Cloudflare R2 secret key
CLOUDFLARE_R2_ACCOUNT_ID=    # Cloudflare R2 account ID

# Other
PYTHON_PATH=              # Custom Python path (optional)
CREDENTIAL_ENCRYPTION_KEY=8VfrrosUTORJghTDpdTKG7pvfD721ChyFt97m3Art1Y=  # Encryption key for storing user credentials
BUBBLE_CONNECTING_STRING_URL=  # Database connection string (optional, defaults to SQLite)
```

#### Additional Commands

```bash
# Run only the setup script
pnpm run setup:env

# Build for production
pnpm run build

# Run tests
pnpm test

# Lint code
pnpm lint
```

### 3. Create BubbleLab App

Get started with BubbleLab in seconds using our CLI tool:

```bash
npx create-bubblelab-app
```

This will scaffold a new BubbleLab project with:

- Pre-configured TypeScript setup with core packages and run time installed
- Sample templates (basic, reddit-scraper, etc.) you can choose
- All necessary dependencies
- Ready-to-run example workflows you fully control, customize

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

## 📚 Documentation

**Learn how to use each bubble node and build powerful workflows:**

👉 [Visit BubbleLab Documentation](https://docs.bubblelab.ai/)

The documentation includes:

- Detailed guides for each node type
- Workflow building tutorials
- API references
- Best practices and examples

## 📦 Open Source Packages

BubbleLab is built on a modular architecture with the following core packages:

### Core Packages

- **[@bubblelab/bubble-core](./packages/bubble-core)** - Core AI workflow engine
- **[@bubblelab/bubble-runtime](./packages/bubble-runtime)** - Runtime execution environment
- **[@bubblelab/shared-schemas](./packages/bubble-shared-schemas)** - Common type definitions and schemas
- **[@bubblelab/ts-scope-manager](./packages/bubble-scope-manager)** - TypeScript scope analysis utilities
- **[create-bubblelab-app](./packages/create-bubblelab-app)** - Quick start with bubble lab runtime

### Apps

- **[bubble-studio](./apps/bubble-studio)** - Visual workflow builder (React + Vite)
- **[bubblelab-api](./apps/bubblelab-api)** - Backend API for flow storage and execution (Bun + Hono)

## 🤝 Contributing & Self-Hosting Bubble Studio

Documentation for contributing to BubbleLab and self-hosting the platform is coming soon!

In the meantime, feel free to:

- Explore the source code
- Open issues for bugs or feature requests about Bubble Studio or add more bubbles
- Submit pull requests
- [Join our Discord community](https://discord.gg/PkJvcU2myV) for discussions and support

## License

Apache 2.0
