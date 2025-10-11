import {
  BubbleFlow,
  GoogleSheetsBubble,
  RedditScrapeTool,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  newContactsAdded: number;
  message: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  spreadsheetId: string;
}

const DESIRED_CONTACTS = 2;
const SHEET_NAME = 'Sheet1';
const HEADERS = ['Name', 'Link to Original Post', 'Message', 'Date', 'Status'];

export class RedditLeadFinder extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { spreadsheetId } = payload;

    // 1. Get existing contacts from Google Sheet
    const readResult = await new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: `${SHEET_NAME}!A:A`,
    }).action();

    let existingContacts: string[] = [];
    if (readResult.success && readResult.data?.values) {
      existingContacts = readResult.data.values.flat().map(String);
    }

    // 2. Scrape Reddit for frustrated users
    const scrapeResult = await new RedditScrapeTool({
      subreddit: 'n8n',
      sort: 'new',
      limit: 300,
    }).action();

    if (!scrapeResult.success || !scrapeResult.data?.posts) {
      throw new Error('Failed to scrape Reddit or no posts found.');
    }

    // 3. Filter for new, frustrated users and generate outreach
    const newContacts: (string | number)[][] = [];

    for (const post of scrapeResult.data.posts) {
      if (newContacts.length >= DESIRED_CONTACTS) {
        break;
      }

      if (existingContacts.includes(post.author)) {
        continue; // Skip existing contact
      }

      const agentResult = await new AIAgentBubble({
        systemPrompt: `You are an expert in identifying customer pain points and drafting empathetic outreach. Your goal is to find people frustrated with n8n.io and craft a personalized, non-salesy message offering a potential solution, BubbleLab (https://bubblelab.ai).`,
        message: `Analyze the following Reddit post to determine if the author is expressing frustration with n8n.
          
          Post Title: "${post.title}"
          Post Content: "${post.selftext}"
          
          If the user seems frustrated or is facing significant challenges, generate a personalized, empathetic outreach message. The message should acknowledge their specific problem and gently introduce BubbleLab as a potentially simpler, more powerful alternative without being pushy.
          
          Respond in JSON format with two keys:
          1. "isFrustrated": boolean (true if the user seems frustrated, otherwise false)
          2. "outreachMessage": string (the personalized message, or an empty string if not frustrated)
          `,
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
        },
        tools: [],
      }).action();

      if (agentResult.success && agentResult.data?.response) {
        try {
          const { isFrustrated, outreachMessage } = JSON.parse(
            agentResult.data.response
          );
          if (isFrustrated && outreachMessage) {
            newContacts.push([
              post.author,
              post.postUrl,
              outreachMessage,
              new Date(post.createdUtc * 1000).toISOString(),
              'Need to Reach Out',
            ]);
            existingContacts.push(post.author); // Add to list to avoid duplicates in the same run
          }
        } catch (e) {
          console.error(
            'Failed to parse AI agent response:',
            agentResult.data.response
          );
        }
      }
    }

    if (newContacts.length === 0) {
      return {
        newContactsAdded: 0,
        message: 'No new frustrated contacts found.',
      };
    }

    // 4. Add headers if sheet is empty
    if (!readResult.data?.values || readResult.data.values.length === 0) {
      await new GoogleSheetsBubble({
        operation: 'write_values',
        spreadsheet_id: spreadsheetId,
        range: `${SHEET_NAME}!A1`,
        values: [HEADERS],
        value_input_option: 'RAW',
      }).action();
    }

    // 5. Append new contacts to the sheet
    const appendResult = await new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: `${SHEET_NAME}!A:A`,
      values: newContacts,
      value_input_option: 'USER_ENTERED',
    }).action();

    if (!appendResult.success) {
      throw new Error('Failed to append new contacts to Google Sheet.');
    }

    return {
      newContactsAdded: newContacts.length,
      message: `Successfully added ${newContacts.length} new contacts to the spreadsheet.`,
    };
  }
}
