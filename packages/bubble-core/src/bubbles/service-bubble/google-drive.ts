import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// Markdown to Google Docs Utility
// ============================================================================

interface TextRange {
  start: number;
  end: number;
}

interface MarkdownParseResult {
  plainText: string;
  requests: Array<Record<string, unknown>>;
}

/**
 * Parses markdown content and converts it to Google Docs API formatting requests.
 * Supports: headers, bold, italic, links, bullet lists, numbered lists.
 *
 * @param content - The markdown content to parse
 * @param insertIndex - The starting index in the Google Doc where text will be inserted
 * @returns Object containing plain text and formatting requests
 */
function parseMarkdownToGoogleDocs(
  content: string,
  insertIndex: number
): MarkdownParseResult {
  const requests: Array<Record<string, unknown>> = [];
  const lines = content.split('\n');
  const processedLines: string[] = [];

  // Track formatting to apply after text insertion
  const boldRanges: TextRange[] = [];
  const italicRanges: TextRange[] = [];
  const linkRanges: Array<TextRange & { url: string }> = [];
  const headerLines: Array<{ lineIndex: number; level: number }> = [];
  const bulletLines: number[] = [];
  const numberedLines: number[] = [];

  let currentOffset = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    let line = lines[lineIdx];
    const lineStartOffset = currentOffset;

    // Check for headers (# ## ### etc.)
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      line = headerMatch[2];
      headerLines.push({ lineIndex: processedLines.length, level });
    }

    // Check for bullet lists (- or *)
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      line = bulletMatch[1];
      bulletLines.push(processedLines.length);
    }

    // Check for numbered lists (1. 2. etc.)
    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      line = numberedMatch[1];
      numberedLines.push(processedLines.length);
    }

    // Process inline formatting (bold, italic, links)
    let processedLine = '';
    let i = 0;

    while (i < line.length) {
      // Check for links [text](url)
      const linkMatch = line.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const linkUrl = linkMatch[2];
        const startPos = lineStartOffset + processedLine.length;
        linkRanges.push({
          start: startPos,
          end: startPos + linkText.length,
          url: linkUrl,
        });
        processedLine += linkText;
        i += linkMatch[0].length;
        continue;
      }

      // Check for bold **text** or __text__
      const boldMatch = line.slice(i).match(/^(\*\*|__)([^*_]+)\1/);
      if (boldMatch) {
        const boldText = boldMatch[2];
        const startPos = lineStartOffset + processedLine.length;
        boldRanges.push({
          start: startPos,
          end: startPos + boldText.length,
        });
        processedLine += boldText;
        i += boldMatch[0].length;
        continue;
      }

      // Check for italic *text* or _text_ (but not ** or __)
      const italicMatch = line.slice(i).match(/^(\*|_)([^*_]+)\1/);
      if (
        italicMatch &&
        !line.slice(i).startsWith('**') &&
        !line.slice(i).startsWith('__')
      ) {
        const italicText = italicMatch[2];
        const startPos = lineStartOffset + processedLine.length;
        italicRanges.push({
          start: startPos,
          end: startPos + italicText.length,
        });
        processedLine += italicText;
        i += italicMatch[0].length;
        continue;
      }

      processedLine += line[i];
      i++;
    }

    processedLines.push(processedLine);
    currentOffset += processedLine.length + 1; // +1 for newline
  }

  const plainText = processedLines.join('\n');

  // Build formatting requests (applied in reverse order for correct indexing)

  // Apply header styles
  let lineStart = insertIndex;
  for (let i = 0; i < processedLines.length; i++) {
    const lineEnd = lineStart + processedLines[i].length + 1;

    const header = headerLines.find((h) => h.lineIndex === i);
    if (header) {
      const namedStyle = `HEADING_${Math.min(header.level, 6)}`;
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: lineStart, endIndex: lineEnd },
          paragraphStyle: { namedStyleType: namedStyle },
          fields: 'namedStyleType',
        },
      });
    }

    lineStart = lineEnd;
  }

  // Apply bullet lists
  if (bulletLines.length > 0) {
    lineStart = insertIndex;
    for (let i = 0; i < processedLines.length; i++) {
      const lineEnd = lineStart + processedLines[i].length + 1;
      if (bulletLines.includes(i)) {
        requests.push({
          createParagraphBullets: {
            range: { startIndex: lineStart, endIndex: lineEnd },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        });
      }
      lineStart = lineEnd;
    }
  }

  // Apply numbered lists
  if (numberedLines.length > 0) {
    lineStart = insertIndex;
    for (let i = 0; i < processedLines.length; i++) {
      const lineEnd = lineStart + processedLines[i].length + 1;
      if (numberedLines.includes(i)) {
        requests.push({
          createParagraphBullets: {
            range: { startIndex: lineStart, endIndex: lineEnd },
            bulletPreset: 'NUMBERED_DECIMAL_NESTED',
          },
        });
      }
      lineStart = lineEnd;
    }
  }

  // Apply bold formatting
  for (const range of boldRanges) {
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: insertIndex + range.start,
          endIndex: insertIndex + range.end,
        },
        textStyle: { bold: true },
        fields: 'bold',
      },
    });
  }

  // Apply italic formatting
  for (const range of italicRanges) {
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: insertIndex + range.start,
          endIndex: insertIndex + range.end,
        },
        textStyle: { italic: true },
        fields: 'italic',
      },
    });
  }

  // Apply link formatting
  for (const range of linkRanges) {
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: insertIndex + range.start,
          endIndex: insertIndex + range.end,
        },
        textStyle: {
          link: { url: range.url },
        },
        fields: 'link',
      },
    });
  }

  return { plainText, requests };
}

/**
 * Detects if content contains markdown formatting.
 */
function isMarkdown(content: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /__[^_]+__/, // Bold alt
    /_[^_]+_/, // Italic alt
    /\[[^\]]+\]\([^)]+\)/, // Links
    /^[-*]\s+/m, // Bullet lists
    /^\d+\.\s+/m, // Numbered lists
  ];

  return markdownPatterns.some((pattern) => pattern.test(content));
}

// ============================================================================

