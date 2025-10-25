// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import '../config/env.js';
import type { CreateBubbleFlowResponse } from '@bubblelab/shared-schemas';
import { TestApp } from '../test/test-app.js';

describe('BubbleFlow Implicit Any Error Testing', () => {
  describe('POST /bubble-flow with implicit any type errors', () => {
    it('should validate Gmail categorization cron workflow with custom tools', async () => {
      const gmailCronCode = `
import {
  // Base classes
  BubbleFlow,
  BaseBubble,
  ServiceBubble,
  WorkflowBubble,
  ToolBubble,

  // Service Bubbles
  HelloWorldBubble,
  AIAgentBubble,
  PostgreSQLBubble,
  SlackBubble,
  ResendBubble,
  GoogleDriveBubble,
  GmailBubble,
  SlackFormatterAgentBubble,
  HttpBubble,
  ApifyBubble,

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,
  InstagramTool,
  LinkedInTool,

  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleContext,
  type BubbleTriggerEvent,
  type WebhookEvent,
  type CronEvent,
} from '@bubblelab/bubble-core';
import { z } from 'zod';

export interface Output {
  categorizedEmails: {
    emailId: string;
    suggestedLabels: string[];
    agentResponse?: string;
  }[];
  errors: string[];
}

export interface CustomCronPayload extends CronEvent {
  // No custom payload needed for this cron job
}

export class GmailCategorizationCron extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '*/5 * * * *'; // Every 5 minutes

  async handle(payload: CustomCronPayload): Promise<Output> {
    const categorizedEmails: Output['categorizedEmails'] = [];
    const errors: string[] = [];

    const listEmailsBubble = new GmailBubble({
      operation: 'list_emails',
      query: 'is:unread',
      max_results: 5, // Process 5 emails at a time to avoid hitting limits
    });

    const listResult = await listEmailsBubble.action();

    if (!listResult.success || !listResult.data?.messages || listResult.data.messages.length === 0) {
      const errorMessage = listResult.error || 'No new messages found to process.';
      console.log(errorMessage);
      if (listResult.error) {
        errors.push(errorMessage);
      }
      return { categorizedEmails, errors };
    }

    const customTools: {
      name: string;
      description: string;
      schema: Record<string, unknown>;
      func: (args: Record<string, unknown>) => Promise<unknown>;
    }[] = [
      {
        name: 'read_gmail_message_content',
        description: 'Reads the full content, subject, and sender of a specific email using its ID.',
        schema: {
          message_id: z.string().describe('The ID of the Gmail message to read.'),
        },
        func: async (args: Record<string, unknown>) => {
          const { message_id } = args as { message_id: string };
          const result = await new GmailBubble({ operation: 'get_email', message_id, format: 'full' }).action();
          if (result.success && result.data?.message) {
            return {
              snippet: result.data.message.snippet,
              headers: result.data.message.payload?.headers?.filter(h => ['From', 'To', 'Subject', 'Date'].includes(h.name)),
              body_snippet: result.data.message.payload?.body?.data?.substring(0, 500), // Return a snippet of the body
            };
          }
          return { error: result.error || 'Failed to retrieve email.' };
        },
      },
    ];

    const systemPrompt = \`
      Objective:
      Analyze an incoming email and suggest appropriate labels for categorization.

      Tool:
      - read_gmail_message_content: Use this tool with the email ID to get the full content, sender, and subject.

      Instructions:
      1. You will be given an email ID and a snippet.
      2. Use the 'read_gmail_message_content' tool to get the email's full details.
      3. Analyze the email's subject, sender, and content to determine the most relevant categories.
      4. Suggest a list of suitable labels. Try to use a consistent structure like "Parent/Child" or simple labels.
      5. Your final response must be a valid JSON object containing a single key "suggested_labels" which is an array of strings. For example: { "suggested_labels": ["Work/Projects/Alpha", "Finance/Receipts"] }.
    \`;

    for (const message of listResult.data.messages) {
      if (!message.id) continue;

      try {
        const agentBubble = new AIAgentBubble({
          message: \`Please suggest labels for the email with ID: \${message.id}. Snippet: \${message.snippet}\`,
          systemPrompt,
          customTools,
          model: {
            model: 'google/gemini-2.5-pro',
            jsonMode: true,
          },
        });

        const agentResult = await agentBubble.action();

        if (agentResult.success && agentResult.data?.response) {
          try {
            const responseJson = JSON.parse(agentResult.data.response);
            categorizedEmails.push({
              emailId: message.id,
              suggestedLabels: responseJson.suggested_labels || [],
              agentResponse: agentResult.data.response,
            });
          } catch (e) {
            const parseError = \`Failed to parse agent JSON response for email \${message.id}: \${agentResult.data.response}\`;
            console.error(parseError);
            errors.push(parseError);
          }
        } else {
          const agentError = \`Agent failed for email \${message.id}: \${agentResult.error}\`;
          console.error(agentError);
          errors.push(agentError);
        }

        await new GmailBubble({ operation: 'mark_as_read', message_ids: [message.id] }).action();

      } catch (error) {
        const errorMessage = \`An unexpected error occurred for email \${message.id}: \${error instanceof Error ? error.message : String(error)}\`;
        console.error(errorMessage);
        errors.push(errorMessage);
        await new GmailBubble({ operation: 'mark_as_read', message_ids: [message.id] }).action();
      }
    }

    return { categorizedEmails, errors };
  }
}
`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'Gmail Categorization Cron',
        description: 'Automatically categorizes incoming emails using AI',
        code: gmailCronCode,
        eventType: 'schedule/cron',
        webhookActive: false,
      });

      console.log('Gmail Response status:', response.status);
      const data = await response.json();
      console.log('Gmail Response:', JSON.stringify(data, null, 2));

      expect(response.status).toBe(201);
    });

    it('should validate LinkedIn lead generation workflow', async () => {
      const linkedInCode = `
import {
  BubbleFlow,
  AIAgentBubble,
  ResendBubble,
  LinkedInTool,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

interface Lead {
  name: string;
  headline: string | null;
  profileUrl: string | null;
  username: string | null;
  reason: string;
  postText: string;
  postUrl: string | null;
  additionalPosts: string[];
  storyAnalysis: string;
}

interface CheckedProfile {
  name: string;
  headline: string | null;
  profileUrl: string | null;
  username: string | null;
  reason: string;
  postText: string;
  postUrl: string | null;
}

export interface Output {
  leads: Lead[];
  emailSent: boolean;
}

export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  leadPersona: string;
}

export class LinkedinLeadGen extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { email = "emailtoreceivereport@gmail.com", leadPersona = "Devs who run automation agencies, or build extensively with n8n" } = payload;

    // Step 1: Generate keywords using AI agent based on the lead persona
    const keywordGenerator = new AIAgentBubble({
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 5000,
      },
      systemPrompt: "You are a lead generation expert. Given a lead persona, generate 10 relevant keywords for searching LinkedIn posts. Return only a comma-separated list of keywords, nothing else.",
      message: \`Generate relevant LinkedIn search keywords for the following lead persona: "\${leadPersona}"\`,
    });

    const keywordResult = await keywordGenerator.action();

    if (!keywordResult.success || !keywordResult.data?.response) {
      throw new Error(\`Failed to generate keywords: \${keywordResult.error}\`);
    }

    // Extract keywords from AI response
    const generatedKeywords = keywordResult.data.response.trim();
    const keywords = generatedKeywords.split(',').map(k => k.trim()).filter(k => k);
    const primaryKeyword = keywords[0] || leadPersona.split(' ').slice(0, 2).join(' ') || 'business';

    this.logger?.info(\`Generated keywords: \${generatedKeywords}\`);
    this.logger?.info(\`Using primary keyword: \${primaryKeyword}\`);

    // Step 2: Search LinkedIn posts using the generated keywords
    const searchResult = await new LinkedInTool({
      operation: 'searchPosts',
      keyword: primaryKeyword,
      limit: 5,
      sortBy: 'relevance'
    }).action();

    if (!searchResult.success || !searchResult.data?.posts) {
      throw new Error(\`Failed to search LinkedIn posts: \${searchResult.error}\`);
    }

    const posts = searchResult.data.posts;

    // Step 3: Analyze each post to determine if it's a lead and extract username using AI heuristics
    const analysisPromises = posts.map(async (post: any) => {
      // Use AI heuristics to extract username from profileUrl
      let username = null;

      if (post.author?.profileUrl) {
        try {
          const usernameExtractor = new AIAgentBubble({
            model: {
              model: 'google/gemini-2.5-flash',
              temperature: 0.1,
              maxTokens: 1000,
            },
            systemPrompt: "You are a URL parser specialist. Extract the LinkedIn username from the given LinkedIn profile URL using advanced heuristics. Return only the username, nothing else. The username is typically the part after 'linkedin.com/in/' and before any '?' or '/' characters. Handle edge cases like URLs with hyphens, special characters, or complex paths.",
            message: \`Extract username using heuristics from this LinkedIn profile URL: \${post.author.profileUrl}\`,
          });

          const extractResult = await usernameExtractor.action();
          if (extractResult.success && extractResult.data?.response) {
            username = extractResult.data.response.trim();
            this.logger?.info(\`AI extracted username: \${username} from URL: \${post.author.profileUrl}\`);
          }
        } catch (aiExtractError) {
          this.logger?.error(\`AI extraction failed for \${post.author.profileUrl}: \${aiExtractError}\`);

          // Fallback to regex-based extraction if AI fails
          try {
            const urlMatch = post.author.profileUrl.match(/linkedin\\.com\\/in\\/([^?\\/]+)/);
            if (urlMatch && urlMatch[1]) {
              username = urlMatch[1];
              this.logger?.info(\`Fallback regex extracted username: \${username} from URL: \${post.author.profileUrl}\`);
            }
          } catch (regexError) {
            this.logger?.error(\`Regex fallback failed for \${post.author.profileUrl}: \${regexError}\`);
          }
        }
      }

      // Initial lead analysis
      const leadGenAnalysisAgent = new AIAgentBubble({
        model: {
          model: 'google/gemini-2.5-flash',
          jsonMode: true,
          temperature: 0.2,
          maxTokens: 10000,
        },
        systemPrompt: \`You are an expert lead generation analyst. Your task is to analyze a LinkedIn post and its author to determine if they are a potential lead based on the following persona: "\${leadPersona}". Respond in JSON format with two keys: "isLead" (boolean) and "reason" (a brief explanation).\`,
        message: \`Analyze the following LinkedIn post and author:\\n\\nAuthor: \${post.author?.firstName} \${post.author?.lastName}\\nHeadline: \${post.author?.headline}\\nPost Text: "\${post.text}"\`,
      });

      const agentResult = await leadGenAnalysisAgent.action();

      if (agentResult.success && agentResult.data?.response) {
        try {
          const analysis = JSON.parse(agentResult.data.response);

          // Create checked profile object for both leads and non-leads
          const checkedProfile: CheckedProfile = {
            name: \`\${post.author?.firstName} \${post.author?.lastName}\`,
            headline: post.author?.headline,
            profileUrl: post.author?.profileUrl,
            username: username,
            reason: analysis.reason,
            postText: post.text,
            postUrl: post.url,
          };

          if (analysis.isLead && username) {
            // Scrape additional posts from this lead's profile
            let additionalPosts: string[] = [];
            let storyAnalysis = "";

            try {
              const profilePostsResult = await new LinkedInTool({
                operation: 'scrapePosts',
                username: username,
                limit: 10,
                pageNumber: 1
              }).action();

              if (profilePostsResult.success && profilePostsResult.data?.posts) {
                additionalPosts = profilePostsResult.data.posts
                  .filter((p: any, index: number) => index < 5 && p.text && p.text !== post.text)
                  .map((p: any) => p.text!);

                // Analyze the complete story of all posts
                if (additionalPosts.length > 0) {
                  const storyAgent = new AIAgentBubble({
                    model: {
                      model: 'google/gemini-2.5-flash',
                      temperature: 0.3,
                      maxTokens: 2000,
                    },
                    systemPrompt: "You are a strategic analyst with web research capabilities. Based on a collection of LinkedIn posts from the same author, analyze their professional story, expertise, and why they might be interested in automation tools or services. Focus on their pain points, current tools they use, and opportunities for engagement. Provide a concise analysis with markdown formatting for better readability (use **bold**, *italic*, bullet points with *, etc.).",
                    message: \`Analyze the professional story and interests of this person based on their recent LinkedIn posts. Use web search and scraping tools to research any companies, tools, or technologies they mention to provide deeper insights:\\n\\nOriginal post: "\${post.text}"\\n\\nAdditional posts:\\n\${additionalPosts.map((p: string, i: number) => \`\${i + 1}. "\${p}"\`).join('\\n\\n')}\\n\\nPersona we're looking for: "\${leadPersona}"\`
                  });

                  const storyResult = await storyAgent.action();
                  if (storyResult.success && storyResult.data?.response) {
                    storyAnalysis = storyResult.data.response;
                  }
                }
              }
            } catch (scrapeError) {
              this.logger?.error(\`Failed to scrape additional posts for \${username}: \${scrapeError}\`);
            }

            return {
              ...checkedProfile,
              additionalPosts,
              storyAnalysis: storyAnalysis,
              isLead: true
            } as Lead;
          } else {
            // Return non-lead profile for tracking
            return { ...checkedProfile, isLead: false };
          }
        } catch (e) {
          console.error('Failed to parse AI response:', e);
        }
      }
      return null;
    });

    const results = await Promise.all(analysisPromises);
    const leads = results.filter((result: any): result is Lead => result && result.isLead === true) as Lead[];

    return { leads, emailSent: false };
  }
}
`;

      const response = await TestApp.post('/bubble-flow', {
        name: 'LinkedIn Lead Generation',
        description: 'LinkedIn lead generation with AI analysis',
        code: linkedInCode,
        eventType: 'webhook/http',
        webhookActive: true,
      });

      console.log('LinkedIn Response status:', response.status);
      const data = await response.json();
      console.log('LinkedIn Response:', JSON.stringify(data, null, 2));

      expect(response.status).toBe(201);
    });
  });
});
