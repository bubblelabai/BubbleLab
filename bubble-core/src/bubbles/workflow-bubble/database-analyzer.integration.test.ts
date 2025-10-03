import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { DatabaseAnalyzerWorkflowBubble } from './database-analyzer.workflow';
import { PostgreSQLBubble } from '../service-bubble/postgresql';

// Load environment variables - try multiple locations
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../../.env'),
  path.join(__dirname, '../../../../../.env'), // From bubble-core to project root
];

let loaded = false;
for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      dotenv.config({
        path: envPath,
        override: true,
        encoding: 'utf8',
      });
      console.log(`✅ Loaded .env from: ${envPath}`);
      loaded = true;
      break;
    }
  } catch {
    // Continue to next path
  }
}

if (!loaded) {
  console.log('⚠️  No .env file found');
}

console.log(process.env.BUBBLE_CONNECTING_STRING_URL);
describe('DatabaseAnalyzerWorkflowBubble Integration Tests', () => {
  // Test full data analysis pipeline: database query -> AI analysis -> Slack notification
  describe('Full data analysis pipeline integration', () => {
    test('should query database, analyze data with AI, and send results to Slack without error', async () => {
      console.log(process.env.BUBBLE_CONNECTING_STRING_URL);
      await new PostgreSQLBubble({
        query: 'SELECT 5 as five',
        ignoreSSL: true,
        credentials: {
          DATABASE_CRED: process.env.BUBBLE_CONNECTING_STRING_URL || '',
        },
        allowedOperations: ['SELECT'],
      }).action();
      // console.log(aiAgentBubble);
      await new DatabaseAnalyzerWorkflowBubble({
        dataSourceType: 'postgresql',
        ignoreSSLErrors: true,
        includeMetadata: true,
        credentials: {
          DATABASE_CRED: process.env.BUBBLE_CONNECTING_STRING_URL,
        },
      }).action();
      // console.log(databaseAnalyzerBubble.data?.databaseSchema);
    });
  });
});