// Define file metadata schema
const DriveFileSchema = z
  .object({
    id: z.string().describe('Unique file identifier'),
    name: z.string().describe('Name of the file'),
    mimeType: z.string().describe('MIME type of the file'),
    size: z.string().optional().describe('Size of the file in bytes'),
    createdTime: z
      .string()
      .optional()
      .describe('Creation time in RFC 3339 format'),
    modifiedTime: z
      .string()
      .optional()
      .describe('Last modified time in RFC 3339 format'),
    webViewLink: z
      .string()
      .optional()
      .describe('Link to view the file in Google Drive'),
    webContentLink: z.string().optional().describe('Link to download the file'),
    parents: z.array(z.string()).optional().describe('Parent folder IDs'),
    shared: z.boolean().optional().describe('Whether the file is shared'),
    owners: z
      .array(
        z.object({
          displayName: z.string().optional().describe('Owner display name'),
          emailAddress: z.string().optional().describe('Owner email address'),
        })
      )
      .optional()
      .describe('File owners'),
  })
  .describe('Google Drive file metadata');

// Define folder creation schema
const DriveFolderSchema = z
  .object({
    id: z.string().describe('Unique folder identifier'),
    name: z.string().describe('Name of the folder'),
    webViewLink: z
      .string()
      .optional()
      .describe('Link to view the folder in Google Drive'),
    parents: z.array(z.string()).optional().describe('Parent folder IDs'),
  })
  .describe('Google Drive folder metadata');

// Define Google Docs Document schema (simplified structure focusing on essential fields)
const GoogleDocsDocumentSchema = z
  .object({
    documentId: z.string().describe('The ID of the document'),
    title: z.string().describe('The title of the document'),
    revisionId: z
      .string()
      .optional()
      .describe('The revision ID of the document'),
    body: z
      .record(z.unknown())
      .optional()
      .describe('The main body of the document containing content array'),
    suggestionsViewMode: z
      .string()
      .optional()
      .describe('The suggestions view mode applied to the document'),
    inlineObjects: z
      .record(z.unknown())
      .optional()
      .describe('The inline objects (images, etc.) in the document'),
    lists: z
      .record(z.unknown())
      .optional()
      .describe('The lists in the document, keyed by list ID'),
  })
  .passthrough()
  .describe('Google Docs document structure');

