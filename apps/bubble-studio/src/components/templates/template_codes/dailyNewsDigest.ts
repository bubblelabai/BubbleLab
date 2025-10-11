// Template for Daily News Digest
// This template scrapes major news sources and selected Reddit communities,
// then generates and sends a comprehensive news digest via email

export const templateCode = `import {
  BubbleFlow,
  RedditScrapeTool,
  WebScrapeTool,
  AIAgentBubble,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  emailId?: string;
  totalHeadlines: number;
}

export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  subreddits?: string[];
  newsUrls?: string[];
}

interface RedditPost {
  author: string;
  title: string;
  selftext: string;
  url: string;
  postUrl: string;
  createdUtc: number;
  score: number;
}

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  content: string
}

export class DailyNewsDigestFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const {
      email,
      subreddits = ['news', 'worldnews', 'technology'],
      newsUrls = ['https://news.ycombinator.com', 'https://techcrunch.com']
    } = payload;

    const allHeadlines: (RedditPost | NewsArticle)[] = [];

    // 1. Scrape Reddit communities
    if (subreddits && subreddits.length > 0) {
      for (const subreddit of subreddits) {
        const redditScraper = new RedditScrapeTool({
          subreddit,
          limit: 15,
          sort: 'top',
          timeFilter: 'day',
        });

        const scrapeResult = await redditScraper.action();

        if (scrapeResult.success && scrapeResult.data?.posts) {
          allHeadlines.push(...scrapeResult.data.posts);
        }
      }
    }

    // 2. Scrape news websites
    if (newsUrls && newsUrls.length > 0) {
      for (const url of newsUrls) {
        const webScraper = new WebScrapeTool({
          url,
          format: 'markdown',
          onlyMainContent: true,
        });

        const scrapeResult = await webScraper.action();

        if (scrapeResult.success && scrapeResult.data?.content) {
          allHeadlines.push({
            title: scrapeResult.data.title || 'News Article',
            content: scrapeResult.data.content,
            url: scrapeResult.data.url,
            source: new URL(url).hostname,
          });
        }
      }
    }

    if (allHeadlines.length === 0) {
      throw new Error('No headlines found from any source');
    }

    // 3. Generate digest structure with AI (JSON mode)
    const prompt = \`
      You are an expert news editor. Analyze the following headlines and organize them into a structured digest.

      Return a JSON object with this structure:
      {
        "categories": [
          {
            "name": "Category Name",
            "description": "Brief 1-sentence description of this category",
            "headlines": [
              {
                "title": "Headline title",
                "url": "URL",
                "source": "Source name or subreddit",
                "summary": "One sentence summary of why this is important"
              }
            ]
          }
        ],
        "executiveSummary": "3-4 sentence summary of key themes and trends across all categories"
      }

      Group headlines into 3-5 meaningful categories based on topics/themes.
      Categories should be clear and descriptive (e.g., "Technology & AI", "World Politics", "Science & Health").

      Headlines:
      \${JSON.stringify(allHeadlines)}
    \`;

    const digestAgent = new AIAgentBubble({
      message: prompt,
      systemPrompt: 'You are an expert news editor. Analyze headlines and organize them into clear, logical categories. Return only valid JSON with no markdown formatting.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
        maxTokens: 900000
      },
      
    });

    const digestResult = await digestAgent.action();

    if (!digestResult.success || !digestResult.data?.response) {
      throw new Error(\`Failed to generate digest: \${digestResult.error || 'No response'}\`);
    }
    this.logger?.info(JSON.stringify(digestResult))

    // 4. Parse the JSON response and create beautiful HTML
    let digestData;
    try {
      digestData = JSON.parse(digestResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const htmlEmail = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily News Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">📰 Your Daily News Digest</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px;">\${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>

          <!-- Executive Summary -->
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-bottom: 3px solid #e2e8f0;">
              <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px; font-weight: 600;">📊 Executive Summary</h2>
              <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">\${digestData.executiveSummary}</p>
            </td>
          </tr>

          <!-- Categories -->
          \${digestData.categories.map((category: any) => \`
            <tr>
              <td style="padding: 30px;">
                <h2 style="margin: 0 0 10px 0; color: #667eea; font-size: 20px; font-weight: 600; border-bottom: 2px solid #667eea; padding-bottom: 8px;">\${category.name}</h2>
                <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px; font-style: italic;">\${category.description}</p>

                \${category.headlines.map((headline: any) => \`
                  <div style="margin-bottom: 20px; padding: 15px; background-color: #f8fafc; border-radius: 6px; border-left: 4px solid #667eea;">
                    <a href="\${headline.url}" style="color: #1e293b; text-decoration: none; font-weight: 600; font-size: 16px; display: block; margin-bottom: 8px;">\${headline.title}</a>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; line-height: 1.5;">\${headline.summary}</p>
                    <span style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">📍 \${headline.source}</span>
                  </div>
                \`).join('')}
              </td>
            </tr>
          \`).join('')}

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #1e293b; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Stay informed with your personalized daily digest</p>
              <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">
                Powered by <a href="https://bubblelab.ai" style="color: #667eea; text-decoration: none; font-weight: 600;">bubble lab</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    \`;

    // 5. Send email digest
    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: \`📰 Your Daily News Digest - \${new Date().toLocaleDateString()}\`,
      html: htmlEmail,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success || !emailResult.data?.email_id) {
      throw new Error(\`Failed to send email: \${emailResult.error || 'Unknown error'}\`);
    }

    return {
      message: \`Successfully sent news digest with \${allHeadlines.length} headlines to \${email}\`,
      emailId: emailResult.data.email_id,
      totalHeadlines: allHeadlines.length,
    };
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Email address to send the daily news digest to',
      },
      subreddits: {
        type: 'array',
        items: {
          type: 'string',
        },
        description:
          'List of subreddit names to scrape for news (e.g., ["news", "worldnews", "technology"])',
        default: ['news', 'worldnews', 'technology'],
      },
      newsUrls: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uri',
        },
        description: 'List of news website URLs to scrape for headlines',
        default: ['https://news.ycombinator.com', 'https://techcrunch.com'],
      },
    },
    required: ['email'],
  }),
  requiredCredentials: {
    reddit: ['read'],
    resend: ['send'],
    firecrawl: ['scrape'],
  },
  // Pre-validated bubble parameters for instant visualization
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'redditScraper',
      bubbleName: 'RedditScrapeTool',
      className: 'RedditScrapeTool',
      nodeType: 'tool',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'subreddit', value: '${subreddit}', type: 'string' },
        { name: 'limit', value: 15, type: 'number' },
        { name: 'sort', value: 'top', type: 'string' },
        { name: 'timeFilter', value: 'day', type: 'string' },
      ],
    },
    2: {
      variableId: 2,
      variableName: 'webScraper',
      bubbleName: 'WebScrapeTool',
      className: 'WebScrapeTool',
      nodeType: 'tool',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'url', value: '${url}', type: 'string' },
        { name: 'format', value: 'markdown', type: 'string' },
        { name: 'onlyMainContent', value: true, type: 'boolean' },
      ],
    },
    3: {
      variableId: 3,
      variableName: 'digestAgent',
      bubbleName: 'AIAgentBubble',
      className: 'AIAgentBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'message',
          value:
            'Generate comprehensive daily news digest from headlines, grouped by topic with executive summary',
          type: 'string',
        },
        {
          name: 'systemPrompt',
          value:
            'Expert news editor generating professional HTML email digests',
          type: 'string',
        },
        {
          name: 'model',
          value: { model: 'google/gemini-2.5-flash' },
          type: 'object',
        },
      ],
    },
    4: {
      variableId: 4,
      variableName: 'emailSender',
      bubbleName: 'ResendBubble',
      className: 'ResendBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'send_email', type: 'string' },
        { name: 'to', value: ['${email}'], type: 'array' },
        {
          name: 'subject',
          value: 'Your Daily News Digest - ${date}',
          type: 'string',
        },
      ],
    },
  },
};
