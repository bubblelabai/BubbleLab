import { BubbleFlowValidationTool } from './bubbleflow-validation-tool.js';
import { describe, it, expect } from 'vitest';

// Invalid code that should fail validation
const invalidCode = `
import {z} from 'zod';
import {
  BubbleFlow,
  type WebhookEvent,
  GoogleSheetsBubble,
  AIAgentBubble,
  ResearchAgentTool,
  LinkedInTool,
} from '@bubblelab/bubble-core';

// --- Input Interfaces ---

interface SalesforceData {
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  industry: string | null;
  leadScore: number | null;
  lastContactDate: string | null;
  leadSource: string | null;
  salesRep: string | null;
  dealStage: string | null;
  dealValue: number | null;
  linkedinUrl?: string;
  twitterUrl?: string;
  facebookUrl?: string;
}

interface ShopifyOrder {
  orderId: string;
  productNames: string[];
  quantities: number[];
  prices: number[];
  discounts: number | null;
  shippingAddress: string | null;
  orderStatus: string;
}

interface ZendeskTicket {
  ticketId: string;
  subject: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | null;
  status: string;
  resolutionTime: number | null; // in hours
  customerSatisfactionScore: number | null; // 1-5
}

export interface CustomWebhookPayload extends WebhookEvent {
  customerId: string;
  salesforceData: SalesforceData;
  shopifyOrders: ShopifyOrder[];
  zendeskTickets: ZendeskTicket[];
  spreadsheetId: string;
}

// --- Output Interface ---

export interface Output {
  customerId: string;
  status: string;
  sheetUpdateResult: any;
  error?: string;
}

// --- Main Workflow Class ---

export class CustomerIntelligenceFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { customerId, salesforceData, shopifyOrders, zendeskTickets, spreadsheetId } = payload;

    // --- 1. Social Media Scraping ---

    let linkedinData = null;
    if (salesforceData.linkedinUrl) {
      const username = salesforceData.linkedinUrl.split('/').filter(Boolean).pop();
      if (username) {
        const linkedinResult = await new LinkedInTool({
          operation: 'scrapePosts',
          username: username,
          limit: 5,
        }).action();
        if (linkedinResult.success && linkedinResult.data && linkedinResult.data.posts.length > 0) {
          const firstPost = linkedinResult.data.posts[0];
          linkedinData = {
            followers: null, // Note: linkedin-tool does not provide follower count directly
            engagementRate: (firstPost.stats?.totalReactions ?? 0) + (firstPost.stats?.comments ?? 0),
            recentPosts: linkedinResult.data.posts.map(p => p.text).filter(Boolean).slice(0, 3),
            bio: firstPost.author?.headline ?? null,
            location: null,
          };
        }
      }
    }

    let twitterData = null;
    if (salesforceData.twitterUrl) {
        const researchResult = await new ResearchAgentTool({
            task: \`Scrape the Twitter profile at \${salesforceData.twitterUrl} for the user's bio, follower count, and the text of their 3 most recent tweets.\`,
            expectedResultSchema: JSON.stringify({
                type: 'object',
                properties: {
                    bio: { type: 'string', description: 'User bio' },
                    followers: { type: 'number', description: 'Follower count' },
                    recentTweets: { type: 'array', items: { type: 'string' }, description: 'Text of recent tweets' }
                },
                required: ['bio', 'followers', 'recentTweets']
            })
        }).action();
        if (researchResult.success && researchResult.data?.result) {
            const result = researchResult.data.result as any;
            twitterData = {
                followers: result.followers ?? null,
                bio: result.bio ?? null,
                recentPosts: result.recentTweets ?? [],
            };
        }
    }


    // --- 2. AI-Powered Data Enhancement ---

    const aiPrompt = \`
      Analyze the following customer data and generate a comprehensive intelligence report in JSON format.
      Handle missing or incomplete data gracefully.

      **Customer Data:**
      - **CRM:** \${JSON.stringify(salesforceData)}
      - **Orders:** \${JSON.stringify(shopifyOrders)}
      - **Support Tickets:** \${JSON.stringify(zendeskTickets)}
      - **LinkedIn Data:** \${JSON.stringify(linkedinData)}
      - **Twitter Data:** \${JSON.stringify(twitterData)}

      **Your Tasks:**
      1.  **Sentiment Analysis:** Analyze sentiment from support tickets and social media posts.
      2.  **Company Info:** Estimate company size and revenue based on industry and available data.
      3.  **Categorization:** Categorize the customer by industry, buying behavior, and engagement level.
      4.  **Churn Risk:** Calculate a churn risk score (0-100) based on ticket patterns and sentiment.
      5.  **Personalized Recommendations:** Generate 1-2 actionable marketing recommendations.
      6.  **Calculate Metrics:** Compute total orders, total spent, average order value, etc.

      **Output JSON Schema:**
      {
        \\\"companySize\\\": \\\"e.g., 1-10 employees\\\",
        \\\"revenueEstimate\\\": \\\"e.g., $1M - $5M\\\",
        \\\"recentSentiment\\\": \\\"Positive | Negative | Neutral\\\",
        \\\"bioKeywords\\\": [\\\"keyword1\\\", \\\"keyword2\\\"],
        \\\"churnRiskScore\\\": 85,
        \\\"customerLifetimeValue\\\": 15000,
        \\\"recommendedActions\\\": [\\\"action1\\\", \\\"action2\\\"],
        \\\"marketingSegment\\\": \\\"e.g., High-Value, Engaged\\\",
        \\\"engagementLevel\\\": \\\"High | Medium | Low\\\",
        \\\"totalOrders\\\": 5,
        \\\"totalSpent\\\": 1205.75,
        \\\"averageOrderValue\\\": 241.15,
        \\\"lastOrderDate\\\": \\\"YYYY-MM-DD\\\",
        \\\"favoriteProducts\\\": [\\\"Product A\\\", \\\"Product B\\\"],
        \\\"orderFrequency\\\": \\\"e.g., Monthly\\\",
        \\\"totalTickets\\\": 3,
        \\\"averageResolutionTime\\\": 12.5, // in hours
        \\\"satisfactionScore\\\": 4.5, // avg score
        \\\"lastTicketDate\\\": \\\"YYYY-MM-DD\\\",
        \\\"commonIssues\\\": [\\\"issue1\\\", \\\"issue2\\\"]
      }
    \`;

    const aiResult = await new AIAgentBubble({
      message: aiPrompt,
      model: { model: 'openai/gpt-4o-mini', temperature: 0.2, maxTokens: 4096, jsonMode: true },
      systemPrompt: 'You are a data analysis expert. Your task is to process customer data and return a clean, accurate JSON object based on the user\\'s request. Do not include any markdown or extra text.',
      tools: [],
    }).action();

    if (!aiResult.success || !aiResult.data?.response) {
      throw new Error(\`AI Agent failed: \${aiResult.error}\`);
    }

    const aiAnalysis = JSON.parse(aiResult.data.response);

    // --- 3. Data Processing and Consolidation ---

    let missingFieldsCount = 0;
    const consolidatedData: any = {
      customerId,
      name: salesforceData.name,
      email: salesforceData.email,
      phone: salesforceData.phone,
      company: salesforceData.company,
      industry: salesforceData.industry,
      companySize: aiAnalysis.companySize,
      revenueEstimate: aiAnalysis.revenueEstimate,
      leadScore: salesforceData.leadScore,
      lastContactDate: salesforceData.lastContactDate,
      leadSource: salesforceData.leadSource,
      salesRep: salesforceData.salesRep,
      dealStage: salesforceData.dealStage,
      dealValue: salesforceData.dealValue,
      totalOrders: aiAnalysis.totalOrders,
      totalSpent: aiAnalysis.totalSpent,
      averageOrderValue: aiAnalysis.averageOrderValue,
      lastOrderDate: aiAnalysis.lastOrderDate,
      favoriteProducts: aiAnalysis.favoriteProducts?.join(', '),
      orderFrequency: aiAnalysis.orderFrequency,
      linkedinFollowers: linkedinData?.followers,
      twitterFollowers: twitterData?.followers,
      facebookFollowers: null, // Placeholder
      engagementRate: linkedinData?.engagementRate,
      recentSentiment: aiAnalysis.recentSentiment,
      bioKeywords: aiAnalysis.bioKeywords?.join(', '),
      totalTickets: aiAnalysis.totalTickets,
      averageResolutionTime: aiAnalysis.averageResolutionTime,
      satisfactionScore: aiAnalysis.satisfactionScore,
      lastTicketDate: aiAnalysis.lastTicketDate,
      commonIssues: aiAnalysis.commonIssues?.join(', '),
      churnRiskScore: aiAnalysis.churnRiskScore,
      customerLifetimeValue: aiAnalysis.customerLifetimeValue,
      recommendedActions: aiAnalysis.recommendedActions?.join(', '),
      marketingSegment: aiAnalysis.marketingSegment,
      engagementLevel: aiAnalysis.engagementLevel,
      dataLastUpdated: new Date().toISOString(),
      dataQualityScore: 0, // Calculated below
      missingFieldsCount: 0, // Calculated below
      integrationStatus: 'Success',
    };

    Object.values(consolidatedData).forEach(value => {
        if (value === null || value === undefined || value === '') {
            missingFieldsCount++;
        }
    });
    consolidatedData.missingFieldsCount = missingFieldsCount;
    consolidatedData.dataQualityScore = 100 - (missingFieldsCount / Object.keys(consolidatedData).length * 100);


    // --- 4. Google Sheets Output ---

    const headers = Object.keys(consolidatedData);
    const values = [Object.values(consolidatedData).map(v => v === null || v === undefined ? '' : String(v))];


    const sheetResult = await new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A1',
      values: values,
      value_input_option: 'USER_ENTERED',
    }).action();

    if (!sheetResult.success) {
      throw new Error(\`Google Sheets update failed: \${sheetResult.error}\`);
    }

    return {
      customerId,
      status: 'Success',
      sheetUpdateResult: sheetResult.data,
    };
  }
}
`;

describe('BubbleFlowValidationTool Unit Test', () => {
  it('should detect invalid code and report errors with strict mode', async () => {
    const validationTool = new BubbleFlowValidationTool({
      code: invalidCode,
      options: { includeDetails: true, strictMode: true },
    });

    const result = await validationTool.action();

    // Expect it to be invalid
    expect(result.success).toBe(false);
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors).toBeDefined();
    expect(result.data?.errors?.length).toBeGreaterThan(0);
  });
});
