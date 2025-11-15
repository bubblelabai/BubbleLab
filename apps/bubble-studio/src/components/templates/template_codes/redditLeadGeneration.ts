// Template for Reddit Lead Generation
// This file contains the template code and metadata for the Reddit lead generation workflow

export const templateCode = `import {
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
    // Reads the existing contact names from the first column of the Google Sheet to
    // prevent duplicate entries. This ensures we only add new leads that haven't
    // been contacted before. Parameters: operation ('read_values'), spreadsheet_id
    // (the Google Sheets ID), range ('Sheet1!A:A' reads all values in column A).
    // This is the first step to maintain data quality and avoid spamming existing contacts.
    const readSheet = new GoogleSheetsBubble({
      operation: 'read_values',
      spreadsheet_id: spreadsheetId,
      range: 'Sheet1!A:A', // Read the entire 'Name' column
    });
    const existingContactsResult = await readSheet.action();

    if (!existingContactsResult.success) {
      throw new Error(\`Failed to read from Google Sheet: \${existingContactsResult.error}\`);
    }

    const existingNames = existingContactsResult.data?.values
      ? existingContactsResult.data.values.flat()
      : [];

    // 2. Scrape Reddit for posts from the specified subreddit
    // Fetches recent posts from the target subreddit to find potential leads. This
    // gathers raw Reddit content that will be analyzed by the AI agent to identify
    // users matching the search criteria. Parameters: subreddit (target subreddit name),
    // sort ('new' to get recent posts), limit (50 posts to analyze). This provides the
    // source material for lead identification in the next step.
    const redditScraper = new RedditScrapeTool({
      subreddit,
      sort: 'new',
      limit: 50,
    });
    const redditResult = await redditScraper.action();

    if (!redditResult.success || !redditResult.data?.posts) {
      throw new Error(\`Failed to scrape Reddit: \${redditResult.error}\`);
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
    // Analyzes Reddit posts to identify potential leads matching the search criteria
    // and generates personalized outreach messages for each lead. This AI agent filters
    // through posts, identifies qualified leads, and creates empathetic, non-salesy
    // messages tailored to each person's specific situation. Parameters: message (includes
    // existing contacts and Reddit posts), systemPrompt (defines lead generation strategy),
    // model (gemini-2.5-pro with jsonMode for structured output). This is the core intelligence
    // step that transforms raw Reddit data into actionable lead information with personalized
    // outreach messages.
    const systemPrompt = \`
      You are an expert analyst. Your task is to identify potential leads from a list of Reddit posts from the '\${subreddit}' subreddit.
      Your goal is to find exactly 10 new people who match the following criteria: \${searchCriteria}
      Do not select users who are already on the provided 'existing contacts' list.
      For each new lead, create a personalized, empathetic, and non-salesy outreach message. The message should acknowledge their specific problem or interest and gently suggest an alternative solution might exist, pointing them towards [product name].

      You MUST return the data as a JSON array of objects, with each object containing the following fields: "name", "link", "message".
      Example:
      [
        {
          "name": "some_redditor",
          "link": "https://reddit.com/r/\${subreddit}/...",
          "message": "Hey [Name], I saw your post about [specific topic]. [Personalized message based on their post]. If you're interested, you might find [product name] helpful. Hope this helps!"
        }
      ]
      Return ONLY the JSON array, with no other text or markdown.
    \`;

    const message = \`
      Existing Contacts:
      \${JSON.stringify(existingNames)}

      Reddit Posts:
      \${JSON.stringify(posts, null, 2)}

      Please analyze the posts and find me 10 new contacts matching the criteria: \${searchCriteria}
    \`;

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
      throw new Error(\`AI agent failed: \${aiResult.error}\`);
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
    // Verifies if the spreadsheet has column headers. This ensures the sheet is properly
    // structured before adding new data. Parameters: operation ('read_values'),
    // spreadsheet_id (the Google Sheets ID), range ('Sheet1!A1:E1' reads the first row).
    // This quality check ensures data integrity and proper organization of the lead data.
    const headerCheck = new GoogleSheetsBubble({
        operation: 'read_values',
        spreadsheet_id: spreadsheetId,
        range: 'Sheet1!A1:E1',
    });
    const headerResult = await headerCheck.action();
    if (!headerResult.success) {
        throw new Error(\`Failed to read headers: \${headerResult.error}\`);
    }

    const headers = headerResult.data?.values?.[0];
    if (!headers || headers.length < 5) {
        // Writes column headers to the spreadsheet if they don't exist. This sets up
        // the proper structure for storing lead information: Name, Link, Message, Date,
        // and Status. Parameters: operation ('write_values'), spreadsheet_id (the Google
        // Sheets ID), range ('Sheet1!A1' starting cell), values (array of header row).
        // This ensures the spreadsheet is properly formatted before adding lead data.
        const writeHeaders = new GoogleSheetsBubble({
            operation: 'write_values',
            spreadsheet_id: spreadsheetId,
            range: 'Sheet1!A1',
            values: [['Name', 'Link to Original Post', 'Message', 'Date', 'Status']],
        });
        const writeResult = await writeHeaders.action();
        if (!writeResult.success) {
            throw new Error(\`Failed to write headers: \${writeResult.error}\`);
        }
    }


    // 5. Format and append new contacts to the Google Sheet
    // Adds the newly identified leads to the Google Sheet with all their information.
    // This persists the lead data for future reference and outreach tracking. Parameters:
    // operation ('append_values'), spreadsheet_id (the Google Sheets ID), range
    // ('Sheet1!A:E' specifies columns A through E), values (array of rows, each containing
    // name, link, message, date, and status). This final step saves the leads and makes
    // them available for the user's outreach workflow.
    const rowsToAppend = newContacts.map(contact => {
        const post = posts.find((p: RedditPost) => p.url === contact.link);
        const postDate = post ? new Date(post.createdUtc * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
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
      throw new Error(\`Failed to append data to Google Sheet: \${appendResult.error}\`);
    }

    return {
      message: \`Successfully added \${newContacts.length} new contacts to the spreadsheet.\`,
      newContactsAdded: newContacts.length,
    };
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      spreadsheetId: {
        type: 'string',
        description: 'Google Sheets spreadsheet ID where leads will be stored',
      },
      subreddit: {
        type: 'string',
        description:
          'The subreddit to scrape for potential leads (e.g., "n8n", "entrepreneur")',
      },
      searchCriteria: {
        type: 'string',
        description:
          'Description of what type of users to identify (e.g., "expressing frustration with workflow automation tools")',
      },
    },
    required: ['spreadsheetId', 'subreddit', 'searchCriteria'],
  }),
  requiredCredentials: {
    'google-sheets': ['read', 'write'],
    reddit: ['read'],
  },
  // Pre-validated bubble parameters for instant visualization (no server validation needed)
  // Keys correspond to variableIds to ensure stable ordering/selection
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'readSheet',
      bubbleName: 'GoogleSheetsBubble',
      className: 'GoogleSheetsBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'read_values', type: 'string' },
        { name: 'spreadsheet_id', value: '${spreadsheetId}', type: 'string' },
        { name: 'range', value: 'Sheet1!A:A', type: 'string' },
      ],
    },
    2: {
      variableId: 2,
      variableName: 'redditScraper',
      bubbleName: 'RedditScrapeTool',
      className: 'RedditScrapeTool',
      nodeType: 'tool',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'subreddit', value: '${subreddit}', type: 'string' },
        { name: 'sort', value: 'new', type: 'string' },
        { name: 'limit', value: 50, type: 'number' },
      ],
    },
    3: {
      variableId: 3,
      variableName: 'aiAgent',
      bubbleName: 'AIAgentBubble',
      className: 'AIAgentBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'message',
          value:
            'Analyze existingNames and Reddit posts to return 10 new contacts matching the search criteria with name/link/message as JSON.',
          type: 'string',
        },
        {
          name: 'systemPrompt',
          value:
            'Identify 10 users matching the specified criteria from the subreddit and craft empathetic outreach. Return only JSON array.',
          type: 'string',
        },
        {
          name: 'model',
          value: { model: 'google/gemini-2.5-pro', jsonMode: true },
          type: 'object',
        },
      ],
    },
    4: {
      variableId: 4,
      variableName: 'headerCheck',
      bubbleName: 'GoogleSheetsBubble',
      className: 'GoogleSheetsBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'read_values', type: 'string' },
        { name: 'spreadsheet_id', value: '${spreadsheetId}', type: 'string' },
        { name: 'range', value: 'Sheet1!A1:E1', type: 'string' },
      ],
    },
    5: {
      variableId: 5,
      variableName: 'writeHeaders',
      bubbleName: 'GoogleSheetsBubble',
      className: 'GoogleSheetsBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'write_values', type: 'string' },
        { name: 'spreadsheet_id', value: '${spreadsheetId}', type: 'string' },
        { name: 'range', value: 'Sheet1!A1', type: 'string' },
        {
          name: 'values',
          value: [
            ['Name', 'Link to Original Post', 'Message', 'Date', 'Status'],
          ],
          type: 'array',
        },
      ],
    },
    6: {
      variableId: 6,
      variableName: 'appendSheet',
      bubbleName: 'GoogleSheetsBubble',
      className: 'GoogleSheetsBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'append_values', type: 'string' },
        { name: 'spreadsheet_id', value: '${spreadsheetId}', type: 'string' },
        { name: 'range', value: 'Sheet1!A:E', type: 'string' },
      ],
    },
  },
};
