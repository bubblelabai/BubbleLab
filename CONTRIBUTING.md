# Contributing to Bubble Lab

Thank you for your interest in contributing to Bubble Lab! We welcome all kinds of contributions from the community. AI-powered search tools such as Cursor's ask mode can significantly speed up the process of understanding each part of the codebase.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Environment Configuration](#environment-configuration)
- [Development vs Production Mode](#development-vs-production-mode)
- [Available Commands](#available-commands)
- [Project Architecture](#project-architecture)
- [Deployment](#deployment)
- [Contribution Guidelines](#contribution-guidelines)

## Getting Started

Before contributing, please:

- [Join our Discord community](https://discord.gg/PkJvcU2myV) for discussions and support
- Check existing issues or open a new one to discuss your idea
- Read through this guide to set up your development environment

## Prerequisites

Make sure you have the following installed:

- **[Bun](https://bun.sh)** - Required for running the backend API server
- **[pnpm](https://pnpm.io)** - Package manager for monorepo management
- **Node.js** - v18 or higher

## Development Setup

### Quick Setup (Mac/Linux)

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

### What Gets Started

- **Frontend**: http://localhost:3000 (Bubble Studio)
- **Backend**: http://localhost:3001 (API Server)

### Windows Setup (Separate Steps)

Some scripts use Unix commands (`cp`, `bash`), so Windows requires manual steps:

#### 1. Install Dependencies

```powershell
pnpm install
```

#### 2. Build Core Packages

```powershell
pnpm build:core
```

#### 3. Copy Required Files

```powershell
Copy-Item "packages/bubble-core/dist/bubble-bundle.d.ts" "apps/bubble-studio/public/bubble-types.txt" -Force
Copy-Item "packages/bubble-core/dist/bubbles.json" "apps/bubble-studio/public/bubbles.json" -Force
```

#### 4. Start Servers (Two Terminals)

**Terminal 1 – Backend (API):**

```powershell
cd apps/bubblelab-api
& "$env:USERPROFILE\.bun\bin\bun.exe" run src/index.ts
```

- Runs on: [http://localhost:3001](http://localhost:3001)

**Terminal 2 – Frontend (Studio):**

```powershell
cd apps/bubble-studio
pnpm vite --host 0.0.0.0 --port 3000
```

- Runs on: [http://localhost:3000](http://localhost:3000)

> ⚠ If you get "TypeScript validation failed," rebuild core packages.

## Environment Configuration

### Required API Keys

**⚠️ IMPORTANT**: To run any flows in self-hosted mode, you **MUST** configure these API keys in `apps/bubblelab-api/.env`:

```bash
GOOGLE_API_KEY=your_google_api_key        # Required for AI flow execution
OPENROUTER_API_KEY=your_openrouter_key    # Required for AI flow execution
```

Without these keys, you can use the visual builder but cannot execute flows. Get your keys:

- Google AI API: https://aistudio.google.com/apikey
- OpenRouter: https://openrouter.ai/keys

### Environment Files

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

### Optional API Keys

Enable specific features in `apps/bubblelab-api/.env`:

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

## Development vs Production Mode

### Development Mode (Default)

By default, the app runs in **development mode** with:

- 🔓 **No authentication required** - Uses mock user `dev@localhost.com`
- 💾 **SQLite database** - Auto-created at `apps/bubblelab-api/dev.db`
- 🎯 **Auto-seeded dev user** - Backend creates the user automatically

### Production Mode

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

## Available Commands

```bash
# Run only the setup script
pnpm run setup:env

# Start development servers
pnpm run dev

# Build for production
pnpm run build

# Run tests
pnpm test

# Lint code
pnpm lint
```

## Project Architecture

BubbleLab is built on a modular monorepo architecture:

### Core Packages

- **[@bubblelab/bubble-core](./packages/bubble-core)** - Core AI workflow engine
- **[@bubblelab/bubble-runtime](./packages/bubble-runtime)** - Runtime execution environment
- **[@bubblelab/shared-schemas](./packages/bubble-shared-schemas)** - Common type definitions and schemas
- **[@bubblelab/ts-scope-manager](./packages/bubble-scope-manager)** - TypeScript scope analysis utilities
- **[create-bubblelab-app](./packages/create-bubblelab-app)** - Quick start with bubble lab runtime

### Apps

- **[bubble-studio](./apps/bubble-studio)** - Visual workflow builder (React + Vite)
- **[bubblelab-api](./apps/bubblelab-api)** - Backend API for flow storage and execution (Bun + Hono)

## Deployment

For Docker-based deployment instructions, see **[deployment/README.md](./deployment/README.md)**.

## Contribution Guidelines

We welcome all types of contributions:

### Ways to Contribute

- 🐛 **Bug Reports** - Open an issue with detailed reproduction steps
- ✨ **Feature Requests** - Suggest new features or improvements to Bubble Studio
- 🔧 **Code Contributions** - Fix bugs or implement new features
- 🧩 **New Bubbles** - Add new integrations, tools, or logic nodes
- 📚 **Documentation** - Improve guides, examples, or API docs
- 💬 **Community Support** - Help others in Discord or GitHub discussions

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the coding standards
4. Test your changes thoroughly
5. Commit your changes with clear, descriptive messages
6. Push to your fork and submit a pull request
7. Wait for review and address any feedback

### Coding Standards

- Use TypeScript with proper types (no `any`)
- Follow existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

### Need Help?

- Check our [Documentation](https://docs.bubblelab.ai/)
- Ask questions in our [Discord community](https://discord.gg/PkJvcU2myV)
- Open a discussion on GitHub for general questions

Thank you for contributing to Bubble Lab! 🎉
