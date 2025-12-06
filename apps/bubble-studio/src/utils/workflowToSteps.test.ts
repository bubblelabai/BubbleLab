import { describe, it, expect } from 'vitest';
import { extractStepGraph, type StepGraph } from './workflowToSteps';
import type {
  ParsedBubbleWithInfo,
  ValidateBubbleFlowResponse,
} from '@bubblelab/shared-schemas';

// Get API base URL from environment (defaults to localhost for testing)
const API_BASE_URL =
  process.env.VITE_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:3001';

async function getValidationResponse(
  code: string
): Promise<ValidateBubbleFlowResponse> {
  // Call backend validation endpoint (simulating useValidateCode without flowId)
  const response = await fetch(`${API_BASE_URL}/bubble-flow/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add auth token if needed for tests
      ...(process.env.TEST_AUTH_TOKEN && {
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      }),
    },
    body: JSON.stringify({
      code,
      // No flowId - simulating validation without existing flow
      options: {
        includeDetails: true,
        strictMode: true,
      },
    }),
  });

  expect(response.ok).toBe(true);

  const validationResult: ValidateBubbleFlowResponse = await response.json();
  console.log(JSON.stringify(validationResult.workflow, null, 2));

  expect(validationResult.valid).toBe(true);
  expect(validationResult.workflow).toBeDefined();
  expect(validationResult.bubbles).toBeDefined();

  // Convert bubbles from Record<string, ParsedBubbleWithInfo> to Record<number, ParsedBubbleWithInfo>
  // The API returns string keys, but extractStepGraph expects number keys
  const bubbles: Record<number, ParsedBubbleWithInfo> = {};
  if (validationResult.bubbles) {
    Object.entries(validationResult.bubbles).forEach(([key, bubble]) => {
      // Try to use variableId if available, otherwise parse the key
      const bubbleId = bubble.variableId ?? parseInt(key, 10);
      if (!isNaN(bubbleId)) {
        bubbles[bubbleId] = bubble;
      }
    });
  }

  return validationResult;
}

async function validateGraph(
  validationResult: ValidateBubbleFlowResponse
): Promise<StepGraph> {
  const stepGraph: StepGraph = extractStepGraph(
    validationResult.workflow,
    validationResult.bubbles as Record<number, ParsedBubbleWithInfo>
  );
  // Assert we get defined results
  expect(stepGraph).toBeDefined();
  expect(stepGraph.steps).toBeDefined();
  expect(Array.isArray(stepGraph.steps)).toBe(true);
  expect(stepGraph.edges).toBeDefined();
  expect(Array.isArray(stepGraph.edges)).toBe(true);

  // Verify edges connect steps properly
  if (stepGraph.steps.length > 1 && stepGraph.edges.length > 0) {
    // Each edge should reference valid step IDs
    stepGraph.edges.forEach((edge) => {
      const sourceExists = stepGraph.steps.some(
        (step) => step.id === edge.sourceStepId
      );
      const targetExists = stepGraph.steps.some(
        (step) => step.id === edge.targetStepId
      );

      expect(sourceExists).toBe(true);
      expect(targetExists).toBe(true);
    });

    // Verify no self-loops (steps shouldn't connect to themselves)
    stepGraph.edges.forEach((edge) => {
      expect(edge.sourceStepId).not.toBe(edge.targetStepId);
    });
  }
  return stepGraph;
}

describe('workflowToSteps', () => {
  describe('extractStepGraph', () => {
    it('should create proper edge connections between steps', async () => {
      const code = `
import {z} from 'zod';

import {
  BubbleFlow,
  AIAgentBubble,
  WebScrapeTool,
  GoogleDriveBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  generatedLaunchPost: string;
  docUrl: string;
  processed: boolean;
}

export interface YCLaunchGeneratorPayload extends WebhookEvent {
  /** Array of URLs to YC launch posts to use as style references. */
  exampleUrls?: string[];
  /** URL to the company's GitHub repository (public). */
  githubRepoUrl: string;
  /** URL to the company's website. */
  companyWebsiteUrl: string;
  /** The current draft of the launch post. */
  currentDraft: string;
  /** Name for the Google Doc that will be created. */
  docName?: string;
}

export class YCLaunchGeneratorFlow extends BubbleFlow<'webhook/http'> {
  
  // Validates that required URLs are present
  private validateInput(payload: YCLaunchGeneratorPayload): void {
    if (!payload.githubRepoUrl || !payload.companyWebsiteUrl || !payload.currentDraft) {
      throw new Error("Missing required inputs: githubRepoUrl, companyWebsiteUrl, or currentDraft.");
    }
  }

  // Scrapes the company website to extract product details and marketing content
  private async scrapeWebsite(url: string): Promise<string> {
    // Using 'markdown' format to preserve structure which helps the AI understand headers and lists.
    // onlyMainContent is true to avoid clutter from navigation menus and footers.
    const websiteScraper = new WebScrapeTool({
      url: url,
      format: 'markdown',
      onlyMainContent: true
    });

    const websiteResult = await websiteScraper.action();

    return websiteResult.success 
      ? (websiteResult.data.content || '[No content found for Company Website]')
      : \`[Failed to retrieve content for Company Website]\`;
  }

  // Scrapes the GitHub repository to extract technical details and implementation information
  private async scrapeRepo(url: string): Promise<string> {
    // Using 'markdown' format to preserve code blocks and documentation structure.
    // onlyMainContent is true to focus on README and key files rather than GitHub UI elements.
    const repoScraper = new WebScrapeTool({
      url: url,
      format: 'markdown',
      onlyMainContent: true
    });

    const repoResult = await repoScraper.action();

    return repoResult.success
      ? (repoResult.data.content || '[No content found for GitHub Repository]')
      : \`[Failed to retrieve content for GitHub Repository]\`;
  }

  // Scrapes a single example YC launch post to learn writing style and structure
  private async scrapeExample(url: string, index: number): Promise<string> {
    // Using 'markdown' format to capture formatting like bold headers, bullet points, and code blocks.
    // onlyMainContent is true to exclude comments and sidebar content, focusing on the post itself.
    const scraper = new WebScrapeTool({
      url: url,
      format: 'markdown',
      onlyMainContent: true
    });

    const result = await scraper.action();

    if (!result.success) {
      console.warn(\`Failed to scrape Example \${index + 1} (\${url}): \${result.error}\`);
      return \`[Failed to retrieve content for Example \${index + 1}]\`;
    }

    return result.data.content || \`[No content found for Example \${index + 1}]\`;
  }

  // Builds the comprehensive context message for the AI agent from all scraped content
  private buildAIPrompt(
    draft: string,
    examplesContent: string,
    websiteContent: string,
    repoContent: string
  ): { systemPrompt: string, message: string } {
    const systemPrompt = \`You are an expert copywriter specializing in YC (Y Combinator) launch posts (Bookface/Hacker News style). 
Your goal is to rewrite a user's draft to match the high-impact, clear, and developer-focused style of successful YC launches.
Analyze the provided 'Style Examples' to understand the tone, structure, and formatting.
Use the 'Company Website' and 'GitHub Repository' content to ensure technical accuracy and depth.
The final output should be a polished, ready-to-publish launch post.\`;

    const message = \`Here is the context for the launch post:

=== STYLE EXAMPLES (Use these for tone and structure) ===

\${examplesContent}

=== COMPANY WEBSITE (Use this for product details) ===

\${websiteContent}

=== GITHUB REPOSITORY (Use this for technical details) ===

\${repoContent}

=== CURRENT DRAFT (Rewrite this) ===

\${draft}

Please generate the best possible YC launch post based on the above.\`;

    return { systemPrompt, message };
  }

  // Uses the AI Agent to synthesize all scraped information and the draft into a final post
  private async generatePost(systemPrompt: string, message: string): Promise<string> {
    // Using gemini-3-pro-preview for high-quality reasoning and creative writing capabilities.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-3-pro-preview' },
      systemPrompt: systemPrompt,
      message: message
    });

    const agentResult = await agent.action();

    if (!agentResult.success) {
      throw new Error(\`AI generation failed: \${agentResult.error}\`);
    }

    return agentResult.data.response;
  }

  // Creates a Google Doc with the generated launch post content
  private async createDoc(content: string, docName: string): Promise<string> {
    // The doc is uploaded as plain text and automatically converted to Google Docs format.
    // Returns the webViewLink URL where users can view and edit the document.
    const googleDrive = new GoogleDriveBubble({
      operation: 'upload_file',
      name: docName,
      content: content,
      mimeType: 'text/plain',
      convert_to_google_docs: true
    });

    const driveResult = await googleDrive.action();

    if (!driveResult.success) {
      throw new Error(\`Failed to create Google Doc: \${driveResult.error}\`);
    }

    if (!driveResult.data.file?.webViewLink) {
      throw new Error('Google Doc was created but no view link was returned');
    }

    return driveResult.data.file.webViewLink;
  }

  // Main workflow orchestration
  async handle(payload: YCLaunchGeneratorPayload): Promise<Output> {
    const { 
      exampleUrls = [], 
      githubRepoUrl, 
      companyWebsiteUrl, 
      currentDraft,
      docName = 'YC Launch Post - Final Draft'
    } = payload;

    this.validateInput(payload);

    const websiteContent = await this.scrapeWebsite(companyWebsiteUrl);

    const repoContent = await this.scrapeRepo(githubRepoUrl);

    // Scrape all example YC launch posts to extract tone, structure, and formatting patterns
    const exampleScrapers: Promise<string>[] = [];

    for (let i = 0; i < exampleUrls.length; i++) {
      exampleScrapers.push(this.scrapeExample(exampleUrls[i], i));
    }

    const exampleContents = await Promise.all(exampleScrapers);

    const examplesContent = exampleContents.join("\\n\\n---\\n\\n");

    // Build AI prompt with all gathered context
    const { systemPrompt, message } = this.buildAIPrompt(
      currentDraft,
      examplesContent,
      websiteContent,
      repoContent
    );

    const generatedPost = await this.generatePost(systemPrompt, message);

    const docUrl = await this.createDoc(generatedPost, docName);

    return {
      generatedLaunchPost: generatedPost,
      docUrl: docUrl,
      processed: true
    };
  }
}
`;

      const validationResult = await getValidationResponse(code);
      const stepGraph = await validateGraph(validationResult);
      // Assert that the workflow was correctly parsed for Promise.all with array.push pattern
      expect(validationResult.workflow).toBeDefined();
      expect(Array.isArray(validationResult.workflow.steps)).toBe(true);
      expect(validationResult.workflow.steps.length).toBeGreaterThan(0);

      const stepsInMain = stepGraph.steps.filter(
        (step) => step.id === 'step-main'
      );
      expect(stepsInMain.length).toBe(0);
    });
  });
});
