import { readFileSync } from 'fs';
import path from 'path';
import '../../../manual-tests/setup.js';
import { ParseDocumentWorkflow } from './parse-document.workflow.js';
import { PDFFormOperationsWorkflow } from './pdf-form-operations.workflow.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { describe, it, expect, beforeAll } from 'vitest';

describe('ParseDocumentWorkflow', () => {
  let sampleImageBase64: string;
  let testPdfBase64: string;
  let receiptImageBase64: string;

  beforeAll(async () => {
    // Create a simple test image in base64 format (1x1 pixel PNG)
    // This is a minimal valid PNG image for testing
    sampleImageBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    // Load the actual 1040 tax form PDF for testing PDF conversion
    try {
      const pdfPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'manual-tests',
        '1040-tax.pdf'
      );
      const pdfBuffer = readFileSync(pdfPath);
      testPdfBase64 = pdfBuffer.toString('base64');
      console.log(
        `✅ Loaded test PDF: ${Math.round(pdfBuffer.length / 1024)}KB`
      );
    } catch {
      console.warn(
        '⚠️  Could not load 1040-tax.pdf, using minimal PDF for testing'
      );
      // Fallback to minimal PDF
      testPdfBase64 =
        'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PmVuZG9iag==';
    }

    // Load the receipt image for realistic image testing
    try {
      const receiptPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'manual-tests',
        'receipt_1.jpg'
      );
      const receiptBuffer = readFileSync(receiptPath);
      receiptImageBase64 = receiptBuffer.toString('base64');
      console.log(
        `✅ Loaded receipt image: ${Math.round(receiptBuffer.length / 1024)}KB`
      );
    } catch {
      console.warn(
        '⚠️  Could not load receipt.jpeg, will use fallback image for testing'
      );
      // Use the minimal PNG as fallback
      receiptImageBase64 = sampleImageBase64;
    }
  });

  describe('Schema Validation', () => {
    it('should validate valid image parsing parameters', () => {
      const validParams = {
        documentData: sampleImageBase64,
        documentType: 'image' as const,
        conversionOptions: {
          preserveStructure: true,
          includeVisualDescriptions: true,
          extractNumericalData: true,
          combinePages: true,
        },
        aiOptions: {
          model: 'google/gemini-2.5-flash' as const,
          temperature: 0.2,
          maxTokens: 50000,
          jsonMode: false,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
        },
      };

      expect(() => {
        new ParseDocumentWorkflow(validParams);
      }).not.toThrow();
    });

    it('should validate valid PDF parsing parameters', () => {
      const validParams = {
        documentData: testPdfBase64,
        documentType: 'pdf' as const,
        conversionOptions: {
          preserveStructure: false,
          includeVisualDescriptions: false,
          extractNumericalData: false,
          combinePages: false,
        },
        imageOptions: {
          format: 'jpeg' as const,
          quality: 0.8,
          dpi: 150,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
        },
      };

      expect(() => {
        new ParseDocumentWorkflow(validParams);
      }).not.toThrow();
    });

    it('should require document data', () => {
      expect(() => {
        ParseDocumentWorkflow.schema.parse({
          documentData: '',
          documentType: 'image',
        });
      }).toThrow();
    });

    it('should validate document type options', () => {
      expect(() => {
        ParseDocumentWorkflow.schema.parse({
          documentData: sampleImageBase64,
          documentType: 'invalid-type',
        });
      }).toThrow();
    });

    it('should have default values for optional parameters', () => {
      const result = ParseDocumentWorkflow.schema.parse({
        documentData: sampleImageBase64,
      });

      expect(result.documentType).toBe('pdf');
      expect(result.conversionOptions.preserveStructure).toBe(true);
      expect(result.conversionOptions.includeVisualDescriptions).toBe(true);
      expect(result.conversionOptions.extractNumericalData).toBe(true);
      expect(result.imageOptions.format).toBe('png');
      expect(result.imageOptions.dpi).toBe(200);
      expect(result.aiOptions.model).toBe('google/gemini-2.5-flash');
      expect(result.aiOptions.jsonMode).toBe(false);
    });
  });

  describe('Static Properties', () => {
    it('should have correct static metadata', () => {
      expect(ParseDocumentWorkflow.type).toBe('workflow');
      expect(ParseDocumentWorkflow.bubbleName).toBe('parse-document-workflow');
      expect(ParseDocumentWorkflow.alias).toBe('parse-doc');
      expect(ParseDocumentWorkflow.shortDescription).toContain(
        'Parse Document'
      );
      expect(ParseDocumentWorkflow.longDescription).toContain('markdown');
    });

    it('should have proper schema definitions', () => {
      expect(ParseDocumentWorkflow.schema).toBeDefined();
      expect(ParseDocumentWorkflow.resultSchema).toBeDefined();
    });
  });

  describe('Result Schema', () => {
    it('should validate successful result structure', () => {
      const successResult = {
        markdown:
          '# Sample Document\n\nThis is a test document with some content.',
        pages: [
          {
            pageNumber: 1,
            markdown: '# Sample Document\n\nThis is a test document.',
            hasCharts: false,
            hasTables: false,
            hasImages: true,
            confidence: 0.85,
          },
        ],
        metadata: {
          totalPages: 1,
          processedPages: 1,
          hasVisualElements: true,
          processingTime: 5000,
          imageFormat: 'png',
          imageDpi: 200,
        },
        conversionSummary: {
          totalCharacters: 58,
          tablesExtracted: 0,
          chartsDescribed: 0,
          imagesDescribed: 1,
        },
        aiAnalysis: {
          model: 'google/gemini-2.5-flash',
          iterations: 2,
          processingTime: 3000,
        },
        success: true,
        error: '',
      };

      expect(() => {
        ParseDocumentWorkflow.resultSchema.parse(successResult);
      }).not.toThrow();
    });

    it('should validate error result structure', () => {
      const errorResult = {
        markdown: '',
        pages: [],
        metadata: {
          totalPages: 0,
          processedPages: 0,
          hasVisualElements: false,
          processingTime: 1000,
          imageFormat: 'png',
          imageDpi: 200,
        },
        conversionSummary: {
          totalCharacters: 0,
          tablesExtracted: 0,
          chartsDescribed: 0,
          imagesDescribed: 0,
        },
        aiAnalysis: {
          model: 'google/gemini-2.5-flash',
          iterations: 0,
          processingTime: 500,
        },
        success: false,
        error: 'Document parsing failed',
      };

      expect(() => {
        ParseDocumentWorkflow.resultSchema.parse(errorResult);
      }).not.toThrow();
    });
  });

  describe('Integration Points', () => {
    it('should be compatible with BubbleFactory registration', () => {
      expect(ParseDocumentWorkflow.type).toBe('workflow');
      expect(typeof ParseDocumentWorkflow.bubbleName).toBe('string');
      expect(ParseDocumentWorkflow.schema).toBeDefined();
      expect(ParseDocumentWorkflow.resultSchema).toBeDefined();
      expect(typeof ParseDocumentWorkflow.shortDescription).toBe('string');
      expect(typeof ParseDocumentWorkflow.longDescription).toBe('string');
      expect(typeof ParseDocumentWorkflow.alias).toBe('string');
    });

    it('should accept proper credential types', () => {
      const validCredentials = {
        [CredentialType.GOOGLE_GEMINI_CRED]: 'google-api-key',
        [CredentialType.OPENAI_CRED]: 'openai-api-key',
      };

      expect(() => {
        new ParseDocumentWorkflow({
          documentData: sampleImageBase64,
          documentType: 'image',
          credentials: validCredentials,
        });
      }).not.toThrow();
    });
  });

  describe('Full Integration Tests', () => {
    it('should process PDF and generate markdown', async () => {
      // Skip this test if no Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.log(
          '⚠️  Skipping integration test - no GOOGLE_API_KEY environment variable'
        );
        return;
      }

      console.log('🚀 Running integration test with 1040 tax form PDF...');

      const integrationWorkflow = new ParseDocumentWorkflow({
        documentData: testPdfBase64,
        documentType: 'pdf',
        conversionOptions: {
          preserveStructure: true,
          includeVisualDescriptions: true,
          extractNumericalData: true,
          combinePages: true,
        },
        imageOptions: {
          format: 'png',
          quality: 0.9,
          dpi: 200,
          pages: [1], // Only process first page for faster testing
        },
        aiOptions: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.2,
          maxTokens: 50000,
          jsonMode: false,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
        },
      });

      const startTime = Date.now();
      const result = await integrationWorkflow.action();
      const executionTime = Date.now() - startTime;

      console.log(`⏱️  Integration test completed in ${executionTime}ms`);

      // Verify the workflow completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBe('');

      // Verify basic structure
      expect(result.data?.markdown).toBeDefined();
      expect(typeof result.data?.markdown).toBe('string');
      expect(result.data?.markdown.length).toBeGreaterThan(0);

      // Verify metadata
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.data?.metadata.processedPages).toBeGreaterThanOrEqual(1);
      expect(result.data?.metadata.imageFormat).toBe('png');
      expect(result.data?.metadata.imageDpi).toBe(200);

      // Verify pages array
      expect(result.data?.pages).toBeDefined();
      expect(Array.isArray(result.data?.pages)).toBe(true);
      expect(result.data?.pages.length).toBeGreaterThanOrEqual(1);

      if (result.data?.pages && result.data.pages.length > 0) {
        const firstPage = result.data.pages[0];
        expect(firstPage.pageNumber).toBe(1);
        expect(typeof firstPage.markdown).toBe('string');
        expect(firstPage.markdown.length).toBeGreaterThan(0);
      }

      // Verify conversion summary
      expect(result.data?.conversionSummary).toBeDefined();
      expect(result.data?.conversionSummary.totalCharacters).toBeGreaterThan(0);

      // Verify AI analysis
      expect(result.data?.aiAnalysis).toBeDefined();
      expect(result.data?.aiAnalysis.model).toBe('google/gemini-2.5-flash');
      expect(result.data?.aiAnalysis.iterations).toBeGreaterThanOrEqual(0);

      console.log(
        `📝 Generated markdown (${result.data?.markdown.length} characters):`
      );

      // Check if the markdown contains expected tax form content
      const markdownLower = result.data?.markdown.toLowerCase() || '';
      const hasTaxContent =
        markdownLower.includes('form') ||
        markdownLower.includes('tax') ||
        markdownLower.includes('1040') ||
        markdownLower.includes('irs');

      if (hasTaxContent) {
        console.log('✅ Successfully extracted tax form content');
      } else {
        console.log(
          'ℹ️  Generated content may not contain expected tax form keywords'
        );
      }

      console.log('✅ PDF integration test passed successfully!');
    }, 180000); // 3 minute timeout for integration test

    it('should process image with realistic content from PDF conversion', async () => {
      // Skip this test if no Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.log(
          '⚠️  Skipping image integration test - no GOOGLE_API_KEY environment variable'
        );
        return;
      }

      console.log(
        '🚀 Running integration test by converting PDF to image first...'
      );

      // First, convert the PDF to an image to get realistic test data
      const pdfToImageWorkflow = new PDFFormOperationsWorkflow({
        operation: 'convert-to-images',
        pdfData: testPdfBase64,
        format: 'png',
        quality: 0.9,
        dpi: 200,
        pages: [1], // Only first page
      });

      const imageResult = await pdfToImageWorkflow.action();

      if (
        !imageResult.success ||
        !imageResult.data?.images ||
        imageResult.data.images.length === 0
      ) {
        console.log('⚠️  Could not convert PDF to image, skipping image test');
        return;
      }

      const imageData = imageResult.data.images[0].imageData;
      console.log(
        `📸 Converted PDF to image: ${Math.round(imageData.length / 1024)}KB base64`
      );

      // Now test the ParseDocument workflow with the real image data
      const parseWorkflow = new ParseDocumentWorkflow({
        documentData: imageData,
        documentType: 'image',
        conversionOptions: {
          preserveStructure: true,
          includeVisualDescriptions: true,
          extractNumericalData: true,
          combinePages: true,
        },
        aiOptions: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.2,
          maxTokens: 50000,
          jsonMode: false,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
        },
      });

      const startTime = Date.now();
      const result = await parseWorkflow.action();
      const executionTime = Date.now() - startTime;

      console.log(`⏱️  Image integration test completed in ${executionTime}ms`);

      // Verify the workflow completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBe('');

      // Verify basic structure
      expect(result.data?.markdown).toBeDefined();
      expect(typeof result.data?.markdown).toBe('string');
      expect(result.data?.markdown.length).toBeGreaterThan(0);

      // Verify metadata for image processing
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata.totalPages).toBe(1);
      expect(result.data?.metadata.processedPages).toBe(1);
      expect(result.data?.metadata.imageFormat).toBe('png');

      console.log('✅ Image integration test passed successfully!');
    }, 180000); // 3 minute timeout for integration test

    it('should process receipt image and extract structured data', async () => {
      // Skip this test if no Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.log(
          '⚠️  Skipping receipt integration test - no GOOGLE_API_KEY environment variable'
        );
        return;
      }

      console.log('🚀 Running integration test with receipt image...');

      const receiptWorkflow = new ParseDocumentWorkflow({
        documentData: receiptImageBase64,
        documentType: 'image',
        conversionOptions: {
          preserveStructure: true,
          includeVisualDescriptions: true,
          extractNumericalData: true,
          combinePages: true,
        },
        aiOptions: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.2,
          maxTokens: 50000,
          jsonMode: false,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
        },
      });

      const startTime = Date.now();
      const result = await receiptWorkflow.action();
      const executionTime = Date.now() - startTime;

      console.log(
        `⏱️  Receipt integration test completed in ${executionTime}ms`
      );
      console.log(result.data?.markdown);

      // Verify the workflow completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBe('');

      // Verify basic structure
      expect(result.data?.markdown).toBeDefined();
      expect(typeof result.data?.markdown).toBe('string');
      expect(result.data?.markdown.length).toBeGreaterThan(0);

      // Verify metadata for image processing
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata.totalPages).toBe(1);
      expect(result.data?.metadata.processedPages).toBe(1);
      expect(result.data?.metadata.imageFormat).toBe('png');

      // Verify pages array
      expect(result.data?.pages).toBeDefined();
      expect(Array.isArray(result.data?.pages)).toBe(true);
      expect(result.data?.pages.length).toBe(1);

      if (result.data?.pages && result.data.pages.length > 0) {
        const receiptPage = result.data.pages[0];
        expect(receiptPage.pageNumber).toBe(1);
        expect(typeof receiptPage.markdown).toBe('string');
        expect(receiptPage.markdown.length).toBeGreaterThan(0);
      }

      // Verify conversion summary
      expect(result.data?.conversionSummary).toBeDefined();
      expect(result.data?.conversionSummary.totalCharacters).toBeGreaterThan(0);

      console.log(
        `📝 Generated receipt markdown (${result.data?.markdown.length} characters):`
      );

      // Check if the markdown contains expected receipt content
      const markdownLower = result.data?.markdown.toLowerCase() || '';
      const hasReceiptContent =
        markdownLower.includes('receipt') ||
        markdownLower.includes('total') ||
        markdownLower.includes('$') ||
        markdownLower.includes('amount') ||
        markdownLower.includes('date') ||
        markdownLower.includes('store') ||
        markdownLower.includes('shop');

      if (hasReceiptContent) {
        console.log(
          '✅ Successfully extracted receipt content with expected elements'
        );
      } else {
        console.log(
          'ℹ️  Generated content may not contain expected receipt keywords'
        );
      }

      console.log('✅ Receipt image integration test passed successfully!');
    }, 180000); // 3 minute timeout for integration test
  });
});
