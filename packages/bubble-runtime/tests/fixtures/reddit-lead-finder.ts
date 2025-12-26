import {
  BubbleFlow,
  GoogleSheetsBubble,
  RedditScrapeTool,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  newContactsAdded: number;
}

export interface CustomWebhookPayload extends WebhookEvent {
  spreadsheetId: string;
  subreddit: string;
  searchCriteria: string;
}

interface RedditPost {
  author: string;
  title: string;
  selftext: string;
  url: string;
  postUrl: string;
  createdUtc: number;
}

export class RedditFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { spreadsheetId, subreddit, searchCriteria } = payload;

    // 1. Get existing contacts from Google Sheet to avoid duplicates
    const readSheet = new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:A',
    });
    const existingContactsResult = await readSheet.action();

    if (!existingContactsResult.success) {
      throw new Error(
        `Failed to read from Google Sheet: ${existingContactsResult.error}`
      );
    }

    const existingNames = existingContactsResult.data?.values
      ? existingContactsResult.data.values.flat()
      : [];

    // 2. Scrape Reddit for posts from the specified subreddit
    const redditScraper = new RedditScrapeTool({
      subreddit,
      sort: 'new',
      limit: 50,
    });
    const redditResult = await redditScraper.action();

    if (!redditResult.success || !redditResult.data?.posts) {
      throw new Error(`Failed to scrape Reddit: ${redditResult.error}`);
    }

    const posts: RedditPost[] = redditResult.data.posts.map((p: any) => ({
      author: p.author,
      title: p.title,
      selftext: p.selftext,
      url: p.postUrl,
      postUrl: p.postUrl,
      createdUtc: p.createdUtc,
    }));

    // 3. Use AI to find users matching the search criteria and generate outreach messages
    const systemPrompt = `
      You are an expert analyst. Your task is to identify potential leads from a list of Reddit posts from the '${subreddit}' subreddit.
      Your goal is to find exactly 10 new people who match the following criteria: ${searchCriteria}
      Do not select users who are already on the provided 'existing contacts' list.
      For each new lead, create a personalized, empathetic, and non-salesy outreach message. The message should acknowledge their specific problem or interest and gently suggest an alternative solution might exist, pointing them towards [product name].

      You MUST return the data as a JSON array of objects, with each object containing the following fields: "name", "link", "message".
      Example:
      [
        {
          "name": "some_redditor",
          "link": "https://reddit.com/r/${subreddit}/...",
          "message": "Hey [Name], I saw your post about [specific topic]. [Personalized message based on their post]. If you're interested, you might find [product name] helpful. Hope this helps!"
        }
      ]
      Return ONLY the JSON array, with no other text or markdown.
    `;

    const message = `
      Existing Contacts:
      ${JSON.stringify(existingNames)}

      Reddit Posts:
      ${JSON.stringify(posts, null, 2)}

      Please analyze the posts and find me 10 new contacts matching the criteria: ${searchCriteria}
    `;

    const aiAgent = new AIAgentBubble({
      message,
      systemPrompt,
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
      tools: [],
    });

    const aiResult = await aiAgent.action();

    if (!aiResult.success || !aiResult.data?.response) {
      throw new Error(`AI agent failed: ${aiResult.error}`);
    }

    let newContacts: { name: string; link: string; message: string }[] = [];
    try {
      newContacts = JSON.parse(aiResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse AI response as JSON.');
    }

    if (!Array.isArray(newContacts) || newContacts.length === 0) {
      return { message: 'No new contacts were found.', newContactsAdded: 0 };
    }

    // 4. Check for headers and add them if they are missing
    const headerCheck = new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A1:E1',
    });
    const headerResult = await headerCheck.action();
    if (!headerResult.success) {
      throw new Error(`Failed to read headers: ${headerResult.error}`);
    }

    const headers = headerResult.data?.values?.[0];
    if (!headers || headers.length < 5) {
      const writeHeaders = new GoogleSheetsBubble({
        operation: 'write_values',
        spreadsheet_id: spreadsheetId,
        range: 'Sheet1!A1',
        values: [
          ['Name', 'Link to Original Post', 'Message', 'Date', 'Status'],
        ],
      });
      const writeResult = await writeHeaders.action();
      if (!writeResult.success) {
        throw new Error(`Failed to write headers: ${writeResult.error}`);
      }
    }

    // 5. Format and append new contacts to the Google Sheet
    const rowsToAppend = newContacts.map((contact) => {
      const post = posts.find((p: RedditPost) => p.url === contact.link);
      const postDate = post
        ? new Date(post.createdUtc * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      return [
        contact.name,
        contact.link,
        contact.message,
        postDate,
        'Need to Reach Out',
      ];
    });

    const appendSheet = new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:E',
      values: rowsToAppend,
    });

    const appendResult = await appendSheet.action();

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
