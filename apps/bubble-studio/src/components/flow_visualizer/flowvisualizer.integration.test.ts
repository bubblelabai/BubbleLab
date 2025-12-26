import { describe, it, expect } from 'vitest';
import { extractStepGraph, type StepGraph } from '../../utils/workflowToSteps';
import type {
  ParsedBubbleWithInfo,
  ValidateBubbleFlowResponse,
} from '@bubblelab/shared-schemas';
import { displayBubbles } from '../../utils/workflowUtils';

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
  if (!validationResult.valid) {
    console.error(JSON.stringify(validationResult, null, 2));
  }
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

async function validateEachBubbleHasAtLeastOneClone(
  validationResult: ValidateBubbleFlowResponse
) {
  const bubbles = displayBubbles(validationResult.workflow!);
  console.log(JSON.stringify(bubbles, null, 2));
  bubbles.bubbles.forEach((bubble) => {
    expect(
      bubbles.clonedBubbles.some(
        (clonedBubble) => clonedBubble.variableId === bubble.variableId
      )
    ).toBe(true);
  });
}

async function validateAllNodesAreUsed(
  validationResult: ValidateBubbleFlowResponse
) {
  const stepGraph = await validateGraph(validationResult);
  expect(validationResult.workflow).toBeDefined();
  expect(Array.isArray(validationResult.workflow?.root)).toBe(true);
  expect(validationResult.workflow?.root.length).toBeGreaterThan(0);
  const stepsInMain = stepGraph.steps.filter((step) => step.id === 'step-main');
  // print workflow bubbles
  // console.log(JSON.stringify(validationResult.workflow?.bubbles, null, 2));
  console.log(JSON.stringify(stepGraph, null, 2));
  if (stepsInMain.length > 0) {
    // Print the bubble names, variableId, clonedFromVariableId
    stepsInMain.forEach((step) => {
      step.bubbleIds.forEach((bubbleId) => {
        const bubble = validationResult.workflow?.bubbles[bubbleId];
        console.warn(
          `Bubble ${bubble?.variableName} at ${bubble?.location.startLine}:${bubble?.location.startCol} variableId: ${bubble?.variableId} clonedFromVariableId: ${bubble?.clonedFromVariableId}`
        );
      });
    });
  }
  expect(stepsInMain.length).toBe(0);
}

