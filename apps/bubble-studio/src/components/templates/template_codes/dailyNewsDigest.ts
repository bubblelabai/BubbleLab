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
  /**
   * Email address where the daily news digest will be sent.
   * @canBeFile false
   */
  email: string;
  /**
   * Subreddit names to scrape for news (without the r/ prefix).
   * @canBeFile false
   */
  subreddits?: string[];
  /**
   * Full URLs of news websites to scrape for headlines.
   * @canBeFile false
   */
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
  content: string;
}

interface DigestCategory {
  name: string;
  description: string;
  headlines: {
    title: string;
    url: string;
    source: string;
    summary: string;
  }[];
}

interface DigestData {
  categories: DigestCategory[];
  executiveSummary: string;
}

export class DailyNewsDigestFlow extends BubbleFlow<'webhook/http'> {
  // Scrape all subreddits
  private async scrapeAllSubreddits(subreddits: string[]): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];

    for (const subreddit of subreddits) {
      // Fetches the top 15 posts from each subreddit filtered by the past day.
      // Adjust the limit parameter for more or fewer posts, or change timeFilter for different date ranges.
      const redditScraper = new RedditScrapeTool({
        subreddit,
        limit: 15,
        sort: 'top',
        timeFilter: 'day',
      });

      const scrapeResult = await redditScraper.action();

      if (scrapeResult.success && scrapeResult.data?.posts) {
        allPosts.push(...scrapeResult.data.posts);
      }
    }

    return allPosts;
  }

  // Scrape all news websites
  private async scrapeAllNewsUrls(newsUrls: string[]): Promise<NewsArticle[]> {
    const allArticles: NewsArticle[] = [];

    for (const url of newsUrls) {
      // Extracts the main content from each news website URL in markdown format.
      // The onlyMainContent flag filters out navigation, ads, and other non-article content.
      const webScraper = new WebScrapeTool({
        url,
        format: 'markdown',
        onlyMainContent: true,
      });

      const scrapeResult = await webScraper.action();

      if (scrapeResult.success && scrapeResult.data?.content) {
        allArticles.push({
          title: scrapeResult.data.title || 'News Article',
          content: scrapeResult.data.content,
          url: scrapeResult.data.url,
          source: new URL(url).hostname,
        });
      }
    }

    return allArticles;
  }

  // Generate AI digest
  private async generateDigest(headlines: (RedditPost | NewsArticle)[]): Promise<DigestData> {
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
      \${JSON.stringify(headlines)}
    \`;

    // Analyzes all collected headlines and organizes them into 3-5 meaningful categories using AI.
    // Uses gemini-2.5-flash with jsonMode for structured output containing categorized headlines,
    // per-headline summaries, and an executive summary synthesizing key themes across all sources.
    // Switch to gemini-2.5-pro for more nuanced categorization of complex or specialized topics.
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

    this.logger?.info(JSON.stringify(digestResult));

    const digestData = JSON.parse(digestResult.data.response);
    return digestData;
  }

  // Build HTML email
  private buildEmailHtml(digestData: DigestData): string {
    return \`
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
          \${digestData.categories.map((category: DigestCategory) => \`
            <tr>
              <td style="padding: 30px;">
                <h2 style="margin: 0 0 10px 0; color: #667eea; font-size: 20px; font-weight: 600; border-bottom: 2px solid #667eea; padding-bottom: 8px;">\${category.name}</h2>
                <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px; font-style: italic;">\${category.description}</p>

                \${category.headlines.map((headline) => \`
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
  }

  // Send email via Resend
  private async sendDigestEmail(email: string, htmlEmail: string): Promise<string> {
    // Sends the formatted HTML news digest to the recipient's email address.
    // The 'from' parameter is automatically set to Bubble Lab's default sender
    // unless you have your own Resend account with a verified domain configured.
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

    return emailResult.data.email_id;
  }

  // Main workflow orchestration
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const {
      email = 'user@example.com',
      subreddits = ['news', 'worldnews', 'technology'],
      newsUrls = ['https://news.ycombinator.com', 'https://techcrunch.com']
    } = payload;

    // Step 1: Scrape Reddit posts from all subreddits
    const redditPosts = await this.scrapeAllSubreddits(subreddits);

    // Step 2: Scrape news articles from all URLs
    const newsArticles = await this.scrapeAllNewsUrls(newsUrls);

    // Step 3: Combine all headlines
    const allHeadlines: (RedditPost | NewsArticle)[] = [...redditPosts, ...newsArticles];

    if (allHeadlines.length === 0) {
      throw new Error('No headlines found from any source');
    }

    // Step 4: Generate AI-organized digest
    const digestData = await this.generateDigest(allHeadlines);

    // Step 5: Build HTML email template
    const htmlEmail = this.buildEmailHtml(digestData);

    // Step 6: Send email to recipient
    const emailId = await this.sendDigestEmail(email, htmlEmail);

    return {
      message: \`Successfully sent news digest with \${allHeadlines.length} headlines to \${email}\`,
      emailId,
      totalHeadlines: allHeadlines.length,
    };
  }
}`;
