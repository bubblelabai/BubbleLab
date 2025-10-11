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
  StorageBubble,
  GoogleDriveBubble,
  GmailBubble,
  SlackFormatterAgentBubble,
  GoogleSheetsBubble,

  // Template Workflows
  SlackDataAssistantWorkflow,
  PDFFormOperationsWorkflow,

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,

  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleContext,
  type BubbleOperationResult,
  type BubbleTriggerEvent,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  newContactsAdded: number;
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  spreadsheetId: string;
}

interface AIResponse {
  contacts: {
    name: string;
    linkToPost: string;
    message: string;
    date: string;
  }[];
}

export class RedditLeadFinder extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { spreadsheetId } = payload;

    // 1. Get existing contacts from Google Sheet to avoid duplicates
    const readSheetResult = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!B:B',
    }).action();

    if (!readSheetResult.success) {
      throw new Error(
        `Failed to read from Google Sheet: ${readSheetResult.error}`
      );
    }
    const existingContacts = readSheetResult.data?.values || [];
    const existingLinks = existingContacts.flat().filter(Boolean);

    // 2. Scrape Reddit for potential leads
    const scrapeResult = await new RedditScrapeTool({
      subreddit: 'n8n',
      sort: 'new',
      limit: 50,
    }).action();

    if (!scrapeResult.success || !scrapeResult.data?.posts) {
      throw new Error(`Failed to scrape Reddit: ${scrapeResult.error}`);
    }
    const posts = scrapeResult.data.posts;

    // 3. Use AI Agent to identify frustrated users and generate outreach messages
    const systemPrompt = `
          You are an expert analyst tasked with identifying potential leads from Reddit posts.
          Your goal is to find up to 10 new contacts who are expressing frustration or dissatisfaction with n8n.
          You will be given a list of Reddit posts and a list of existing contact links to avoid duplicates.
  
          Instructions:
          1. Analyze the provided Reddit posts from the 'n8n' subreddit.
          2. Identify posts where the author seems frustrated, is facing difficult issues, or is considering alternatives to n8n.
          3. Compare the post permalinks with the list of existing contact links. DO NOT include anyone from the existing contacts list.
          4. For each NEW and frustrated user, create a personalized, empathetic outreach message. The message should acknowledge their struggle and gently introduce Bubble Lab (https://bubblelab.ai) as a potential solution without being overly salesy.
          5. Extract the author's name, the permalink to their post, and the date of the post (in ISO 8601 format).
          6. Format the final output as a single JSON object with a key "contacts" which is an array of objects. Each object in the array should have the following keys: "name", "linkToPost", "message", "date".
          7. Ensure you find up to 10 unique, new contacts. If no one is frustrated, return an empty "contacts" array.
      `;

    const aiAgentBubble = new AIAgentBubble({
      message: `Here are the Reddit posts: ${JSON.stringify(posts)}. Here are the existing contact links to exclude: ${JSON.stringify(existingLinks)}`,
      systemPrompt,
      model: {
        model: 'openai/gpt-5',
        jsonMode: true,
      },
      tools: [],
    });

    const aiResult = await aiAgentBubble.action();

    if (!aiResult.success || !aiResult.data?.response) {
      throw new Error(`AI Agent failed: ${aiResult.error}`);
    }

    let newContacts: AIResponse['contacts'] = [];
    try {
      const parsedResponse: AIResponse = JSON.parse(aiResult.data.response);
      newContacts = parsedResponse.contacts || [];
    } catch (error) {
      const e = error as Error;
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    if (newContacts.length === 0) {
      return {
        message: 'No new contacts found.',
        newContactsAdded: 0,
      };
    }

    // 4. Check for headers and add them if they don't exist
    const headerReadResult = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!1:1',
    }).action();

    if (!headerReadResult.success) {
      throw new Error(`Failed to read headers: ${headerReadResult.error}`);
    }

    const headers = headerReadResult.data?.values?.[0];
    if (!headers || headers.length < 5) {
      await new GoogleSheetsBubble({
        operation: 'write_values',
        spreadsheet_id: spreadsheetId,
        range: 'Sheet1!A1',
        values: [
          ['Name', 'Link to Original Post', 'Message', 'Date', 'Status'],
        ],
        value_input_option: 'RAW',
      }).action();
    }

    // 5. Append new contacts to the Google Sheet
    const rowsToAppend = newContacts.map((contact) => [
      contact.name,
      contact.linkToPost,
      contact.message,
      contact.date,
      'Need to Reach Out',
    ]);

    const appendResult = await new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:A',
      values: rowsToAppend,
      value_input_option: 'RAW',
    }).action();

    if (!appendResult.success) {
      throw new Error(
        `Failed to append data to Google Sheet: ${appendResult.error}`
      );
    }

    return {
      message: `Successfully added ${newContacts.length} new contacts to the spreadsheet.`,
      newContactsAdded: newContacts.length,
    };
  }
}
