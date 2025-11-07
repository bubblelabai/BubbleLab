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

  it('should validate correct code and pass with valid BubbleFlow structure', async () => {
    const validCode = `
import {z} from 'zod';
import {
  // Base classes
  BubbleFlow,
  BaseBubble,
  ServiceBubble,
  WorkflowBubble,
  ToolBubble,

  // Service Bubbles
  HelloWorldBubble,
  AIAgentBubble,
  PostgreSQLBubble,
  SlackBubble,
  ResendBubble,
  GoogleDriveBubble,
  GmailBubble,
  SlackFormatterAgentBubble,
  HttpBubble,
  ApifyBubble,

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,
  InstagramTool,
  LinkedInTool,

  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleContext,
  type BubbleTriggerEvent,
  type WebhookEvent,
  type CronEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

// Define your custom input interface for webhook triggers
export interface CustomWebhookPayload extends WebhookEvent {
  // This workflow is triggered by a simple webhook, no custom payload needed.
}

export class GoogleDriveFileOrganizerFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const listFilesBubble = new GoogleDriveBubble({
      operation: 'list_files',
      max_results: 100, // Process up to 100 files per run
    });
    const listResult = await listFilesBubble.action();

    if (!listResult.success || !listResult.data?.files) {
      throw new Error(\`Failed to list Google Drive files: \${listResult.error || 'Unknown error'}\`);
    }

    const filesToProcess = listResult.data.files.filter(
      (file) => file.mimeType !== 'application/vnd.google-apps.folder' && file.id
    );

    if (filesToProcess.length === 0) {
      return { message: 'No files found to organize.' };
    }

    const mimeTypeFolderMap = new Map<string, string>();
    let organizedCount = 0;
    const errors: string[] = [];

    // Process files in batches of 5
    for (let i = 0; i < filesToProcess.length; i += 5) {
      const batch = filesToProcess.slice(i, i + 5);
      const batchPromises = batch.map(async (file) => {
        try {
          if (!file.id || !file.mimeType || !file.name) {
            console.warn(\`Skipping file with missing data: \${JSON.stringify(file)}\`);
            return;
          }

          // 1. Get or create the destination folder
          let folderId = mimeTypeFolderMap.get(file.mimeType);
          if (!folderId) {
            const folderName = \`\${file.mimeType.split('/').pop()?.split('.').pop()?.toUpperCase()} Files\`;
            const createFolderBubble = new GoogleDriveBubble({
              operation: 'create_folder',
              name: folderName,
            });
            const folderResult = await createFolderBubble.action();
            if (folderResult.success && folderResult.data?.folder?.id) {
              folderId = folderResult.data.folder.id;
              mimeTypeFolderMap.set(file.mimeType, folderId);
            } else {
              throw new Error(\`Failed to create folder for \${file.mimeType}: \${folderResult.error}\`);
            }
          }

          // 2. Download the file
          const downloadBubble = new GoogleDriveBubble({
            operation: 'download_file',
            file_id: file.id,
          });
          const downloadResult = await downloadBubble.action();
          if (!downloadResult.success || !downloadResult.data?.content) {
            throw new Error(\`Failed to download file \${file.name}: \${downloadResult.error}\`);
          }

          // 3. Upload the file to the new folder
          const uploadBubble = new GoogleDriveBubble({
            operation: 'upload_file',
            name: file.name,
            content: downloadResult.data.content,
            mimeType: file.mimeType,
            parent_folder_id: folderId,
          });
          const uploadResult = await uploadBubble.action();
          if (!uploadResult.success) {
            throw new Error(\`Failed to upload file \${file.name}: \${uploadResult.error}\`);
          }

          // 4. Delete the original file
          const deleteBubble = new GoogleDriveBubble({
            operation: 'delete_file',
            file_id: file.id,
          });
          const deleteResult = await deleteBubble.action();
          if (!deleteResult.success) {
            // Log as a non-critical error, since the file was already moved
            console.error(\`Failed to delete original file \${file.name}: \${deleteResult.error}\`);
          }
          
          organizedCount++;

        } catch (error: any) {
          const errorMessage = \`Error processing file \${file.name || 'unknown'}: \${error.message}\`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      });

      await Promise.all(batchPromises);
    }

    let message = \`Successfully organized \${organizedCount} out of \${filesToProcess.length} files.\`;
    if (errors.length > 0) {
        message += \` Encountered \${errors.length} errors. Check logs for details.\`;
    }

    return { message };
  }
}
`;

    const validationTool = new BubbleFlowValidationTool({
      code: validCode,
      options: { includeDetails: true, strictMode: true },
    });

    const result = await validationTool.action();

    // Expect it to be valid
    expect(result.success).toBe(true);
    expect(result.data?.valid).toBe(true);
  });

  it('should show enhanced error message for invalid trigger event type', async () => {
    const invalidTriggerCode = `
import { z } from 'zod';

import {
  BubbleFlow,
  AIAgentBubble,
  GoogleCalendarBubble,
  SlackBubble,
  type GmailNewEmailEvent,
} from '@bubblelab/bubble-core';

// Define the structure for the output of the workflow
export interface Output {
  message: string;
  eventId?: string;
}

// Main class for the email processing and event creation workflow
export class EmailToCalendarAgent extends BubbleFlow<'gmail/new-email'> {
  async handle(payload: GmailNewEmailEvent): Promise<Output> {
    // Extract the email body content. It might be in payload.body.data or nested in parts.
    const emailBody = this.extractEmailBody(payload);

    if (!emailBody) {
      this.logger?.warn('Could not extract a readable body from the email.');
      return { message: 'Could not extract email body.' };
    }

    // Use an AI agent to analyze the email content
    const emailAnalysisAgent = new AIAgentBubble({
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
      systemPrompt: \`
        You are an intelligent assistant that analyzes emails to determine if a meeting or event needs to be scheduled.
        Your task is to extract the event details from the email content.
        - If an event is proposed, extract the summary (title), description, location, start time, and end time.
        - Times should be in ISO 8601 format (e.g., "2024-09-15T14:00:00-07:00").
        - Also, extract a list of attendee emails.
        - Respond with a JSON object containing these details.
        - If no event needs to be scheduled, respond with a JSON object: { "createEvent": false }.
        - Example output for a valid event:
          {
            "createEvent": true,
            "summary": "Project Kick-off",
            "description": "Initial meeting to discuss project goals.",
            "location": "Virtual / Google Meet",
            "startTime": "2024-09-15T14:00:00-07:00",
            "endTime": "2024-09-15T15:00:00-07:00",
            "attendees": ["test@example.com"]
          }
      \`,
      message: \`Analyze the following email content: \${emailBody}\`,
    });

    const analysisResult = await emailAnalysisAgent.action();

    if (!analysisResult.success || !analysisResult.data?.response) {
      this.logger?.error('AI agent failed to analyze the email.', new Error(analysisResult.error));
      return { message: 'AI agent analysis failed.' };
    }

    // Safely parse the AI's JSON response
    let eventDetails;
    try {
      eventDetails = JSON.parse(analysisResult.data.response);
    } catch (error) {
      this.logger?.error('Failed to parse AI agent JSON response.', error as Error);
      return { message: 'Failed to parse AI response.' };
    }

    // Proceed only if the AI determines an event should be created
    if (!eventDetails.createEvent) {
      return { message: 'No event creation required for this email.' };
    }

    const { summary, description, location, startTime, endTime, attendees } = eventDetails;

    // Validate that essential event details are present
    if (!summary || !startTime || !endTime) {
        this.logger?.warn('AI agent did not provide enough details to create an event.', { details: eventDetails });
        return { message: 'Insufficient event details from AI.' };
    }

    // Send a Slack message to ask for permission before creating the event
    // NOTE: In a real-world scenario, this would involve interactive components (buttons)
    // and a separate webhook to handle the user's response. For simplicity, this
    // implementation just notifies the user and proceeds.
    const permissionRequester = new SlackBubble({
      operation: 'send_message',
      channel: 'general', // Change to your desired channel
      text: \`An email was received that suggests a calendar event.
*Subject:* \${this.findHeader(payload.headers, 'Subject')}
*Summary:* \${summary}
*Time:* \${startTime} - \${endTime}
*Attendees:* \${attendees?.join(', ') || 'None'}
A calendar event will be created based on this.\`,
    });

    await permissionRequester.action();

    // Create the Google Calendar event
    const eventCreator = new GoogleCalendarBubble({
      operation: 'create_event',
      summary,
      description,
      location,
      start: {
        dateTime: startTime,
        timeZone: 'UTC', // Defaulting to UTC, could be dynamic
      },
      end: {
        dateTime: endTime,
        timeZone: 'UTC', // Defaulting to UTC, could be dynamic
      },
      attendees: attendees?.map((email: string) => ({ email })) || [],
    });

    const eventResult = await eventCreator.action();

    if (!eventResult.success || !eventResult.data?.event?.id) {
      this.logger?.error('Failed to create Google Calendar event.', new Error(eventResult.error));
      return { message: 'Failed to create calendar event.' };
    }

    this.logger?.info(\`Successfully created event with ID: \${eventResult.data.event.id}\`);

    return {
      message: 'Successfully analyzed email and created calendar event.',
      eventId: eventResult.data.event.id,
    };
  }

  /**
   * Extracts the body content from a Gmail payload.
   * It handles different MIME types and encodings.
   */
  private extractEmailBody(email: GmailNewEmailEvent | GmailNewEmailEvent['parts'][0]): string | null {
    const { parts, body, mimeType } = email;

    if (mimeType === 'text/plain' && body?.data) {
      return Buffer.from(body.data, 'base64').toString('utf-8');
    }

    if (parts) {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        // Recursive call for nested parts
        if (part.parts) {
            const nestedBody = this.extractEmailBody(part);
            if (nestedBody) return nestedBody;
        }
      }
    }
    
    // Fallback for emails that might not have a text/plain part but have a body
    if (body?.data) {
        return Buffer.from(body.data, 'base64').toString('utf-8');
    }
    return null;
  }
  
  /**
   * Finds a specific header value from the Gmail payload.
   */
  private findHeader(headers: { name: string; value: string }[], name: string): string {
    const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : 'No Subject';
  }
}
`;

    const validationTool = new BubbleFlowValidationTool({
      code: invalidTriggerCode,
      options: { includeDetails: true, strictMode: true },
    });

    const result = await validationTool.action();

    // Expect it to be invalid
    expect(result.success).toBe(false);
    expect(result.data?.valid).toBe(false);
    expect(result.data?.errors).toBeDefined();
    expect(result.data?.errors?.length).toBeGreaterThan(0);

    // Check that the error message includes the enhanced hint with available trigger event types
    const errorMessages = result.data?.errors?.join('\n') || '';
    console.log(errorMessages);
    expect(errorMessages).toContain('Available trigger event types');
    expect(errorMessages).toContain("'slack/bot_mentioned'");
    expect(errorMessages).toContain("'schedule/cron'");
    expect(errorMessages).toContain("'webhook/http'");
  });
});
