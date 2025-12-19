import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  ResendBubble,
  WebSearchTool,
  RedditScrapeTool,
  type WebhookEvent,
  type CronEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  /** Summary message of the workflow execution. */
  message: string;
  /** Whether the sentiment analysis and report delivery were successful. */
  processed: boolean;
}

export interface StockSentimentPayload extends WebhookEvent {
  /**
   * List of stock tickers to analyze (e.g., AAPL, NVDA, TSLA).
   * @canBeFile false
   */
  tickers?: string[];
  /**
   * Email address where the sentiment report should be sent.
   * @canBeFile false
   */
  email: string;
}

interface NewsResult {
  title: string;
  url: string;
  content: string;
}

interface RedditPost {
  title: string;
  selftext: string;
  url: string;
}

interface SentimentAnalysis {
  ticker: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  confidence: number;
  summary: string;
}

/**
 * Analyzes sentiment for a list of tech stocks by gathering news and Reddit data,
 * then sends a formatted report via email.
 */
export class StockSentimentFlow extends BubbleFlow<'webhook/http'> {
  // Fetches latest stock news for a specific ticker using web search.
  private async fetchNews(ticker: string): Promise<NewsResult[]> {
    const searchTool = new WebSearchTool({
      query: `${ticker} stock news latest headlines`,
      limit: 10,
      categories: ['research'],
    });

    const newsResult = await searchTool.action();

    if (!newsResult.success) {
      this.logger?.error(
        `Failed to fetch news for ${ticker}: ${newsResult.error}`
      );
      return [];
    }

    return (newsResult.data?.results || []) as NewsResult[];
  }

  // Scrapes Reddit posts from r/stocks to capture retail investor sentiment.
  private async fetchReddit(ticker: string): Promise<RedditPost[]> {
    const redditTool = new RedditScrapeTool({
      subreddit: 'stocks',
      limit: 20,
      sort: 'hot',
    });

    const redditResult = await redditTool.action();

    if (!redditResult.success) {
      this.logger?.error(
        `Failed to fetch Reddit data for ${ticker}: ${redditResult.error}`
      );
      return [];
    }

    return (redditResult.data?.posts || []) as RedditPost[];
  }

  // Filters Reddit posts to only include those mentioning the specified ticker symbol.
  private filterRedditPosts(posts: RedditPost[], ticker: string): RedditPost[] {
    return posts.filter(
      (post) =>
        post.title.toUpperCase().includes(ticker.toUpperCase()) ||
        (post.selftext &&
          post.selftext.toUpperCase().includes(ticker.toUpperCase()))
    );
  }

  // Uses AI to analyze news and Reddit data to determine overall sentiment for a stock.
  private async analyzeSentiment(
    ticker: string,
    news: NewsResult[],
    redditPosts: RedditPost[]
  ): Promise<SentimentAnalysis | null> {
    const analysisAgent = new AIAgentBubble({
      model: {
        model: 'google/gemini-3-pro-preview',
        jsonMode: true,
      },
      systemPrompt: `You are a financial sentiment analyst. Analyze the provided news and Reddit discussions for the stock ticker ${ticker}.
      Determine if the overall sentiment is Bullish, Bearish, or Neutral.
      Provide a confidence score (0-100) and a brief summary of the key reasons.
      Output your response in the following JSON format:
      {
        "ticker": "${ticker}",
        "sentiment": "Bullish | Bearish | Neutral",
        "confidence": number,
        "summary": "string"
      }`,
      message: `News Data: ${JSON.stringify(news)}\n\nReddit Data: ${JSON.stringify(redditPosts)}`,
    });

    const analysisResult = await analysisAgent.action();

    if (!analysisResult.success) {
      this.logger?.error(
        `AI Analysis failed for ${ticker}: ${analysisResult.error}`
      );
      return null;
    }

    return JSON.parse(analysisResult.data.response) as SentimentAnalysis;
  }

  // Sends the formatted HTML report to the specified email address.
  private async sendReport(
    email: string,
    reportHtml: string,
    tickers: string[]
  ): Promise<void> {
    const emailBubble = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: `Daily Stock Sentiment Report: ${tickers.join(', ')}`,
      html: reportHtml,
    });

    const emailResult = await emailBubble.action();

    if (!emailResult.success) {
      throw new Error(`Failed to send email: ${emailResult.error}`);
    }
  }

  // Generates the HTML report layout from the sentiment analysis results.
  private formatReportHtml(analysisResults: SentimentAnalysis[]): string {
    return `
      <h1>Tech Stock Sentiment Report</h1>
      <p>Generated on ${new Date().toLocaleDateString()}</p>
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px;">Ticker</th>
            <th style="padding: 8px;">Sentiment</th>
            <th style="padding: 8px;">Confidence</th>
            <th style="padding: 8px;">Key Reasons</th>
          </tr>
        </thead>
        <tbody>
          ${analysisResults
            .map(
              (res) => `
            <tr>
              <td style="padding: 8px; font-weight: bold;">${res.ticker}</td>
              <td style="padding: 8px; color: ${res.sentiment === 'Bullish' ? 'green' : res.sentiment === 'Bearish' ? 'red' : 'black'};">${res.sentiment}</td>
              <td style="padding: 8px;">${res.confidence}%</td>
              <td style="padding: 8px;">${res.summary}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  async handle(payload: StockSentimentPayload): Promise<Output> {
    const {
      tickers = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL'],
      email = 'user@example.com',
    } = payload;

    const results: SentimentAnalysis[] = [];

    for (const ticker of tickers) {
      const news = await this.fetchNews(ticker);
      const allPosts = await this.fetchReddit(ticker);
      const redditPosts = this.filterRedditPosts(allPosts, ticker);
      const analysis = await this.analyzeSentiment(ticker, news, redditPosts);

      if (analysis) {
        results.push(analysis);
      }
    }

    const reportHtml = this.formatReportHtml(results);
    await this.sendReport(email, reportHtml, tickers);

    return {
      message: `Sentiment report for ${tickers.join(', ')} sent to ${email}`,
      processed: true,
    };
  }
}

