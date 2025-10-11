# BubbleLab Reddit News Scraper

Welcome to your BubbleLab Reddit scraper! This template demonstrates how to build AI agents that scrape and analyze Reddit content using BubbleLab's workflow engine.

## 🎯 What This Does

This example creates an AI agent that:

- Scrapes posts from any Reddit subreddit
- Uses Google Gemini AI to analyze and summarize content
- Identifies key themes and trends in the posts
- Exports results to a JSON file

## 🚀 Quick Start

### 1. Set Up Environment Variables

Your `.env` file was created during setup. You can modify it to customize the scraper:

```env
GOOGLE_API_KEY=your_google_api_key_here

# Optional: Specify subreddit to scrape (default: worldnews)
SUBREDDIT=worldnews

# Optional: Number of posts to scrape (default: 10)
POST_LIMIT=10
```

#### Get API Keys

- **Google Gemini API**: https://aistudio.google.com/app/apikey (Free tier available)

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
🫧 BubbleLab Reddit News Scraper

✅ BubbleFactory initialized

📊 Configuration:
  Subreddit: r/worldnews
  Post Limit: 10

🤖 Running Reddit scraper...

📊 Results:
──────────────────────────────────────────────────────────────────────

📝 NEWS SUMMARY:

[AI-generated summary of Reddit posts]

──────────────────────────────────────────────────────────────────────

✅ Scraped 10 posts from r/worldnews
💾 Results exported to: reddit-news-worldnews-1234567890.json
```

## 📚 Project Structure

```
my-bubblelab-app/
├── src/
│   ├── index.ts              # Main entry point
│   └── reddit-news-flow.ts   # Reddit scraper flow definition
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## 🧩 Understanding the Code

### The Flow (reddit-news-flow.ts)

This is a simple 2-step workflow:

```typescript
export class RedditNewsFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: RedditNewsPayload) {
    // Step 1: Scrape Reddit for posts
    const scrapeResult = await new RedditScrapeTool({
      subreddit: 'worldnews',
      sort: 'hot',
      limit: 10,
    }).action();

    // Step 2: Summarize the news using AI
    const summaryResult = await new AIAgentBubble({
      message: `Summarize these Reddit posts...`,
      model: { model: 'google/gemini-2.5-flash' },
    }).action();

    return { summary: summaryResult.data?.response };
  }
}
```

**Key components:**

1. **RedditScrapeTool** - Scrapes posts from Reddit
   - `subreddit`: Which subreddit to scrape
   - `sort`: Sorting method ('hot', 'new', 'top')
   - `limit`: Number of posts to fetch

2. **AIAgentBubble** - AI-powered analysis
   - `message`: The task/prompt for the AI
   - `model`: Which AI model to use

### Running the Flow (index.ts)

The `index.ts` file shows how to execute the flow:

```typescript
const runner = new BubbleRunner(flowCode, bubbleFactory);
const result = await runner.runAll({ subreddit, limit });
```

## 🎨 Customization

### Change the Subreddit

Set the `SUBREDDIT` environment variable:

```bash
SUBREDDIT="technology" npm run dev
```

Or modify `.env`:

```env
SUBREDDIT=technology
```

### Scrape More Posts

Change the `POST_LIMIT`:

```bash
POST_LIMIT=20 npm run dev
```

### Change Sort Order

Edit `src/reddit-news-flow.ts`:

```typescript
const scrapeResult = await new RedditScrapeTool({
  subreddit: subreddit,
  sort: 'new', // Options: 'hot', 'new', 'top', 'rising'
  limit: limit,
}).action();
```

### Customize AI Analysis

Modify the AI prompt in `src/reddit-news-flow.ts`:

```typescript
const summaryResult = await new AIAgentBubble({
  message: `Analyze these posts and focus on technology trends...`,
  model: { model: 'google/gemini-2.5-flash' },
}).action();
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
- `npm run typecheck` - Check TypeScript types

## 📖 Next Steps

### Use Cases

This template can be extended for:

- **Lead generation** - Find potential customers discussing pain points
- **Market research** - Analyze trends and sentiment in specific communities
- **Content curation** - Collect and summarize relevant discussions
- **Competitive intelligence** - Monitor what people say about competitors
- **Community management** - Track important discussions in your community

### Example: Lead Finder

Extend the flow to find frustrated users:

```typescript
const agentResult = await new AIAgentBubble({
  systemPrompt: `Identify users who are frustrated with their current solution.`,
  message: `Analyze this post: "${post.title}" - ${post.selftext}`,
  model: {
    model: 'google/gemini-2.5-flash',
    jsonMode: true,
  },
}).action();
```

### Learn More

- [BubbleLab Documentation](https://github.com/bubblelabai/BubbleLab)
- [Examples & Tutorials](https://github.com/bubblelabai/BubbleLab/tree/main/examples)

## 🐛 Troubleshooting

### Error: API Key Not Found

Make sure `.env` file exists and contains a valid `GOOGLE_API_KEY`.

### Error: Module Not Found

Run `npm install` to install dependencies.

### No Posts Found

- Check that the subreddit name is spelled correctly
- Try increasing the `limit` parameter
- Verify you have internet connection

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/bubblelabai/BubbleLab/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bubblelabai/BubbleLab/discussions)

## 📄 License

Apache-2.0 © Bubble Lab, Inc.

---

**Happy Scraping! 🫧**
