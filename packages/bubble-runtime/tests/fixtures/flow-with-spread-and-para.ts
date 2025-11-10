import { z } from 'zod';
import {
  BubbleFlow,
  WebhookEvent,
  WebScrapeTool,
  AIAgentBubble,
  SlackBubble,
} from '@bubblelab/bubble-core';

// Define the output structure for each news item
interface NewsItem {
  title: string;
  url: string;
}

// Define the output structure for the entire workflow
export interface Output {
  news: NewsItem[];
}

// Define the input payload for the webhook trigger
export interface CustomWebhookPayload extends WebhookEvent {
  // The channel to post the news to
  channel: string;
}

export class HackerNewsScraper extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { channel } = payload;

    // 1. Scrape the Hacker News homepage
    const hackerNewsUrl = 'https://news.ycombinator.com';
    this.logger?.info(`Scraping Hacker News from: ${hackerNewsUrl}`);
    const scrapeBubble = new WebScrapeTool({
      url: hackerNewsUrl,
      format: 'markdown',
    });
    const scrapeResult = await scrapeBubble.action();

    if (!scrapeResult.success || !scrapeResult.data?.content) {
      this.logger?.error('Failed to scrape Hacker News');
      throw new Error('Failed to scrape Hacker News');
    }

    this.logger?.info('Successfully scraped Hacker News');

    // 2. Use an AI agent to extract the top 10 news articles
    const extractionPrompt = `
      Extract the top 10 news articles from the following Hacker News markdown content.
      For each article, provide the title and the URL.
      Respond with a JSON object containing a "news" key, which is an array of objects, where each object has "title" and "url" keys.

      Example format:
      {
        "news": [
          {
            "title": "Example News Title 1",
            "url": "http://example.com/news1"
          },
          {
            "title": "Example News Title 2",
            "url": "http://example.com/news2"
          }
        ]
      }

      Content:
      ${scrapeResult.data.content}
    `;

    this.logger?.info('Extracting top 10 news with AI Agent');
    const extractionAgent = new AIAgentBubble({
      message: extractionPrompt,
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });
    const extractionResult = await extractionAgent.action();

    if (!extractionResult.success || !extractionResult.data?.response) {
      this.logger?.error('AI agent failed to extract news');
      throw new Error('AI agent failed to extract news');
    }

    this.logger?.info('Successfully extracted news');
    const extractedData = JSON.parse(extractionResult.data.response);
    const newsItems: NewsItem[] = extractedData.news;

    // 3. Format the news for Slack
    const slackMessage = {
      text: 'Top 10 Hacker News Stories',
      blocks: [
        {
          type: 'header' as const,
          text: {
            type: 'plain_text' as const,
            text: 'Top 10 Hacker News Stories',
          },
        },
        {
          type: 'divider' as const,
        },
        ...newsItems.map((item, index) => ({
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `${index + 1}. <${item.url}|${item.title}>`,
          },
        })),
      ],
    };

    // 4. Send the formatted news to the specified Slack channel
    this.logger?.info(`Sending news to Slack channel: ${channel}`);
    const slackNotifier = new SlackBubble({
      operation: 'send_message',
      channel: channel,
      ...slackMessage,
    });
    const slackResult = await slackNotifier.action();

    if (!slackResult.success) {
      this.logger?.error(
        `Failed to send message to Slack: ${slackResult.error}`
      );
    } else {
      this.logger?.info('Successfully sent news to Slack');
    }

    return {
      news: newsItems,
    };
  }
}