// Define the parameters schema for Google Drive operations
const GoogleDriveParamsSchema = z.discriminatedUnion('operation', [
  // Upload file operation
  z.object({
    operation: z
      .literal('upload_file')
      .describe('Upload a file to Google Drive'),
    name: z
      .string()
      .min(1, 'File name is required')
      .describe('Name for the uploaded file'),
    content: z
      .string()
      .describe('File content as base64 encoded string or plain text'),
    mimeType: z
      .string()
      .optional()
      .describe('MIME type of the file (auto-detected if not provided)'),
    parent_folder_id: z
      .string()
      .optional()
      .describe('ID of the parent folder (uploads to root if not provided)'),
    convert_to_google_docs: z
      .boolean()
      .optional()
      .default(false)
      .describe('Convert uploaded file to Google Docs format if possible'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Download file operation
  z.object({
    operation: z
      .literal('download_file')
      .describe('Download a file from Google Drive'),
    file_id: z
      .string()
      .min(1, 'File ID is required')
      .describe('Google Drive file ID to download'),
    export_format: z
      .string()
      .optional()
      .describe(
        'Export format for Google Workspace files (e.g., "application/pdf", "text/plain")'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List files operation
  z.object({
    operation: z
      .literal('list_files')
      .describe('List files and folders in Google Drive'),
    folder_id: z
      .string()
      .optional()
      .describe(
        'ID of folder to list files from (lists from root if not provided)'
      ),
    query: z
      .string()
      .optional()
      .describe(
        'Search query to filter files (e.g., "name contains \'report\'"'
      ),
    max_results: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(100)
      .describe('Maximum number of files to return'),
    include_folders: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include folders in the results'),
    order_by: z
      .string()
      .optional()
      .default('modifiedTime desc')
      .describe('Order results by field (e.g., "name", "modifiedTime desc")'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create folder operation
  z.object({
    operation: z
      .literal('create_folder')
      .describe('Create a new folder in Google Drive'),
    name: z
      .string()
      .min(1, 'Folder name is required')
      .describe('Name of the folder to create'),
    parent_folder_id: z
      .string()
      .optional()
      .describe('ID of the parent folder (creates in root if not provided)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete file operation
  z.object({
    operation: z
      .literal('delete_file')
      .describe('Delete a file or folder from Google Drive'),
    file_id: z
      .string()
      .min(1, 'File ID is required')
      .describe('Google Drive file or folder ID to delete'),
    permanent: z
      .boolean()
      .optional()
      .default(false)
      .describe('Permanently delete (true) or move to trash (false)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get file info operation
  z.object({
    operation: z
      .literal('get_file_info')
      .describe('Get detailed information about a file or folder'),
    file_id: z
      .string()
      .min(1, 'File ID is required')
      .describe('Google Drive file or folder ID to get info for'),
    include_permissions: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include file permissions in the response'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Share file operation
  z.object({
    operation: z
      .literal('share_file')
      .describe('Share a file or folder with specific users or make it public'),
    file_id: z
      .string()
      .min(1, 'File ID is required')
      .describe('Google Drive file or folder ID to share'),
    email_address: z
      .string()
      .email()
      .optional()
      .describe('Email address to share with (for specific user sharing)'),
    role: z
      .enum(['reader', 'writer', 'commenter', 'owner'])
      .optional()
      .default('reader')
      .describe('Permission role to grant'),
    type: z
      .enum(['user', 'group', 'domain', 'anyone'])
      .optional()
      .default('user')
      .describe('Type of permission to create'),
    send_notification: z
      .boolean()
      .optional()
      .default(true)
      .describe('Send notification email to the user'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Move file operation
  z.object({
    operation: z
      .literal('move_file')
      .describe(
        'Move a file or folder to a different location in Google Drive'
      ),
    file_id: z
      .string()
      .min(1, 'File ID is required')
      .describe('Google Drive file or folder ID to move'),
    new_parent_folder_id: z
      .string()
      .optional()
      .describe('ID of the new parent folder (moves to root if not provided)'),
    remove_parent_folder_id: z
      .string()
      .optional()
      .describe(
        'ID of the parent folder to remove (removes from all parents if not provided)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get Google Doc content operation (uses Google Docs API)
  z.object({
    operation: z
      .literal('get_doc')
      .describe(
        'Get the content and metadata of a Google Doc using the Google Docs API, use this over download_file for Google Docs'
      ),
    document_id: z
      .string()
      .min(1, 'Document ID is required')
      .describe('The ID of the Google Doc to retrieve'),
    tab_id: z
      .string()
      .optional()
      .describe('Specific tab ID to read. If omitted, reads first tab.'),
    include_all_tabs: z
      .boolean()
      .optional()
      .default(false)
      .describe('Return info for all tabs including their plain text content'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Update Google Doc content operation (uses Google Docs API)
  z.object({
    operation: z
      .literal('update_doc')
      .describe(
        'Update a Google Doc with new content using the Google Docs API batchUpdate'
      ),
    document_id: z
      .string()
      .min(1, 'Document ID is required')
      .describe('The ID of the Google Doc to update'),
    content: z
      .string()
      .min(1, 'Content is required')
      .describe(
        'The text or markdown content to write to the document (auto-detected)'
      ),
    mode: z
      .enum(['replace', 'append'])
      .optional()
      .default('replace')
      .describe(
        'Update mode: "replace" clears existing content first, "append" adds to the end'
      ),
    tab_id: z
      .string()
      .optional()
      .describe('Tab to write to. If omitted, writes to first tab.'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Find and replace text operation (preserves formatting)
  z.object({
    operation: z
      .literal('replace_text')
      .describe(
        'Find and replace text in a Google Doc while preserving formatting'
      ),
    document_id: z
      .string()
      .min(1, 'Document ID is required')
      .describe('The ID of the Google Doc to perform replacements in'),
    replacements: z
      .array(
        z.object({
          find: z.string().describe('Text to find'),
          replace: z.string().describe('Text to replace with'),
          match_case: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether to match case when finding text'),
        })
      )
      .describe('List of find/replace pairs'),
    tab_id: z
      .string()
      .optional()
      .describe(
        'Tab to perform replacements in. If omitted, applies to all tabs.'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Copy document operation
  z.object({
    operation: z
      .literal('copy_doc')
      .describe('Create a copy of a Google Doc (useful for templates)'),
    document_id: z
      .string()
      .min(1, 'Document ID is required')
      .describe('Source document ID to copy'),
    new_name: z
      .string()
      .min(1, 'New name is required')
      .describe('Name for the new document'),
    parent_folder_id: z
      .string()
      .optional()
      .describe('Folder to place the copy in'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Create tab operation
  z.object({
    operation: z
      .literal('create_tab')
      .describe('Create a new tab in a Google Doc'),
    document_id: z
      .string()
      .min(1, 'Document ID is required')
      .describe('The ID of the Google Doc to add a tab to'),
    title: z
      .string()
      .min(1, 'Tab title is required')
      .describe('Title for the new tab'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define result schemas for different operations
const GoogleDriveResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('upload_file')
      .describe('Upload a file to Google Drive'),
    success: z.boolean().describe('Whether the file was uploaded successfully'),
    file: DriveFileSchema.optional().describe('Uploaded file metadata'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('download_file')
      .describe('Download a file from Google Drive'),
    success: z
      .boolean()
      .describe('Whether the file was downloaded successfully'),
    content: z
      .string()
      .optional()
      .describe(
        'File content as plain text (for text-based files) or base64 encoded string (for binary files)'
      ),
    filename: z.string().optional().describe('Original filename'),
    mimeType: z
      .string()
      .optional()
      .describe('MIME type of the downloaded file'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('list_files')
      .describe('List files and folders in Google Drive'),
    success: z
      .boolean()
      .describe('Whether the file list was retrieved successfully'),
    files: z
      .array(DriveFileSchema)
      .optional()
      .describe('List of files and folders'),
    total_count: z.number().optional().describe('Total number of files found'),
    next_page_token: z
      .string()
      .optional()
      .describe('Token for fetching next page of results'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('create_folder')
      .describe('Create a new folder in Google Drive'),
    success: z
      .boolean()
      .describe('Whether the folder was created successfully'),
    folder: DriveFolderSchema.optional().describe('Created folder metadata'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('delete_file')
      .describe('Delete a file or folder from Google Drive'),
    success: z.boolean().describe('Whether the file was deleted successfully'),
    deleted_file_id: z.string().optional().describe('ID of the deleted file'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('get_file_info')
      .describe('Get detailed information about a file or folder'),
    success: z
      .boolean()
      .describe('Whether the file information was retrieved successfully'),
    file: DriveFileSchema.optional().describe('File metadata and information'),
    permissions: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          role: z.string(),
          emailAddress: z
            .string()
            .optional()
            .describe('Permission holder email address'),
          displayName: z
            .string()
            .optional()
            .describe('Permission holder display name'),
        })
      )
      .optional()
      .describe('File permissions (if requested)'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('share_file')
      .describe('Share a file or folder with specific users or make it public'),
    success: z.boolean().describe('Whether the file was shared successfully'),
    permission_id: z
      .string()
      .optional()
      .describe('ID of the created permission'),
    share_link: z.string().optional().describe('Shareable link to the file'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('move_file')
      .describe(
        'Move a file or folder to a different location in Google Drive'
      ),
    success: z.boolean().describe('Whether the file was moved successfully'),
    file: DriveFileSchema.optional().describe(
      'Updated file metadata after move'
    ),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('get_doc')
      .describe(
        'Get the content and metadata of a Google Doc using the Google Docs API'
      ),
    success: z
      .boolean()
      .describe('Whether the document was retrieved successfully'),
    document: GoogleDocsDocumentSchema.optional().describe(
      'The Google Docs document content and metadata'
    ),
    plainText: z
      .string()
      .optional()
      .describe('Extracted plain text content from the document'),
    tabs: z
      .array(
        z.object({
          tabId: z.string().describe('Unique tab identifier'),
          title: z.string().describe('Tab title'),
          index: z.number().describe('Tab position index'),
          plainText: z
            .string()
            .optional()
            .describe('Plain text content of the tab'),
        })
      )
      .optional()
      .describe('All tabs in the document'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('update_doc')
      .describe(
        'Update a Google Doc with new content using the Google Docs API batchUpdate'
      ),
    success: z
      .boolean()
      .describe('Whether the document was updated successfully'),
    documentId: z
      .string()
      .optional()
      .describe('The ID of the updated document'),
    revisionId: z
      .string()
      .optional()
      .describe('The new revision ID after the update'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('replace_text')
      .describe('Find and replace text in a Google Doc'),
    success: z
      .boolean()
      .describe('Whether the replacements were made successfully'),
    replacements_made: z
      .number()
      .optional()
      .describe('Total number of replacements made'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z.literal('copy_doc').describe('Create a copy of a Google Doc'),
    success: z
      .boolean()
      .describe('Whether the document was copied successfully'),
    new_document_id: z.string().optional().describe('ID of the new document'),
    new_document_url: z
      .string()
      .optional()
      .describe('URL to view the new document'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z
      .literal('create_tab')
      .describe('Create a new tab in a Google Doc'),
    success: z.boolean().describe('Whether the tab was created successfully'),
    tab_id: z.string().optional().describe('ID of the newly created tab'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

type GoogleDriveResult = z.output<typeof GoogleDriveResultSchema>;
type GoogleDriveParams = z.input<typeof GoogleDriveParamsSchema>;

// Helper type to get the result type for a specific operation
export type GoogleDriveOperationResult<
  T extends GoogleDriveParams['operation'],
> = Extract<GoogleDriveResult, { operation: T }>;

// Export the input type for external usage
export type GoogleDriveParamsInput = z.input<typeof GoogleDriveParamsSchema>;

export class GoogleDriveBubble<
  T extends GoogleDriveParams = GoogleDriveParams,
> extends ServiceBubble<
  T,
  Extract<GoogleDriveResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'google-drive';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'google-drive';
  static readonly schema = GoogleDriveParamsSchema;
  static readonly resultSchema = GoogleDriveResultSchema;
  static readonly shortDescription =
    'Google Drive integration with full Google Docs tab support - read/write specific tabs, copy templates, and preserve formatting with find/replace';
  static readonly longDescription = `
    Google Drive service integration for comprehensive file, folder, and Google Docs management.

    File & Folder Operations:
    - Upload files and documents to Google Drive
    - Download files with format conversion support
    - List and search files with advanced filtering
    - Create and organize folders
    - Share files and manage permissions
    - Get detailed file metadata and information

    Google Docs Tab Support:
    - Read content from specific tabs or all tabs (get_doc with tab_id/include_all_tabs)
    - Write content to specific tabs (update_doc with tab_id)
    - Create new tabs in documents (create_tab)

    Template & Formatting Operations:
    - Copy documents to create new docs from templates (copy_doc)
    - Find and replace text while preserving all formatting (replace_text)
      - Preserves bold, colors, underlines, tables, shaded boxes, etc.
      - Supports case-sensitive/insensitive matching
      - Can target specific tabs or apply to all tabs

    Security Features:
    - OAuth 2.0 authentication with Google
    - Scoped access permissions
    - Secure file handling and validation
    - User-controlled sharing and permissions
  `;
  static readonly alias = 'gdrive';
  constructor(
    params: T = {
      operation: 'list_files',
      max_results: 10,
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('Google Drive credentials are required');
    }
    try {
      // Test the credentials by making a simple API call
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=user&supportsAllDrives=true',
        {
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private async makeGoogleApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: any,
    headers: Record<string, string> = {},
    responseType: 'auto' | 'json' | 'text' | 'arrayBuffer' = 'auto'
  ): Promise<any> {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://www.googleapis.com/drive/v3${endpoint}`;

    const requestHeaders = {
      Authorization: `Bearer ${this.chooseCredential()}`,
      'Content-Type': 'application/json',
      ...headers,
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      if (body instanceof FormData) {
        // Remove Content-Type for FormData (browser will set it with boundary)
        const { 'Content-Type': _, ...headersWithoutContentType } =
          requestHeaders;
        requestInit.headers = headersWithoutContentType;
        requestInit.body = body;
      } else if (body instanceof Buffer) {
        // Handle Buffer content (for multipart uploads)
        requestInit.body = body;
      } else if (typeof body === 'string') {
        // Handle string content directly
        requestInit.body = body;
      } else {
        // Handle JSON objects
        requestInit.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type') || '';
    let responseData;
    if (responseType === 'arrayBuffer') {
      const ab = await response.arrayBuffer();
      responseData = ab;
    } else if (
      responseType === 'json' ||
      (responseType === 'auto' && contentType.includes('application/json'))
    ) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return responseData;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<GoogleDriveResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<GoogleDriveResult> => {
        switch (operation) {
          case 'upload_file':
            return await this.uploadFile(this.params);
          case 'download_file':
            return await this.downloadFile(this.params);
          case 'list_files':
            return await this.listFiles(this.params);
          case 'create_folder':
            return await this.createFolder(this.params);
          case 'delete_file':
            return await this.deleteFile(this.params);
          case 'get_file_info':
            return await this.getFileInfo(this.params);
          case 'share_file':
            return await this.shareFile(this.params);
          case 'move_file':
            return await this.moveFile(this.params);
          case 'get_doc':
            return await this.getDoc(this.params);
          case 'update_doc':
            return await this.updateDoc(this.params);
          case 'replace_text':
            return await this.replaceText(this.params);
          case 'copy_doc':
            return await this.copyDoc(this.params);
          case 'create_tab':
            return await this.createTab(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<
        GoogleDriveResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<GoogleDriveResult, { operation: T['operation'] }>;
    }
  }

  private async uploadFile(
    params: Extract<GoogleDriveParams, { operation: 'upload_file' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'upload_file' }>> {
    try {
      const {
        name,
        content,
        mimeType,
        parent_folder_id,
        convert_to_google_docs,
      } = params;

      // Validate required parameters
      if (!name || name.trim().length === 0) {
        throw new Error('File name is required and cannot be empty');
      }

      if (!content || content.length === 0) {
        throw new Error('File content is required and cannot be empty');
      }

      // Prepare file metadata
      const fileMetadata: any = {
        name,
      };

      if (parent_folder_id) {
        fileMetadata.parents = [parent_folder_id];
      }

      // Handle Google Workspace conversion
      if (convert_to_google_docs && mimeType) {
        if (mimeType.includes('text/')) {
          fileMetadata.mimeType = 'application/vnd.google-apps.document';
        } else if (
          mimeType.includes('spreadsheet') ||
          mimeType.includes('csv')
        ) {
          fileMetadata.mimeType = 'application/vnd.google-apps.spreadsheet';
        } else if (mimeType.includes('presentation')) {
          fileMetadata.mimeType = 'application/vnd.google-apps.presentation';
        }
      }

      // Determine content type and prepare file data
      let fileData: Buffer;
      let actualMimeType = mimeType;

      // Check if content is base64 encoded
      const isBase64 = this.isBase64(content);

      if (isBase64) {
        // Extract actual base64 content (might be wrapped in JSON)
        const extractedBase64 = this.extractBase64Content(content);

        // Decode base64 content
        fileData = Buffer.from(extractedBase64, 'base64');

        // Auto-detect MIME type if not provided
        if (!actualMimeType) {
          actualMimeType = this.detectMimeTypeFromBase64(extractedBase64);
        }
      } else {
        // Treat as plain text
        fileData = Buffer.from(content, 'utf-8');

        // Default to text/plain if no MIME type provided for plain text
        if (!actualMimeType) {
          actualMimeType = 'text/plain';
        }
      }

      // Create multipart form data for upload
      const boundary = `----formdata-boundary-${Date.now()}`;
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      // Build the multipart body
      let body = delimiter;
      body += 'Content-Type: application/json\r\n\r\n';
      body += JSON.stringify(fileMetadata) + delimiter;
      body += `Content-Type: ${actualMimeType}\r\n\r\n`;

      // Convert to Buffer and combine with file data
      const bodyBuffer = Buffer.from(body, 'utf8');
      const closeBuffer = Buffer.from(closeDelimiter, 'utf8');
      const fullBody = Buffer.concat([bodyBuffer, fileData, closeBuffer]);

      const uploadUrl =
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents';

      // Make the upload request
      const response = await this.makeGoogleApiRequest(
        uploadUrl,
        'POST',
        fullBody,
        {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        }
      );

      return {
        operation: 'upload_file',
        success: true,
        file: response,
        error: '',
      };
    } catch (error) {
      // Enhanced error handling for upload failures
      let errorMessage = 'Unknown error occurred during file upload';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more specific error messages for common issues
        if (errorMessage.includes('401')) {
          errorMessage =
            'Authentication failed. Please check your Google Drive credentials.';
        } else if (errorMessage.includes('403')) {
          errorMessage =
            'Permission denied. Please ensure you have write access to Google Drive.';
        } else if (errorMessage.includes('404')) {
          errorMessage =
            'Parent folder not found. Please check the parent_folder_id.';
        } else if (errorMessage.includes('413')) {
          errorMessage = 'File too large. Please reduce the file size.';
        } else if (errorMessage.includes('quotaExceeded')) {
          errorMessage =
            'Google Drive storage quota exceeded. Please free up space.';
        }
      }

      return {
        operation: 'upload_file',
        success: false,
        file: undefined,
        error: errorMessage,
      };
    }
  }

  private isTextMimeType(mimeType: string | undefined): boolean {
    if (!mimeType) {
      return false;
    }

    // Text-based MIME types that should be returned as plain text
    const textMimeTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript',
      'application/x-sh',
      'application/x-yaml',
      'application/x-toml',
      'application/csv',
      'application/x-csv',
      'text/csv',
    ];

    return textMimeTypes.some((prefix) => mimeType.startsWith(prefix));
  }

  private async downloadFile(
    params: Extract<GoogleDriveParams, { operation: 'download_file' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'download_file' }>> {
    const { file_id, export_format } = params;

    // Get file metadata to determine if it's a Google Workspace file
    let fileInfo: { name?: string; mimeType?: string };
    try {
      fileInfo = await this.makeGoogleApiRequest(
        `/files/${file_id}?fields=name,mimeType&supportsAllDrives=true`
      );
    } catch (error) {
      // On 404, fall back to get_doc (file might be a Google Doc)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('404')) {
        const docUrl = `https://docs.googleapis.com/v1/documents/${file_id}`;
        const document = await this.makeGoogleApiRequest(docUrl, 'GET');
        const content = this.extractPlainTextFromDoc(document);
        return {
          operation: 'download_file',
          success: true,
          content,
          filename: document.title,
          mimeType: 'text/plain',
          error: '',
        };
      }
      throw error;
    }

    let content: string;
    let actualMimeType: string;

    // Check if it's a Google Workspace file that needs export
    if (fileInfo.mimeType?.startsWith('application/vnd.google-apps.')) {
      if (!export_format) {
        throw new Error('Export format is required for Google Workspace files');
      }

      const exportResponse = await this.makeGoogleApiRequest(
        `/files/${file_id}/export?mimeType=${encodeURIComponent(export_format)}&supportsAllDrives=true`,
        'GET',
        undefined,
        {},
        'arrayBuffer'
      );

      actualMimeType = export_format;

      // Return as plain text for text-based formats, base64 for binary
      if (this.isTextMimeType(actualMimeType)) {
        content = Buffer.from(exportResponse).toString('utf-8');
      } else {
        content = Buffer.from(exportResponse).toString('base64');
      }
    } else {
      // Regular file download
      const downloadResponse = await this.makeGoogleApiRequest(
        `/files/${file_id}?alt=media&supportsAllDrives=true`,
        'GET',
        undefined,
        {},
        'arrayBuffer'
      );

      actualMimeType = fileInfo.mimeType || 'application/octet-stream';

      // Return as plain text for text-based formats, base64 for binary
      if (this.isTextMimeType(actualMimeType)) {
        content = Buffer.from(downloadResponse).toString('utf-8');
      } else {
        content = Buffer.from(downloadResponse).toString('base64');
      }
    }

    return {
      operation: 'download_file',
      success: true,
      content,
      filename: fileInfo.name,
      mimeType: actualMimeType,
      error: '',
    };
  }

  private async listFiles(
    params: Extract<GoogleDriveParams, { operation: 'list_files' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'list_files' }>> {
    const { folder_id, query, max_results, include_folders, order_by } = params;

    let searchQuery = '';

    // Build search query
    if (folder_id) {
      searchQuery += `'${folder_id}' in parents`;
    }

    if (!include_folders) {
      searchQuery +=
        (searchQuery ? ' and ' : '') +
        "mimeType != 'application/vnd.google-apps.folder'";
    }

    if (query) {
      searchQuery += (searchQuery ? ' and ' : '') + query;
    }

    // Add trashed filter
    searchQuery += (searchQuery ? ' and ' : '') + 'trashed = false';

    // Build query parameters
    const queryParams = new URLSearchParams({
      pageSize: max_results!.toString(),
      orderBy: order_by!,
      fields:
        'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,shared,owners)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    if (searchQuery) {
      queryParams.set('q', searchQuery);
    }

    const response = await this.makeGoogleApiRequest(
      `/files?${queryParams.toString()}`
    );

    return {
      operation: 'list_files',
      success: true,
      files: response.files || [],
      total_count: response.files?.length || 0,
      next_page_token: response.nextPageToken,
      error: '',
    };
  }

  private async createFolder(
    params: Extract<GoogleDriveParams, { operation: 'create_folder' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'create_folder' }>> {
    const { name, parent_folder_id } = params;

    const fileMetadata: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parent_folder_id) {
      fileMetadata.parents = [parent_folder_id];
    }

    const response = await this.makeGoogleApiRequest(
      '/files?supportsAllDrives=true&fields=id,name,webViewLink,parents',
      'POST',
      fileMetadata
    );

    return {
      operation: 'create_folder',
      success: true,
      folder: response,
      error: '',
    };
  }

  private async deleteFile(
    params: Extract<GoogleDriveParams, { operation: 'delete_file' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'delete_file' }>> {
    const { file_id, permanent } = params;

    if (permanent) {
      // Permanently delete the file
      await this.makeGoogleApiRequest(
        `/files/${file_id}?supportsAllDrives=true`,
        'DELETE'
      );
    } else {
      // Move to trash
      await this.makeGoogleApiRequest(
        `/files/${file_id}?supportsAllDrives=true`,
        'PATCH',
        {
          trashed: true,
        }
      );
    }

    return {
      operation: 'delete_file',
      success: true,
      deleted_file_id: file_id,
      error: '',
    };
  }

  private async getFileInfo(
    params: Extract<GoogleDriveParams, { operation: 'get_file_info' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'get_file_info' }>> {
    const { file_id, include_permissions } = params;

    const fields =
      'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,shared,owners';

    const response = await this.makeGoogleApiRequest(
      `/files/${file_id}?fields=${fields}&supportsAllDrives=true`
    );

    let permissions;
    if (include_permissions) {
      const permissionsResponse = await this.makeGoogleApiRequest(
        `/files/${file_id}/permissions?fields=permissions(id,type,role,emailAddress,displayName)&supportsAllDrives=true`
      );
      permissions = permissionsResponse.permissions;
    }

    return {
      operation: 'get_file_info',
      success: true,
      file: response,
      permissions,
      error: '',
    };
  }

  private async shareFile(
    params: Extract<GoogleDriveParams, { operation: 'share_file' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'share_file' }>> {
    const { file_id, email_address, role, type, send_notification } = params;

    const permission: any = {
      role,
      type,
    };

    if (email_address && (type === 'user' || type === 'group')) {
      permission.emailAddress = email_address;
    }

    const queryParams = new URLSearchParams({
      fields: 'id',
      supportsAllDrives: 'true',
    });

    if (send_notification !== undefined) {
      queryParams.set('sendNotificationEmail', send_notification.toString());
    }

    const response = await this.makeGoogleApiRequest(
      `/files/${file_id}/permissions?${queryParams.toString()}`,
      'POST',
      permission
    );

    // Get the file's web view link for sharing
    const fileResponse = await this.makeGoogleApiRequest(
      `/files/${file_id}?fields=webViewLink&supportsAllDrives=true`
    );

    return {
      operation: 'share_file',
      success: true,
      permission_id: response.id,
      share_link: fileResponse.webViewLink,
      error: '',
    };
  }

  private async moveFile(
    params: Extract<GoogleDriveParams, { operation: 'move_file' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'move_file' }>> {
    const { file_id, new_parent_folder_id, remove_parent_folder_id } = params;

    // First, get the current file info to retrieve existing parents
    const currentFileInfo = await this.makeGoogleApiRequest(
      `/files/${file_id}?fields=parents&supportsAllDrives=true`
    );

    const currentParents: string[] = currentFileInfo.parents || [];

    // Build the query parameters for the update
    const queryParams = new URLSearchParams({
      supportsAllDrives: 'true',
    });

    // Determine which parents to add
    if (new_parent_folder_id) {
      queryParams.set('addParents', new_parent_folder_id);
    }

    // Determine which parents to remove
    if (remove_parent_folder_id) {
      // Remove specific parent
      queryParams.set('removeParents', remove_parent_folder_id);
    } else if (new_parent_folder_id) {
      // Remove all current parents when moving to a new location
      queryParams.set('removeParents', currentParents.join(','));
    }

    // Add fields to return
    queryParams.set(
      'fields',
      'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,shared,owners'
    );

    // Make the update request
    const response = await this.makeGoogleApiRequest(
      `/files/${file_id}?${queryParams.toString()}`,
      'PATCH',
      {}
    );

    return {
      operation: 'move_file',
      success: true,
      file: response,
      error: '',
    };
  }

  private async getDoc(
    params: Extract<GoogleDriveParams, { operation: 'get_doc' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'get_doc' }>> {
    const { document_id, tab_id, include_all_tabs } = params;

    // Always fetch with tabs to get full structure
    const url = `https://docs.googleapis.com/v1/documents/${document_id}?includeTabsContent=true`;

    // Make the request to Google Docs API
    const response = await this.makeGoogleApiRequest(url, 'GET');

    // Build tabs info if document has tabs
    const responseTabs = response.tabs as
      | Array<{
          tabProperties?: { tabId?: string; title?: string; index?: number };
          documentTab?: { body?: { content?: Array<Record<string, unknown>> } };
        }>
      | undefined;

    const tabs = responseTabs?.map((tab) => ({
      tabId: tab.tabProperties?.tabId || '',
      title: tab.tabProperties?.title || 'Untitled',
      index: tab.tabProperties?.index || 0,
      plainText: include_all_tabs
        ? this.extractPlainTextFromTab(tab)
        : undefined,
    }));

    // Get content from specific tab or first tab
    const targetTab = tab_id
      ? responseTabs?.find((t) => t.tabProperties?.tabId === tab_id)
      : responseTabs?.[0];

    // Extract plain text from the target tab, or fall back to document body for non-tabbed docs
    const plainText = targetTab
      ? this.extractPlainTextFromTab(targetTab)
      : this.extractPlainTextFromDoc(response);

    return {
      operation: 'get_doc',
      success: true,
      document: response,
      plainText,
      tabs,
      error: '',
    };
  }

  private async updateDoc(
    params: Extract<GoogleDriveParams, { operation: 'update_doc' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'update_doc' }>> {
    const { document_id, content, mode, tab_id } = params;

    const url = `https://docs.googleapis.com/v1/documents/${document_id}:batchUpdate`;

    // Build the requests array based on mode
    const requests: Array<Record<string, unknown>> = [];

    // Auto-detect markdown and parse if needed
    const useMarkdown = isMarkdown(content);

    // Helper to build location object with optional tabId
    const buildLocation = (index: number) => {
      const location: { index: number; tabId?: string } = { index };
      if (tab_id) {
        location.tabId = tab_id;
      }
      return location;
    };

    // Helper to build range object with optional tabId
    const buildRange = (startIndex: number, endIndex: number) => {
      const range: { startIndex: number; endIndex: number; tabId?: string } = {
        startIndex,
        endIndex,
      };
      if (tab_id) {
        range.tabId = tab_id;
      }
      return range;
    };

    if (mode === 'replace') {
      // For replace mode, first get the document to find content length
      const docUrl = `https://docs.googleapis.com/v1/documents/${document_id}?includeTabsContent=true`;
      const document = await this.makeGoogleApiRequest(docUrl, 'GET');

      // Get the end index from the target tab or document body
      let endIndex = 1;
      if (tab_id && document.tabs) {
        const tabs = document.tabs as Array<{
          tabProperties?: { tabId?: string };
          documentTab?: { body?: { content?: Array<{ endIndex?: number }> } };
        }>;
        const targetTab = tabs.find((t) => t.tabProperties?.tabId === tab_id);
        const tabContent = targetTab?.documentTab?.body?.content || [];
        const lastElement = tabContent[tabContent.length - 1];
        endIndex = lastElement?.endIndex || 1;
      } else {
        const body = document.body as {
          content?: Array<{ endIndex?: number }>;
        };
        const contentElements = body?.content || [];
        const lastElement = contentElements[contentElements.length - 1];
        endIndex = lastElement?.endIndex || 1;
      }

      // Only delete if there's content to delete (endIndex > 1)
      if (endIndex > 1) {
        requests.push({
          deleteContentRange: {
            range: buildRange(1, endIndex - 1),
          },
        });
      }

      if (useMarkdown) {
        // Parse markdown and get plain text + formatting requests
        const parsed = parseMarkdownToGoogleDocs(content, 1);

        // Insert plain text first
        requests.push({
          insertText: {
            location: buildLocation(1),
            text: parsed.plainText,
          },
        });

        // Add formatting requests with tabId if provided
        for (const req of parsed.requests) {
          if (tab_id) {
            // Add tabId to range objects in formatting requests
            this.addTabIdToRequest(req, tab_id);
          }
          requests.push(req);
        }
      } else {
        // Plain text - just insert
        requests.push({
          insertText: {
            location: buildLocation(1),
            text: content,
          },
        });
      }
    } else {
      // For append mode, get document to find the end position
      const docUrl = `https://docs.googleapis.com/v1/documents/${document_id}?includeTabsContent=true`;
      const document = await this.makeGoogleApiRequest(docUrl, 'GET');

      // Get the end index from the target tab or document body
      let endIndex = 1;
      if (tab_id && document.tabs) {
        const tabs = document.tabs as Array<{
          tabProperties?: { tabId?: string };
          documentTab?: { body?: { content?: Array<{ endIndex?: number }> } };
        }>;
        const targetTab = tabs.find((t) => t.tabProperties?.tabId === tab_id);
        const tabContent = targetTab?.documentTab?.body?.content || [];
        const lastElement = tabContent[tabContent.length - 1];
        endIndex = lastElement?.endIndex || 1;
      } else {
        const body = document.body as {
          content?: Array<{ endIndex?: number }>;
        };
        const contentElements = body?.content || [];
        const lastElement = contentElements[contentElements.length - 1];
        endIndex = lastElement?.endIndex || 1;
      }

      const insertIndex = endIndex - 1;

      if (useMarkdown) {
        // Parse markdown and get plain text + formatting requests
        const parsed = parseMarkdownToGoogleDocs(content, insertIndex);

        // Insert plain text first
        requests.push({
          insertText: {
            location: buildLocation(insertIndex),
            text: parsed.plainText,
          },
        });

        // Add formatting requests with tabId if provided
        for (const req of parsed.requests) {
          if (tab_id) {
            this.addTabIdToRequest(req, tab_id);
          }
          requests.push(req);
        }
      } else {
        // Plain text - just insert
        requests.push({
          insertText: {
            location: buildLocation(insertIndex),
            text: content,
          },
        });
      }
    }

    // Make the batchUpdate request
    const response = await this.makeGoogleApiRequest(url, 'POST', {
      requests,
    });

    return {
      operation: 'update_doc',
      success: true,
      documentId: response.documentId,
      revisionId: response.writeControl?.requiredRevisionId,
      error: '',
    };
  }

  /**
   * Adds tabId to range objects in formatting requests
   */
  private addTabIdToRequest(req: Record<string, unknown>, tabId: string): void {
    for (const key of Object.keys(req)) {
      const value = req[key] as Record<string, unknown>;
      if (value && typeof value === 'object') {
        if ('range' in value && typeof value.range === 'object') {
          (value.range as Record<string, unknown>).tabId = tabId;
        }
        if ('location' in value && typeof value.location === 'object') {
          (value.location as Record<string, unknown>).tabId = tabId;
        }
      }
    }
  }

  private async replaceText(
    params: Extract<GoogleDriveParams, { operation: 'replace_text' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'replace_text' }>> {
    const { document_id, replacements, tab_id } = params;

    const url = `https://docs.googleapis.com/v1/documents/${document_id}:batchUpdate`;

    // Build requests for each replacement
    const requests = replacements.map((r) => {
      const containsText: {
        text: string;
        matchCase: boolean;
        tabId?: string;
      } = {
        text: r.find,
        matchCase: r.match_case ?? true,
      };

      // Add tabId if provided to target specific tab
      if (tab_id) {
        containsText.tabId = tab_id;
      }

      return {
        replaceAllText: {
          containsText,
          replaceText: r.replace,
        },
      };
    });

    // Make the batchUpdate request
    const response = await this.makeGoogleApiRequest(url, 'POST', {
      requests,
    });

    // Count total replacements made
    const replies = response.replies as
      | Array<{ replaceAllText?: { occurrencesChanged?: number } }>
      | undefined;
    const totalReplacements =
      replies?.reduce(
        (sum, r) => sum + (r.replaceAllText?.occurrencesChanged || 0),
        0
      ) || 0;

    return {
      operation: 'replace_text',
      success: true,
      replacements_made: totalReplacements,
      error: '',
    };
  }

  private async copyDoc(
    params: Extract<GoogleDriveParams, { operation: 'copy_doc' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'copy_doc' }>> {
    const { document_id, new_name, parent_folder_id } = params;

    // Use Drive API copy endpoint
    const body: { name: string; parents?: string[] } = { name: new_name };
    if (parent_folder_id) {
      body.parents = [parent_folder_id];
    }

    const response = await this.makeGoogleApiRequest(
      `/files/${document_id}/copy?supportsAllDrives=true&fields=id,webViewLink`,
      'POST',
      body
    );

    return {
      operation: 'copy_doc',
      success: true,
      new_document_id: response.id,
      new_document_url: response.webViewLink,
      error: '',
    };
  }

  private async createTab(
    params: Extract<GoogleDriveParams, { operation: 'create_tab' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'create_tab' }>> {
    const { document_id, title } = params;

    const url = `https://docs.googleapis.com/v1/documents/${document_id}:batchUpdate`;

    // Create a new tab using the addDocumentTab request
    const requests = [
      {
        addDocumentTab: {
          tab: {
            tabProperties: {
              title,
            },
          },
        },
      },
    ];

    // Make the batchUpdate request
    const response = await this.makeGoogleApiRequest(url, 'POST', {
      requests,
    });

    // Extract the new tab ID from the response
    const replies = response.replies as
      | Array<{
          addDocumentTab?: { tab?: { tabProperties?: { tabId?: string } } };
        }>
      | undefined;
    const newTabId = replies?.[0]?.addDocumentTab?.tab?.tabProperties?.tabId;

    return {
      operation: 'create_tab',
      success: true,
      tab_id: newTabId,
      error: '',
    };
  }

  /**
   * Extracts plain text content from a Google Docs document body
   */
  private extractPlainTextFromDoc(document: Record<string, unknown>): string {
    const body = document.body as
      | { content?: Array<Record<string, unknown>> }
      | undefined;
    if (!body?.content) {
      return '';
    }

    return this.extractPlainTextFromContent(body.content);
  }

  /**
   * Extracts plain text content from a Google Docs tab
   */
  private extractPlainTextFromTab(tab: {
    documentTab?: { body?: { content?: Array<Record<string, unknown>> } };
  }): string {
    const body = tab?.documentTab?.body;
    if (!body?.content) {
      return '';
    }

    return this.extractPlainTextFromContent(body.content);
  }

  /**
   * Extracts plain text from a content array
   */
  private extractPlainTextFromContent(
    content: Array<Record<string, unknown>>
  ): string {
    const textParts: string[] = [];

    for (const element of content) {
      const paragraph = element.paragraph as
        | { elements?: Array<Record<string, unknown>> }
        | undefined;
      if (paragraph?.elements) {
        for (const elem of paragraph.elements) {
          const textRun = elem.textRun as { content?: string } | undefined;
          if (textRun?.content) {
            textParts.push(textRun.content);
          }
        }
      }
    }

    return textParts.join('');
  }

  private isBase64(str: string): boolean {
    try {
      // First check if it's a direct base64 string
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

      if (base64Regex.test(str)) {
        // Try to decode and re-encode to verify
        const decoded = Buffer.from(str, 'base64').toString('base64');
        return decoded === str;
      }

      // Check if it's JSON containing base64 data
      if (str.trim().startsWith('[') || str.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(str);
          const hasBase64Data = this.findBase64InObject(parsed);
          return hasBase64Data;
        } catch (jsonError) {
          // Invalid JSON structure
        }
      }

      // Check if it looks like base64 data (longer strings that might be base64)
      if (str.length > 100 && /^[A-Za-z0-9+/]/.test(str) && str.includes('=')) {
        const cleanStr = str.replace(/\s/g, ''); // Remove whitespace
        if (base64Regex.test(cleanStr)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  private extractBase64Content(content: string): string {
    try {
      // If content is direct base64, return as-is
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (base64Regex.test(content)) {
        return content;
      }

      // Try to parse as JSON and extract base64 data
      if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(content);
          const extractedBase64 = this.findAndExtractBase64(parsed);
          if (extractedBase64) {
            return extractedBase64;
          }
        } catch (parseError) {
          // Failed to parse JSON for base64 extraction
        }
      }

      // If no extraction possible, return original content
      return content;
    } catch (error) {
      return content;
    }
  }

  private findAndExtractBase64(obj: any): string | null {
    if (typeof obj === 'string') {
      // Check if this string looks like base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (obj.length > 100 && base64Regex.test(obj)) {
        return obj;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = this.findAndExtractBase64(item);
        if (result) return result;
      }
    } else if (typeof obj === 'object' && obj !== null) {
      // Look for common base64 data fields
      const base64Fields = ['data', 'content', 'image', 'file'];
      for (const field of base64Fields) {
        if (obj[field] && typeof obj[field] === 'string') {
          const result = this.findAndExtractBase64(obj[field]);
          if (result) return result;
        }
      }

      // Check all other values
      for (const value of Object.values(obj)) {
        const result = this.findAndExtractBase64(value);
        if (result) return result;
      }
    }
    return null;
  }

  private findBase64InObject(obj: any): boolean {
    if (typeof obj === 'string') {
      // Check if this string looks like base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (obj.length > 100 && base64Regex.test(obj)) {
        return true;
      }
    } else if (Array.isArray(obj)) {
      return obj.some((item) => this.findBase64InObject(item));
    } else if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some((value) => this.findBase64InObject(value));
    }
    return false;
  }

  private detectMimeTypeFromBase64(base64Content: string): string {
    try {
      // Decode the first few bytes to check for file signatures
      const buffer = Buffer.from(base64Content.substring(0, 100), 'base64');
      const header = buffer.toString('hex').toUpperCase();

      // Common file type signatures
      if (header.startsWith('FFD8FF')) return 'image/jpeg';
      if (header.startsWith('89504E47')) return 'image/png';
      if (header.startsWith('47494638')) return 'image/gif';
      if (header.startsWith('25504446')) return 'application/pdf';
      if (
        header.startsWith('504B0304') ||
        header.startsWith('504B0506') ||
        header.startsWith('504B0708')
      ) {
        // ZIP-based formats
        return 'application/zip';
      }
      if (header.startsWith('D0CF11E0A1B11AE1'))
        return 'application/vnd.ms-office';

      // Default to binary if no specific type detected
      return 'application/octet-stream';
    } catch {
      // If detection fails, default to binary
      return 'application/octet-stream';
    }
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No Google Drive credentials provided');
    }

    // Google Drive bubble uses GOOGLE_DRIVE_CRED credentials
    return credentials[CredentialType.GOOGLE_DRIVE_CRED];
  }
}
