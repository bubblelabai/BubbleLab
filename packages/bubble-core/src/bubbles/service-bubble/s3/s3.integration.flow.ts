import {
  BubbleFlow,
  S3Bubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface S3IntegrationTestPayload extends WebhookEvent {
  /**
   * S3 bucket name for testing
   * @canBeFile false
   */
  bucketName: string;
}

/**
 * S3 Integration Test Flow
 *
 * Tests all major S3 operations end-to-end:
 * 1. getUploadUrl — generate presigned upload URL
 * 2. updateFile — upload file content directly
 * 3. getFile — generate presigned download URL + metadata
 * 4. getMultipleUploadUrls — generate multiple presigned URLs
 * 5. deleteFile — delete a file from the bucket
 */
export class S3IntegrationTest extends BubbleFlow<'webhook/http'> {
  private async testGetUploadUrl(bucketName: string) {
    const result = await new S3Bubble({
      operation: 'getUploadUrl',
      bucketName,
      fileName: 'integration-test.txt',
      contentType: 'text/plain',
      expirationMinutes: 5,
    }).action();

    return {
      operation: 'getUploadUrl',
      success: result.success,
      details: result.success
        ? `Upload URL generated, fileName: ${result.fileName}`
        : result.error,
    };
  }

  private async testUpdateFile(bucketName: string) {
    const result = await new S3Bubble({
      operation: 'updateFile',
      bucketName,
      fileName: 'integration-test-update.txt',
      fileContent: 'Hello from S3 integration test!',
      contentType: 'text/plain',
    }).action();

    return {
      operation: 'updateFile',
      success: result.success,
      details: result.success
        ? `File updated, fileName: ${result.fileName}`
        : result.error,
      fileName: result.success ? result.fileName : undefined,
    };
  }

  private async testGetFile(bucketName: string, fileName: string) {
    const result = await new S3Bubble({
      operation: 'getFile',
      bucketName,
      fileName,
      expirationMinutes: 5,
    }).action();

    return {
      operation: 'getFile',
      success: result.success,
      details: result.success
        ? `Download URL generated, size: ${result.fileSize ?? 'unknown'}`
        : result.error,
    };
  }

  private async testGetMultipleUploadUrls(bucketName: string) {
    const result = await new S3Bubble({
      operation: 'getMultipleUploadUrls',
      bucketName,
      pdfFileName: 'integration-test.pdf',
      pageCount: 3,
      expirationMinutes: 5,
    }).action();

    return {
      operation: 'getMultipleUploadUrls',
      success: result.success,
      details: result.success
        ? `PDF URL + ${result.pageUploadUrls?.length ?? 0} page URLs generated`
        : result.error,
    };
  }

  private async testDeleteFile(bucketName: string, fileName: string) {
    const result = await new S3Bubble({
      operation: 'deleteFile',
      bucketName,
      fileName,
    }).action();

    return {
      operation: 'deleteFile',
      success: result.success,
      details: result.success ? `Deleted: ${result.fileName}` : result.error,
    };
  }

  async execute(payload: S3IntegrationTestPayload): Promise<Output> {
    const { bucketName } = payload;
    const testResults: Output['testResults'] = [];

    // 1. Test getUploadUrl
    testResults.push(await this.testGetUploadUrl(bucketName));

    // 2. Test updateFile (directly upload content)
    const updateResult = await this.testUpdateFile(bucketName);
    testResults.push(updateResult);

    // 3. Test getFile (using the file we just uploaded)
    if (updateResult.fileName) {
      testResults.push(
        await this.testGetFile(bucketName, updateResult.fileName)
      );
    }

    // 4. Test getMultipleUploadUrls
    testResults.push(await this.testGetMultipleUploadUrls(bucketName));

    // 5. Test deleteFile (clean up the file we uploaded)
    if (updateResult.fileName) {
      testResults.push(
        await this.testDeleteFile(bucketName, updateResult.fileName)
      );
    }

    return { testResults };
  }
}
