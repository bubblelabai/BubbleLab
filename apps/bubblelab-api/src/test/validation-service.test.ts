// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import { validateBubbleFlow } from '../services/validation.js';

describe('Validation Service', () => {
  it('should validate the Google Drive file organizer code using validation service', async () => {
    const googleDriveCode = `import { z } from 'zod';
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
}`;

    // Use the validation service
    const result = await validateBubbleFlow(googleDriveCode);
    expect(result.valid).toBe(true);
  });
});
