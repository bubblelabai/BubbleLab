#!/usr/bin/env tsx

/**
 * End-to-End Test: PDF-to-Images → AI Agent Analysis
 *
 * This test demonstrates the complete workflow:
 * 1. Convert a PDF form to images using PDFFormOperationsWorkflow
 * 2. Pass the resulting base64 images to AIAgentBubble for analysis
 * 3. Get AI insights about the form content
 */

import { readFileSync } from 'fs';
import path from 'path';
import './setup.ts';
import { PDFFormOperationsWorkflow } from '../src/bubbles/workflow-bubble/pdf-form-operations.workflow.js';
import { AIAgentBubble } from '../src/bubbles/service-bubble/ai-agent.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import './setup.ts';

async function testPDFToAIChain() {
  console.log('🔗 Testing PDF-to-Images → AI Agent Chain');
  console.log('📄 Target PDF: Form 1040 U.S. Individual Income Tax Return');

  try {
    // Step 1: Load the PDF file
    const pdfPath = path.join(__dirname, 'form.pdf');
    console.log(`📂 Loading PDF from: ${pdfPath}`);

    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    console.log(`✅ PDF loaded: ${Math.round(pdfBuffer.length / 1024)}KB`);

    // Step 2: Convert PDF to images using our PDF workflow
    console.log('\n🖼️  Step 1: Converting PDF to images...');

    const pdfWorkflow = new PDFFormOperationsWorkflow({
      operation: 'convert-to-images',
      pdfData: pdfBase64,
      format: 'png',
      dpi: 150,
      quality: 0.8,
      // Convert all pages
    });

    console.log('⚙️  Executing PDF conversion...');
    const conversionResult = await pdfWorkflow.action();

    if (!conversionResult.success) {
      throw new Error(`PDF conversion failed: ${conversionResult.error}`);
    }

    console.log(`✅ PDF conversion successful!`);
    console.log(
      `📊 Results: ${conversionResult?.data?.convertedPages} pages converted to images`
    );
    console.log(
      `📏 Image dimensions: ${conversionResult?.data?.images[0]?.width}x${conversionResult?.data?.images[0]?.height}`
    );

    // Step 3: Prepare images for AI agent
    console.log('\n🤖 Step 2: Preparing images for AI analysis...');

    const imageInputs = conversionResult?.data?.images.map((image: any) => ({
      type: 'base64' as const,
      data: image.imageData,
      mimeType: 'image/png',
      description: `Page ${image.pageNumber} of Form 1040 - U.S. Individual Income Tax Return`,
    }));

    console.log(`📸 Prepared ${imageInputs?.length} images for AI analysis`);

    // Step 4: Analyze with AI Agent
    console.log('\n🧠 Step 3: Analyzing form content with AI...');

    // Note: This would require actual credentials to run
    // For testing purposes, we'll validate the schema and setup
    const result = await new AIAgentBubble({
      message: `Please analyze this document`,
      images: imageInputs,
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.3, // Lower temperature for more consistent analysis
        jsonMode: false,
      },
      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
      },
      tools: [], // No additional tools needed for this analysis
      maxIterations: 3,
    }).action();

    console.log('✅ AI Agent result:', result?.data?.response);

    // Return test data for potential further testing
    return {
      pdfConverted: true,
      aiAgentResult: result,
      imageCount: imageInputs?.length,
      aiAgentReady: true,
      imageInputs: imageInputs?.map((img: any) => ({
        mimeType: img.mimeType,
        description: img.description,
        dataLength: img.data.length,
      })),
      conversionResult: {
        totalPages: conversionResult?.data?.totalPages,
        convertedPages: conversionResult?.data?.convertedPages,
        success: conversionResult?.success,
      },
    };
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Execute the test
console.log('🚀 Starting PDF-to-AI Chain Test...\n');

testPDFToAIChain()
  .then((result) => {
    console.log('\n🎉 Test completed successfully!');
    console.log('✅ PDF-to-Images → AI Agent workflow is fully functional');
    console.log('\n📊 Final Results:', JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });
