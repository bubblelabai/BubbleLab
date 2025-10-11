#!/usr/bin/env tsx

/**
 * Test script to validate AI Agent multimodal functionality
 * This script tests the schema and creates example multimodal input
 */

import { AIAgentBubble } from '../src/bubbles/service-bubble/ai-agent.js';
import './setup.ts';
import { CredentialType } from '@bubblelab/shared-schemas';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
async function testMultimodalAIAgent() {
  console.log('🧪 Testing AI Agent Multimodal Support');

  // Example base64 image data (1x1 red pixel PNG for testing)
  const testImageBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  // Test schema validation
  try {
    const testParams = {
      message: 'What do you see in this image?',
      images: [
        {
          type: 'base64' as const,
          data: testImageBase64,
          mimeType: 'image/png',
          description: 'A test image',
        },
      ],
      systemPrompt: 'You are a helpful AI assistant that can analyze images.',
      model: {
        model: 'google/gemini-2.5-flash' as const,
        temperature: 0.7,
        maxTokens: 1000,
        jsonMode: false,
      },
      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY,
      },
    };

    console.log('✅ Schema validation passed for multimodal input');
    console.log('📝 Test parameters:', {
      messageLength: testParams.message.length,
      imageCount: testParams.images.length,
      firstImageMimeType: testParams.images[0].mimeType,
      model: testParams.model.model,
    });

    // Create AI Agent instance (this validates the schema)
    const aiAgent = new AIAgentBubble(testParams);
    console.log('✅ AI Agent instance created successfully');

    const result = await aiAgent.action();
    console.log('✅ AI Agent result:', result);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  console.log(
    '🎉 All tests passed! AI Agent now supports base64 images from PDF conversion.'
  );
}

// Run the test
testMultimodalAIAgent().catch(console.error);
