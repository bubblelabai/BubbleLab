import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import '../../../manual-tests/setup.js';
import { PDFOcrWorkflow } from './pdf-ocr.workflow.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { describe, it, expect, beforeAll } from 'vitest';

describe('PDFOcrWorkflow', () => {
  let testPdfBase64: string;

  beforeAll(() => {
    // Load the actual 1040 tax form PDF
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
        `✅ Loaded 1040 tax form PDF: ${Math.round(pdfBuffer.length / 1024)}KB`
      );
    } catch {
      console.warn(
        '⚠️  Could not load 1040-tax.pdf, using minimal PDF for testing'
      );
      // Fallback to minimal PDF for testing
      testPdfBase64 =
        'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDUgMDAwMDAgbiAKMDAwMDAwMDMyMiAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQxNQolJUVPRg==';
    }
  });

  describe('Schema Validation', () => {
    it('should validate valid identify mode parameters', () => {
      const validParams = {
        mode: 'identify' as const,
        pdfData: testPdfBase64,
        discoveryOptions: {
          targetPage: 1,
        },
        imageOptions: {
          format: 'png' as const,
          quality: 0.8,
          dpi: 150,
        },
        aiOptions: {
          model: 'google/gemini-2.5-flash' as const,
          temperature: 0.3,
          maxTokens: 50000,
          jsonMode: true,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
        },
      };

      expect(() => {
        new PDFOcrWorkflow(validParams);
      }).not.toThrow();
    });

    it('should validate valid autofill mode parameters', () => {
      const validParams = {
        mode: 'autofill' as const,
        pdfData: testPdfBase64,
        clientInformation:
          'John Doe, 123 Main St, Springfield, IL, SSN: 123-45-6789',
        discoveryOptions: {
          targetPage: 1,
        },
        imageOptions: {
          format: 'png' as const,
          quality: 0.8,
          dpi: 150,
        },
        aiOptions: {
          model: 'google/gemini-2.5-flash' as const,
          temperature: 0.3,
          maxTokens: 50000,
          jsonMode: true,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
        },
      };

      expect(() => {
        new PDFOcrWorkflow(validParams);
      }).not.toThrow();
    });

    it('should require mode parameter', () => {
      expect(() => {
        PDFOcrWorkflow.schema.parse({
          pdfData: testPdfBase64,
        });
      }).toThrow();
    });

    it('should require clientInformation for autofill mode', () => {
      expect(() => {
        PDFOcrWorkflow.schema.parse({
          mode: 'autofill',
          pdfData: testPdfBase64,
        });
      }).toThrow();
    });

    it('should not require clientInformation for identify mode', () => {
      expect(() => {
        PDFOcrWorkflow.schema.parse({
          mode: 'identify',
          pdfData: testPdfBase64,
        });
      }).not.toThrow();
    });
  });

  describe('Static Properties', () => {
    it('should have correct static metadata', () => {
      expect(PDFOcrWorkflow.type).toBe('workflow');
      expect(PDFOcrWorkflow.bubbleName).toBe('pdf-ocr-workflow');
      expect(PDFOcrWorkflow.alias).toBe('pdf-ocr');
      expect(PDFOcrWorkflow.shortDescription).toContain('PDF OCR workflow');
      expect(PDFOcrWorkflow.longDescription).toContain(
        'Comprehensive PDF OCR workflow'
      );
    });

    it('should have proper schema definitions', () => {
      expect(PDFOcrWorkflow.schema).toBeDefined();
      expect(PDFOcrWorkflow.resultSchema).toBeDefined();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate image options', () => {
      const validImageOptions = {
        format: 'png' as const,
        quality: 0.8,
        dpi: 150,
        pages: [1, 2, 3],
      };

      expect(() => {
        new PDFOcrWorkflow({
          mode: 'identify',
          pdfData: testPdfBase64,
          imageOptions: validImageOptions,
        });
      }).not.toThrow();
    });

    it('should validate AI options', () => {
      const validAiOptions = {
        model: 'google/gemini-2.5-flash' as const,
        temperature: 0.5,
        maxTokens: 25000,
        jsonMode: false,
      };

      expect(() => {
        new PDFOcrWorkflow({
          mode: 'identify',
          pdfData: testPdfBase64,
          aiOptions: validAiOptions,
        });
      }).not.toThrow();
    });

    it('should reject invalid model names', () => {
      expect(() => {
        PDFOcrWorkflow.schema.parse({
          mode: 'identify',
          pdfData: testPdfBase64,
          aiOptions: {
            model: 'invalid-model',
            temperature: 0.3,
            maxTokens: 50000,
            jsonMode: true,
          },
        });
      }).toThrow();
    });

    it('should validate temperature range', () => {
      expect(() => {
        PDFOcrWorkflow.schema.parse({
          mode: 'identify',
          pdfData: testPdfBase64,
          aiOptions: {
            model: 'google/gemini-2.5-flash',
            temperature: 3.0, // Invalid: > 2.0
            maxTokens: 50000,
            jsonMode: true,
          },
        });
      }).toThrow();
    });

    it('should validate DPI range', () => {
      expect(() => {
        PDFOcrWorkflow.schema.parse({
          mode: 'identify',
          pdfData: testPdfBase64,
          imageOptions: {
            format: 'png',
            quality: 0.8,
            dpi: 50, // Invalid: < 72
          },
        });
      }).toThrow();
    });
  });

  describe('Result Schema', () => {
    it('should validate successful identify mode result structure', () => {
      const successResult = {
        mode: 'identify' as const,
        extractedFields: [
          {
            id: 1,
            fieldName: 'firstName',
            confidence: 0.95,
          },
        ],
        discoveryData: {
          totalFields: 10,
          fieldsWithCoordinates: 8,
          pages: [1, 2],
        },
        imageData: {
          totalPages: 2,
          convertedPages: 2,
          format: 'png',
          dpi: 150,
        },
        aiAnalysis: {
          model: 'google/gemini-2.5-flash',
          iterations: 3,
          processingTime: 5000,
        },
        success: true,
        error: '',
      };

      expect(() => {
        PDFOcrWorkflow.resultSchema.parse(successResult);
      }).not.toThrow();
    });

    it('should validate successful autofill mode result structure', () => {
      const successResult = {
        mode: 'autofill' as const,
        extractedFields: [
          {
            id: 1,
            fieldName: 'firstName',
            value: 'John',
            confidence: 0.95,
          },
        ],
        filledPdfData: 'base64-pdf-data',
        discoveryData: {
          totalFields: 10,
          fieldsWithCoordinates: 8,
          pages: [1, 2],
        },
        imageData: {
          totalPages: 2,
          convertedPages: 2,
          format: 'png',
          dpi: 150,
        },
        aiAnalysis: {
          model: 'google/gemini-2.5-flash',
          iterations: 3,
          processingTime: 5000,
        },
        fillResults: {
          filledFields: 5,
          successfullyFilled: 4,
        },
        success: true,
        error: '',
      };

      expect(() => {
        PDFOcrWorkflow.resultSchema.parse(successResult);
      }).not.toThrow();
    });

    it('should validate error result structure for identify mode', () => {
      const errorResult = {
        mode: 'identify' as const,
        extractedFields: [],
        discoveryData: {
          totalFields: 0,
          fieldsWithCoordinates: 0,
          pages: [],
        },
        imageData: {
          totalPages: 0,
          convertedPages: 0,
          format: 'png',
          dpi: 150,
        },
        aiAnalysis: {
          model: 'google/gemini-2.5-flash',
          iterations: 0,
          processingTime: 1000,
        },
        success: false,
        error: 'PDF processing failed',
      };

      expect(() => {
        PDFOcrWorkflow.resultSchema.parse(errorResult);
      }).not.toThrow();
    });

    it('should validate error result structure for autofill mode', () => {
      const errorResult = {
        mode: 'autofill' as const,
        extractedFields: [],
        filledPdfData: '',
        discoveryData: {
          totalFields: 0,
          fieldsWithCoordinates: 0,
          pages: [],
        },
        imageData: {
          totalPages: 0,
          convertedPages: 0,
          format: 'png',
          dpi: 150,
        },
        aiAnalysis: {
          model: 'google/gemini-2.5-flash',
          iterations: 0,
          processingTime: 1000,
        },
        fillResults: {
          filledFields: 0,
          successfullyFilled: 0,
        },
        success: false,
        error: 'PDF processing failed',
      };

      expect(() => {
        PDFOcrWorkflow.resultSchema.parse(errorResult);
      }).not.toThrow();
    });
  });

  describe('Integration Points', () => {
    it('should be compatible with BubbleFactory registration', () => {
      // Test that the class has all required properties for BubbleFactory
      expect(PDFOcrWorkflow.type).toBe('workflow');
      expect(typeof PDFOcrWorkflow.bubbleName).toBe('string');
      expect(PDFOcrWorkflow.schema).toBeDefined();
      expect(PDFOcrWorkflow.resultSchema).toBeDefined();
      expect(typeof PDFOcrWorkflow.shortDescription).toBe('string');
      expect(typeof PDFOcrWorkflow.longDescription).toBe('string');
      expect(typeof PDFOcrWorkflow.alias).toBe('string');
    });

    it('should accept proper credential types', () => {
      const validCredentials = {
        [CredentialType.GOOGLE_GEMINI_CRED]: 'google-api-key',
        [CredentialType.OPENAI_CRED]: 'openai-api-key',
      };

      expect(() => {
        new PDFOcrWorkflow({
          mode: 'identify',
          pdfData: testPdfBase64,
          credentials: validCredentials,
        });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid base64 PDF data', async () => {
      const workflowWithInvalidPdf = new PDFOcrWorkflow({
        mode: 'identify',
        pdfData: 'invalid-base64-data',
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
        },
      });

      const result = await workflowWithInvalidPdf.action();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Workflow Steps Integration', () => {
    it('should properly configure PDF form operations workflow', () => {
      expect(() => {
        // Test that we can create the workflow without throwing
        new PDFOcrWorkflow({
          mode: 'identify',
          pdfData: testPdfBase64,
          discoveryOptions: { targetPage: 1 },
        });
      }).not.toThrow();
    });

    it('should properly configure AI agent workflow', () => {
      expect(() => {
        new PDFOcrWorkflow({
          mode: 'identify',
          pdfData: testPdfBase64,
          aiOptions: {
            model: 'google/gemini-2.5-flash',
            temperature: 0.1,
            maxTokens: 10000,
            jsonMode: true,
          },
        });
      }).not.toThrow();
    });
  });

  describe('Full Integration Test with 1040 Tax Form', () => {
    it('should process the 1040 tax form and extract fields (identify mode)', async () => {
      // Skip this test if no Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.log(
          '⚠️  Skipping integration test - no GOOGLE_API_KEY environment variable'
        );
        return;
      }

      console.log('🚀 Running full integration test with 1040 tax form...');

      const integrationWorkflow = new PDFOcrWorkflow({
        pdfData: testPdfBase64,
        mode: 'identify' as const,
        aiOptions: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.3, // Low temperature for consistent extraction
          maxTokens: 50000,
          jsonMode: true,
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

      // The result is now automatically type-safe without casting!
      expect(result.data?.mode).toBe('identify');

      // Access type-safe properties directly
      const identifyResult = result.data;

      // Verify discovery data
      expect(identifyResult?.discoveryData).toBeDefined();
      expect(identifyResult?.discoveryData.totalFields).toBeGreaterThanOrEqual(
        0
      );
      expect(identifyResult?.discoveryData.pages).toBeInstanceOf(Array);

      // Verify image data
      expect(identifyResult?.imageData).toBeDefined();
      expect(identifyResult?.imageData.convertedPages).toBeGreaterThan(0);
      expect(identifyResult?.imageData.format).toBe('png');
      expect(identifyResult?.imageData.dpi).toBe(150);

      // Verify AI analysis
      expect(identifyResult?.aiAnalysis).toBeDefined();
      expect(identifyResult?.aiAnalysis.model).toBe('google/gemini-2.5-flash');
      expect(identifyResult?.aiAnalysis.iterations).toBeGreaterThanOrEqual(0);

      // Verify extracted fields (should have some fields from 1040 form)
      expect(identifyResult?.extractedFields).toBeInstanceOf(Array);

      if (
        identifyResult?.extractedFields &&
        identifyResult.extractedFields.length > 0
      ) {
        console.log(
          `📝 Successfully extracted ${identifyResult.extractedFields.length} fields`
        );

        // Verify field structure
        const firstField = identifyResult.extractedFields[0];
        expect(typeof firstField.id).toBe('number');
        expect(typeof firstField.fieldName).toBe('string');
        expect(typeof firstField.confidence).toBe('number');
        expect(firstField.confidence).toBeGreaterThanOrEqual(0);
        expect(firstField.confidence).toBeLessThanOrEqual(1);

        // Identify mode should NOT have value field (type-safe check)
        expect(firstField).not.toHaveProperty('value');

        // TypeScript now knows this is an IdentifyFieldResult, so this would cause a compile error:
        // const value = firstField.value; // Property 'value' does not exist on type 'IdentifyFieldResult'

        // Log some sample extracted fields for verification
        const sampleFields = identifyResult.extractedFields.slice(0, 5);
        console.log('📋 Sample extracted fields:');
        sampleFields.forEach((field) => {
          console.log(
            `  ${field.id}: ${field.fieldName} (${(field.confidence * 100).toFixed(1)}% confidence)`
          );
        });

        // Check for expected 1040 form fields (common field names)
        const fieldNames = identifyResult.extractedFields.map((f) =>
          f.fieldName.toLowerCase()
        );
        const hasCommonTaxFields = fieldNames.some(
          (name) =>
            name.includes('name') ||
            name.includes('ssn') ||
            name.includes('address') ||
            name.includes('income') ||
            name.includes('tax')
        );

        if (hasCommonTaxFields) {
          console.log(
            '✅ Found common tax form fields - extraction working correctly'
          );
        } else {
          console.log(
            'ℹ️  No common tax form fields detected - this may be expected depending on the PDF content'
          );
        }
      } else {
        console.log(
          'ℹ️  No fields extracted - this could indicate an issue with the PDF or AI analysis'
        );
      }

      console.log('✅ Full integration test passed successfully!');
    }, 500000); // 5 minute timeout for integration test

    it('should process the 1040 tax form and autofill with client information', async () => {
      // Skip this test if no Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.log(
          '⚠️  Skipping autofill integration test - no GOOGLE_API_KEY environment variable'
        );
        return;
      }

      console.log('🚀 Running autofill integration test with 1040 tax form...');

      // Believable tax information for John and Jane Doe
      const clientInformation = `
Taxpayer Information:
- Primary Taxpayer: John Andrew Doe
- Social Security Number: 123-45-6789
- Spouse: Jane Marie Doe
- Spouse SSN: 987-65-4321
- Filing Status: Married Filing Jointly
- Address: 1425 Maple Street, Springfield, IL 62701
- Phone: (217) 555-0123
- Occupation: Software Engineer
- Spouse Occupation: Teacher

Income Information:
- W-2 Wages (John): $85,000
- W-2 Wages (Jane): $45,000
- Federal Tax Withheld (John): $12,750
- Federal Tax Withheld (Jane): $6,750
- Interest Income: $125
- Dividend Income: $45

Dependents:
- Child 1: Emma Rose Doe, SSN: 111-22-3333, DOB: 03/15/2015
- Child 2: Michael James Doe, SSN: 444-55-6666, DOB: 08/22/2018

Deductions:
- Mortgage Interest: $8,500
- State and Local Taxes: $5,000
- Charitable Contributions: $2,500
- Medical Expenses: $3,200

Bank Account for Refund:
- Routing Number: 123456789
- Account Number: 987654321
- Account Type: Checking
      `;

      const autofillWorkflow = new PDFOcrWorkflow({
        mode: 'autofill' as const,
        pdfData: testPdfBase64,
        clientInformation,
        aiOptions: {
          model: 'google/gemini-2.5-pro',
          temperature: 0.2, // Lower temperature for more consistent field mapping
          maxTokens: 50000,
          jsonMode: true,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
        },
      });

      const startTime = Date.now();
      const result = await autofillWorkflow.action();
      const executionTime = Date.now() - startTime;

      console.log(
        `⏱️  Autofill integration test completed in ${executionTime}ms`
      );

      // Verify the workflow completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBe('');

      // The result is now automatically type-safe without casting!
      expect(result.data?.mode).toBe('autofill');

      // Access type-safe properties directly
      const autofillResult = result.data;

      // Verify discovery data
      expect(autofillResult?.discoveryData).toBeDefined();
      expect(autofillResult?.discoveryData.totalFields).toBeGreaterThanOrEqual(
        0
      );
      expect(autofillResult?.discoveryData.pages).toBeInstanceOf(Array);

      // Verify image data
      expect(autofillResult?.imageData).toBeDefined();
      expect(autofillResult?.imageData.convertedPages).toBeGreaterThan(0);
      expect(autofillResult?.imageData.format).toBe('png');
      expect(autofillResult?.imageData.dpi).toBe(150);

      // Verify AI analysis
      expect(autofillResult?.aiAnalysis).toBeDefined();
      expect(autofillResult?.aiAnalysis.model).toBe('google/gemini-2.5-pro');
      expect(autofillResult?.aiAnalysis.iterations).toBeGreaterThanOrEqual(0);

      // Verify autofill-specific results - type-safe access
      expect(autofillResult?.fillResults).toBeDefined();
      expect(autofillResult?.fillResults.filledFields).toBeGreaterThanOrEqual(
        0
      );
      expect(
        autofillResult?.fillResults.successfullyFilled
      ).toBeGreaterThanOrEqual(0);
      expect(autofillResult?.filledPdfData).toBeDefined();
      expect(typeof autofillResult?.filledPdfData).toBe('string');
      expect(autofillResult?.filledPdfData.length).toBeGreaterThan(0);

      // Save the filled PDF locally to see the results
      if (autofillResult?.filledPdfData) {
        const outputDir = path.join(__dirname, '..', '..', '..', 'output');

        // Create output directory if it doesn't exist
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `1040-tax-filled-${timestamp}.pdf`;
        const outputPath = path.join(outputDir, filename);

        // Convert base64 to buffer and save
        const pdfBuffer = Buffer.from(autofillResult.filledPdfData, 'base64');
        writeFileSync(outputPath, pdfBuffer);

        console.log(`💾 Filled PDF saved to: ${outputPath}`);
        console.log(`📁 File size: ${Math.round(pdfBuffer.length / 1024)}KB`);

        // Verify file was actually saved
        expect(existsSync(outputPath)).toBe(true);
      }

      // Verify extracted fields with values
      expect(autofillResult?.extractedFields).toBeInstanceOf(Array);

      if (
        autofillResult?.extractedFields &&
        autofillResult.extractedFields.length > 0
      ) {
        console.log(
          `📝 Successfully extracted ${autofillResult.extractedFields.length} fields for autofill`
        );
        console.log(
          'autofill result',
          JSON.stringify(autofillResult.extractedFields, null, 2)
        );

        // Verify autofill field structure
        const firstField = autofillResult.extractedFields[0];
        expect(typeof firstField.id).toBe('number');
        expect(typeof firstField.fieldName).toBe('string');
        expect(typeof firstField.confidence).toBe('number');
        expect(firstField.confidence).toBeGreaterThanOrEqual(0);
        expect(firstField.confidence).toBeLessThanOrEqual(1);

        // Autofill mode should have value field - now type-safe!
        expect(firstField).toHaveProperty('value');
        expect(typeof firstField.value).toBe('string');

        // TypeScript now knows this is an AutofillFieldResult, so we can access .value safely:
        console.log(`📝 First field value: "${firstField.value}"`); // This works without casting!

        // Count fields that were actually filled with values
        const fieldsWithValues = autofillResult.extractedFields.filter(
          (field) => field.value && field.value.trim().length > 0
        );

        console.log(
          `💰 ${fieldsWithValues.length} fields have values from client information`
        );

        // Log some sample fields with values
        const sampleFieldsWithValues = fieldsWithValues.slice(0, 5);
        console.log('📋 Sample autofilled fields:');
        sampleFieldsWithValues.forEach((field) => {
          console.log(
            `  ${field.id}: ${field.fieldName} = "${field.value}" (${(field.confidence * 100).toFixed(1)}% confidence)`
          );
        });

        // Check for expected tax-related values
        const fieldValues = fieldsWithValues.map((f) => f.value.toLowerCase());
        const hasExpectedTaxValues = fieldValues.some(
          (value) =>
            value.includes('john') ||
            value.includes('doe') ||
            value.includes('85000') ||
            value.includes('45000') ||
            value.includes('springfield') ||
            value.includes('123-45-6789')
        );

        if (hasExpectedTaxValues) {
          console.log(
            '✅ Found expected client data in autofilled fields - autofill working correctly'
          );
        } else if (fieldsWithValues.length > 0) {
          console.log(
            'ℹ️  Fields were filled but may not match expected client data - this could be normal depending on form fields'
          );
        } else {
          console.log(
            'ℹ️  No fields were filled with client data - form may not have fillable fields or AI may need adjustment'
          );
        }

        // Now we can safely access autofill-specific properties
        console.log(
          `📊 Fill Results: ${autofillResult.fillResults.successfullyFilled}/${autofillResult.fillResults.filledFields} fields successfully filled`
        );
      } else {
        console.log(
          'ℹ️  No fields extracted - this could indicate an issue with the PDF or AI analysis'
        );
      }

      console.log('✅ Autofill integration test passed successfully!');
    }, 500000); // 5 minute timeout for integration test
  });
});
