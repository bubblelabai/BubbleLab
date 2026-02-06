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
    contentLength?: number;
    durationMs?: number;
    error?: string;
  }[];
  summary: {
    totalOperations: number;
    successfulOperations: number;
    totalDurationMs: number;
    largestDocumentSize: number;
  };
}

/**
 * Payload for the Google Docs Stress Test workflow.
 */
export interface GoogleDocsStressTestPayload extends WebhookEvent {
  /**
   * The title for the test document.
   * @canBeFile false
   */
  testTitle?: string;

  /**
   * Number of sections to generate in the knowledge document.
   * Each section has ~500-1000 characters. Default: 20
   * @canBeFile false
   */
  sectionCount?: number;

  /**
   * Number of times to replace the entire document content.
   * Tests repeated full-page replacements. Default: 5
   * @canBeFile false
   */
  replaceIterations?: number;

  /**
   * Whether to delete the test document after all tests. Default: true
   * @canBeFile false
   */
  deleteAfterTest?: boolean;
}

/**
 * Stress test for Google Docs update operations.
 *
 * Tests:
 * 1. Creating large documents (simulating knowledge bases)
 * 2. Replacing entire document content multiple times
 * 3. Handling documents with many sections and formatting
 * 4. Content integrity verification after replacements
 * 5. Performance under repeated full-document updates
 */
export class GoogleDocsStressTest extends BubbleFlow<'webhook/http'> {
  /**
   * Generate a knowledge base section with realistic content
   */
  private generateSection(index: number, includeMarkdown: boolean): string {
    const topics = [
      'API Integration',
      'Authentication',
      'Data Processing',
      'Error Handling',
      'Performance Optimization',
      'Security Best Practices',
      'Testing Strategies',
      'Deployment Procedures',
      'Monitoring & Logging',
      'Troubleshooting Guide',
      'Configuration Management',
      'Database Operations',
      'Caching Strategies',
      'Rate Limiting',
      'Webhook Handling',
      'File Management',
      'User Permissions',
      'Audit Logging',
      'Backup & Recovery',
      'Migration Guide',
    ];

    const topic = topics[index % topics.length];
    const sectionNumber = index + 1;

    if (includeMarkdown) {
      return `## Section ${sectionNumber}: ${topic}

### Overview

This section covers **${topic}** in detail. Understanding this concept is *critical* for effective system operation.

### Key Points

- First important point about ${topic.toLowerCase()}
- Second consideration when implementing
- Third best practice to follow
- Fourth common pitfall to avoid

### Implementation Details

When working with ${topic.toLowerCase()}, follow these steps:

1. Initialize the required components
2. Configure the necessary parameters
3. Implement the core logic
4. Add error handling
5. Test thoroughly

### Code Example

The implementation should handle edge cases properly. Consider timeouts, retries, and graceful degradation.

### Related Topics

See also: Section ${((index + 5) % 20) + 1}, Section ${((index + 10) % 20) + 1}

---

`;
    } else {
      return `SECTION ${sectionNumber}: ${topic.toUpperCase()}

Overview:
This section covers ${topic} in detail. Understanding this concept is critical for effective system operation.

Key Points:
- First important point about ${topic.toLowerCase()}
- Second consideration when implementing
- Third best practice to follow
- Fourth common pitfall to avoid

Implementation Details:
When working with ${topic.toLowerCase()}, follow these steps:
1. Initialize the required components
2. Configure the necessary parameters
3. Implement the core logic
4. Add error handling
5. Test thoroughly

Code Example:
The implementation should handle edge cases properly. Consider timeouts, retries, and graceful degradation.

Related Topics:
See also: Section ${((index + 5) % 20) + 1}, Section ${((index + 10) % 20) + 1}

========================================

`;
    }
  }

