import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// Base credentials schema that all operations share
const BaseCredentialsSchema = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

// Define the parameters schema for S3 operations using discriminated union
export const S3ParamsSchema = z.discriminatedUnion('operation', [
  // Get upload URL operation
  z.object({
    operation: z
      .literal('getUploadUrl')
      .describe('Generate presigned upload URL'),
    bucketName: z
      .string()
      .min(1, 'Bucket name is required')
      .describe('Name of the S3 bucket'),
    fileName: z
      .string()
      .min(1, 'File name is required')
      .describe('Original filename for the upload'),
    region: z
      .string()
      .optional()
      .describe('AWS region override (defaults from credential or us-east-1)'),
    expirationMinutes: z
      .number()
      .optional()
      .default(60)
      .describe('URL expiration time in minutes'),
    contentType: z.string().optional().describe('Content type for uploads'),
    userId: z.string().optional().describe('User ID for secure file isolation'),
    credentials: BaseCredentialsSchema,
  }),

  // Get file operation
  z.object({
    operation: z.literal('getFile').describe('Generate presigned download URL'),
    bucketName: z
      .string()
      .min(1, 'Bucket name is required')
      .describe('Name of the S3 bucket'),
    fileName: z
      .string()
      .min(1, 'File name is required')
      .describe('Name of the file to retrieve'),
    region: z
      .string()
      .optional()
      .describe('AWS region override (defaults from credential or us-east-1)'),
    expirationMinutes: z
      .number()
      .optional()
      .default(60)
      .describe('URL expiration time in minutes'),
    userId: z.string().optional().describe('User ID for secure file isolation'),
    credentials: BaseCredentialsSchema,
  }),

  // Delete file operation
  z.object({
    operation: z.literal('deleteFile').describe('Delete file from bucket'),
    bucketName: z
      .string()
      .min(1, 'Bucket name is required')
      .describe('Name of the S3 bucket'),
    fileName: z
      .string()
      .min(1, 'File name is required')
      .describe('Name of the file to delete'),
    region: z
      .string()
      .optional()
      .describe('AWS region override (defaults from credential or us-east-1)'),
    credentials: BaseCredentialsSchema,
  }),

  // Update file operation
  z.object({
    operation: z
      .literal('updateFile')
      .describe('Upload or replace file content'),
    bucketName: z
      .string()
      .min(1, 'Bucket name is required')
      .default('bubble-lab-bucket'),
    fileName: z
      .string()
      .min(1, 'File name is required')
      .describe(
        'Name of the file. Pass a secure fileName from a previous operation to overwrite it, or a new name to create a new file'
      ),
    region: z
      .string()
      .optional()
      .describe('AWS region override (defaults from credential or us-east-1)'),
    contentType: z.string().optional().describe('Content type for uploads'),
    fileContent: z
      .string()
      .min(1, 'File content is required for updates')
      .describe('Base64 encoded file content or raw text content'),
    userId: z.string().optional().describe('User ID for secure file isolation'),
    credentials: BaseCredentialsSchema,
  }),

  // Get multiple upload URLs operation
  z.object({
    operation: z
      .literal('getMultipleUploadUrls')
      .describe(
        'Generate multiple presigned upload URLs for PDF + page images'
      ),
    bucketName: z
      .string()
      .min(1, 'Bucket name is required')
      .describe('Name of the S3 bucket'),
    pdfFileName: z
      .string()
      .min(1, 'PDF file name is required')
      .describe('Original filename for the PDF'),
    pageCount: z
      .number()
      .min(1, 'Page count must be at least 1')
      .describe('Number of pages to generate upload URLs for'),
    region: z
      .string()
      .optional()
      .describe('AWS region override (defaults from credential or us-east-1)'),
    expirationMinutes: z
      .number()
      .optional()
      .default(60)
      .describe('URL expiration time in minutes'),
    userId: z.string().optional().describe('User ID for secure file isolation'),
    credentials: BaseCredentialsSchema,
  }),
]);

// Define result schemas for different operations using discriminated union
export const S3ResultSchema = z.discriminatedUnion('operation', [
  // Get upload URL result
  z.object({
    operation: z
      .literal('getUploadUrl')
      .describe('Generate presigned upload URL'),
    success: z.boolean().describe('Whether the operation was successful'),
    uploadUrl: z.string().optional().describe('Presigned upload URL'),
    fileName: z
      .string()
      .optional()
      .describe('Secure filename generated for the upload'),
    contentType: z.string().optional().describe('Content type of the file'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get file result
  z.object({
    operation: z.literal('getFile').describe('Generate presigned download URL'),
    success: z.boolean().describe('Whether the operation was successful'),
    downloadUrl: z.string().optional().describe('Presigned download URL'),
    fileUrl: z.string().optional().describe('Direct file access URL'),
    fileName: z.string().optional().describe('Name of the file'),
    fileSize: z.number().optional().describe('File size in bytes'),
    contentType: z.string().optional().describe('Content type of the file'),
    lastModified: z
      .string()
      .optional()
      .describe('Last modified timestamp in ISO format'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Delete file result
  z.object({
    operation: z.literal('deleteFile').describe('Delete file from bucket'),
    success: z.boolean().describe('Whether the operation was successful'),
    fileName: z.string().optional().describe('Name of the deleted file'),
    deleted: z
      .boolean()
      .optional()
      .describe('Whether the file was successfully deleted'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Update file result
  z.object({
    operation: z
      .literal('updateFile')
      .describe(
        'Update/replace file content and generate a new secure filename for the file'
      ),
    success: z.boolean().describe('Whether the operation was successful'),
    fileName: z
      .string()
      .optional()
      .describe(
        'Secure filename for the updated file (different from the original filename)'
      ),
    updated: z
      .boolean()
      .optional()
      .describe('Whether the file was successfully updated'),
    contentType: z
      .string()
      .optional()
      .describe('Content type of the updated file'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get multiple upload URLs result
  z.object({
    operation: z
      .literal('getMultipleUploadUrls')
      .describe(
        'Generate multiple presigned upload URLs for PDF + page images'
      ),
    success: z.boolean().describe('Whether the operation was successful'),
    pdfUploadUrl: z
      .string()
      .optional()
      .describe('Presigned upload URL for PDF'),
    pdfFileName: z.string().optional().describe('Secure filename for PDF'),
    pageUploadUrls: z
      .array(
        z.object({
          pageNumber: z.number().describe('Page number (1-indexed)'),
          uploadUrl: z.string().describe('Presigned upload URL for this page'),
          fileName: z.string().describe('Secure filename for this page image'),
        })
      )
      .optional()
      .describe('Array of upload URLs for page images'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

export type S3Result = z.output<typeof S3ResultSchema>;
export type S3Params = z.output<typeof S3ParamsSchema>;
export type S3ParamsInput = z.input<typeof S3ParamsSchema>;

// Helper type to get the result type for a specific operation
export type S3OperationResult<T extends S3Params['operation']> = Extract<
  S3Result,
  { operation: T }
>;
