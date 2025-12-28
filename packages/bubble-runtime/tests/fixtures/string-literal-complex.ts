import { z } from 'zod';
import {
  BubbleFlow,
  ApifyBubble,
  ResearchAgentTool,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface AmazonSourcingOutput {
  products: Array<{
    name: string;
    amazonPrice: string;
    amazonUrl: string;
    thumbnail: string;
    suppliers: Array<{
      name: string;
      price: string;
      url: string;
    }>;
  }>;
  productsProcessed: number;
}

export interface AmazonSourcingPayload extends WebhookEvent {
  /**
   * The Amazon Best Sellers category URL to scrape.
   * Navigate to Amazon.com, click "Best Sellers", choose a category, and copy the full URL from your browser's address bar.
   * @canBeFile false
   */
  amazonCategoryUrl?: string;

  /**
   * The maximum number of top-performing products to research for suppliers.
   * Enter a number between 1 and 10. Higher numbers will take longer to process.
   */
  maxProducts?: number;

  /**
   * The name for the new Google Sheet where results will be saved.
   * This sheet will be created in your Google Drive.
   * @canBeFile false
   */
  sheetName?: string;
}

export class AmazonProductSourcingFlow extends BubbleFlow<'webhook/http'> {
  /**
   * Scrapes the top-performing products from the specified Amazon Best Sellers category.
   * Uses the 'junglee/amazon-bestsellers' Apify actor to extract product names, prices, and URLs.
   * The maxItems parameter limits the initial scrape to avoid unnecessary processing.
   */
  private async scrapeAmazonBestsellers(
    amazonCategoryUrl: string,
    maxProducts: number
  ) {
    // Runs the Amazon Best Sellers scraper to identify high-performing products.
    // The startUrls parameter takes the category URL provided in the payload.
    // We limit the scrape to the maxProducts count to ensure the workflow remains efficient.
    const amazonScraper = new ApifyBubble({
      actorId: 'iHaiR8VIUt13olbXg',
      input: {
        startUrls: [{ url: amazonCategoryUrl }],
        maxItems: maxProducts,
      },
      waitForFinish: true,
    });

    const result = await amazonScraper.action();

    if (!result.success || !result.data?.items) {
      throw new Error(
        `Failed to scrape Amazon: ${result.error || 'No items found'}`
      );
    }

    return result.data.items as Array<{
      name: string;
      price: number;
      currency: string;
      url: string;
      thumbnail: string;
    }>;
  }

  /**
   * Researches alternative suppliers for a specific Amazon product to find lower prices.
   * Uses the Research Agent to search the web, including AliExpress and wholesalers.
   * Returns a structured list of suppliers with their names, prices, and direct links.
   */
  private async findSuppliersForProduct(
    productName: string,
    amazonPrice: number,
    currency: string
  ) {
    // Employs the research agent to find better deals for the identified product.
    // The task prompt explicitly asks for lower prices than the current Amazon listing.
    // Uses gemini-3-pro-preview for deep research across multiple potential supplier sites.
    const supplierResearch = new ResearchAgentTool({
      task: `Find suppliers for the product "${productName}" that offer it at a lower price than ${currency}${amazonPrice}. 
             Check AliExpress, Alibaba, and general wholesalers. Provide the supplier name, their price, and the product URL.`,
      model: 'google/gemini-3-pro-preview',
      expectedResultSchema: z.object({
        suppliers: z
          .array(
            z.object({
              name: z.string().describe('Name of the supplier or website'),
              price: z.number().describe('The price offered by this supplier'),
              url: z
                .string()
                .describe('Direct URL to the product on the supplier website'),
            })
          )
          .describe('A list of alternative suppliers found'),
      }),
    });

    const result = await supplierResearch.action();

    if (!result.success) {
      this.logger?.info(`Research failed for ${productName}: ${result.error}`);
      return [];
    }

    return (
      (
        result.data?.result as {
          suppliers: { name: string; price: number; url: string }[];
        }
      )?.suppliers || []
    );
  }

  /**
   * Orchestrates the entire product sourcing workflow.
   * Coordinates scraping and research, returning all data directly in the response.
   */
  async handle(payload: AmazonSourcingPayload): Promise<AmazonSourcingOutput> {
    const {
      amazonCategoryUrl = 'https://www.amazon.com/Best-Sellers/zgbs',
      maxProducts = 5,
    } = payload;

    // Identify top performing products
    const products = await this.scrapeAmazonBestsellers(
      amazonCategoryUrl,
      maxProducts
    );

    // Research each product and collect results
    const results: Array<{
      name: string;
      amazonPrice: string;
      amazonUrl: string;
      thumbnail: string;
      suppliers: Array<{
        name: string;
        price: string;
        url: string;
      }>;
    }> = [];
    for (const product of products) {
      const suppliers = await this.findSuppliersForProduct(
        product.name,
        product.price,
        product.currency || '$'
      );

      results.push({
        name: product.name,
        amazonPrice: `${product.currency || '$'}${product.price}`,
        amazonUrl: product.url,
        thumbnail: product.thumbnail,
        suppliers: suppliers.map((s) => ({
          name: s.name,
          price: `${product.currency || '$'}${s.price}`,
          url: s.url,
        })),
      });
    }

    return {
      products: results,
      productsProcessed: results.length,
    };
  }
}
