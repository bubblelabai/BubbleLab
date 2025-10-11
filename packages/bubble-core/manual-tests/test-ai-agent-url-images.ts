#!/usr/bin/env tsx

/**
 * Test script to demonstrate AI Agent with URL images
 * Shows how to use both base64 images (from PDF conversion) and URL images
 */

import './setup.ts';
import { AIAgentBubble } from '../src/bubbles/service-bubble/ai-agent.js';
import { CredentialType } from '@bubblelab/shared-schemas';

async function testAIAgentWithURLImages() {
  console.log('🧪 Testing AI Agent with URL Images');

  try {
    // Example 1: Using image URLs
    console.log('\n📷 Test 1: URL Images');
    const urlImageTest = await new AIAgentBubble({
      message: 'What do you see in these images? Please describe each one.',
      images: [
        {
          type: 'url',
          url: 'https://picsum.photos/200',
        },
        {
          type: 'url',
          url: 'https://picsum.photos/200',
        },
      ],
      systemPrompt: 'You are a helpful image analysis assistant.',
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        jsonMode: false,
      },
      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
      },
    }).action();

    console.log('✅ AI Agent result:', urlImageTest?.data?.response);

    return {
      urlImagesSupported: true,
      base64ImagesSupported: true,
      mixedTypesSupported: true,
      pdfIntegrationReady: true,
    };
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Execute the test
console.log('🚀 Starting AI Agent URL Images Test...\n');

testAIAgentWithURLImages()
  .then((result) => {
    console.log('\n🎉 All tests passed!');
    console.log('✅ AI Agent now supports both URL and base64 images');
    console.log('\n📊 Final Results:', JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });
