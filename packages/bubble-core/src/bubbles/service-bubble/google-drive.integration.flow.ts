import {
  BubbleFlow,
  GoogleDriveBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  documentId: string;
  documentUrl: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the Google Docs Integration Test workflow.
 */
export interface GoogleDocsTestPayload extends WebhookEvent {
  /**
   * The title for the test document that will be created.
   * @canBeFile false
   */
  testTitle?: string;

  /**
   * Whether to delete the test document after all tests are complete. Set to false to keep the document in your Google Drive for review.
   * @canBeFile false
   */
  deleteAfterTest?: boolean;
}

export class GoogleDocsIntegrationTest extends BubbleFlow<'webhook/http'> {
  // Creates a new Google Doc by uploading plain text with conversion
  private async createTestDocument(title: string, initialContent: string) {
    const result = await new GoogleDriveBubble({
      operation: 'upload_file',
      name: title,
      content: initialContent,
      mimeType: 'text/plain',
      convert_to_google_docs: true,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to create document: ${result.error}`);
    }

    return result.data?.file;
  }

  // Gets document content using get_doc operation
  private async getDocumentContent(documentId: string) {
    const result = await new GoogleDriveBubble({
      operation: 'get_doc',
      document_id: documentId,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to get document: ${result.error}`);
    }

    return {
      document: result.data?.document,
      plainText: result.data?.plainText,
    };
  }

  // Updates document with plain text using update_doc operation
  private async updateDocumentPlainText(documentId: string, content: string) {
    const result = await new GoogleDriveBubble({
      operation: 'update_doc',
      document_id: documentId,
      content: content,
      mode: 'replace',
    }).action();

    if (!result.success) {
      throw new Error(`Failed to update document: ${result.error}`);
    }

    return {
      documentId: result.data?.documentId,
      revisionId: result.data?.revisionId,
    };
  }

  // Updates document with markdown content using update_doc operation
  private async updateDocumentMarkdown(documentId: string, markdown: string) {
    const result = await new GoogleDriveBubble({
      operation: 'update_doc',
      document_id: documentId,
      content: markdown,
      mode: 'replace',
    }).action();

    if (!result.success) {
      throw new Error(
        `Failed to update document with markdown: ${result.error}`
      );
    }

    return {
      documentId: result.data?.documentId,
      revisionId: result.data?.revisionId,
    };
  }

  // Appends content to document using update_doc operation with append mode
  private async appendToDocument(documentId: string, content: string) {
    const result = await new GoogleDriveBubble({
      operation: 'update_doc',
      document_id: documentId,
      content: content,
      mode: 'append',
    }).action();

    if (!result.success) {
      throw new Error(`Failed to append to document: ${result.error}`);
    }

    return {
      documentId: result.data?.documentId,
      revisionId: result.data?.revisionId,
    };
  }

  // Gets file info from Google Drive
  private async getFileInfo(fileId: string) {
    const result = await new GoogleDriveBubble({
      operation: 'get_file_info',
      file_id: fileId,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to get file info: ${result.error}`);
    }

    return result.data?.file;
  }

  // Deletes test document
  private async deleteDocument(fileId: string) {
    const result = await new GoogleDriveBubble({
      operation: 'delete_file',
      file_id: fileId,
      permanent: true,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to delete document: ${result.error}`);
    }

    return result.data?.deleted_file_id;
  }

  async handle(payload: GoogleDocsTestPayload): Promise<Output> {
    const {
      testTitle = 'Google Docs Integration Test',
      deleteAfterTest = true,
    } = payload;
    const results: Output['testResults'] = [];
    let documentId = '';
    let documentUrl = '';

    // 1. Create Document
    const initialContent = 'Initial test content for Google Docs integration.';
    const file = await this.createTestDocument(testTitle, initialContent);
    documentId = file?.id || '';
    documentUrl = file?.webViewLink || '';
    results.push({
      operation: 'create_document',
      success: true,
      details: `Created document: ${file?.name} (${file?.id})`,
    });

    // 2. Get Document Content - verify initial content
    const initialDoc = await this.getDocumentContent(documentId);
    results.push({
      operation: 'get_doc_initial',
      success: !!initialDoc.plainText,
      details: `Retrieved ${initialDoc.plainText?.length || 0} characters`,
    });

    // 3. Update Document with Plain Text
    const plainTextContent =
      'This is updated plain text content.\n\nIt has multiple paragraphs.';
    const updateResult = await this.updateDocumentPlainText(
      documentId,
      plainTextContent
    );
    results.push({
      operation: 'update_doc_plain_text',
      success: !!updateResult.documentId,
      details: `Updated document, revision: ${updateResult.revisionId || 'N/A'}`,
    });

    // 4. Get Document Content - verify plain text update
    const afterPlainText = await this.getDocumentContent(documentId);
    results.push({
      operation: 'get_doc_after_plain_update',
      success:
        afterPlainText.plainText?.includes('updated plain text') || false,
      details: `Content length: ${afterPlainText.plainText?.length || 0}`,
    });

    // 5. Update Document with Markdown - tests markdown formatting
    const markdownContent = `# Test Document

## Introduction

This is a **bold** statement and this is *italic* text.

Here's a [link to Google](https://google.com).

### List Examples

- First bullet item
- Second bullet item
- Third bullet item

1. First numbered item
2. Second numbered item
3. Third numbered item

## Conclusion

End of test document.`;

    const markdownResult = await this.updateDocumentMarkdown(
      documentId,
      markdownContent
    );
    results.push({
      operation: 'update_doc_markdown',
      success: !!markdownResult.documentId,
      details: `Updated with markdown, revision: ${markdownResult.revisionId || 'N/A'}`,
    });

    // 6. Get Document Content - verify markdown update
    const afterMarkdown = await this.getDocumentContent(documentId);
    results.push({
      operation: 'get_doc_after_markdown_update',
      success: afterMarkdown.plainText?.includes('Test Document') || false,
      details: `Content length: ${afterMarkdown.plainText?.length || 0}`,
    });

    // 7. Append Content to Document
    const appendContent = '\n\n---\n\nAppended section at the end.';
    const appendResult = await this.appendToDocument(documentId, appendContent);
    results.push({
      operation: 'append_to_doc',
      success: !!appendResult.documentId,
      details: `Appended content, revision: ${appendResult.revisionId || 'N/A'}`,
    });

    // 8. Get Document Content - verify append
    const afterAppend = await this.getDocumentContent(documentId);
    results.push({
      operation: 'get_doc_after_append',
      success: afterAppend.plainText?.includes('Appended section') || false,
      details: `Final content length: ${afterAppend.plainText?.length || 0}`,
    });

    // 9. Get File Info - verify it's a Google Doc
    const fileInfo = await this.getFileInfo(documentId);
    results.push({
      operation: 'get_file_info',
      success: fileInfo?.mimeType === 'application/vnd.google-apps.document',
      details: `MIME type: ${fileInfo?.mimeType}`,
    });

    // 10. Delete Document (cleanup)
    if (deleteAfterTest) {
      await this.deleteDocument(documentId);
      results.push({
        operation: 'delete_document',
        success: true,
        details: 'Test document deleted successfully',
      });
    } else {
      results.push({
        operation: 'delete_document',
        success: true,
        details: 'Document kept in Google Drive (deleteAfterTest=false)',
      });
    }

    return {
      documentId,
      documentUrl,
      testResults: results,
    };
  }
}