describe('workflowToSteps', () => {
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
    await validateAllNodesAreUsed(validationResult);
  });
  it('should handle AI agent with tool configurations', async () => {
    const code = `
import {z} from 'zod';

import {
  // Base classes
  BubbleFlow,

  // Service Bubbles
  GithubBubble,
  AIAgentBubble,

  // Event Types
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  comparisonAndValidation: string;
  processed: boolean;
}

export interface GithubComparisonPayload extends WebhookEvent {
  /** First GitHub repository URL or "owner/repo" string. */
  repo1: string;
  /** Second GitHub repository URL or "owner/repo" string. */
  repo2: string;
  /** Text to validate for factual correctness. */
  validationText: string;
}

interface RepoDetails {
  owner: string;
  repo: string;
}

export class GithubRepoComparatorFlow extends BubbleFlow<'webhook/http'> {
  
  // Parses a GitHub repository string (URL or "owner/repo") into owner and repo names
  private parseRepoString(input: string): RepoDetails {
    const cleanInput = input.trim();
    
    // Handle full URLs
    if (cleanInput.startsWith('http')) {
      const urlParts = cleanInput.split('/');
      // https://github.com/owner/repo
      const repoIndex = urlParts.length - 1;
      const ownerIndex = urlParts.length - 2;
      return {
        owner: urlParts[ownerIndex],
        repo: urlParts[repoIndex].replace('.git', '')
      };
    }
    
    // Handle "owner/repo" format
    const parts = cleanInput.split('/');
    if (parts.length === 2) {
      return {
        owner: parts[0],
        repo: parts[1]
      };
    }
    
    throw new Error(\`Invalid repository format: \${input}. Expected "owner/repo" or full GitHub URL.\`);
  }

  // Fetches repository file structure and README content to build a context summary
  private async fetchRepoContext(details: RepoDetails): Promise<string> {
    const { owner, repo } = details;
    let context = \`Repository: \${owner}/\${repo}\\n\`;

    // 1. Get file structure (root directory)
    // Lists files in the root directory to understand project structure and language
    const dirBubble = new GithubBubble({
      operation: 'get_directory',
      owner,
      repo,
      path: '' // Root
    });

    const dirResult = await dirBubble.action();
    
    if (dirResult.success && dirResult.data?.contents) {
      const files = dirResult.data.contents.map((f: any) => f.name).join(', ');
      context += \`Root Files: \${files}\\n\`;
    } else {
      context += \`Root Files: Unable to list (Error: \${dirResult.error || 'Unknown'})\\n\`;
    }

    // 2. Get README.md content
    // Fetches the README file to get the project description and documentation
    const readmeBubble = new GithubBubble({
      operation: 'get_file',
      owner,
      repo,
      path: 'README.md'
    });

    const readmeResult = await readmeBubble.action();

    if (readmeResult.success && readmeResult.data?.content) {
      // Content is base64 encoded
      const decoded = Buffer.from(readmeResult.data.content, 'base64').toString('utf-8');
      // Truncate if too long to avoid token limits (e.g., first 5000 chars)
      const truncated = decoded.length > 5000 ? decoded.substring(0, 5000) + '...[truncated]' : decoded;
      context += \`README Content:\\n\${truncated}\\n\`;
    } else {
      // Try lowercase readme.md just in case
      const readmeLowerBubble = new GithubBubble({
        operation: 'get_file',
        owner,
        repo,
        path: 'readme.md'
      });
      const lowerResult = await readmeLowerBubble.action();
      if (lowerResult.success && lowerResult.data?.content) {
         const decoded = Buffer.from(lowerResult.data.content, 'base64').toString('utf-8');
         const truncated = decoded.length > 5000 ? decoded.substring(0, 5000) + '...[truncated]' : decoded;
         context += \`README Content:\\n\${truncated}\\n\`;
      } else {
         context += \`README Content: Not found or unable to fetch.\\n\`;
      }
    }

    return context;
  }

  // Uses AI to compare the two repositories and validate the user's text
  private async performComparisonAndValidation(
    repo1Context: string, 
    repo2Context: string, 
    validationText: string
  ): Promise<string> {
    // Analyzes both repositories and the validation text to generate a comprehensive report
    // Uses gemini-3-pro-preview for advanced reasoning capabilities required for code comparison
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-3-pro-preview' },
      systemPrompt: \`You are an expert Senior Software Engineer and Technical Auditor. 
Your task is to:
1. Compare two GitHub repositories based on their file structure and README content. Highlight key differences in purpose, tech stack, and architecture.
2. Validate a specific text provided by the user for factual correctness. If the text relates to the repos, use the repo context. If it's general knowledge, use your internal knowledge base.

Structure your response clearly with headings: "Repository Comparison" and "Factual Validation".\`,
      message: \`Here is the data for analysis:

=== REPOSITORY 1 ===
\${repo1Context}

=== REPOSITORY 2 ===
\${repo2Context}

=== TEXT TO VALIDATE ===
\${validationText}\`
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(\`AI Analysis failed: \${result.error}\`);
    }

    return result.data.response;
  }

  async handle(payload: GithubComparisonPayload): Promise<Output> {
    // Default values for destructuring
    const { 
      repo1 = 'facebook/react', 
      repo2 = 'vuejs/core', 
      validationText = 'React uses a virtual DOM while Vue uses a real DOM exclusively.' 
    } = payload;

    // 1. Parse Repo Strings
    const repo1Details = this.parseRepoString(repo1);
    const repo2Details = this.parseRepoString(repo2);

    // 2. Fetch Context for both repos
    // We run these sequentially to ensure stability, though Promise.all could be used for speed
    const repo1Context = await this.fetchRepoContext(repo1Details);
    const repo2Context = await this.fetchRepoContext(repo2Details);

    // 3. Perform AI Analysis
    const analysisResult = await this.performComparisonAndValidation(repo1Context, repo2Context, validationText);

    return {
      comparisonAndValidation: analysisResult,
      processed: true
    };
  }
}
`;

    const validationResult = await getValidationResponse(code);
    await validateEachBubbleHasAtLeastOneClone(validationResult);
    await validateAllNodesAreUsed(validationResult);
  });
  it('should handle variables with same name in different scopes', async () => {
    const code = `
import { BubbleFlow, AIAgentBubble, type WebhookEvent } from '@bubblelab/bubble-core';

export interface CustomWebhookPayload extends WebhookEvent {
  input?: string;
}

export interface Output {
  message: string;
  processed: boolean;
}

export class TestFlow extends BubbleFlow<'webhook/http'> {
  
  private transformData(input: string | undefined): string | null {
    if (!input || input.trim().length === 0) return null;
    return input.trim().toUpperCase();
  }

  private async processWithAI(input: string): Promise<string> {

   if (input === 'Hello, how are you?2') {
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt: 'You are a helpful assistant.',
      message: \`Process this input: \${input}\`
    });
    await agent.action();
    return "fd";
   }
    if (input === 'Hello, how are you?') {
      const agent = new AIAgentBubble({
        model: { model: 'google/gemini-2.5-flash' },
        systemPrompt: 'You are a helpful assistant.',
        message: 'Hello, how are you?',
      });
       await agent.action();
      return "fd";
    }

    return "fd"
  }

  private formatOutput(response: string | null, wasProcessed: boolean): Output {
    return {
      message: response || 'No input provided',
      processed: wasProcessed,
    };
  }

  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const transformedInput = this.transformData(payload.input);

    let aiResponse: string | null = null;
    if (transformedInput && transformedInput.length > 3) {
      aiResponse = await this.processWithAI(transformedInput);
    }

    return this.formatOutput(aiResponse, aiResponse !== null);
  }
}
`;
    const validationResult = await getValidationResponse(code);
    await validateEachBubbleHasAtLeastOneClone(validationResult);
    await validateAllNodesAreUsed(validationResult);
  });

  it('should handle custom tools with functions', async () => {
    const code = `
import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  GoogleSheetsBubble,
  GoogleCalendarBubble,
  TelegramBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface DentalClinicOutput {
  /** The final response from the AI assistant. */
  response: string;
  /** Whether the request was processed successfully. */
  success: boolean;
}

export interface DentalClinicPayload extends WebhookEvent {
  /**
   * The message or inquiry from the patient.
   * @canBeFile true
   */
  message: string;

  /**
   * Telegram Chat ID to send the response back to.
   * Right-click a message in the chat and select "Copy Link" or use a bot like @userinfobot to find it.
   * @canBeFile false
   */
  chatId?: string;

  /**
   * The Google Sheets spreadsheet ID where appointments are recorded.
   * Found in the URL: docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   * @canBeFile false
   */
  spreadsheetId: string;

  /**
   * The Google Calendar ID for checking availability and booking.
   * Usually your email address or found in Calendar Settings -> Integrate calendar.
   * @canBeFile false
   */
  calendarId: string;

  /**
   * The name of the sheet within the spreadsheet to use.
   * Defaults to 'Appointments' if not provided.
   * @canBeFile false
   */
  sheetName?: string;
}

export class DentalClinicFlow extends BubbleFlow<'webhook/http'> {
  /**
   * Orchestrates the dental clinic assistant logic by defining tools and running the AI agent.
   */
  private async runDentalAssistant(
    message: string,
    spreadsheetId: string,
    calendarId: string,
    sheetName: string = 'Appointments'
  ) {
    const now = new Date().toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
    });

    // Defines the core AI agent that acts as a front-desk assistant for the dental clinic.
    // It uses custom tools to check calendar availability, book appointments, and record data in sheets.
    // The system prompt is configured to maintain a professional, friendly KL-based clinic persona.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-3-pro-preview' },
      message: message,
      systemPrompt: \`
# Role

# Task
- Collect customer information for their inquiry, including name, phone number, and email.
- Schedule appointments based on availability in Google Calendar, ensuring to offer alternative slots if the requested time is unavailable.
- Use Google Sheets to record confirmed appointments accurately.
- Redirect medical or diagnosis-related questions to licensed professionals, emphasizing the need to consult with a dentist during their appointment.

## Specifics
- Confirm available slots before booking and suggest the nearest available time if the requested slot is taken.
- Politely gather all necessary details for booking: name, phone, email, and service type.
- If a user is unsure about the service they need, suggest starting with a Dental Checkup.
- Remind users of the clinic's operating hours and services offered when necessary.
- Do not provide medical advice or imply diagnosis; instead, encourage consultation with a dentist.
- Ask the user how can you help them first. Ask if they need to make an appointment.

# Tools
1. **checkAvailability** — To check for appointment availability in Google Calendar.
2. **bookAppointment** — To create a new appointment in Google Calendar AND record it in Google Sheets.
3. **getAppointmentData** — To retrieve existing appointment information from Google Sheets.

# Notes
- **Tone:** Maintain a friendly, calm, and professional demeanor throughout interactions, mirroring a helpful clinic receptionist.
- **Style:** Be polite and conversational, using simple language to ensure clarity and ease of understanding for all patients.
- **Behavior to Avoid:** Never provide or imply medical advice. Avoid overly technical or robotic phrasing and ensure the conversation flows smoothly, prioritizing a human-like interaction.
- **Confirmation and Clarification:** Always confirm details clearly before proceeding with bookings and clarify any uncertainties by asking for more information or redirecting to clinic professionals.
- Keep messages short and sweet.
- Only create the event when you have all the information (Name, phone, email, date and time of appointment and services requested).
      \`,
      customTools: [
        {
          name: 'checkAvailability',
          description:
            'Checks for existing events in the Google Calendar within a specific time range to determine availability.',
          schema: z.object({
            timeMin: z.string().describe('Lower bound (RFC3339 timestamp)'),
            timeMax: z.string().describe('Upper bound (RFC3339 timestamp)'),
          }),
          func: async (input: Record<string, unknown>) => {
            const { timeMin, timeMax } = input as {
              timeMin: string;
              timeMax: string;
            };
            // Lists events from the specified Google Calendar to check for scheduling conflicts.
            const result = await new GoogleCalendarBubble({
              operation: 'list_events',
              calendar_id: calendarId,
              time_min: timeMin,
              time_max: timeMax,
              single_events: true,
            }).action();
            return result.data;
          },
        },
        {
          name: 'bookAppointment',
          description:
            'Creates a calendar event and appends the appointment details to a Google Sheet.',
          schema: z.object({
            name: z.string(),
            phone: z.string(),
            email: z.string(),
            serviceType: z.string(),
            startTime: z.string().describe('RFC3339 timestamp'),
            endTime: z.string().describe('RFC3339 timestamp'),
          }),
          func: async (input: Record<string, unknown>) => {
            const { name, phone, email, serviceType, startTime, endTime } =
              input as {
                name: string;
                phone: string;
                email: string;
                serviceType: string;
                startTime: string;
                endTime: string;
              };
            // Creates a new event in the Google Calendar for the confirmed appointment slot.
            const calResult = await new GoogleCalendarBubble({
              operation: 'create_event',
              calendar_id: calendarId,
              summary: \`Dental Appt: \${name} (\${serviceType})\`,
              description: \`Patient: \${name}\\nPhone: \${phone}\\nEmail: \${email}\\nService: \${serviceType}\`,
              start: { dateTime: startTime },
              end: { dateTime: endTime },
            }).action();

            // Appends the appointment details as a new row in the specified Google Sheet for record-keeping.
            const sheetResult = await new GoogleSheetsBubble({
              operation: 'append_values',
              spreadsheet_id: spreadsheetId,
              range: \`\${sheetName}!A:E\`,
              values: [[name, phone, email, serviceType, startTime]],
              value_input_option: 'USER_ENTERED',
            }).action();

            return { calendar: calResult.data, sheets: sheetResult.data };
          },
        },
        {
          name: 'getAppointmentData',
          description: 'Retrieves appointment records from the Google Sheet.',
          schema: z.object({
            range: z
              .string()
              .optional()
              .describe('A1 notation range, e.g., "Sheet1!A1:E10"'),
          }),
          func: async (input: Record<string, unknown>) => {
            const { range } = input as { range?: string };
            // Reads appointment data from the Google Sheet to retrieve existing records or verify bookings.
            const result = await new GoogleSheetsBubble({
              operation: 'read_values',
              spreadsheet_id: spreadsheetId,
              range: range || \`\${sheetName}!A:E\`,
            }).action();
            return result.data;
          },
        },
      ],
    });

    const result = await agent.action();
    if (!result.success || !result.data) {
      throw new Error(\`AI Agent failed: \${result.error || 'No data returned'}\`);
    }

    return result.data.response;
  }

  /**
   * Sends the AI's response back to the user via Telegram.
   */
  private async sendTelegramReply(chatId: string, text: string) {
    // Sends a text message to the specified Telegram chat ID using the bot integration.
    const result = await new TelegramBubble({
      operation: 'send_message',
      chat_id: chatId,
      text: text,
    }).action();

    if (!result.success) {
      this.logger?.error(\`Failed to send Telegram message: \${result.error}\`);
    }
  }

  /**
   * Main workflow orchestration for the Dental Clinic Assistant.
   */
  async handle(payload: DentalClinicPayload): Promise<DentalClinicOutput> {
    const {
      message,
      chatId,
      spreadsheetId,
      calendarId,
      sheetName = 'Appointments',
    } = payload;

    const aiResponse = await this.runDentalAssistant(
      message,
      spreadsheetId,
      calendarId,
      sheetName
    );

    // If a Telegram chat ID is provided, send the response back to the user on Telegram.
    if (chatId) {
      await this.sendTelegramReply(chatId, aiResponse as unknown as string);
    }

    return {
      response: aiResponse as unknown as string,
      success: true,
    };
  }
}
`;
    const validationResult = await getValidationResponse(code);
    // See validation result's ai agent has functionNodeChilren
    const aiAgentBubbleID = Object.keys(
      validationResult.workflow?.bubbles || {}
    ).find(
      (key) =>
        validationResult.workflow?.bubbles?.[key]?.bubbleName === 'ai-agent'
    );
    if (aiAgentBubbleID) {
      expect(
        validationResult.workflow?.bubbles[aiAgentBubbleID]?.dependencyGraph
          ?.functionCallChildren
      ).toBeDefined();
    }
    await validateAllNodesAreUsed(validationResult);
  });
});
