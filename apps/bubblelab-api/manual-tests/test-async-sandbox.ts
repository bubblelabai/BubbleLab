// Load environment variables
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

import { PostgreSQLBubble } from '@bubblelab/bubble-core';

async function testAsyncInSandbox() {
  console.log('🧪 Testing Async Execution in Sandbox');
  console.log('='.repeat(50));

  // Test 1: Direct PostgreSQL bubble execution (should work)
  console.log('\n1. 🧪 Direct PostgreSQL bubble test...');
  try {
    const directResult = await new PostgreSQLBubble({
      query: 'SELECT count(*) FROM "user"',
      ignoreSSL: true,
    }).action();

    console.log('✅ Direct execution result:', {
      success: directResult.success,
      error: directResult.error,
      dataType: typeof directResult.data,
      data: directResult.data,
    });
  } catch (error) {
    console.log('❌ Direct execution failed:', error);
  }

  // Test 2: Simulated sandbox execution (mimics how the execution service works)
  console.log('\n2. 🧪 Sandbox simulation test...');

  const sandboxCode = `
    console.log('🔍 Creating PostgreSQL bubble...');
    const bubble = new PostgreSQLBubble({
      query: 'SELECT count(*) FROM "user"',  
      ignoreSSL: true,
      credential: "${process.env.BUBBLE_CONNECTING_STRING_URL}",
    });
    
    console.log('🔍 About to call bubble.action()...');
    const result = await bubble.action();

    
    return { 
      hello: "hello",
      testResult: result,
      dataOnly: result?.data,
      success: result?.success 
    };
  `;

  try {
    // Create sandbox context similar to execution.ts
    const sandbox = {
      console: {
        log: (...args: unknown[]) => console.log('[Sandbox]', ...args),
        error: (...args: unknown[]) => console.error('[Sandbox]', ...args),
      },
      PostgreSQLBubble,
    };

    // Execute in sandbox (similar to execution.ts)
    const func = new Function(
      'PostgreSQLBubble',
      'console',
      `
      return (async () => {
        ${sandboxCode}
      })();
      `
    );

    const sandboxResult = await func.call(
      {},
      PostgreSQLBubble,
      sandbox.console
    );

    console.log('✅ Sandbox execution result:', {
      success: sandboxResult?.testResult?.success,
      error: sandboxResult?.testResult?.error,
      dataType: typeof sandboxResult?.testResult?.data,
      hasData: !!sandboxResult?.testResult?.data,
      fullResult: sandboxResult,
    });
  } catch (error) {
    console.log('❌ Sandbox execution failed:', error);
  }
}

testAsyncInSandbox();
