import {
  BubbleFlow,
  AIAgentBubble,
  GithubBubble,
  HttpBubble,
  SlackBubble,
  BubbleError,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

// Define the expected payload from a GitHub webhook that supports both pull request and push events.
// An index signature `[key: string]: unknown;` is added to ensure compatibility
// with the base WebhookEvent['body'] type which is Record<string, unknown>.
export interface GitHubWebhookPayload {
  // Pull request event fields
  action?: 'opened' | 'reopened' | 'synchronize' | string;
  number?: number;
  pull_request?: {
    url: string;
    diff_url: string;
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
    };
  };
  // Push event fields
  ref?: string;
  before?: string;
  after?: string;
  commits?: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    url: string;
  }>;
  pusher?: {
    name: string;
    email: string;
  };
  repository: {
    name: string;
    full_name: string;
    html_url: string;
    owner: {
      login: string;
    };
  };
  [key: string]: unknown;
}

export interface CustomWebhookPayload extends WebhookEvent {
  body: GitHubWebhookPayload;
  /** Slack channel ID (starts with 'C'), channel name (e.g., 'general' or '#general'), or user ID for DM. Find channel ID by right-clicking channel → "View channel details" → Copy the "Channel ID". */
  slackChannel?: string;
}

export class GithubWebhookHandler extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { slackChannel = 'general' } = payload;

    const webhookData = payload.body;
    const owner = webhookData.repository.owner.login;
    const repo = webhookData.repository.name;

    // Check if this is a push event to the main branch
    if (webhookData.ref === 'refs/heads/main' && webhookData.commits) {
      // Handle push event to main branch
      const commits = webhookData.commits;
      const pusher = webhookData.pusher?.name || 'Unknown';
      const commitCount = commits.length;

      // Build commit list for the notification
      const commitList = commits
        .map((commit) => {
          const shortSha = commit.id.substring(0, 7);
          return `• \`${shortSha}\`: ${commit.message.split('\n')[0]}`;
        })
        .join('\n');

      // Sends a formatted notification to Slack when new commits are pushed to the main branch.
      // The channel parameter controls where the message goes - use a channel ID (C01234567AB),
      // channel name (general or #general), or user ID for DM. The message uses markdown formatting
      // with blocks for better visual structure. Modify the blocks array to change the notification
      // appearance or add additional fields like author information or repository links.
      const slackNotification = new SlackBubble({
        operation: 'send_message',
        channel: slackChannel,
        text: `${commitCount} new commit${commitCount > 1 ? 's' : ''} pushed to ${repo}/main by ${pusher}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚀 Push to ${repo}/main`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Pusher:* ${pusher}\n*Repository:* <${webhookData.repository.html_url}|${webhookData.repository.full_name}>\n*Commits:* ${commitCount}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Recent Commits:*\n${commitList}`,
            },
          },
        ],
      });

      const slackResult = await slackNotification.action();

      if (!slackResult.success) {
        const errorMessage = `Failed to send Slack notification: ${slackResult.error}`;
        this.logger?.error(errorMessage);
        throw new BubbleError(errorMessage);
      }

      this.logger?.info(
        `Sent Slack notification for ${commitCount} commits to ${repo}/main`
      );
      return {
        message: `Successfully sent Slack notification for ${commitCount} commit${commitCount > 1 ? 's' : ''} to ${repo}/main`,
      };
    }

    // Check if this is a pull request event
    if (webhookData.action === 'opened' && webhookData.pull_request) {
      // Only process newly opened pull requests to avoid spamming on updates.
      const pull_number = webhookData.number!;

      // 1. Get the commit message guidelines from the COMMIT.md file in the repository.
      const getCommitFileBubble = new GithubBubble({
        operation: 'get_file',
        owner,
        repo,
        path: 'COMMIT.md',
      });
      const commitFileResult = await getCommitFileBubble.action();

      let commitFileContent = 'No COMMIT.md file found or file is empty.';
      // The file content is now directly in the result.data.content
      if (commitFileResult.success && commitFileResult.data?.content) {
        commitFileContent = Buffer.from(
          commitFileResult.data.content,
          'base64'
        ).toString('utf-8');
      } else if (!commitFileResult.success) {
        this.logger?.warn(
          `Could not retrieve COMMIT.md: ${commitFileResult.error}`
        );
      }

      // 2. Get the PR's code changes (diff) from the provided diff_url.
      const getPrDiffBubble = new HttpBubble({
        url: webhookData.pull_request.diff_url,
        method: 'GET',
      });
      const diffResult = await getPrDiffBubble.action();

      if (!diffResult.success || !diffResult.data?.body) {
        const errorMessage = `Failed to get PR diff from ${webhookData.pull_request.diff_url}: ${diffResult.error}`;
        this.logger?.error(errorMessage);
        throw new BubbleError(errorMessage);
      }
      const diffContent = diffResult.data.body;

      // 3. Use an AI agent to generate a title and body based on the diff and commit guidelines.
      const suggestionAgent = new AIAgentBubble({
        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.5,
          jsonMode: true,
        },
        systemPrompt:
          'You are an expert at writing GitHub pull request titles and descriptions. Analyze the provided commit guidelines and code differences to generate a concise and informative title and a detailed body. The output must be a valid JSON object with "title" and "body" keys.',
        message: `Commit Guidelines:\n${commitFileContent}\n\nPull Request Diff:\n${diffContent}\n\nGenerate a suitable PR title and body based on the provided information.`,
      });

      const suggestionResult = await suggestionAgent.action();

      if (!suggestionResult.success || !suggestionResult.data?.response) {
        const errorMessage = `AI agent failed to generate suggestion: ${suggestionResult.error}`;
        this.logger?.error(errorMessage);
        throw new BubbleError(errorMessage);
      }

      let suggestion: { title: string; body: string };
      try {
        suggestion = JSON.parse(suggestionResult.data.response);
      } catch (error) {
        const errorMessage = `Failed to parse AI response JSON: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        this.logger?.error(errorMessage);
        this.logger?.info(
          `Invalid AI Response: ${suggestionResult.data.response}`
        );
        throw new BubbleError(errorMessage);
      }

      // 4. Post the generated suggestion as a comment on the pull request.
      const commentBody = `### Suggested PR title from Pearl\n\n**Title:** \`${suggestion.title}\`\n\n**Body:**\n${suggestion.body}`;

      const createCommentBubble = new GithubBubble({
        operation: 'create_pr_comment',
        owner,
        repo,
        pull_number,
        body: commentBody,
      });
      const commentResult = await createCommentBubble.action();

      if (!commentResult.success) {
        const errorMessage = `Failed to create PR comment: ${commentResult.error}`;
        this.logger?.error(errorMessage);
        throw new BubbleError(errorMessage);
      }

      this.logger?.info(
        `Posted comment to PR #${pull_number} in ${owner}/${repo}`
      );
      return {
        message: `Successfully posted PR suggestion comment to PR #${pull_number}.`,
      };
    }

    // If it's neither a push to main nor an opened PR, skip processing
    return {
      message: `Skipping event - not a push to main or opened PR. Event: ${webhookData.action || webhookData.ref || 'unknown'}`,
    };
  }
}
