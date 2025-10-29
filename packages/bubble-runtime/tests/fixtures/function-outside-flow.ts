import { z } from 'zod';
import {
  BubbleFlow,
  WebhookEvent,
  CronEvent,
  ResearchAgentTool,
  AIAgentBubble,
} from '@bubblelab/bubble-core';

const DAX_TICKERS = [
  'ADS.DE',
  'ALV.DE',
  'BAS.DE',
  'BAYN.DE',
  'BEI.DE',
  'BMW.DE',
  'CON.DE',
  '1COV.DE',
  'DAI.DE',
  'DBK.DE',
  'DB1.DE',
  'DPW.DE',
  'DTE.DE',
  'EOAN.DE',
  'FRE.DE',
  'FME.DE',
  'HEI.DE',
  'HEN3.DE',
  'IFX.DE',
  'LIN.DE',
  'LHA.DE',
  'MRK.DE',
  'MUV2.DE',
  'RWE.DE',
  'SAP.DE',
  'SIE.DE',
  'TKA.DE',
  'VOW3.DE',
  'VNA.DE',
  'WDI.DE',
  'P911.DE',
  'SHL.DE',
  'DTG.DE',
  'QIA.DE',
  'ENR.DE',
  'HNR1.DE',
  'RAA.DE',
  'SY1.DE',
  'ZAL.DE',
  'AIR.DE',
];

interface NewsArticle {
  headline: string;
  source: string;
}

interface TickerNews {
  company: string;
  ticker: string;
  sentimentScore: number;
  positiveHeadlines: NewsArticle[];
  takeaways: string[];
}

interface TopCompany {
  company: string;
  ticker: string;
  sentimentScore: number;
  takeaways: string[];
  headline: NewsArticle;
}

export interface Output {
  top5: TopCompany[];
  summary: {
    marketOverview: string;
    companies: {
      company: string;
      ticker: string;
      sentimentScore: number;
      takeaways: string[];
      headline: string;
      source: string;
    }[];
  };
  formattedText: string;
  processedCount: number;
  failedCount: number;
}

export interface CustomWebhookPayload extends WebhookEvent {}
export interface CustomCronPayload extends CronEvent {}

class NewsHandler {
  async fetchNewsForTicker(
    ticker: string,
    retries = 3
  ): Promise<NewsArticle[]> {
    for (let i = 0; i < retries; i++) {
      try {
        const researchBubble = new ResearchAgentTool({
          task: `Find the latest news articles for the company with ticker ${ticker} from the last 24 hours. Focus on financial and business news.`,
          expectedResultSchema: JSON.stringify({
            type: 'object',
            properties: {
              articles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    headline: { type: 'string' },
                    source: { type: 'string' },
                  },
                  required: ['headline', 'source'],
                },
              },
            },
            required: ['articles'],
          }),
          model: 'openai/gpt-5-mini',
        });

        const result = await researchBubble.action();

        if (result.success && result.data) {
          const parsedResult = result.data.result as {
            articles: NewsArticle[];
          };
          if (parsedResult && parsedResult.articles) {
            return parsedResult.articles;
          }
        }
        console.log(
          `Attempt ${i + 1} failed for ${ticker}: No articles found or parsing failed.`
        );
      } catch (error) {
        console.error(
          `Error fetching news for ${ticker} on attempt ${i + 1}:`,
          error
        );
      }
    }
    return [];
  }

  async analyzeSentiment(headline: string): Promise<number> {
    try {
      const sentimentAgent = new AIAgentBubble({
        message: `Analyze the sentiment of the following news headline and return a score between -1 (very negative) and 1 (very positive). Headline: \"${headline}\"`,
        systemPrompt:
          'You are a financial sentiment analysis expert. Respond ONLY with a JSON object containing a "score" field.',
        model: {
          model: 'openai/gpt-5-mini',
          jsonMode: true,
        },
      });

      const result = await sentimentAgent.action();

      if (result.success && result.data?.response) {
        const parsed = JSON.parse(result.data.response);
        if (typeof parsed.score === 'number') {
          return parsed.score;
        }
      }
    } catch (error) {
      console.error(
        `Error analyzing sentiment for headline: \"${headline}\"`,
        error
      );
    }
    return 0;
  }

  async generateTakeaways(headlines: string[]): Promise<string[]> {
    if (headlines.length === 0) return [];
    try {
      const takeawayAgent = new AIAgentBubble({
        message: `Based on these positive headlines, generate 1-2 concise bullet point takeaways in German:\n\n${headlines.join('\n')}`,
        systemPrompt:
          'You are a financial analyst. Create brief, insightful takeaways.',
        model: { model: 'openai/gpt-5-mini' },
      });
      const result = await takeawayAgent.action();
      if (result.success && result.data?.response) {
        return result.data.response
          .split('\n')
          .map((t) => t.replace(/^- /, ''))
          .filter((t) => t);
      }
    } catch (error) {
      console.error('Error generating takeaways:', error);
    }
    return [];
  }
}

