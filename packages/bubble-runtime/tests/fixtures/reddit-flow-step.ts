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
  // Reads existing contact names from column A of the Google Sheet to prevent duplicate entries
  private async readExistingContacts(spreadsheetId: string): Promise<string[]> {
    // Reads existing contact names from column A of the Google Sheet using the
    // spreadsheet_id to prevent duplicate entries and maintain data quality.
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

    return existingContactsResult.data?.values
      ? existingContactsResult.data.values.flat().map((v) => String(v))
      : [];
  }

  // Fetches the 50 most recent posts from the target subreddit for lead analysis
  private async scrapeRedditPosts(subreddit: string): Promise<RedditPost[]> {
    // Fetches the 50 most recent posts from the target subreddit, gathering raw
    // Reddit content that will be analyzed to identify users matching the search criteria.
    const redditScraper = new RedditScrapeTool({
      subreddit,
      sort: 'new',
      limit: 50,
    });

    const redditResult = await redditScraper.action();

    if (!redditResult.success || !redditResult.data?.posts) {
      throw new Error(`Failed to scrape Reddit: ${redditResult.error}`);
    }

    return redditResult.data.posts.map((p: any) => ({
      author: p.author,
      title: p.title,
      selftext: p.selftext,
      url: p.postUrl,
      postUrl: p.postUrl,
      createdUtc: p.createdUtc,
    }));
  }

  // Analyzes Reddit posts using AI to identify potential leads matching search criteria
  private async analyzePostsForLeads(
    subreddit: string,
    searchCriteria: string,
    existingNames: string[],
    posts: RedditPost[]
  ): Promise<{ name: string; link: string; message: string }[]> {
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

    // Analyzes Reddit posts using gemini-2.5-pro with jsonMode to identify potential
    // leads matching the search criteria and generate personalized, empathetic outreach
    // messages tailored to each person's specific situation.
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

    try {
      const newContacts = JSON.parse(aiResult.data.response);
      if (!Array.isArray(newContacts)) {
        throw new Error('AI response is not a valid array');
      }
      return newContacts;
    } catch (error) {
      throw new Error('Failed to parse AI response as JSON.');
    }
  }

  // Ensures the spreadsheet has proper column headers before adding new data
  private async ensureHeadersExist(spreadsheetId: string): Promise<void> {
    // Verifies if the spreadsheet has column headers by reading the first row (A1:E1),
    // ensuring the sheet is properly structured before adding new data.
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
      // Writes column headers (Name, Link, Message, Date, Status) to cell A1 if they
      // don't exist, ensuring the spreadsheet is properly formatted before adding lead data.
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
  }

  // Formats new contacts into rows ready for Google Sheets with date and status
  private formatContactsForSheet(
    newContacts: { name: string; link: string; message: string }[],
    posts: RedditPost[]
  ): string[][] {
    return newContacts.map((contact) => {
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
  }

  // Appends newly identified leads to the Google Sheet with all contact information
  private async appendNewContacts(
    spreadsheetId: string,
    rowsToAppend: string[][]
  ): Promise<void> {
    // Appends the newly identified leads to columns A through E of the Google Sheet,
    // persisting lead data with name, link, message, date, and status for future
    // reference and outreach tracking.
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
  }

  // Main workflow orchestration
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { spreadsheetId, subreddit, searchCriteria } = payload;

    // Read existing contacts to prevent duplicates
    const existingNames = await this.readExistingContacts(spreadsheetId);

    // Scrape Reddit posts for analysis
    const posts = await this.scrapeRedditPosts(subreddit);

    // Analyze posts to identify new leads
    const newContacts = await this.analyzePostsForLeads(
      subreddit,
      searchCriteria,
      existingNames,
      posts
    );

    if (!Array.isArray(newContacts) || newContacts.length === 0) {
      return { message: 'No new contacts were found.', newContactsAdded: 0 };
    }

    // Ensure spreadsheet headers exist
    await this.ensureHeadersExist(spreadsheetId);

    // Format contacts for spreadsheet
    const rowsToAppend = this.formatContactsForSheet(newContacts, posts);

    // Append new contacts to spreadsheet
    await this.appendNewContacts(spreadsheetId, rowsToAppend);

    return {
      message: `Successfully added ${newContacts.length} new contacts to the spreadsheet.`,
      newContactsAdded: newContacts.length,
    };
  }
}
