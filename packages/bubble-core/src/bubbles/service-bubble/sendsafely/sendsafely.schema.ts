import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

// ============================================================================
// CREDENTIALS FIELD - Required for all operations
// ============================================================================

const credentialsField = z
  .record(z.nativeEnum(CredentialType), z.string())
  .optional()
  .describe('Object mapping credential types to values (injected at runtime)');

// ============================================================================
// DATA SCHEMAS - SendSafely API Response Objects
// ============================================================================

export const SendSafelyPackageInfoSchema = z
  .object({
    packageId: z.string().describe('Unique SendSafely package identifier'),
    packageCode: z.string().optional().describe('Package access code'),
    serverSecret: z
      .string()
      .optional()
      .describe('Server-side secret for encryption'),
    recipients: z
      .array(
        z.object({
          recipientId: z.string().describe('Recipient identifier'),
          email: z.string().describe('Recipient email address'),
        })
      )
      .optional()
      .describe('List of package recipients'),
    files: z
      .array(
        z.object({
          fileId: z.string().describe('File identifier'),
          fileName: z.string().describe('Original file name'),
          fileSize: z.number().optional().describe('File size in bytes'),
        })
      )
      .optional()
      .describe('List of files in the package'),
    state: z.string().optional().describe('Current package state'),
    life: z.number().optional().describe('Package lifetime in days'),
    secureLink: z
      .string()
      .optional()
      .describe('Secure link URL for the package'),
  })
  .describe('SendSafely package info');

// ============================================================================
// PARAMETERS SCHEMA - All SendSafely Operations
// ============================================================================

export const SendSafelyParamsSchema = z.discriminatedUnion('operation', [
  // Send File
  z.object({
    operation: z
      .literal('send_file')
      .describe(
        'Create an encrypted package with a file and send to a recipient'
      ),
    recipientEmail: z
      .string()
      .email('Invalid email format')
      .describe('Email address of the recipient'),
    fileName: z
      .string()
      .min(1, 'File name is required')
      .describe('Name of the file being sent'),
    fileData: z
      .string()
      .min(1, 'File data is required')
      .describe('Base64-encoded file content'),
    message: z
      .string()
      .optional()
      .describe('Optional secure message to include with the package'),
    lifeDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe('Package lifetime in days (default set by SendSafely org)'),
    credentials: credentialsField,
  }),

  // Send Message
  z.object({
    operation: z
      .literal('send_message')
      .describe('Create an encrypted package with a secure message'),
    recipientEmail: z
      .string()
      .email('Invalid email format')
      .describe('Email address of the recipient'),
    message: z
      .string()
      .min(1, 'Message is required')
      .describe('Secure message to send'),
    lifeDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe('Package lifetime in days (default set by SendSafely org)'),
    credentials: credentialsField,
  }),

  // Get Package
  z.object({
    operation: z.literal('get_package').describe('Retrieve package info by ID'),
    package_id: z
      .string()
      .min(1, 'Package ID is required')
      .describe('SendSafely package identifier'),
    credentials: credentialsField,
  }),
]);

// ============================================================================
// RESULT SCHEMA - All SendSafely Operation Results
// ============================================================================

export const SendSafelyResultSchema = z.discriminatedUnion('operation', [
  // Send File Result
  z.object({
    operation: z.literal('send_file'),
    success: z.boolean().describe('Whether the operation succeeded'),
    packageId: z.string().optional().describe('Created package identifier'),
    secureLink: z
      .string()
      .optional()
      .describe('Secure link URL for the package'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Send Message Result
  z.object({
    operation: z.literal('send_message'),
    success: z.boolean().describe('Whether the operation succeeded'),
    packageId: z.string().optional().describe('Created package identifier'),
    secureLink: z
      .string()
      .optional()
      .describe('Secure link URL for the package'),
    error: z.string().describe('Error message if operation failed'),
  }),

  // Get Package Result
  z.object({
    operation: z.literal('get_package'),
    success: z.boolean().describe('Whether the operation succeeded'),
    package: SendSafelyPackageInfoSchema.optional().describe('Package info'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SendSafelyParamsInput = z.input<typeof SendSafelyParamsSchema>;
export type SendSafelyParams = z.output<typeof SendSafelyParamsSchema>;
export type SendSafelyResult = z.output<typeof SendSafelyResultSchema>;