export interface StockSentimentCronPayload extends CronEvent {}

/**
 * Scheduled version of the Stock Sentiment Report that runs daily.
 */
export class StockSentimentCronFlow extends BubbleFlow<'schedule/cron'> {
  // Runs every weekday at 1 PM UTC (9 AM EST) to provide a morning sentiment update.
  readonly cronSchedule = '0 13 * * 1-5';

  // Fetches latest stock news for a specific ticker using web search.
  private async fetchNews(ticker: string): Promise<NewsResult[]> {
    const searchTool = new WebSearchTool({
      query: `${ticker} stock news latest headlines`,
      limit: 10,
      categories: ['research'],
    });

    const newsResult = await searchTool.action();

    if (!newsResult.success) {
      this.logger?.error(
        `Failed to fetch news for ${ticker}: ${newsResult.error}`
      );
      return [];
    }

    return (newsResult.data?.results || []) as NewsResult[];
  }

  // Scrapes Reddit posts from r/stocks to capture retail investor sentiment.
  private async fetchReddit(ticker: string): Promise<RedditPost[]> {
    const redditTool = new RedditScrapeTool({
      subreddit: 'stocks',
      limit: 20,
      sort: 'hot',
    });

    const redditResult = await redditTool.action();

    if (!redditResult.success) {
      this.logger?.error(
        `Failed to fetch Reddit data for ${ticker}: ${redditResult.error}`
      );
      return [];
    }

    return (redditResult.data?.posts || []) as RedditPost[];
  }

  // Filters Reddit posts to only include those mentioning the specified ticker symbol.
  private filterRedditPosts(posts: RedditPost[], ticker: string): RedditPost[] {
    return posts.filter(
      (post) =>
        post.title.toUpperCase().includes(ticker.toUpperCase()) ||
        (post.selftext &&
          post.selftext.toUpperCase().includes(ticker.toUpperCase()))
    );
  }

  // Uses AI to analyze news and Reddit data to determine overall sentiment for a stock.
  private async analyzeSentiment(
    ticker: string,
    news: NewsResult[],
    redditPosts: RedditPost[]
  ): Promise<SentimentAnalysis | null> {
    const analysisAgent = new AIAgentBubble({
      model: {
        model: 'google/gemini-3-pro-preview',
        jsonMode: true,
      },
      systemPrompt: `You are a financial sentiment analyst. Analyze the provided news and Reddit discussions for the stock ticker ${ticker}.
      Determine if the overall sentiment is Bullish, Bearish, or Neutral.
      Provide a confidence score (0-100) and a brief summary of the key reasons.
      Output your response in the following JSON format:
      {
        "ticker": "${ticker}",
        "sentiment": "Bullish | Bearish | Neutral",
        "confidence": number,
        "summary": "string"
      }`,
      message: `News Data: ${JSON.stringify(news)}\n\nReddit Data: ${JSON.stringify(redditPosts)}`,
    });

    const analysisResult = await analysisAgent.action();

    if (!analysisResult.success) {
      this.logger?.error(
        `AI Analysis failed for ${ticker}: ${analysisResult.error}`
      );
      return null;
    }

    return JSON.parse(analysisResult.data.response) as SentimentAnalysis;
  }

  // Sends the formatted HTML report to the specified email address.
  private async sendReport(
    email: string,
    reportHtml: string,
    tickers: string[]
  ): Promise<void> {
    const emailBubble = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: `Daily Stock Sentiment Report: ${tickers.join(', ')}`,
      html: reportHtml,
    });

    const emailResult = await emailBubble.action();

    if (!emailResult.success) {
      throw new Error(`Failed to send email: ${emailResult.error}`);
    }
  }

  // Generates the HTML report layout from the sentiment analysis results.
  private formatReportHtml(analysisResults: SentimentAnalysis[]): string {
    return `
      <h1>Tech Stock Sentiment Report</h1>
      <p>Generated on ${new Date().toLocaleDateString()}</p>
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px;">Ticker</th>
            <th style="padding: 8px;">Sentiment</th>
            <th style="padding: 8px;">Confidence</th>
            <th style="padding: 8px;">Key Reasons</th>
          </tr>
        </thead>
        <tbody>
          ${analysisResults
            .map(
              (res) => `
            <tr>
              <td style="padding: 8px; font-weight: bold;">${res.ticker}</td>
              <td style="padding: 8px; color: ${res.sentiment === 'Bullish' ? 'green' : res.sentiment === 'Bearish' ? 'red' : 'black'};">${res.sentiment}</td>
              <td style="padding: 8px;">${res.confidence}%</td>
              <td style="padding: 8px;">${res.summary}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  async handle(payload: StockSentimentCronPayload): Promise<Output> {
    const tickers = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    const email = 'user@example.com'; // Default recipient for scheduled reports

    const results: SentimentAnalysis[] = [];

    for (const ticker of tickers) {
      const news = await this.fetchNews(ticker);
      const allPosts = await this.fetchReddit(ticker);
      const redditPosts = this.filterRedditPosts(allPosts, ticker);
      const analysis = await this.analyzeSentiment(ticker, news, redditPosts);

      if (analysis) {
        results.push(analysis);
      }
    }

    const reportHtml = this.formatReportHtml(results);
    await this.sendReport(email, reportHtml, tickers);

    return {
      message: `Scheduled sentiment report for ${tickers.join(', ')} sent to ${email}`,
      processed: true,
    };
  }
}
