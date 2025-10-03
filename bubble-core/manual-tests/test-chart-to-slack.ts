import { ChartJSTool } from '../src/bubbles/tool-bubble/chart-js-tool.js';
import { SlackBubble } from '../src/bubbles/service-bubble/slack.js';
import * as fs from 'fs/promises';
import './setup.js';

async function testChartToSlack() {
  console.log('📊➡️💬 Testing Chart Generation and Slack Upload...\n');

  // Test data
  const salesData = [
    { month: 'Jan', sales: 12000, profit: 2400 },
    { month: 'Feb', sales: 15000, profit: 3500 },
    { month: 'Mar', sales: 13000, profit: 2800 },
    { month: 'Apr', sales: 18000, profit: 4200 },
    { month: 'May', sales: 16000, profit: 3800 },
    { month: 'Jun', sales: 20000, profit: 5000 },
  ];

  const credentials = {
    SLACK_CRED: process.env.SLACK_TOKEN,
  };

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
      fileName: 'sales-trend-for-slack.png',
      options: {
        title: 'Monthly Sales Trend',
        xAxisLabel: 'Month',
        yAxisLabel: 'Sales ($)',
        colorScheme: 'viridis',
      },
      reasoning: 'Creating a sales trend chart to share in Slack',
    });

    const chartResult = await chartTool.action();

    if (!chartResult.success || !chartResult.data?.filePath) {
      throw new Error(`Chart generation failed: ${chartResult.error}`);
    }

    generatedFilePath = chartResult.data.filePath;
    console.log(`✅ Chart generated: ${generatedFilePath}`);
    console.log(`📏 File size: ${chartResult.data.fileSize} bytes`);
    console.log(`🔍 File exists: ${chartResult.data.fileExists}`);

    // Step 2: Upload to Slack
    console.log('\n💬 Step 2: Uploading to Slack...');

    // First, let's send a message about what we're sharing
    const messageBubble = new SlackBubble({
      operation: 'send_message',
      channel: '#general', // Change this to your test channel
      text: "Here's the latest sales trend analysis! 📈",
      credentials,
    });

    const messageResult = await messageBubble.action();
    if (messageResult.success) {
      console.log('✅ Message sent to Slack');
    } else {
      console.log(`⚠️ Message failed: ${messageResult.error}`);
    }

    // Upload the chart file
    const uploadBubble = new SlackBubble({
      operation: 'upload_file',
      channel: 'staging-bot', // Change this to your test channel
      file_path: generatedFilePath,
      filename: 'sales-trend.png',
      title: 'Monthly Sales Trend',
      initial_comment:
        '📊 Generated chart showing sales performance over the past 6 months',
      credentials,
    });

    const uploadResult = await uploadBubble.action();

    if (uploadResult.success) {
      console.log('✅ Chart uploaded to Slack successfully!');
      console.log(
        `🔗 File URL: ${(uploadResult as any).file?.url_private || 'N/A'}`
      );
    } else {
      console.log(`❌ Slack upload failed: ${uploadResult.error}`);
    }

    // Step 3: Clean up temporary file
    console.log('\n🗑️ Step 3: Cleaning up temporary file...');

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

    console.log('\n🎉 Chart-to-Slack workflow completed!');

    // Summary
    console.log('\n📋 Summary:');
    console.log('===========');
    console.log(`📊 Chart generated: ${chartResult.success ? '✅' : '❌'}`);
    console.log(`💬 Slack message: ${messageResult.success ? '✅' : '❌'}`);
    console.log(`📤 File upload: ${uploadResult.success ? '✅' : '❌'}`);
    console.log(
      `🗑️ File cleanup: ${generatedFilePath ? '✅ Completed' : '❌ No file to clean'}`
    );
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

// Alternative version without file generation (using in-memory approach)
async function testInMemoryChartToSlack() {
  console.log('\n🧠➡️💬 Testing In-Memory Chart to Slack...\n');

  const salesData = [
    { month: 'Jan', sales: 12000 },
    { month: 'Feb', sales: 15000 },
    { month: 'Mar', sales: 13000 },
    { month: 'Apr', sales: 18000 },
    { month: 'May', sales: 16000 },
  ];

  try {
    // Generate chart config only (no file)
    console.log('📊 Generating chart configuration...');
    const chartTool = new ChartJSTool({
      data: salesData,
      chartType: 'bar',
      xColumn: 'month',
      yColumn: 'sales',
      generateFile: false, // No file generation
      options: {
        title: 'Sales by Month',
        colorScheme: 'categorical',
      },
      reasoning: 'Creating chart config for in-memory processing',
    });

    const chartResult = await chartTool.action();

    if (chartResult.success) {
      console.log('✅ Chart configuration generated');
      console.log(`📊 Chart type: ${chartResult.data?.chartType}`);
      console.log(`📈 Data points: ${chartResult.data?.dataPointCount}`);

      // Send the chart config as a code block to Slack
      const configText = JSON.stringify(chartResult.data?.chartConfig, null, 2);

      const slackBubble = new SlackBubble({
        operation: 'send_message',
        channel: 'staging-bot',
        text:
          '📊 Generated Chart Configuration:\n```json\n' +
          configText.substring(0, 1000) +
          '\n```',
        credentials: {
          SLACK_CRED: process.env.SLACK_TOKEN,
        },
      });

      const slackResult = await slackBubble.action();
      console.log(
        `💬 Slack result: ${slackResult.success ? '✅ Sent' : '❌ Failed'}`
      );
    }
  } catch (error) {
    console.error('❌ In-memory test failed:', error);
  }
}

// Run both tests
async function runAllTests() {
  await testChartToSlack();
  await testInMemoryChartToSlack();
}

runAllTests().catch(console.error);
