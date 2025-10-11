# create-bubblelab-app

The easiest way to get started with BubbleLab - the AI agent workflow framework.

## Usage

Create a new BubbleLab application with one command:

```bash
npx create-bubblelab-app
```

or with your preferred package manager:

```bash
# pnpm
pnpm create bubblelab-app

# yarn
yarn create bubblelab-app

# npm
npm create bubblelab-app
```

## What You Get

The CLI will:

1. Prompt you for a project name
2. Let you choose a template (Weather Agent, more coming soon)
3. Set up a complete BubbleLab project with:
   - TypeScript configuration
   - Example AI agent workflow
   - Comprehensive documentation
   - Environment setup guide

## Templates

### Weather Agent (Recommended)

A complete example showing how to build an AI agent that:

- Uses Google Gemini AI
- Performs web research
- Handles dynamic parameters
- Returns structured results

Perfect for learning BubbleLab basics!

## After Creation

```bash
cd your-project-name

# Set up your API keys
cp .env.example .env
# Edit .env with your keys

# Run the example
npm run dev
```

## Requirements

- Node.js 18+
- A Google Gemini API key (free tier available)
- A Firecrawl API key for web search

## Learn More

- [BubbleLab GitHub](https://github.com/bubblelabai/BubbleLab)
- [Documentation](https://github.com/bubblelabai/BubbleLab/tree/main/docs)
- [Examples](https://github.com/bubblelabai/BubbleLab/tree/main/examples)

## License

Apache-2.0 © Bubble Lab, Inc.
