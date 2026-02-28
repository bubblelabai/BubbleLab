import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  S3ParamsSchema,
  S3ResultSchema,
  type S3Params,
  type S3ParamsInput,
  type S3Result,
} from './s3.schema.js';
import { parseS3Credential, isBase64, type S3Credentials } from './s3.utils.js';

/**
 * S3 Storage Service Bubble
 *
 * S3-compatible storage operations for file management.
 * Works with AWS S3, MinIO, DigitalOcean Spaces, Backblaze B2, and other
 * S3-compatible providers via a configurable endpoint.
 *
 * Uses a single bundled credential (S3_CRED) containing:
 * - accessKeyId, secretAccessKey (required)
 * - endpoint (optional, for non-AWS providers)
 * - region (optional, defaults to us-east-1)
 */
export class S3Bubble<
  T extends S3ParamsInput = S3ParamsInput,
> extends ServiceBubble<T, Extract<S3Result, { operation: T['operation'] }>> {
  static readonly service = 's3';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 's3-storage';
  static readonly type = 'service' as const;
  static readonly schema = S3ParamsSchema;
  static readonly resultSchema = S3ResultSchema;
  static readonly shortDescription =
    'S3-compatible storage operations for file management';
  static readonly longDescription = `
    A comprehensive storage bubble for S3-compatible storage providers.
    Works with AWS S3, MinIO, DigitalOcean Spaces, Backblaze B2, and more.
    Use cases:
    - Generate presigned upload URLs for client-side file uploads
    - Get secure download URLs for file retrieval with authentication
    - Delete files from S3 buckets
    - Update/replace files in S3 buckets (supports base64 encoded content for binary files like images)
    - Manage file access with time-limited URLs
  `;
  static readonly alias = 's3';

  private s3Client: S3Client | null = null;

  constructor(
    params: T = {
      operation: 'getUploadUrl',
      bucketName: 'my-bucket',
      fileName: 'example.txt',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.S3_CRED];
  }

  private initializeS3Client(regionOverride?: string): S3Credentials {
    const credentialValue = this.chooseCredential();
    if (!credentialValue) {
      throw new Error(
        'S3 credentials not found. Provide an S3_CRED credential.'
      );
    }

    const creds = parseS3Credential(credentialValue);

    // Region: explicit override > per-operation > credential > default
    const region =
      regionOverride ||
      (this.params as S3Params).region ||
      creds.region ||
      'us-east-1';

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    };

    // Only set endpoint for non-AWS providers
    if (creds.endpoint) {
      clientConfig.endpoint = creds.endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.s3Client = new S3Client(clientConfig);
    return creds;
  }

  /**
   * Extract the correct region from an S3 PermanentRedirect error.
   * AWS returns the correct endpoint in the error message, e.g.
   * "...endpoint: gymii-test.s3.us-east-2.amazonaws.com"
   */
  private extractRegionFromRedirectError(error: unknown): string | undefined {
    const message = error instanceof Error ? error.message : String(error);
    // Match patterns like "bucketname.s3.us-east-2.amazonaws.com" or just "s3.us-west-1.amazonaws.com"
    const match = message.match(/s3[.-]([a-z0-9-]+)\.amazonaws\.com/);
    return match?.[1];
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('S3 credentials not provided');
    }

    const creds = parseS3Credential(credential);
    if (!creds.accessKeyId || !creds.secretAccessKey) {
      throw new Error(
        'S3 credential is missing accessKeyId or secretAccessKey'
      );
    }

    this.initializeS3Client();
    if (!this.s3Client) {
      throw new Error('Failed to initialize S3 client');
    }

    // Actually call S3 to verify the credentials work — let errors propagate
    // so the validator can surface vendor-specific messages
    await this.s3Client.send(new ListBucketsCommand({}));
    return true;
  }

  private async executeOperation(): Promise<S3Result> {
    const { operation } = this.params;
    switch (operation) {
      case 'getUploadUrl':
        return await this.getUploadUrl(
          this.params as Extract<S3Params, { operation: 'getUploadUrl' }>
        );
      case 'getFile':
        return await this.getFile(
          this.params as Extract<S3Params, { operation: 'getFile' }>
        );
      case 'deleteFile':
        return await this.deleteFile(
          this.params as Extract<S3Params, { operation: 'deleteFile' }>
        );
      case 'updateFile':
        return await this.updateFile(
          this.params as Extract<S3Params, { operation: 'updateFile' }>
        );
      case 'getMultipleUploadUrls':
        return await this.getMultipleUploadUrls(
          this.params as Extract<
            S3Params,
            { operation: 'getMultipleUploadUrls' }
          >
        );
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<S3Result, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      this.initializeS3Client();
      if (!this.s3Client) {
        throw new Error('Failed to initialize S3 client');
      }

      try {
        const result = await this.executeOperation();
        return result as Extract<S3Result, { operation: T['operation'] }>;
      } catch (error) {
        // Auto-retry on region mismatch (PermanentRedirect)
        const redirectRegion = this.extractRegionFromRedirectError(error);
        if (redirectRegion) {
          console.log(
            `[S3Bubble] Region redirect detected, retrying with region: ${redirectRegion}`
          );
          this.initializeS3Client(redirectRegion);
          const result = await this.executeOperation();
          return result as Extract<S3Result, { operation: T['operation'] }>;
        }
        throw error;
      }
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<S3Result, { operation: T['operation'] }>;
    }
  }

  private async getUploadUrl(
    params: Extract<S3Params, { operation: 'getUploadUrl' }>
  ): Promise<Extract<S3Result, { operation: 'getUploadUrl' }>> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    // Generate secure filename with timestamp and optional userId for isolation
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = params.fileName.split('.').pop() || 'bin';
    const baseName = params.fileName.replace(/\.[^/.]+$/, '');
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');

    const userPrefix = params.userId ? `${params.userId}/` : '';
    const secureFileName = `${userPrefix}${timestamp}-${sanitizedBaseName}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: params.bucketName,
      Key: secureFileName,
      ContentType: params.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: params.expirationMinutes! * 60,
    });

    return {
      operation: 'getUploadUrl',
      success: true,
      uploadUrl,
      fileName: secureFileName,
      contentType: params.contentType,
      error: '',
    };
  }

  private async getFile(
    params: Extract<S3Params, { operation: 'getFile' }>
  ): Promise<Extract<S3Result, { operation: 'getFile' }>> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    const command = new GetObjectCommand({
      Bucket: params.bucketName,
      Key: params.fileName,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: params.expirationMinutes! * 60,
    });

    // Also get file metadata
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: params.bucketName,
        Key: params.fileName,
      });

      const metadata = await this.s3Client.send(headCommand);

      return {
        operation: 'getFile',
        success: true,
        downloadUrl,
        fileUrl: downloadUrl,
        fileName: params.fileName,
        fileSize: metadata.ContentLength,
        contentType: metadata.ContentType,
        lastModified: metadata.LastModified?.toISOString(),
        error: '',
      };
    } catch {
      // If metadata fetch fails, still return the download URL
      return {
        operation: 'getFile',
        success: true,
        downloadUrl,
        fileUrl: downloadUrl,
        fileName: params.fileName,
        error: '',
      };
    }
  }

  private async deleteFile(
    params: Extract<S3Params, { operation: 'deleteFile' }>
  ): Promise<Extract<S3Result, { operation: 'deleteFile' }>> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    const command = new DeleteObjectCommand({
      Bucket: params.bucketName,
      Key: params.fileName,
    });

    await this.s3Client.send(command);

    return {
      operation: 'deleteFile',
      success: true,
      fileName: params.fileName,
      deleted: true,
      error: '',
    };
  }

  private async updateFile(
    params: Extract<S3Params, { operation: 'updateFile' }>
  ): Promise<Extract<S3Result, { operation: 'updateFile' }>> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    // Generate secure filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = params.fileName.split('.').pop() || 'bin';
    const baseName = params.fileName.replace(/\.[^/.]+$/, '');
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const secureFileName = `${timestamp}-${crypto.randomUUID()}-${sanitizedBaseName}.${fileExtension}`;

    // Handle base64 encoded content
    let bodyContent: Buffer | string;

    if (isBase64(params.fileContent)) {
      const base64Data = params.fileContent.replace(/^data:[^;]+;base64,/, '');
      bodyContent = Buffer.from(base64Data, 'base64');
    } else {
      bodyContent = params.fileContent;
    }

    const command = new PutObjectCommand({
      Bucket: params.bucketName,
      Key: secureFileName,
      ContentType: params.contentType,
      Body: bodyContent,
    });

    await this.s3Client.send(command);

    return {
      operation: 'updateFile',
      success: true,
      fileName: secureFileName,
      updated: true,
      contentType: params.contentType,
      error: '',
    };
  }

  private async getMultipleUploadUrls(
    params: Extract<S3Params, { operation: 'getMultipleUploadUrls' }>
  ): Promise<Extract<S3Result, { operation: 'getMultipleUploadUrls' }>> {
    if (!this.s3Client) throw new Error('S3 client not initialized');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userPrefix = params.userId ? `${params.userId}/` : '';

    // Generate secure PDF filename
    const pdfExtension = params.pdfFileName.split('.').pop() || 'pdf';
    const pdfBaseName = params.pdfFileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_');
    const securePdfFileName = `${userPrefix}${timestamp}-${pdfBaseName}.${pdfExtension}`;

    // Generate PDF upload URL
    const pdfCommand = new PutObjectCommand({
      Bucket: params.bucketName,
      Key: securePdfFileName,
      ContentType: 'application/pdf',
    });

    const pdfUploadUrl = await getSignedUrl(this.s3Client, pdfCommand, {
      expiresIn: params.expirationMinutes! * 60,
    });

    // Generate page image upload URLs
    const pageUploadUrls: Array<{
      pageNumber: number;
      uploadUrl: string;
      fileName: string;
    }> = [];
    for (let pageNum = 1; pageNum <= params.pageCount; pageNum++) {
      const pageFileName = `${userPrefix}${timestamp}-${pdfBaseName}_page${pageNum}.jpeg`;

      const pageCommand = new PutObjectCommand({
        Bucket: params.bucketName,
        Key: pageFileName,
        ContentType: 'image/jpeg',
      });

      const pageUploadUrl = await getSignedUrl(this.s3Client, pageCommand, {
        expiresIn: params.expirationMinutes! * 60,
      });

      pageUploadUrls.push({
        pageNumber: pageNum,
        uploadUrl: pageUploadUrl,
        fileName: pageFileName,
      });
    }

    return {
      operation: 'getMultipleUploadUrls',
      success: true,
      pdfUploadUrl,
      pdfFileName: securePdfFileName,
      pageUploadUrls,
      error: '',
    };
  }
}
