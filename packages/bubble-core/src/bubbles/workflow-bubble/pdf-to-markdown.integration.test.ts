import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import '../../../manual-tests/setup.js';
import { PDFFormOperationsWorkflow } from './pdf-form-operations.workflow.js';
import { describe, it, expect, beforeAll } from 'vitest';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('PDF to Markdown Conversion Test', () => {
  let originalPdfBase64: string;
  let originalPdfSize: number;

  beforeAll(() => {
    // Load the actual 1040 tax form PDF
    const pdfPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'manual-tests',
      '1040-tax.pdf'
    );
    const pdfBuffer = readFileSync(pdfPath);
    originalPdfBase64 = pdfBuffer.toString('base64');
    originalPdfSize = pdfBuffer.length;
    console.log(
      `✅ Loaded original PDF: ${Math.round(originalPdfSize / 1024)}KB`
    );
  });

  it('should convert 1040 tax form PDF to structured markdown', async () => {
    console.log('🧪 Testing PDF to markdown conversion...');

    // Check if Google Gemini credentials are available
    const geminiApiKey = process.env.GOOGLE_API_KEY;
    if (!geminiApiKey) {
      console.log('⚠️ No Google API key found, skipping AI-powered test');
      return;
    }

    const markdownWorkflow = new PDFFormOperationsWorkflow({
      operation: 'convert-to-markdown',
      pdfData: originalPdfBase64,
      includeFormFields: true,
      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: geminiApiKey,
      },
    });

    const markdownResult = await markdownWorkflow.action();

    console.log('🔍 Conversion result:', {
      success: markdownResult.success,
      totalPages: markdownResult.data?.totalPages,
      convertedPages: markdownResult.data?.convertedPages,
      markdownLength: markdownResult.data?.markdown.length,
      error: markdownResult.data?.error,
    });

    expect(markdownResult.success).toBe(true);
    expect(markdownResult.data?.markdown).toBeDefined();
    expect(markdownResult.data?.markdown.length).toBeGreaterThan(100);
    expect(markdownResult.data?.pages).toBeDefined();
    expect(markdownResult.data?.pages.length).toBe(2);
    expect(markdownResult.data?.convertedPages).toBe(2);

    const markdown = markdownResult.data!.markdown;
    const pageData = markdownResult.data!.pages[0];

    // Save the markdown for manual review
    const outputDir = path.join(__dirname, '..', '..', '..', 'output');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const markdownPath = path.join(outputDir, `1040-page1-${timestamp}.md`);
    writeFileSync(markdownPath, markdown);

    console.log(`💾 Saved markdown: ${markdownPath}`);
    console.log(`📊 Generated markdown preview (first 500 chars):`);
    console.log(markdown.substring(0, 500) + '...');

    // Basic content checks
    expect(markdown).toContain('1040'); // Should contain form number
    expect(markdown).toMatch(/[Tt]ax|[Rr]eturn|[Ii]ncome/); // Should contain tax-related terms

    // Check page data structure
    expect(pageData.pageNumber).toBe(1);
    expect(pageData.markdown).toBeDefined();
    expect(pageData.markdown.length).toBeGreaterThan(50);

    if (pageData.formFields) {
      console.log(
        `📋 Found ${pageData.formFields.length} form fields in markdown conversion`
      );
      expect(pageData.formFields.length).toBeGreaterThan(0);

      // Log some sample form fields
      const sampleFields = pageData.formFields.slice(0, 3);
      sampleFields.forEach((field) => {
        console.log(`  - ${field.name} (${field.type}): "${field.value}"`);
      });
    }

    console.log('✅ PDF to markdown conversion test completed successfully');
  }, 1200000); // 2 minute timeout for AI processing
});
