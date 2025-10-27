import { z } from 'zod';
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
  organizedFiles: { fileName: string; newFolder: string }[];
  createdFolders: string[];
  errors: { fileName: string; error: string }[];
  message: string;
}

export class GoogleDriveOrganizerFlow extends BubbleFlow<'webhook/http'> {
  private getFolderNameForMimeType(mimeType: string): string {
    if (!mimeType) return 'Miscellaneous';
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType === 'application/pdf') return 'PDFs';
    if (mimeType === 'application/vnd.google-apps.document')
      return 'Google Docs';
    if (mimeType === 'application/vnd.google-apps.spreadsheet')
      return 'Google Sheets';
    if (mimeType === 'application/vnd.google-apps.presentation')
      return 'Google Slides';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'Archives';
    return 'Miscellaneous';
  }

  async handle(payload: WebhookEvent): Promise<Output> {
    const organizedFiles: { fileName: string; newFolder: string }[] = [];
    const createdFolders: string[] = [];
    const errors: { fileName: string; error: string }[] = [];
    const folderCache = new Map<string, string>();

    const listFilesBubble = new GoogleDriveBubble({
      operation: 'list_files',
      query:
        "'root' in parents and mimeType != 'application/vnd.google-apps.folder'",
      max_results: 1000,
    });
    const filesResult = await listFilesBubble.action();

    if (!filesResult.success || !filesResult.data?.files) {
      throw new Error(
        `Failed to list files: ${filesResult.error || 'No files found'}`
      );
    }

    for (const file of filesResult.data.files) {
      try {
        if (
          !file.id ||
          !file.name ||
          !file.mimeType ||
          !file.parents ||
          file.parents.length === 0
        ) {
          errors.push({
            fileName: file.name || 'Unknown',
            error:
              'File is missing required properties (id, name, mimeType, parents).',
          });
          continue;
        }

        const folderName = this.getFolderNameForMimeType(file.mimeType);
        let folderId = folderCache.get(folderName);

        if (!folderId) {
          const escapedFolderName = folderName.replace(/'/g, "\\'");
          const findFolderBubble = new GoogleDriveBubble({
            operation: 'list_files',
            query: `name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents`,
            max_results: 1,
          });
          const findResult = await findFolderBubble.action();

          if (
            findResult.success &&
            findResult.data?.files &&
            findResult.data.files.length > 0 &&
            findResult.data.files[0].id
          ) {
            folderId = findResult.data.files[0].id;
          } else {
            const createFolderBubble = new GoogleDriveBubble({
              operation: 'create_folder',
              name: folderName,
            });
            const createResult = await createFolderBubble.action();
            if (createResult.success && createResult.data?.folder?.id) {
              folderId = createResult.data.folder.id;
              createdFolders.push(folderName);
            } else {
              throw new Error(
                `Failed to create folder '${folderName}': ${createResult.error || 'Unknown error'}`
              );
            }
          }
          folderCache.set(folderName, folderId);
        }

        const originalParent = file.parents[0];
        const moveFileBubble = new GoogleDriveBubble({
          operation: 'move_file',
          file_id: file.id,
          new_parent_folder_id: folderId,
          remove_parent_folder_id: originalParent,
        });
        const moveResult = await moveFileBubble.action();

        if (moveResult.success) {
          organizedFiles.push({ fileName: file.name, newFolder: folderName });
        } else {
          throw new Error(
            `Failed to move file: ${moveResult.error || 'Unknown error'}`
          );
        }
      } catch (e: any) {
        errors.push({ fileName: file.name || 'Unknown', error: e.message });
      }
    }

    return {
      organizedFiles,
      createdFolders,
      errors,
      message: `Organization complete. Moved ${organizedFiles.length} files. Created ${createdFolders.length} new folders. Encountered ${errors.length} errors.`,
    };
  }
}
