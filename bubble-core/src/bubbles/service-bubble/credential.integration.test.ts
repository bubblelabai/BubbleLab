import { CredentialType } from '@bubblelab/shared-schemas';
import { AIAgentBubble, PostgreSQLBubble, SlackBubble } from '../../index.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the package root
dotenv.config({ path: path.join(process.cwd(), '../../.env.local') });

describe('Credential Tests', () => {
  // Test full data analysis pipeline: database query -> AI analysis -> Slack notification
  describe('Bubble should validate should validate credentials with default parameters', () => {
    test('should validate credentials with default parameters given a valid credential type', async () => {
      const slackBubble = new SlackBubble();
      slackBubble.setCredentials({
        [CredentialType.SLACK_CRED]: process.env.SLACK_TOKEN!,
      });
      const result = await slackBubble.testCredential();
      expect(result).toBe(true);
    });
    test('should invalidate credentials with default parameters given an invalid credential type', async () => {
      const slackBubble = new SlackBubble();
      slackBubble.setCredentials({
        [CredentialType.SLACK_CRED]: 'invalid-token',
      });
      const result = await slackBubble.testCredential();
      expect(result).toBe(false);
    });
  });
});
