import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

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
      .describe('File content as base64 encoded string'),
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
    'Google Drive integration for file management';
  static readonly longDescription = `
    Google Drive service integration for comprehensive file and folder management.
    Use cases:
    - Upload files and documents to Google Drive
    - Download files with format conversion support
    - List and search files with advanced filtering
    - Create and organize folders
    - Share files and manage permissions
    - Get detailed file metadata and information
    
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
        'https://www.googleapis.com/drive/v3/about?fields=user',
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

    console.log('📤 Sending request...');
    const response = await fetch(url, requestInit);

    console.log('📥 Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      throw new Error(
        `Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type') || '';
    let responseData;
    if (responseType === 'arrayBuffer') {
      const ab = await response.arrayBuffer();
      console.log('✅ API Response data: arrayBuffer bytes', ab.byteLength);
      responseData = ab;
    } else if (
      responseType === 'json' ||
      (responseType === 'auto' && contentType.includes('application/json'))
    ) {
      responseData = await response.json();
      console.log(
        '✅ API Response data:',
        JSON.stringify(responseData, null, 2)
      );
    } else {
      responseData = await response.text();
      console.log(
        '✅ API Response data:',
        `text: ${String(responseData).substring(0, 200)}...`
      );
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
      console.log('🔍 Starting Google Drive upload process...');
      const {
        name,
        content,
        mimeType,
        parent_folder_id,
        convert_to_google_docs,
      } = params;

      console.log('📝 Upload parameters:', {
        name,
        contentLength: content?.length,
        mimeType,
        parent_folder_id,
        convert_to_google_docs,
      });

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
      console.log('🔍 Content analysis:', {
        isBase64,
        contentPreview:
          content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        providedMimeType: mimeType,
      });

      if (isBase64) {
        // Extract actual base64 content (might be wrapped in JSON)
        const extractedBase64 = this.extractBase64Content(content);
        console.log('🎯 Extracted base64 info:', {
          originalLength: content.length,
          extractedLength: extractedBase64.length,
          isExtracted: extractedBase64 !== content,
        });

        // Decode base64 content
        fileData = Buffer.from(extractedBase64, 'base64');
        console.log('✅ Decoded base64 content:', {
          base64Length: extractedBase64.length,
          decodedLength: fileData.length,
        });

        // Auto-detect MIME type if not provided
        if (!actualMimeType) {
          actualMimeType = this.detectMimeTypeFromBase64(extractedBase64);
          console.log('🎯 Auto-detected MIME type:', actualMimeType);
        }
      } else {
        // Treat as plain text
        fileData = Buffer.from(content, 'utf-8');
        console.log('📝 Processing as plain text:', {
          contentLength: content.length,
          bufferLength: fileData.length,
        });

        // Default to text/plain if no MIME type provided for plain text
        if (!actualMimeType) {
          actualMimeType = 'text/plain';
        }
      }

      console.log('🎯 Final MIME type:', actualMimeType);

      // Create multipart form data for upload
      const boundary = `----formdata-boundary-${Date.now()}`;
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      console.log('🔧 Building multipart request:', {
        boundary,
        fileMetadata,
        actualMimeType,
        fileDataLength: fileData.length,
      });

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
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents';
      console.log('🚀 Making upload request to:', uploadUrl);

      // Make the upload request
      const response = await this.makeGoogleApiRequest(
        uploadUrl,
        'POST',
        fullBody,
        {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        }
      );

      console.log('✅ Upload successful:', response);

      return {
        operation: 'upload_file',
        success: true,
        file: response,
        error: '',
      };
    } catch (error) {
      // Enhanced error handling for upload failures
      console.error('❌ Upload failed:', error);
      let errorMessage = 'Unknown error occurred during file upload';

      if (error instanceof Error) {
        console.error('📝 Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });

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

      console.error('💥 Final error message:', errorMessage);

      return {
        operation: 'upload_file',
        success: false,
        file: undefined,
        error: errorMessage,
      };
    }
  }

  private async downloadFile(
    params: Extract<GoogleDriveParams, { operation: 'download_file' }>
  ): Promise<Extract<GoogleDriveResult, { operation: 'download_file' }>> {
    const { file_id, export_format } = params;

    // First get file metadata to determine if it's a Google Workspace file
    const fileInfo = await this.makeGoogleApiRequest(
      `/files/${file_id}?fields=name,mimeType`
    );

    let content: string;
    let actualMimeType: string;

    // Check if it's a Google Workspace file that needs export
    if (fileInfo.mimeType?.startsWith('application/vnd.google-apps.')) {
      if (!export_format) {
        throw new Error('Export format is required for Google Workspace files');
      }

      const exportResponse = await this.makeGoogleApiRequest(
        `/files/${file_id}/export?mimeType=${encodeURIComponent(export_format)}`,
        'GET',
        undefined,
        {},
        'arrayBuffer'
      );

      content = Buffer.from(exportResponse).toString('base64');
      actualMimeType = export_format;
    } else {
      // Regular file download
      const downloadResponse = await this.makeGoogleApiRequest(
        `/files/${file_id}?alt=media`,
        'GET',
        undefined,
        {},
        'arrayBuffer'
      );

      content = Buffer.from(downloadResponse).toString('base64');
      actualMimeType = fileInfo.mimeType;
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
      '/files?fields=id,name,webViewLink,parents',
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
      await this.makeGoogleApiRequest(`/files/${file_id}`, 'DELETE');
    } else {
      // Move to trash
      await this.makeGoogleApiRequest(`/files/${file_id}`, 'PATCH', {
        trashed: true,
      });
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
      `/files/${file_id}?fields=${fields}`
    );

    let permissions;
    if (include_permissions) {
      const permissionsResponse = await this.makeGoogleApiRequest(
        `/files/${file_id}/permissions?fields=permissions(id,type,role,emailAddress,displayName)`
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
      `/files/${file_id}?fields=webViewLink`
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
      `/files/${file_id}?fields=parents`
    );

    const currentParents: string[] = currentFileInfo.parents || [];

    // Build the query parameters for the update
    const queryParams = new URLSearchParams();

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

  private isBase64(str: string): boolean {
    try {
      console.log('🔍 Analyzing content for base64...');
      console.log('📏 Content length:', str.length);
      console.log('🔤 Content start:', str.substring(0, 200));

      // First check if it's a direct base64 string
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

      if (base64Regex.test(str)) {
        console.log('✅ Direct base64 detected');
        // Try to decode and re-encode to verify
        const decoded = Buffer.from(str, 'base64').toString('base64');
        return decoded === str;
      }

      // Check if it's JSON containing base64 data
      if (str.trim().startsWith('[') || str.trim().startsWith('{')) {
        console.log('🔍 JSON structure detected, looking for base64 inside...');
        try {
          const parsed = JSON.parse(str);
          const hasBase64Data = this.findBase64InObject(parsed);
          console.log('📊 Base64 found in JSON:', hasBase64Data);
          return hasBase64Data;
        } catch (jsonError) {
          console.log('❌ Invalid JSON structure');
        }
      }

      // Check if it looks like base64 data (longer strings that might be base64)
      if (str.length > 100 && /^[A-Za-z0-9+/]/.test(str) && str.includes('=')) {
        console.log('🤔 Possible base64 string detected');
        const cleanStr = str.replace(/\s/g, ''); // Remove whitespace
        if (base64Regex.test(cleanStr)) {
          console.log('✅ Cleaned base64 validated');
          return true;
        }
      }

      console.log('❌ No base64 content detected');
      return false;
    } catch (error) {
      console.error('⚠️ Error in base64 detection:', error);
      return false;
    }
  }

  private extractBase64Content(content: string): string {
    try {
      console.log('🔍 Extracting base64 content...');

      // If content is direct base64, return as-is
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (base64Regex.test(content)) {
        console.log('✅ Content is direct base64');
        return content;
      }

      // Try to parse as JSON and extract base64 data
      if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(content);
          const extractedBase64 = this.findAndExtractBase64(parsed);
          if (extractedBase64) {
            console.log('✅ Extracted base64 from JSON structure');
            return extractedBase64;
          }
        } catch (parseError) {
          console.log('❌ Failed to parse JSON for base64 extraction');
        }
      }

      // If no extraction possible, return original content
      console.log('⚠️ No base64 extraction possible, returning original');
      return content;
    } catch (error) {
      console.error('⚠️ Error extracting base64 content:', error);
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
