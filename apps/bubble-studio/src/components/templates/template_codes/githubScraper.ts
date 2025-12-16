// Template for GitHub Contributor Scraper
// This file contains the template code and metadata for the GitHub contributor scraping workflow

export const templateCode = `import {
  BubbleFlow,
  ResearchAgentTool,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  /**
   * GitHub repository URL to scrape contributors from (e.g., "https://github.com/user/repo").
   * @canBeFile false
   */
  githubUrl: string;
  /**
   * Email address to send the contributor list to.
   * @canBeFile false
   */
  email: string;
}

interface Contributor {
    name: string;
    commits: number;
    profileUrl: string;
    avatarUrl?: string;
}

interface ScraperOutput {
    contributors: Contributor[];
}

export class GithubContributorScraperFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { githubUrl, email } = payload;

    let url = githubUrl;
    if (!url.endsWith('/graphs/contributors')) {
      url = url.endsWith('/') ? \`\${url}graphs/contributors\` : \`\${url}/graphs/contributors\`;
    }

    const researchAgent = new ResearchAgentTool({
      task: \`Scrape the GitHub contributors from \${url} and list the top 10 contributors. For each contributor, extract their username, number of commits, profile URL, and avatar URL if available.\`,
      expectedResultSchema: JSON.stringify({
        type: 'object',
        properties: {
          contributors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                commits: { type: 'number' },
                profileUrl: { type: 'string' },
                avatarUrl: { type: 'string' },
              },
              required: ['name', 'commits', 'profileUrl'],
            },
          },
        },
        required: ['contributors'],
      }),
    });

    const researchResult = await researchAgent.action();

    // Validate that we got a successful result with data
    if (!researchResult.success || !researchResult.data) {
      throw new Error(\`Research agent failed: \${researchResult.error}\`);
    }

    const scrapedData = researchResult.data.result as ScraperOutput;
    
    // Validate that contributors array exists and has data
    if (!scrapedData || !scrapedData.contributors || !Array.isArray(scrapedData.contributors)) {
      throw new Error('Invalid data structure returned from research agent');
    }

    const contributors = scrapedData.contributors;

    // Only proceed with email if we have valid contributor data
    if (contributors.length === 0) {
      return { message: 'No contributors found. Email not sent.' };
    }

    // Validate that contributors have required fields
    const validContributors = contributors.filter(
      c => c && c.name && c.name.trim() !== '' && c.commits && c.profileUrl
    );
    
    if (validContributors.length === 0) {
      return { message: 'No valid contributors with complete data found. Email not sent.' };
    }

    const topContributors = validContributors.slice(0, 10);
    
    const emailText = \`Here are the top \${topContributors.length} contributors for \${githubUrl}:\\n\\n\${topContributors.map((c, index) => 
      \`\${index + 1}. \${c.name}\\n   Commits: \${c.commits}\\n   Profile: \${c.profileUrl}\\n\`
    ).join('\\n')}\`;
    
    const emailHtml = \`
      <h1>Top \${topContributors.length} Contributors for \${githubUrl}</h1>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">#</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Contributor</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Commits</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Profile</th>
          </tr>
        </thead>
        <tbody>
          \${topContributors.map((c, index) => \`
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">\${index + 1}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">
                \${c.avatarUrl ? \`<img src="\${c.avatarUrl}" alt="\${c.name}" style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 8px;">\` : ''}
                \${c.name}
              </td>
              <td style="padding: 10px; border: 1px solid #ddd;">\${c.commits.toLocaleString()}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">
                <a href="\${c.profileUrl}" style="color: #0066cc;">View Profile</a>
              </td>
            </tr>
          \`).join('')}
        </tbody>
      </table>
    \`;

    const emailBubble = new ResendBubble({
      operation: 'send_email',
      to: email,
      subject: \`Top Contributors for \${githubUrl}\`,
      text: emailText,
      html: emailHtml,
    });

    const emailResult = await emailBubble.action();

    if (!emailResult.success) {
      throw new Error(\`Failed to send email: \${emailResult.error}\`);
    }

    return {
      message: \`Successfully scraped \${topContributors.length} contributors and sent the list to \${email}.\`,
    };
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      githubUrl: {
        type: 'string',
        description: 'GitHub repository URL to scrape contributors from',
      },
      email: {
        type: 'string',
        description: 'Email address to send the contributor list to',
      },
    },
    required: ['githubUrl', 'email'],
  }),
  requiredCredentials: {
    'research-agent': ['read'],
    resend: ['send'],
  },
  // Pre-validated bubble parameters for instant visualization (no server validation needed)
  // Keys correspond to variableIds to ensure stable ordering/selection
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'researchAgent',
      bubbleName: 'ResearchAgentTool',
      className: 'ResearchAgentTool',
      nodeType: 'tool',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'task',
          value:
            'Scrape GitHub contributors and extract top 10 with username, commits, profile URL, and avatar.',
          type: 'string',
        },
        {
          name: 'expectedResultSchema',
          value:
            'JSON schema for contributors array with name, commits, profileUrl, avatarUrl.',
          type: 'string',
        },
      ],
    },
    2: {
      variableId: 2,
      variableName: 'emailBubble',
      bubbleName: 'ResendBubble',
      className: 'ResendBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'send_email', type: 'string' },
        { name: 'to', value: '${email}', type: 'string' },
        {
          name: 'subject',
          value: 'Top Contributors for ${githubUrl}',
          type: 'string',
        },
        {
          name: 'text',
          value:
            'Plain text list of top contributors with names, commits, and profile links.',
          type: 'string',
        },
        {
          name: 'html',
          value:
            'HTML table with contributor details including avatars and formatted links.',
          type: 'string',
        },
      ],
    },
  },
};
