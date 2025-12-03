import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  type WebhookEvent,
  ResendBubble,
  GoogleSheetsBubble,
} from '@bubblelab/bubble-core';

export interface Output {
  category: string;
  response: string;
  metadata: {
    processingTime: number;
    agentUsed: string;
  };
  emailSent?: boolean;
  emailId?: string;
  sheetUpdated?: boolean;
  sheetRange?: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  query?: string;
  /** Email address where research results should be sent. Provide your email to receive the research findings. */
  recipientEmail?: string;
  /** The spreadsheet ID is the long string in the URL right after /d/ and before the next / in the URL. */
  spreadsheetId?: string;
  /** The sheet name where data should be appended. Use the exact tab name from your Google Sheet. */
  sheetName?: string;
}

// Category types for research routing
type ResearchCategory = 'general' | 'technical' | 'academic';

interface CategorizedQuery {
  category: ResearchCategory;
  confidence: number;
  reasoning: string;
}

interface AgentResponse {
  response: string;
  sources: string[];
  category: ResearchCategory;
}

export class ResearchFlow extends BubbleFlow<'webhook/http'> {
  // Atomic function: Input validation
  private validateInput(query: string): string {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      throw new Error('Query must be at least 3 characters long');
    }
    return trimmed;
  }

  // Atomic function: Query categorization
  private async categorizeQuery(query: string): Promise<CategorizedQuery> {
    const categorizer = new AIAgentBubble({
      message: `Analyze this research query and categorize it into one of three types:

1. "general" - General news, facts, current events, basic information
2. "technical" - Programming, APIs, technical documentation, development topics  
3. "academic" - Research papers, scientific studies, academic content

Query: "${query}"

Respond with JSON:
{
  "category": "general|technical|academic",
  "confidence": 0.9,
  "reasoning": "Brief explanation of why this category was chosen"
}`,
      systemPrompt:
        'You are a research query categorization expert. Analyze queries and determine the most appropriate research domain.',
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.1,
        jsonMode: true,
      },
    });

    const result = await categorizer.action();

    if (!result.success) {
      // Fallback to general category
      return {
        category: 'general',
        confidence: 0.5,
        reasoning: 'Categorization failed, using default',
      };
    }

    try {
      const parsed = JSON.parse(result.data.response) as CategorizedQuery;
      return parsed;
    } catch {
      return {
        category: 'general',
        confidence: 0.5,
        reasoning: 'JSON parsing failed, using default',
      };
    }
  }

  // Atomic function: General research
  private async performGeneralResearch(query: string): Promise<AgentResponse> {
    // News and Current Events Researcher - specializes in general information, news, facts, and current events
    // Uses web search to find reliable sources and provides accurate, up-to-date information
    const newsResearcher = new AIAgentBubble({
      message: query,
      systemPrompt:
        'You are a general research assistant focused on providing accurate, up-to-date information on news, facts, and general topics. Use web search to find reliable sources.',
      model: { model: 'google/gemini-2.5-flash' },
      tools: [
        {
          name: 'web-search-tool',
          config: { limit: 3 },
        },
      ],
    });

    const result = await newsResearcher.action();
    if (!result.success) {
      throw new Error(`General research agent failed: ${result.error}`);
    }

    return {
      response: result.data.response,
      sources: result.data.toolCalls
        .filter((call) => call.tool === 'web-search-tool' && call.output)
        .map((call) => JSON.stringify(call.output)),
      category: 'general',
    };
  }

  // Atomic function: Technical research
  private async performTechnicalResearch(
    query: string
  ): Promise<AgentResponse> {
    // Developer and Technical Researcher - specializes in programming, APIs, documentation, and development
    // Focuses on finding specific technical details, code examples, and implementation guidance
    const developerResearcher = new AIAgentBubble({
      message: query,
      systemPrompt:
        'You are a technical research expert specializing in programming, APIs, documentation, and development. Find specific technical details and code examples when relevant.',
      model: { model: 'google/gemini-2.5-flash' },
      tools: [
        {
          name: 'web-search-tool',
          config: { limit: 2 },
        },
      ],
    });

    const result = await developerResearcher.action();
    if (!result.success) {
      throw new Error(`Technical research agent failed: ${result.error}`);
    }

    return {
      response: result.data.response,
      sources: result.data.toolCalls
        .filter((call) => call.tool === 'web-search-tool' && call.output)
        .map((call) => JSON.stringify(call.output)),
      category: 'technical',
    };
  }

  // Atomic function: Academic research
  private async performAcademicResearch(query: string): Promise<AgentResponse> {
    // Academic and Scholarly Content Researcher - specializes in research papers and scientific studies
    // Prioritizes academic sources, peer-reviewed content, and scholarly research materials
    const academicResearcher = new AIAgentBubble({
      message: query,
      systemPrompt:
        'You are an academic research assistant focused on finding research papers, scientific studies, and scholarly content. Prioritize academic sources.',
      model: { model: 'google/gemini-2.5-flash' },
      tools: [
        {
          name: 'web-search-tool',
          config: { limit: 2 },
        },
      ],
    });

    const result = await academicResearcher.action();
    if (!result.success) {
      throw new Error(`Academic research agent failed: ${result.error}`);
    }

    return {
      response: result.data.response,
      sources: result.data.toolCalls
        .filter((call) => call.tool === 'web-search-tool' && call.output)
        .map((call) => JSON.stringify(call.output)),
      category: 'academic',
    };
  }

  // Atomic function: Output formatting
  private formatOutput(
    categorizedQuery: CategorizedQuery,
    agentResponse: AgentResponse,
    startTime: number,
    emailSent?: boolean,
    emailId?: string,
    sheetUpdated?: boolean,
    sheetRange?: string
  ): Output {
    const processingTime = Date.now() - startTime;

    return {
      category: categorizedQuery.category,
      response: agentResponse.response,
      metadata: {
        processingTime,
        agentUsed: `${categorizedQuery.category}-research-agent`,
      },
      emailSent,
      emailId,
      sheetUpdated,
      sheetRange,
    };
  }

  // Atomic function: Send research results via email and append to Google Sheets
  private async sendResults(
    recipientEmail: string,
    query: string,
    category: ResearchCategory,
    response: string,
    sources: string[],
    spreadsheetId: string,
    sheetName: string
  ): Promise<{ emailId: string; updatedRange: string }> {
    // Sends the research results to the specified email address using formatted content
    // The email includes the original query, the research response, and all source references
    // Uses bubblelab's default email sender and formats the content in HTML for better readability
    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [recipientEmail],
      subject: `Research Results: ${query}`,
      html: `<h2>Research Results</h2>
        <p><strong>Query:</strong> ${query}</p>
        <p><strong>Category:</strong> ${category}</p>
        <hr>
        <h3>Response:</h3>
        <div>${response.replace(/\n/g, '<br>')}</div>
        <hr>
        <h4>Sources:</h4>
        <ul>
          ${sources.map((source) => `<li>${source}</li>`).join('')}
        </ul>`,
    });

    const emailResult = await emailSender.action();
    if (!emailResult.success) {
      throw new Error(`Email sending failed: ${emailResult.error}`);
    }

    // Appends research results as a new row to the specified Google Sheet
    // The row includes timestamp, query, category, response summary, and source count
    // Uses ROWS major dimension to append data as a single row of values
    const sheetUpdater = new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: `${sheetName}!A:E`,
      values: [
        [
          new Date().toISOString(),
          query,
          category,
          response.substring(0, 500) + (response.length > 500 ? '...' : ''),
          `${sources.length} source(s)`,
        ],
      ],
      major_dimension: 'ROWS',
      value_input_option: 'USER_ENTERED',
      insert_data_option: 'INSERT_ROWS',
      include_values_in_response: false,
    });

    const sheetResult = await sheetUpdater.action();
    if (!sheetResult.success) {
      throw new Error(`Google Sheets append failed: ${sheetResult.error}`);
    }

    return {
      emailId: emailResult.data.email_id || 'unknown',
      updatedRange: sheetResult.data.updated_range || 'unknown',
    };
  }

  // Main workflow orchestration with all branching logic
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const startTime = Date.now();

    // Step 1: Validate input
    const {
      query = 'What are the latest developments in artificial intelligence?',
      recipientEmail,
      spreadsheetId = '',
      sheetName = 'Sheet1',
    } = payload;
    const validatedQuery = this.validateInput(query);

    // Step 2: Categorize the query
    const categorizedQuery = await this.categorizeQuery(validatedQuery);

    // Step 3: Branching logic - route to specialized agent
    let agentResponse: AgentResponse;

    if (categorizedQuery.category === 'general') {
      agentResponse = await this.performGeneralResearch(validatedQuery);
    } else if (categorizedQuery.category === 'technical') {
      agentResponse = await this.performTechnicalResearch(validatedQuery);
    } else if (categorizedQuery.category === 'academic') {
      agentResponse = await this.performAcademicResearch(validatedQuery);
    } else {
      // Fallback to general if category is unexpected
      agentResponse = await this.performGeneralResearch(validatedQuery);
    }

    // Step 4: Send results via email and append to Google Sheets if both recipient and spreadsheet provided
    let resultData: { emailId: string; updatedRange: string } | undefined;
    if (recipientEmail && spreadsheetId) {
      resultData = await this.sendResults(
        recipientEmail,
        validatedQuery,
        categorizedQuery.category,
        agentResponse.response,
        agentResponse.sources,
        spreadsheetId,
        sheetName
      );
    }

    // Step 5: Format and return output
    const a = this.formatOutput(
      categorizedQuery,
      agentResponse,
      startTime,
      !!resultData,
      resultData?.emailId,
      !!resultData,
      resultData?.updatedRange
    );
    return a;
  }
}
