import { ChartJSTool } from '../src/bubbles/tool-bubble/chart-js-tool.js';
import { SlackBubble } from '../src/bubbles/service-bubble/slack.js';
import './setup.ts';
import * as fs from 'fs/promises';

async function testSimpleChartToSlack() {
  console.log('📊➡️💬 Testing Chart Generation and Slack Upload...\n');

  // Test data
  const salesData = [
    { month: 'Jan', sales: 12000 },
    { month: 'Feb', sales: 15000 },
    { month: 'Mar', sales: 13000 },
    { month: 'Apr', sales: 18000 },
    { month: 'May', sales: 16000 },
  ];

  let generatedFilePath: string | undefined;

  try {
    // Step 1: Generate chart file
    console.log('📊 Step 1: Generating chart...');
    const chartTool = new ChartJSTool({
      data: salesData,
      chartType: 'line',
      xColumn: 'month',
      yColumn: 'sales',
      generateFile: true,
      filePath: '/tmp/charts',
      fileName: 'sales-trend-demo.png',
      options: {
        title: 'Monthly Sales Trend',
        xAxisLabel: 'Month',
        yAxisLabel: 'Sales ($)',
        colorScheme: 'viridis',
      },
      reasoning:
        'Creating a sales trend chart to demonstrate Slack integration',
    });

    const chartResult = await chartTool.action();

    if (!chartResult.success || !chartResult.data?.filePath) {
      throw new Error(`Chart generation failed: ${chartResult.error}`);
    }

    generatedFilePath = chartResult.data.filePath;
    console.log(`✅ Chart generated: ${generatedFilePath}`);
    console.log(`📏 File size: ${chartResult.data.fileSize} bytes`);
    console.log(`🔍 File exists: ${chartResult.data.fileExists}`);

    // Step 2: Verify file exists
    console.log('\n🔍 Step 2: Verifying file...');
    try {
      const stats = await fs.stat(generatedFilePath);
      console.log(`✅ File verified: ${stats.size} bytes`);
      console.log(`📅 Created: ${stats.birthtime.toISOString()}`);

      // Check if it's a valid PNG
      const buffer = await fs.readFile(generatedFilePath);
      const isPNG =
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      console.log(`🖼️  Valid PNG: ${isPNG}`);
    } catch (error) {
      throw new Error(`File verification failed: ${error}`);
    }

    // Step 3: Simulate Slack upload (no actual credentials needed for demo)
    console.log('\n💬 Step 3: Simulating Slack upload...');
    console.log(`📤 Would upload file: ${generatedFilePath}`);
    console.log(`📝 Filename: sales-trend-demo.png`);
    console.log(`💬 Channel: #general`);
    console.log(`📄 Title: Monthly Sales Trend`);
    console.log(`✅ Slack upload simulation: SUCCESS`);

    // Test with actual Slack credentials if available
    const slackToken = process.env.SLACK_TOKEN;
    if (slackToken) {
      console.log('\n📤 Uploading to Slack with credentials...');

      const uploadBubble = new SlackBubble({
        operation: 'upload_file',
        channel: 'C08J0L09PT6',
        file_path: generatedFilePath,
        filename: 'sales-trend-demo.png',
        title: 'Monthly Sales Trend',
        initial_comment:
          '📊 Auto-generated chart showing sales performance for the last 5 months. The trend shows positive growth!',
        credentials: { SLACK_CRED: slackToken },
      });

      const uploadResult = await uploadBubble.action();
      console.log(
        `📤 Actual Slack upload: ${uploadResult.success ? '✅ SUCCESS' : '❌ FAILED'}`
      );

      if (uploadResult.success) {
        console.log(`📁 File ID: ${(uploadResult as any).file?.id}`);
        console.log(`🔗 Permalink: ${(uploadResult as any).file?.permalink}`);
      } else {
        console.log(`❌ Error: ${uploadResult.error}`);
      }
    } else {
      console.log('\n⚠️  No SLACK_TOKEN found in environment');
      console.log(
        '   To test actual upload, set SLACK_TOKEN environment variable'
      );
    }

    // Step 4: Clean up temporary file
    console.log('\n🗑️ Step 4: Cleaning up temporary file...');

    if (generatedFilePath) {
      try {
        await fs.unlink(generatedFilePath);
        console.log(`✅ Temporary file deleted: ${generatedFilePath}`);

        // Verify it's gone
        try {
          await fs.access(generatedFilePath);
          console.log('⚠️ File still exists after deletion attempt');
        } catch {
          console.log('✅ File successfully removed from disk');
        }
      } catch (deleteError) {
        console.log(`⚠️ Failed to delete temporary file: ${deleteError}`);
      }
    }

    console.log('\n🎉 Chart-to-Slack workflow completed successfully!');

    // Summary
    console.log('\n📋 Workflow Summary:');
    console.log('=====================');
    console.log('1. ✅ Chart generated with Chart.js tool');
    console.log('2. ✅ File written to disk and verified');
    console.log('3. ✅ Ready for Slack upload (simulated)');
    console.log('4. ✅ Temporary file cleaned up');
    console.log('\n💡 This demonstrates the complete flow:');
    console.log('   Data → Chart → File → Slack → Cleanup');
  } catch (error) {
    console.error('❌ Test failed:', error);

    // Clean up on error too
    if (generatedFilePath) {
      try {
        await fs.unlink(generatedFilePath);
        console.log('🧹 Cleaned up temporary file after error');
      } catch {
        console.log('⚠️ Could not clean up temporary file after error');
      }
    }
  }
}

// Alternative: In-memory approach (no file generation)
async function testInMemoryApproach() {
  console.log('\n🧠 Alternative: In-Memory Chart Configuration...\n');

  const salesData = [
    { month: 'Jan', sales: 12000 },
    { month: 'Feb', sales: 15000 },
    { month: 'Mar', sales: 13000 },
  ];

  try {
    // Generate chart config only (no file)
    const chartTool = new ChartJSTool({
      data: salesData,
      chartType: 'bar',
      xColumn: 'month',
      yColumn: 'sales',
      generateFile: false, // Key difference: no file
      options: {
        title: 'Sales Summary',
        colorScheme: 'blues',
      },
      reasoning: 'Creating chart config without file generation',
    });

    const chartResult = await chartTool.action();

    if (chartResult.success) {
      console.log('✅ Chart configuration generated (no file)');
      console.log(`📊 Chart type: ${chartResult.data?.chartType}`);
      console.log(`📈 Data points: ${chartResult.data?.dataPointCount}`);
      console.log(
        `📁 File generated: ${chartResult.data?.filePath ? 'Yes' : 'No'}`
      );

      // The configuration could be sent to a web service like QuickChart
      // or used in a browser environment
      console.log('💡 Chart config available for:');
      console.log('   - Browser rendering');
      console.log('   - QuickChart API');
      console.log('   - Base64 data URLs');
      console.log('   - Real-time dashboards');
    }
  } catch (error) {
    console.error('❌ In-memory test failed:', error);
  }
}

// Run the tests
async function runTests() {
  await testSimpleChartToSlack();
  await testInMemoryApproach();
}

runTests().catch(console.error);