  /**
   * Generate a full knowledge document with multiple sections
   */
  private generateKnowledgeDoc(
    sectionCount: number,
    version: number,
    includeMarkdown: boolean
  ): string {
    const timestamp = new Date().toISOString();
    const header = includeMarkdown
      ? `# Knowledge Base Document v${version}

**Last Updated:** ${timestamp}
**Sections:** ${sectionCount}
**Version:** ${version}

---

`
      : `KNOWLEDGE BASE DOCUMENT v${version}

Last Updated: ${timestamp}
Sections: ${sectionCount}
Version: ${version}

========================================

`;

    const sections: string[] = [header];
    for (let i = 0; i < sectionCount; i++) {
      sections.push(this.generateSection(i, includeMarkdown));
    }

    const footer = includeMarkdown
      ? `
---

## Document Footer

This document was auto-generated for stress testing purposes.
Version ${version} | Generated at ${timestamp}
`
      : `
========================================

DOCUMENT FOOTER

This document was auto-generated for stress testing purposes.
Version ${version} | Generated at ${timestamp}
`;

    sections.push(footer);
    return sections.join('');
  }

  /**
   * Create a new Google Doc
   */
  private async createDocument(title: string, initialContent: string) {
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

  /**
   * Replace entire document content
   */
  private async replaceDocument(documentId: string, content: string) {
    const result = await new GoogleDriveBubble({
      operation: 'update_doc',
      document_id: documentId,
      content: content,
      mode: 'replace',
    }).action();

    if (!result.success) {
      throw new Error(`Failed to replace document: ${result.error}`);
    }

    return {
      documentId: result.data?.documentId,
      revisionId: result.data?.revisionId,
    };
  }

  /**
   * Get document content
   */
  private async getDocumentContent(documentId: string) {
    const result = await new GoogleDriveBubble({
      operation: 'get_doc',
      document_id: documentId,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to get document: ${result.error}`);
    }

    return {
      plainText: result.data?.plainText,
      document: result.data?.document,
    };
  }

  /**
   * Delete document
   */
  private async deleteDocument(fileId: string) {
    const result = await new GoogleDriveBubble({
      operation: 'delete_file',
      file_id: fileId,
      permanent: true,
    }).action();

    if (!result.success) {
      throw new Error(`Failed to delete document: ${result.error}`);
    }
  }

  async handle(payload: GoogleDocsStressTestPayload): Promise<Output> {
    const {
      testTitle = 'Google Docs Stress Test',
      sectionCount = 20,
      replaceIterations = 5,
      deleteAfterTest = true,
    } = payload;

    const results: Output['testResults'] = [];
    let documentId = '';
    let documentUrl = '';
    let largestDocumentSize = 0;
    const startTime = Date.now();

    // 1. Create initial large document
    const initialContent = this.generateKnowledgeDoc(sectionCount, 1, false);
    largestDocumentSize = Math.max(largestDocumentSize, initialContent.length);

    const createStart = Date.now();
    try {
      const file = await this.createDocument(testTitle, initialContent);
      documentId = file?.id || '';
      documentUrl = file?.webViewLink || '';
      results.push({
        operation: 'create_large_document',
        success: true,
        details: `Created document with ${sectionCount} sections`,
        contentLength: initialContent.length,
        durationMs: Date.now() - createStart,
      });
    } catch (error) {
      results.push({
        operation: 'create_large_document',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - createStart,
      });
      return {
        documentId: '',
        documentUrl: '',
        testResults: results,
        summary: {
          totalOperations: 1,
          successfulOperations: 0,
          totalDurationMs: Date.now() - startTime,
          largestDocumentSize,
        },
      };
    }

    // 2. Verify initial content
    const verifyStart = Date.now();
    try {
      const content = await this.getDocumentContent(documentId);
      const hasAllSections =
        content.plainText?.includes(`Section ${sectionCount}`) ?? false;
      results.push({
        operation: 'verify_initial_content',
        success: hasAllSections,
        details: hasAllSections
          ? `Verified all ${sectionCount} sections present`
          : 'Missing sections in initial content',
        contentLength: content.plainText?.length || 0,
        durationMs: Date.now() - verifyStart,
      });
    } catch (error) {
      results.push({
        operation: 'verify_initial_content',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - verifyStart,
      });
    }

    // 3. Perform multiple full-document replacements
    for (let i = 0; i < replaceIterations; i++) {
      const version = i + 2;
      const useMarkdown = i % 2 === 0; // Alternate between plain text and markdown
      const newContent = this.generateKnowledgeDoc(
        sectionCount,
        version,
        useMarkdown
      );
      largestDocumentSize = Math.max(largestDocumentSize, newContent.length);

      const replaceStart = Date.now();
      try {
        await this.replaceDocument(documentId, newContent);
        results.push({
          operation: `replace_full_document_v${version}`,
          success: true,
          details: `Replaced with ${useMarkdown ? 'markdown' : 'plain text'} v${version}`,
          contentLength: newContent.length,
          durationMs: Date.now() - replaceStart,
        });
      } catch (error) {
        results.push({
          operation: `replace_full_document_v${version}`,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          contentLength: newContent.length,
          durationMs: Date.now() - replaceStart,
        });
      }

      // Verify content after replacement
      const verifyReplaceStart = Date.now();
      try {
        const content = await this.getDocumentContent(documentId);
        const hasVersion = content.plainText?.includes(`v${version}`) ?? false;
        const hasFooter =
          content.plainText?.includes(`Version ${version}`) ?? false;
        results.push({
          operation: `verify_replacement_v${version}`,
          success: hasVersion && hasFooter,
          details:
            hasVersion && hasFooter
              ? `Content correctly updated to v${version}`
              : `Version mismatch after replacement`,
          contentLength: content.plainText?.length || 0,
          durationMs: Date.now() - verifyReplaceStart,
        });
      } catch (error) {
        results.push({
          operation: `verify_replacement_v${version}`,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Date.now() - verifyReplaceStart,
        });
      }
    }

    // 4. Test with extra large document (double sections)
    const extraLargeContent = this.generateKnowledgeDoc(
      sectionCount * 2,
      99,
      true
    );
    largestDocumentSize = Math.max(
      largestDocumentSize,
      extraLargeContent.length
    );

    const extraLargeStart = Date.now();
    try {
      await this.replaceDocument(documentId, extraLargeContent);
      results.push({
        operation: 'replace_with_extra_large_doc',
        success: true,
        details: `Replaced with ${sectionCount * 2} sections (${extraLargeContent.length} chars)`,
        contentLength: extraLargeContent.length,
        durationMs: Date.now() - extraLargeStart,
      });
    } catch (error) {
      results.push({
        operation: 'replace_with_extra_large_doc',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        contentLength: extraLargeContent.length,
        durationMs: Date.now() - extraLargeStart,
      });
    }

    // 5. Verify extra large content
    const verifyExtraLargeStart = Date.now();
    try {
      const content = await this.getDocumentContent(documentId);
      const expectedLastSection = `Section ${sectionCount * 2}`;
      const hasAllSections =
        content.plainText?.includes(expectedLastSection) ?? false;
      results.push({
        operation: 'verify_extra_large_content',
        success: hasAllSections,
        details: hasAllSections
          ? `Verified all ${sectionCount * 2} sections`
          : `Missing sections - expected "${expectedLastSection}"`,
        contentLength: content.plainText?.length || 0,
        durationMs: Date.now() - verifyExtraLargeStart,
      });
    } catch (error) {
      results.push({
        operation: 'verify_extra_large_content',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - verifyExtraLargeStart,
      });
    }

    // 6. Cleanup
    if (deleteAfterTest && documentId) {
      const deleteStart = Date.now();
      try {
        await this.deleteDocument(documentId);
        results.push({
          operation: 'delete_document',
          success: true,
          details: 'Test document deleted',
          durationMs: Date.now() - deleteStart,
        });
      } catch (error) {
        results.push({
          operation: 'delete_document',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Date.now() - deleteStart,
        });
      }
    } else {
      results.push({
        operation: 'delete_document',
        success: true,
        details: 'Document kept (deleteAfterTest=false)',
      });
    }

    const totalDurationMs = Date.now() - startTime;
    const successfulOperations = results.filter((r) => r.success).length;

    return {
      documentId,
      documentUrl,
      testResults: results,
      summary: {
        totalOperations: results.length,
        successfulOperations,
        totalDurationMs,
        largestDocumentSize,
      },
    };
  }
}
