import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  category: string;
  response: string;
  metadata: {
    processingTime: number;
    agentUsed: string;
  };
}

export interface CustomWebhookPayload extends WebhookEvent {
  query?: string;
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
    const researchAgent = new AIAgentBubble({
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

    const result = await researchAgent.action();
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
    const researchAgent = new AIAgentBubble({
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

    const result = await researchAgent.action();
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
    const researchAgent = new AIAgentBubble({
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

    const result = await researchAgent.action();
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
    startTime: number
  ): Output {
    const processingTime = Date.now() - startTime;

    return {
      category: categorizedQuery.category,
      response: agentResponse.response,
      metadata: {
        processingTime,
        agentUsed: `${categorizedQuery.category}-research-agent`,
      },
    };
  }

  // Main workflow orchestration with all branching logic
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const startTime = Date.now();

    // Step 1: Validate input
    const {
      query = 'What are the latest developments in artificial intelligence?',
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

    // Step 4: Format and return output
    return this.formatOutput(categorizedQuery, agentResponse, startTime);
  }
}
