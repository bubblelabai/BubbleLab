import '../../../manual-tests/setup.js';
import { GenerateDocumentWorkflow } from './generate-document.workflow.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { describe, it, expect, beforeAll } from 'vitest';

describe('GenerateDocumentWorkflow', () => {
  let sampleExpenseDocuments: string[];
  let sampleInvoiceDocuments: string[];

  beforeAll(() => {
    // Sample expense documents in markdown format
    sampleExpenseDocuments = [
      `# Expense Report - January 2024

## Business Meals
- **Date**: 2024-01-15
- **Vendor**: Starbucks Downtown
- **Amount**: $12.50
- **Category**: Meals & Entertainment
- **Description**: Client meeting with John Smith

## Office Supplies
- **Date**: 2024-01-18
- **Vendor**: Office Depot
- **Amount**: $45.99
- **Category**: Office Supplies
- **Description**: Printer paper and pens

## Travel Expenses
- **Date**: 2024-01-20
- **Vendor**: Uber
- **Amount**: $28.75
- **Category**: Transportation
- **Description**: Airport pickup for conference`,

      `# February Expenses

**Restaurant Receipt**
Date: Feb 3, 2024
Location: The Grill House
Total: $67.89
Category: Business Dinner
Notes: Quarterly review meeting with team

**Gas Station**
- Date: February 8, 2024
- Shell Gas Station
- Amount: $52.30
- Type: Fuel for company vehicle

**Hotel Stay**
Date Range: Feb 12-14, 2024
Hotel: Marriott Downtown
Total Cost: $389.97
Purpose: Business conference attendance`,
    ];

    // Sample invoice documents
    sampleInvoiceDocuments = [
      `# Invoice #INV-2024-001

**From:** TechCorp Solutions  
**To:** Client ABC Inc.  
**Date:** January 15, 2024  
**Due Date:** February 15, 2024  

## Services Rendered
- Web Development Services: $2,500.00
- UI/UX Design: $1,200.00
- Project Management: $800.00

**Subtotal:** $4,500.00  
**Tax (8.5%):** $382.50  
**Total:** $4,882.50`,

      `# Monthly Service Invoice

**Invoice Number:** SRV-2024-0234  
**Client:** XYZ Corporation  
**Billing Period:** February 1-28, 2024  

### Line Items:
1. **Consulting Hours**
   - Rate: $150/hour
   - Hours: 40
   - Total: $6,000.00

2. **Software License**
   - Monthly subscription
   - Amount: $299.99

3. **Support Services**
   - Priority support package
   - Cost: $199.00

**Net Amount:** $6,498.99  
**Sales Tax:** $519.92  
**Final Total:** $7,018.91`,
    ];
  });

  describe('Schema Validation', () => {
    it('should validate valid expense tracking parameters', () => {
      const validParams = {
        documents: sampleExpenseDocuments,
        outputDescription:
          'expense tracking with vendor, amount, date, category, and description',
        outputFormat: 'html' as const,
        aiOptions: {
          model: 'google/gemini-2.5-flash' as const,
          temperature: 0.1,
          maxTokens: 50000,
          jsonMode: true,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
        },
      };

      expect(() => {
        new GenerateDocumentWorkflow(validParams);
      }).not.toThrow();
    });

    it('should validate valid invoice processing parameters', () => {
      const validParams = {
        documents: sampleInvoiceDocuments,
        outputDescription:
          'invoice tracking with invoice number, client, date, amount, and services',
        outputFormat: 'csv' as const,
        aiOptions: {
          model: 'google/gemini-2.5-flash' as const,
          temperature: 0.05,
          maxTokens: 30000,
          jsonMode: true,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
        },
      };

      expect(() => {
        new GenerateDocumentWorkflow(validParams);
      }).not.toThrow();
    });

    it('should require at least one document', () => {
      expect(() => {
        GenerateDocumentWorkflow.schema.parse({
          documents: [],
          outputDescription: 'expense tracking',
          outputFormat: 'html',
        });
      }).toThrow();
    });

    it('should require a meaningful output description', () => {
      expect(() => {
        GenerateDocumentWorkflow.schema.parse({
          documents: ['# Test'],
          outputDescription: 'short',
          outputFormat: 'html',
        });
      }).toThrow();
    });

    it('should validate output format options', () => {
      expect(() => {
        GenerateDocumentWorkflow.schema.parse({
          documents: ['# Test'],
          outputDescription: 'valid description here',
          outputFormat: 'invalid-format',
        });
      }).toThrow();
    });

    it('should have default values for optional parameters', () => {
      const result = GenerateDocumentWorkflow.schema.parse({
        documents: ['# Test Document'],
        outputDescription: 'test data extraction',
      });

      expect(result.outputFormat).toBe('html');
      expect(result.aiOptions.model).toBe('google/gemini-2.5-flash');
      expect(result.aiOptions.temperature).toBe(0.1);
      expect(result.aiOptions.jsonMode).toBe(true);
    });
  });

  describe('Static Properties', () => {
    it('should have correct static metadata', () => {
      expect(GenerateDocumentWorkflow.type).toBe('workflow');
      expect(GenerateDocumentWorkflow.bubbleName).toBe(
        'generate-document-workflow'
      );
      expect(GenerateDocumentWorkflow.alias).toBe('generate-doc');
      expect(GenerateDocumentWorkflow.shortDescription).toContain(
        'Generate Document'
      );
      expect(GenerateDocumentWorkflow.longDescription).toContain('markdown');
    });

    it('should have proper schema definitions', () => {
      expect(GenerateDocumentWorkflow.schema).toBeDefined();
      expect(GenerateDocumentWorkflow.resultSchema).toBeDefined();
    });
  });

  describe('Result Schema', () => {
    it('should validate successful result structure', () => {
      const successResult = {
        columns: [
          {
            name: 'vendor',
            type: 'string',
            description: 'Vendor or company name',
          },
          {
            name: 'amount',
            type: 'number',
            description: 'Expense amount in dollars',
          },
          {
            name: 'date',
            type: 'date',
            description: 'Transaction date',
          },
          {
            name: 'category',
            type: 'string',
            description: 'Expense category',
          },
        ],
        rows: [
          {
            vendor: 'Starbucks Downtown',
            amount: 12.5,
            date: '2024-01-15',
            category: 'Meals & Entertainment',
          },
          {
            vendor: 'Office Depot',
            amount: 45.99,
            date: '2024-01-18',
            category: 'Office Supplies',
          },
        ],
        metadata: {
          totalDocuments: 2,
          totalRows: 2,
          totalColumns: 4,
          processingTime: 5000,
          extractedFrom: ['Document 1', 'Document 2'],
        },
        generatedFiles: {
          html: '<table>...</table>',
          csv: 'vendor,amount,date,category\nStarbucks,12.50,2024-01-15,Meals',
          json: '{"columns":[],"rows":[]}',
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
        GenerateDocumentWorkflow.resultSchema.parse(successResult);
      }).not.toThrow();
    });

    it('should validate error result structure', () => {
      const errorResult = {
        columns: [],
        rows: [],
        metadata: {
          totalDocuments: 1,
          totalRows: 0,
          totalColumns: 0,
          processingTime: 1000,
          extractedFrom: [],
        },
        generatedFiles: {},
        aiAnalysis: {
          model: 'google/gemini-2.5-flash',
          iterations: 0,
          processingTime: 500,
        },
        success: false,
        error: 'Document processing failed',
      };

      expect(() => {
        GenerateDocumentWorkflow.resultSchema.parse(errorResult);
      }).not.toThrow();
    });
  });

  describe('Integration Points', () => {
    it('should be compatible with BubbleFactory registration', () => {
      expect(GenerateDocumentWorkflow.type).toBe('workflow');
      expect(typeof GenerateDocumentWorkflow.bubbleName).toBe('string');
      expect(GenerateDocumentWorkflow.schema).toBeDefined();
      expect(GenerateDocumentWorkflow.resultSchema).toBeDefined();
      expect(typeof GenerateDocumentWorkflow.shortDescription).toBe('string');
      expect(typeof GenerateDocumentWorkflow.longDescription).toBe('string');
      expect(typeof GenerateDocumentWorkflow.alias).toBe('string');
    });

    it('should accept proper credential types', () => {
      const validCredentials = {
        [CredentialType.GOOGLE_GEMINI_CRED]: 'google-api-key',
        [CredentialType.OPENAI_CRED]: 'openai-api-key',
      };

      expect(() => {
        new GenerateDocumentWorkflow({
          documents: sampleExpenseDocuments,
          outputDescription: 'expense tracking',
          credentials: validCredentials,
        });
      }).not.toThrow();
    });
  });

  describe('Full Integration Test with Expense Data', () => {
    it('should process expense documents and generate structured data', async () => {
      // Skip this test if no Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.log(
          '⚠️  Skipping integration test - no GOOGLE_API_KEY environment variable'
        );
        return;
      }

      console.log('🚀 Running full integration test with expense documents...');

      const integrationWorkflow = new GenerateDocumentWorkflow({
        documents: sampleExpenseDocuments,
        outputDescription:
          'expense tracking with vendor name, amount, date, category, and description fields for business expense management',
        outputFormat: 'html',
        aiOptions: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.1,
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

      // Verify metadata
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata.totalDocuments).toBe(2);
      expect(result.data?.metadata.totalRows).toBeGreaterThan(0);
      expect(result.data?.metadata.totalColumns).toBeGreaterThan(0);

      // Verify columns were extracted
      expect(result.data?.columns).toBeDefined();
      expect(Array.isArray(result.data?.columns)).toBe(true);
      expect(result.data?.columns.length).toBeGreaterThan(0);

      console.log(
        `📝 Successfully extracted ${result.data?.columns.length} columns:`
      );
      result.data?.columns.forEach((col) => {
        console.log(`  - ${col.name} (${col.type}): ${col.description}`);
      });

      // Verify rows were extracted
      expect(result.data?.rows).toBeDefined();
      expect(Array.isArray(result.data?.rows)).toBe(true);
      expect(result.data?.rows.length).toBeGreaterThan(0);

      console.log(
        `📊 Successfully extracted ${result.data?.rows.length} data rows`
      );

      // Verify generated files
      expect(result.data?.generatedFiles).toBeDefined();
      expect(result.data?.generatedFiles.html).toBeDefined();
      expect(result.data?.generatedFiles.json).toBeDefined();

      // Check that HTML contains expected structure
      expect(result.data?.generatedFiles.html).toContain('<table>');
      expect(result.data?.generatedFiles.html).toContain('<thead>');
      expect(result.data?.generatedFiles.html).toContain('<tbody>');

      // Verify AI analysis
      expect(result.data?.aiAnalysis).toBeDefined();
      expect(result.data?.aiAnalysis.model).toBe('google/gemini-2.5-flash');
      expect(result.data?.aiAnalysis.iterations).toBeGreaterThanOrEqual(0);

      console.log('✅ Full integration test passed successfully!');
    }, 120000); // 2 minute timeout for integration test

    it('should process invoice documents and generate CSV output', async () => {
      // Skip this test if no Google API key is available
      if (!process.env.GOOGLE_API_KEY) {
        console.log(
          '⚠️  Skipping CSV integration test - no GOOGLE_API_KEY environment variable'
        );
        return;
      }

      console.log('🚀 Running CSV integration test with invoice documents...');

      const csvWorkflow = new GenerateDocumentWorkflow({
        documents: sampleInvoiceDocuments,
        outputDescription:
          'invoice management with invoice number, client name, date, total amount, and service description',
        outputFormat: 'csv',
        aiOptions: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.05,
          maxTokens: 30000,
          jsonMode: true,
        },
        credentials: {
          [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
        },
      });

      const result = await csvWorkflow.action();

      // Verify the workflow completed successfully
      expect(result.success).toBe(true);
      expect(result.error).toBe('');

      // Verify CSV was generated
      expect(result.data?.generatedFiles.csv).toBeDefined();
      expect(result.data?.generatedFiles.csv!.length).toBeGreaterThan(0);

      // Check CSV structure
      const csvLines = result.data?.generatedFiles.csv!.split('\n');
      expect(csvLines?.length).toBeGreaterThan(1); // Header + at least one data row

      console.log('📄 Generated CSV output:');
      console.log(result.data?.generatedFiles.csv);

      console.log('✅ CSV integration test passed successfully!');
    }, 120000); // 2 minute timeout for integration test
  });
});
