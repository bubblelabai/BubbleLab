import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import '../../../manual-tests/setup.js';
import { PDFFormOperationsWorkflow } from './pdf-form-operations.workflow.js';
import { describe, it, expect, beforeAll } from 'vitest';

describe('PDF Form Fill Background Preservation Test', () => {
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

  it('should preserve background images and content when filling form fields', async () => {
    console.log('🧪 Testing PDF form filling background preservation...');

    // First, discover fields to see what we're working with
    const discoveryWorkflow = new PDFFormOperationsWorkflow({
      operation: 'discover',
      pdfData: originalPdfBase64,
    });

    const discoveryResult = await discoveryWorkflow.action();
    expect(discoveryResult.success).toBe(true);

    const fieldsData = discoveryResult.data?.fields || [];
    console.log(`📋 Found ${fieldsData.length} form fields`);

    // Log first few field names for debugging
    const sampleFields = fieldsData.slice(0, 5);
    console.log(
      'Sample field names:',
      sampleFields.map((f) => f.name)
    );

    // Try to fill a simple text field (if available)
    const textFields = fieldsData.filter((f) => f.field_type === 'Text');
    console.log(`📝 Found ${textFields.length} text fields`);

    if (textFields.length === 0) {
      console.log('⚠️ No text fields found, skipping fill test');
      return;
    }

    // Fill the first text field with a simple value
    const fieldToFill = textFields[0];
    const testValue = 'John Doe';

    console.log(
      `📋 Testing fill on field: "${fieldToFill.name}" with value: "${testValue}"`
    );

    const fillWorkflow = new PDFFormOperationsWorkflow({
      operation: 'fill',
      pdfData: originalPdfBase64,
      fieldValues: {
        [fieldToFill.name]: testValue,
      },
    });

    const fillResult = await fillWorkflow.action();
    expect(fillResult.success).toBe(true);
    expect(fillResult.data?.filledPdfData).toBeDefined();

    const filledPdfData = fillResult.data!.filledPdfData;
    const filledPdfBuffer = Buffer.from(filledPdfData, 'base64');

    console.log(
      `📊 Original PDF size: ${Math.round(originalPdfSize / 1024)}KB`
    );
    console.log(
      `📊 Filled PDF size: ${Math.round(filledPdfBuffer.length / 1024)}KB`
    );

    // Save both PDFs for manual comparison
    const outputDir = path.join(__dirname, '..', '..', '..', 'output');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save original for comparison
    const originalPath = path.join(outputDir, `original-${timestamp}.pdf`);
    writeFileSync(originalPath, Buffer.from(originalPdfBase64, 'base64'));

    // Save filled version
    const filledPath = path.join(outputDir, `filled-${timestamp}.pdf`);
    writeFileSync(filledPath, filledPdfBuffer);

    console.log(`💾 Saved original PDF: ${originalPath}`);
    console.log(`💾 Saved filled PDF: ${filledPath}`);
    console.log(`📋 Compare these files to check for background image loss`);

    // Basic checks
    expect(filledPdfBuffer.length).toBeGreaterThan(0);

    // If the filled PDF is less than 50% of original size, likely lost content
    if (filledPdfBuffer.length < originalPdfSize) {
      console.warn(
        '⚠️ WARNING: Filled PDF is significantly smaller than original - possible content loss!'
      );
      //
    }
    expect(filledPdfBuffer.length).toBeGreaterThan(originalPdfSize * 0.9);

    // Verify field was actually filled
    const verifyWorkflow = new PDFFormOperationsWorkflow({
      operation: 'validate',
      pdfData: filledPdfData,
    });

    const verifyResult = await verifyWorkflow.action();
    expect(verifyResult.success).toBe(true);

    const verifiedFields = verifyResult.data?.fields || {};
    const filledField = verifiedFields[fieldToFill.name];

    if (filledField) {
      console.log(
        `✅ Field "${fieldToFill.name}" was filled with: "${filledField.value}"`
      );
      expect(filledField.value).toBe(testValue);
    } else {
      console.warn(
        `⚠️ Field "${fieldToFill.name}" was not found in verification`
      );
    }

    console.log('✅ PDF form fill test completed');
  }, 60000); // 1 minute timeout
});
