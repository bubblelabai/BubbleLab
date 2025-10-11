#!/usr/bin/env tsx

/**
 * Simple Test: PDF to Images Conversion Only
 *
 * This test converts the 1040 tax PDF to images and saves them to files
 * so you can verify the image quality before running the full OCR workflow.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import './setup.js';
import { PDFFormOperationsWorkflow } from '../src/bubbles/workflow-bubble/pdf-form-operations.workflow.js';

async function testPdfToImagesOnly() {
  console.log('🖼️  Testing PDF to Images Conversion Only');
  console.log('📄 Target PDF: 1040 Tax Form');

  try {
    // Step 1: Load the PDF file
    const pdfPath = path.join(__dirname, '1040-tax.pdf');
    console.log(`📂 Loading PDF from: ${pdfPath}`);

    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    console.log(`✅ PDF loaded: ${Math.round(pdfBuffer.length / 1024)}KB`);

    // Step 2: Convert PDF to images with different quality settings
    const testConfigs = [
      { dpi: 150, quality: 0.8, format: 'png' as const, name: 'standard' },
      { dpi: 300, quality: 0.9, format: 'png' as const, name: 'high-quality' },
      {
        dpi: 150,
        quality: 0.8,
        format: 'jpeg' as const,
        name: 'jpeg-standard',
      },
    ];

    for (const config of testConfigs) {
      console.log(
        `\n🔄 Converting with ${config.name} settings (${config.dpi} DPI, ${config.quality} quality, ${config.format})...`
      );

      const imageWorkflow = new PDFFormOperationsWorkflow({
        operation: 'convert-to-images',
        pdfData: pdfBase64,
        format: config.format,
        quality: config.quality,
        dpi: config.dpi,
        pages: [1, 2], // Convert first 2 pages
      });

      const result = await imageWorkflow.action();

      if (!result.success) {
        console.error(`❌ Conversion failed for ${config.name}:`, result.error);
        continue;
      }

      console.log(
        `✅ Successfully converted ${result.data?.convertedPages} pages`
      );

      // Save images to files
      if (result.data?.images) {
        for (const image of result.data.images) {
          const fileName = `1040-page-${image.pageNumber}-${config.name}.${config.format}`;
          const filePath = path.join(__dirname, fileName);

          // Convert base64 to buffer and save
          const imageBuffer = Buffer.from(image.imageData, 'base64');
          writeFileSync(filePath, imageBuffer);

          console.log(
            `💾 Saved: ${fileName} (${Math.round(imageBuffer.length / 1024)}KB, ${image.width}x${image.height})`
          );
        }
      }
    }

    console.log('\n🎉 PDF to Images conversion test completed!');
    console.log('\n📁 Generated files in manual-tests/:');
    console.log('   • 1040-page-1-standard.png (150 DPI, 0.8 quality)');
    console.log('   • 1040-page-2-standard.png');
    console.log('   • 1040-page-1-high-quality.png (300 DPI, 0.9 quality)');
    console.log('   • 1040-page-2-high-quality.png');
    console.log(
      '   • 1040-page-1-jpeg-standard.jpeg (150 DPI, 0.8 quality, JPEG)'
    );
    console.log('   • 1040-page-2-jpeg-standard.jpeg');
    console.log(
      '\n👀 Please check the image quality and readability of text in these files.'
    );

    return {
      success: true,
      message: 'PDF to images conversion completed successfully',
      filesGenerated: testConfigs.length * 2, // 2 pages per config
    };
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Execute the test
console.log('🚀 Starting PDF to Images Test...\n');

testPdfToImagesOnly()
  .then((result) => {
    console.log('\n✅ Test completed successfully!');
    console.log(`📊 Result: ${result.message}`);
    console.log(`📸 Generated ${result.filesGenerated} image files`);
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });
