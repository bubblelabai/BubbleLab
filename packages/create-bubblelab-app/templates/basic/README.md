# BubbleLab Weather Agent

Welcome to your first BubbleLab application! This starter template demonstrates how to build AI agents using BubbleLab's powerful workflow engine.

## 🎯 What This Does

This example creates an AI agent that:

- Researches weather information for any city
- Uses Google Gemini AI for intelligent processing
- Performs web searches to find current weather data
- Returns detailed weather reports

## 🚀 Quick Start

### 1. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
GOOGLE_API_KEY=your_google_api_key_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
CITY=New York  # Optional: default city
```

#### Get API Keys

- **Google Gemini API**: https://aistudio.google.com/app/apikey (Free tier available)
- **Firecrawl API**: https://www.firecrawl.dev/ (Required for web research)

### 2. Run the Example

```bash
npm run dev
```

or

```bash
pnpm dev
```

You should see output like:

```
🫧 BubbleLab Weather Agent

✅ BubbleFactory initialized
✅ BubbleRunner created
🌍 Researching weather for: New York
🤖 Running AI agent...

📊 Results:
──────────────────────────────────────────────────
{
  "city": "New York",
  "weather": "Current weather in New York is...",
  "status": "success"
}
──────────────────────────────────────────────────
```

## 📚 Project Structure

```
my-bubblelab-app/
├── src/
│   ├── index.ts           # Main entry point
│   └── weather-flow.ts    # Weather agent flow definition
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🧩 Understanding the Code

### BubbleFlow

A `BubbleFlow` is a workflow definition that handles events:

```typescript
export class WeatherFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WeatherPayload) {
    // Your workflow logic here
  }
}
```

### AIAgentBubble

An `AIAgentBubble` is an AI-powered action node:

```typescript
const weatherAgent = new AIAgentBubble({
  message: 'What is the weather in New York?',
  model: { model: 'google/gemini-2.5-flash' },
  tools: [{ name: 'research-agent-tool' }],
});
```

**Key concepts:**

- `message`: The task/prompt for the AI agent
- `model`: Which AI model to use
- `tools`: Additional capabilities (like web search)

### BubbleRunner

The `BubbleRunner` executes your flow:

```typescript
const runner = new BubbleRunner(WeatherFlow, bubbleFactory);
const result = await runner.runAll();
```

## 🎨 Customization

### Change the City

Set the `CITY` environment variable:

```bash
CITY="Los Angeles" npm run dev
```

Or modify the code in `src/index.ts`:

```typescript
const city = 'Los Angeles';
runner.injector.changeBubbleParameters(
  bubbleIds[0],
  'message',
  `What is the weather in ${city}?`
);
```

### Use Different AI Models

BubbleLab supports multiple AI providers:

```typescript
// OpenAI
model: {
  model: 'openai/gpt-4';
}

// Anthropic Claude
model: {
  model: 'anthropic/claude-3-sonnet';
}

// Google Gemini (default)
model: {
  model: 'google/gemini-2.5-flash';
}
```

### Add More Tools

Available tools:

- `research-agent-tool` - Web search

```typescript
tools: [{ name: 'research-agent-tool' }, { name: 'code-interpreter' }];
```

## 🔧 Development

### Build for Production

```bash
npm run build
npm start
```

### Project Scripts

- `npm run dev` - Run with hot reload (tsx)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled JavaScript

## 📖 Next Steps

### Learn More

- [BubbleLab Documentation](https://github.com/bubblelabai/BubbleLab)
- [Examples & Tutorials](https://github.com/bubblelabai/BubbleLab/tree/main/examples)

### Build More Complex Flows

Try adding:

- Multiple AI agents working together
- Conditional logic and branching
- Error handling and retries
- Data transformation and validation
- Integration with external APIs

### Example: Multi-Step Flow

```typescript
export class MultiStepFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: any) {
    // Step 1: Research
    const research = await new AIAgentBubble({
      message: 'Research current weather trends',
      tools: [{ name: 'research-agent-tool' }],
    }).action();

    // Step 2: Analyze
    const analysis = await new AIAgentBubble({
      message: `Analyze this data: ${research.data?.response}`,
      model: { model: 'google/gemini-2.5-flash' },
    }).action();

    return { research, analysis };
  }
}
```

## 🐛 Troubleshooting

### Error: API Key Not Found

Make sure `.env` file exists and contains valid API keys.

### Error: Module Not Found

Run `npm install` to install dependencies.

### Agent Takes Too Long

- Check your internet connection
- Verify API keys are valid
- Try a simpler prompt first

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/bubblelabai/BubbleLab/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bubblelabai/BubbleLab/discussions)

## 📄 License

Apache-2.0 © Bubble Lab, Inc.

---

**Happy Building! 🫧**
