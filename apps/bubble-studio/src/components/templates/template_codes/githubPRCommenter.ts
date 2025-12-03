// Template for GitHub PR Commenter - Automated PR Title and Body Suggestions
//
// INPUT: This workflow is triggered by a GitHub webhook when a pull request is opened
//
// Workflow:
// PHASE 1: Webhook Processing
//   - Receive GitHub pull request webhook payload
//   - Validate the action is "opened" (skip other actions to avoid spam)
//   - Extract PR metadata (owner, repo, pull_number, diff_url)
//
// PHASE 2: Context Gathering
//   - Fetch COMMIT.md file from the repository (commit message guidelines)
//   - Retrieve PR diff/changes from GitHub's diff_url
//   - Handle errors gracefully if COMMIT.md doesn't exist
//
// PHASE 3: AI Analysis & Suggestion Generation
//   - Use AI agent to analyze the commit guidelines and code diff
//   - Generate a suggested PR title following project conventions
//   - Generate a detailed PR body/description
//   - Use JSON mode for structured output
//
// PHASE 4: Comment Posting
//   - Format the suggestions as a GitHub comment
//   - Post the comment to the pull request
//   - Return success status

export const templateCode = `import {
  BubbleFlow,
  AIAgentBubble,
  GithubBubble,
  HttpBubble,
  BubbleError,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

// Define the expected payload from a GitHub pull request webhook.
// An index signature \`[key: string]: unknown;\` is added to ensure compatibility
// with the base WebhookEvent['body'] type which is Record<string, unknown>.
export interface GitHubPullRequestPayload {
  action: 'opened' | 'reopened' | 'synchronize' | string;
  number: number;
  pull_request: {
    url: string;
    diff_url: string;
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
    };
  };
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  [key: string]: unknown;
}

export interface CustomWebhookPayload extends WebhookEvent {
  body: GitHubPullRequestPayload;
}

export class GithubPRCommenter extends BubbleFlow<'webhook/http'> {
  // Retrieves the COMMIT.md file from the repository to understand commit message conventions
  private async getCommitGuidelines(
    owner: string,
    repo: string
  ): Promise<string> {
    // Retrieves the COMMIT.md file from the repository using the owner, repo, and path
    // to understand commit message conventions, ensuring AI-generated PR suggestions
    // align with the project's style.
    const getCommitFileBubble = new GithubBubble({
      operation: 'get_file',
      owner,
      repo,
      path: 'COMMIT.md',
    });

    const commitFileResult = await getCommitFileBubble.action();

    if (commitFileResult.success && commitFileResult.data?.content) {
      return Buffer.from(
        commitFileResult.data.content,
        'base64'
      ).toString('utf-8');
    }

    if (!commitFileResult.success) {
      this.logger?.warn(
        \`Could not retrieve COMMIT.md: \${commitFileResult.error}\`
      );
    }

    return 'No COMMIT.md file found or file is empty.';
  }

  // Fetches the code changes (diff) from GitHub's diff URL for AI analysis
  private async getPrDiff(diffUrl: string): Promise<string> {
    // Fetches the code changes (diff) from GitHub's diff URL using a GET request,
    // providing the AI agent with all file changes, additions, and deletions needed
    // to generate accurate PR descriptions.
    const getPrDiffBubble = new HttpBubble({
      url: diffUrl,
      method: 'GET',
    });

    const diffResult = await getPrDiffBubble.action();

    if (!diffResult.success || !diffResult.data?.body) {
      const errorMessage = \`Failed to get PR diff from \${diffUrl}: \${diffResult.error}\`;
      this.logger?.error(errorMessage);
      throw new BubbleError(errorMessage);
    }

    return diffResult.data.body;
  }

  // Analyzes commit guidelines and PR diff using AI to generate PR title and description suggestions
  private async generatePRSuggestions(
    commitFileContent: string,
    diffContent: string
  ): Promise<{ title: string; body: string }> {
    // Analyzes commit guidelines and PR diff using to
    // generate structured PR title and description suggestions that combine project
    // style guidelines with actual code changes.
    const suggestionAgent = new AIAgentBubble({
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.5,
        jsonMode: true,
      },
      systemPrompt:
        'You are an expert at writing GitHub pull request titles and descriptions. Analyze the provided commit guidelines and code differences to generate a concise and informative title and a detailed body. The output must be a valid JSON object with "title" and "body" keys.',
      message: \`Commit Guidelines:\\n\${commitFileContent}\\n\\nPull Request Diff:\\n\${diffContent}\\n\\nGenerate a suitable PR title and body based on the provided information.\`,
    });

    const suggestionResult = await suggestionAgent.action();

    if (!suggestionResult.success || !suggestionResult.data?.response) {
      const errorMessage = \`AI agent failed to generate suggestion: \${suggestionResult.error}\`;
      this.logger?.error(errorMessage);
      throw new BubbleError(errorMessage);
    }

    try {
      const suggestion = JSON.parse(suggestionResult.data.response);
      if (
        typeof suggestion !== 'object' ||
        !suggestion.title ||
        !suggestion.body
      ) {
        throw new Error('Invalid suggestion structure');
      }
      return suggestion as { title: string; body: string };
    } catch (error) {
      const errorMessage = \`Failed to parse AI response JSON: \${
        error instanceof Error ? error.message : 'Unknown error'
      }\`;
      this.logger?.error(errorMessage);
      this.logger?.info(\`Invalid AI Response: \${suggestionResult.data.response}\`);
      throw new BubbleError(errorMessage);
    }
  }

  // Formats PR suggestions into a markdown comment body for GitHub
  private formatCommentBody(suggestion: {
    title: string;
    body: string;
  }): string {
    return \`### Suggested PR title from Pearl\\n\\n**Title:** \\\`\${suggestion.title}\\\`\\n\\n**Body:**\\n\${suggestion.body}\`;
  }

  // Posts the AI-generated PR suggestions as a comment on the pull request
  private async postPRComment(
    owner: string,
    repo: string,
    pull_number: number,
    commentBody: string
  ): Promise<void> {
    // Posts the AI-generated PR suggestions as a formatted markdown comment on the
    // pull request using the owner, repo, and pull_number, making the suggestions
    // immediately visible to the PR author and reviewers.
    const createCommentBubble = new GithubBubble({
      operation: 'create_pr_comment',
      owner,
      repo,
      pull_number,
      body: commentBody,
    });

    const commentResult = await createCommentBubble.action();

    if (!commentResult.success) {
      const errorMessage = \`Failed to create PR comment: \${commentResult.error}\`;
      this.logger?.error(errorMessage);
      throw new BubbleError(errorMessage);
    }

    this.logger?.info(\`Posted comment to PR #\${pull_number} in \${owner}/\${repo}\`);
  }

  // Main workflow orchestration
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const prData = payload.body;

    // Only process newly opened pull requests to avoid spamming on updates.
    if (prData.action !== 'opened') {
      return {
        message: \`Skipping action "\${prData.action}" for PR #\${prData.number}.\`,
      };
    }

    const owner = prData.repository.owner.login;
    const repo = prData.repository.name;
    const pull_number = prData.number;

    // Get commit guidelines and PR diff
    const commitFileContent = await this.getCommitGuidelines(owner, repo);
    const diffContent = await this.getPrDiff(prData.pull_request.diff_url);

    // Generate PR suggestions using AI
    const suggestion = await this.generatePRSuggestions(
      commitFileContent,
      diffContent
    );

    // Format and post comment
    const commentBody = this.formatCommentBody(suggestion);
    await this.postPRComment(owner, repo, pull_number, commentBody);

    return {
      message: \`Successfully posted PR suggestion comment to PR #\${pull_number}.\`,
    };
  }
}`;