class DaxNewsLogic {
  public async execute(): Promise<Output> {
    const newsHandler = new NewsHandler();
    const allTickerNews: TickerNews[] = [];
    let failedCount = 0;

    const processTicker = async (ticker: string): Promise<void> => {
      const articles = await newsHandler.fetchNewsForTicker(ticker);
      if (articles.length === 0) {
        failedCount++;
        return;
      }

      let totalScore = 0;
      const positiveHeadlines: NewsArticle[] = [];

      const sentimentPromises = articles.map((article) =>
        newsHandler.analyzeSentiment(article.headline)
      );
      const scores = await Promise.all(sentimentPromises);

      articles.forEach((article, index) => {
        const score = scores[index];
        totalScore += score;
        if (score > 0) {
          positiveHeadlines.push(article);
        }
      });

      if (positiveHeadlines.length > 0) {
        const takeaways = await newsHandler.generateTakeaways(
          positiveHeadlines.map((h) => h.headline)
        );
        allTickerNews.push({
          company: ticker.split('.')[0],
          ticker,
          sentimentScore: totalScore / articles.length,
          positiveHeadlines,
          takeaways,
        });
      }
    };

    const tickerBatches: string[][] = [];
    for (let i = 0; i < DAX_TICKERS.length; i += 5) {
      tickerBatches.push(DAX_TICKERS.slice(i, i + 5));
    }

    for (const batch of tickerBatches) {
      await Promise.all(batch.map((ticker) => processTicker(ticker)));
    }

    const rankedNews = allTickerNews
      .filter((n) => n.sentimentScore > 0)
      .sort((a, b) => b.sentimentScore - a.sentimentScore);

    const top5 = rankedNews.slice(0, 5).map((n) => ({
      company: n.company,
      ticker: n.ticker,
      sentimentScore: n.sentimentScore,
      takeaways: n.takeaways,
      headline: n.positiveHeadlines[0],
    }));

    if (top5.length === 0) {
      return {
        top5: [],
        summary: {
          marketOverview: 'Keine signifikant positiven Nachrichten gefunden.',
          companies: [],
        },
        formattedText:
          'Heute wurden keine signifikant positiven Nachrichten für die DAX-Unternehmen gefunden.',
        processedCount: DAX_TICKERS.length - failedCount,
        failedCount,
      };
    }

    const summaryAgent = new AIAgentBubble({
      message: `Erstelle eine kurze, prägnante deutsche Zusammenfassung der heutigen Top 5 DAX-Nachrichten.
            
            Marktübersicht: Beginne mit einem allgemeinen Absatz zur Marktstimmung basierend auf diesen Nachrichten.

            Unternehmens-Highlights: Liste die 5 Unternehmen mit ihren Ticker-Symbolen, Sentiment-Scores, den wichtigsten 1-2 Bullet-Point-Takeaways und einer positiven Schlagzeile auf.

            Daten:
            ${JSON.stringify(top5, null, 2)}`,
      systemPrompt:
        'Du bist ein Finanzjournalist, der für einen deutschen Newsletter schreibt. Antworte nur mit dem formatierten deutschen Text.',
      model: { model: 'openai/gpt-5' },
    });

    const summaryResult = await summaryAgent.action();
    const formattedText =
      summaryResult.success && summaryResult.data?.response
        ? summaryResult.data.response
        : 'Zusammenfassung konnte nicht generiert werden.';

    const marketOverview = formattedText.split('\n\n')[0] || '';

    return {
      top5,
      summary: {
        marketOverview,
        companies: top5.map((c) => ({
          company: c.company,
          ticker: c.ticker,
          sentimentScore: c.sentimentScore,
          takeaways: c.takeaways,
          headline: c.headline.headline,
          source: c.headline.source,
        })),
      },
      formattedText,
      processedCount: DAX_TICKERS.length - failedCount,
      failedCount,
    };
  }
}

export class DAXPositiveNewsSummary extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const logic = new DaxNewsLogic();
    return logic.execute();
  }
}

export class DAXPositiveNewsSummaryCron extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '30 5 * * 1-5';

  async handle(payload: CustomCronPayload): Promise<Output> {
    const logic = new DaxNewsLogic();
    return logic.execute();
  }
}
