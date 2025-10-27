import { describe, it, expect, beforeAll } from 'vitest';
import { getFixture } from '../../tests/fixtures/index.js';
import { getWarmChecker, validateScript } from './BubbleValidator.js';

describe('LanguageService typechecker - validateScript', () => {
  beforeAll(() => {
    // Warm the checker once per test run for fast subsequent checks
    getWarmChecker('./tsconfig.json');
  });

  it('passes on valid HelloWorld flow', () => {
    const code = getFixture('hello-world');
    const result = validateScript(code, {
      fileName: 'virtual/hello-world.ts',
    });
    console.log(result);
    expect(result.success).toBe(true);
    expect(Object.keys(result.errors || {}).length).toBe(0);
  });

  it('fails on invalida parameter in HelloWorld flow', () => {
    const code = getFixture('hello-world-wrong-para');
    const result = validateScript(code, {
      fileName: 'virtual/hello-world-invalid-parameter.ts',
    });
    console.log(result);
  });

  it('fails on wrong types in HelloWorld flow', () => {
    const code = getFixture('hello-world-wrong-type');
    const result = validateScript(code, {
      fileName: 'virtual/hello-world-wrong-para.ts',
    });
    console.log(result);
    expect(result.success).toBe(false);
    expect(Object.keys(result.errors || {}).length).toBeGreaterThan(0);
  });

  it('passes on valid RedditLeadFinder flow', () => {
    const code = getFixture('reddit-lead-finder');
    const result = validateScript(code, {
      fileName: 'virtual/reddit-lead-finder.ts',
    });
    console.log(result);
    expect(result.success).toBe(true);
    expect(Object.keys(result.errors || {}).length).toBe(0);
  });

  it('passes on valid LinkedInLeadFinder flow', () => {
    const code = getFixture('linkedin-lead-finder-problematic');
    const result = validateScript(code, {
      fileName: 'virtual/linkedin-lead-finder.ts',
    });
    console.log(result);
    expect(result.success).toBe(false);
    expect(Object.keys(result.errors || {}).length).toBeGreaterThan(0);
    // Expect some erros to contain 'TS2322'
    expect(
      Object.values(result.errors || {}).some((error) =>
        error.includes('TS2322')
      )
    ).toBe(true);
  });

  it('passes on valid GmailCategorizationCron flow', () => {
    const code = `
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
import { z } from 'zod';

export interface Output {
  categorizedEmails: {
    emailId: string;
    suggestedLabels: string[];
    agentResponse?: string;
  }[];
  errors: string[];
}

export interface CustomCronPayload extends CronEvent {
  // No custom payload needed for this cron job
}

export class GmailCategorizationCron extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '*/5 * * * *'; // Every 5 minutes

  async handle(payload: CustomCronPayload): Promise<Output> {
    const categorizedEmails: Output['categorizedEmails'] = [];
    const errors: string[] = [];

    const listEmailsBubble = new GmailBubble({
      operation: 'list_emails',
      query: 'is:unread',
      max_results: 5, // Process 5 emails at a time to avoid hitting limits
    });

    const listResult = await listEmailsBubble.action();

    if (!listResult.success || !listResult.data?.messages || listResult.data.messages.length === 0) {
      const errorMessage = listResult.error || 'No new messages found to process.';
      console.log(errorMessage);
      if (listResult.error) {
        errors.push(errorMessage);
      }
      return { categorizedEmails, errors };
    }

    const customTools: {
      name: string;
      description: string;
      schema: Record<string, any>;
      func: (args: Record<string, unknown>) => Promise<unknown>;
    }[] = [
      {
        name: 'read_gmail_message_content',
        description: 'Reads the full content, subject, and sender of a specific email using its ID.',
        schema: {
          message_id: z.string().describe('The ID of the Gmail message to read.'),
        },
        func: async (args: Record<string, unknown>) => {
          const { message_id } = args as { message_id: string };
          const result = await new GmailBubble({ operation: 'get_email', message_id, format: 'full' }).action();
          if (result.success && result.data?.message) {
            return {
              snippet: result.data.message.snippet,
              headers: result.data.message.payload?.headers?.filter(h => ['From', 'To', 'Subject', 'Date'].includes(h.name)),
              body_snippet: result.data.message.payload?.body?.data?.substring(0, 500), // Return a snippet of the body
            };
          }
          return { error: result.error || 'Failed to retrieve email.' };
        },
      },
    ];

    const systemPrompt = \`
      Objective:
      Analyze an incoming email and suggest appropriate labels for categorization.

      Tool:
      - read_gmail_message_content: Use this tool with the email ID to get the full content, sender, and subject.

      Instructions:
      1. You will be given an email ID and a snippet.
      2. Use the 'read_gmail_message_content' tool to get the email's full details.
      3. Analyze the email's subject, sender, and content to determine the most relevant categories.
      4. Suggest a list of suitable labels. Try to use a consistent structure like "Parent/Child" or simple labels.
      5. Your final response must be a valid JSON object containing a single key "suggested_labels" which is an array of strings. For example: { "suggested_labels": ["Work/Projects/Alpha", "Finance/Receipts"] }.
    \`;

    for (const message of listResult.data.messages) {
      if (!message.id) continue;

      try {
        const agentBubble = new AIAgentBubble({
          message: \`Please suggest labels for the email with ID: \${message.id}. Snippet: \${message.snippet}\`,
          systemPrompt,
          customTools,
          model: {
            model: 'google/gemini-2.5-pro',
            jsonMode: true,
          },
        });

        const agentResult = await agentBubble.action();

        if (agentResult.success && agentResult.data?.response) {
          try {
            const responseJson = JSON.parse(agentResult.data.response);
            categorizedEmails.push({
              emailId: message.id,
              suggestedLabels: responseJson.suggested_labels || [],
              agentResponse: agentResult.data.response,
            });
          } catch (e) {
            const parseError = \`Failed to parse agent JSON response for email \${message.id}: \${agentResult.data.response}\`;
            console.error(parseError);
            errors.push(parseError);
          }
        } else {
          const agentError = \`Agent failed for email \${message.id}: \${agentResult.error}\`;
          console.error(agentError);
          errors.push(agentError);
        }

        await new GmailBubble({ operation: 'mark_as_read', message_ids: [message.id] }).action();

      } catch (error) {
        const errorMessage = \`An unexpected error occurred for email \${message.id}: \${error instanceof Error ? error.message : String(error)}\`;
        console.error(errorMessage);
        errors.push(errorMessage);
        await new GmailBubble({ operation: 'mark_as_read', message_ids: [message.id] }).action();
      }
    }

    return { categorizedEmails, errors };
  }
}
`;
    const result = validateScript(code, {
      fileName: 'virtual/gmail-categorization-cron.ts',
    });
    console.log(result);
    expect(result.success).toBe(true);
    expect(Object.keys(result.errors || {}).length).toBe(0);
  });

  it('passes on valid GoogleDriveFileOrganizer flow', () => {
    const code = `import { z } from 'zod';
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

interface GoogleDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
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

    const filesToProcess: GoogleDriveFile[] = listResult.data.files.filter(
      (file: GoogleDriveFile) => file.mimeType !== 'application/vnd.google-apps.folder' && file.id
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
      const batchPromises = batch.map(async (file: GoogleDriveFile) => {
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

        } catch (error: unknown) {
          const errorMessage = \`Error processing file \${file.name || 'unknown'}: \${error instanceof Error ? error.message : String(error)}\`;
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
    const result = validateScript(code, {
      fileName: 'virtual/google-drive-file-organizer.ts',
    });
    console.log(result);
    console.log(result.errors);
    expect(result.success).toBe(true);
    expect(Object.keys(result.errors || {}).length).toBe(0);
  });
});
