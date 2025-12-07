import { z } from 'zod';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { SafeGeminiChat } from '../../utils/safe-gemini-chat.js';
import { AvailableModels } from '@bubblelab/shared-schemas';
import { BubbleFactory } from '../../bubble-factory.js';
import type { BubbleName } from '@bubblelab/shared-schemas';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';

// Define tool call interface (from LangChain)
interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// Define verbosity levels
const VerbosityLevel = z
  .enum(['1', '2', '3', '4', '5'])
  .describe(
    'Verbosity level: 1=concise, 2=brief, 3=moderate, 4=detailed, 5=comprehensive'
  );

// Define technicality levels
const TechnicalityLevel = z
  .enum(['1', '2', '3', '4', '5'])
  .describe(
    'Technicality level: 1=non-technical, 2=basic, 3=intermediate, 4=advanced, 5=expert'
  );

// Define Slack block types for structured output
const SlackBlockType = z.enum([
  'section',
  'header',
  'divider',
  'context',
  'actions',
  'input',
  'file',
  'image',
]);

// Define model configuration
const ModelConfigSchema = z.object({
  model: AvailableModels.default('google/gemini-2.5-flash').describe(
    'AI model to use (format: provider/model-name)'
  ),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .default(0.7)
    .describe(
      'Temperature for response randomness (0 = deterministic, 2 = very random)'
    ),
  maxTokens: z
    .number()
    .positive()
    .optional()
    .default(10000)
    .describe('Maximum number of tokens to generate in response'),
});

// Define tool configuration
const ToolConfigSchema = z.object({
  name: z
    .string()
    .describe('Name of the tool bubble to enable for the AI agent'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .default({})
    .optional()
    .describe(
      'Credential types to use for the tool bubble (injected at runtime)'
    ),
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Configuration for the tool bubble'),
});

// Define the parameters schema for the Slack Formatter Agent bubble
const SlackFormatterAgentParamsSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .describe('The message or question to send to the AI agent'),
  verbosity: VerbosityLevel.default('3').describe(
    'Response verbosity level (1-5): 1=concise bullet points, 5=comprehensive explanations'
  ),
  technicality: TechnicalityLevel.default('3').describe(
    'Technical complexity level (1-5): 1=plain English, 5=expert terminology'
  ),
  includeBlockKit: z
    .boolean()
    .default(true)
    .describe('Include Slack Block Kit JSON for rich formatting'),
  includeQuery: z
    .boolean()
    .default(false)
    .describe('Include the query that was executed in the response'),
  includeExplanation: z
    .boolean()
    .default(false)
    .describe(
      'Include explanation of what the query does and why it was chosen'
    ),
  model: ModelConfigSchema.default({
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 50000,
  }).describe(
    'AI model configuration including provider, temperature, and tokens'
  ),
  tools: z
    .array(ToolConfigSchema)
    .default([])
    .describe('Array of tool bubbles the AI agent can use'),
  maxIterations: z
    .number()
    .positive()
    .default(10)
    .describe('Maximum number of iterations for the agent workflow'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
  additionalContext: z
    .string()
    .optional()
    .describe('Additional context about how to answer the question'),
});

const SlackFormatterAgentResultSchema = z.object({
  response: z
    .string()
    .describe('The AI agents formatted response in Slack markdown'),
  blocks: z
    .array(
      z.object({
        type: SlackBlockType,
        text: z
          .object({
            type: z.enum(['plain_text', 'mrkdwn']),
            text: z.string(),
            emoji: z.boolean().optional(),
            verbatim: z.boolean().optional(),
          })
          .optional(),
        block_id: z.string().optional(),
        accessory: z.unknown().optional(),
        fields: z
          .array(
            z.object({
              type: z.enum(['plain_text', 'mrkdwn']),
              text: z.string(),
              emoji: z.boolean().optional(),
              verbatim: z.boolean().optional(),
            })
          )
          .optional(),
        element: z.unknown().optional(),
        label: z.unknown().optional(),
        hint: z.unknown().optional(),
        optional: z.boolean().optional(),
        alt_text: z.string().optional(),
        image_url: z.string().optional(),
        title: z
          .object({
            type: z.enum(['plain_text']),
            text: z.string(),
            emoji: z.boolean().optional(),
          })
          .optional(),
        // Add elements field for context blocks
        elements: z
          .array(
            z.object({
              type: z.enum(['plain_text', 'mrkdwn']),
              text: z.string(),
              emoji: z.boolean().optional(),
              verbatim: z.boolean().optional(),
            })
          )
          .optional(),
      })
    )
    .optional()
    .describe('Slack Block Kit formatted blocks for rich message display'),
  metadata: z
    .object({
      verbosityLevel: z.string().describe('Applied verbosity level'),
      technicalityLevel: z.string().describe('Applied technicality level'),
      wordCount: z.number().describe('Total word count of response'),
      blockCount: z
        .number()
        .optional()
        .describe('Number of Slack blocks generated'),
    })
    .describe('Metadata about the formatting'),
  toolCalls: z
    .array(
      z.object({
        tool: z.string().describe('Name of the tool that was called'),
        input: z.unknown().describe('Input parameters passed to the tool'),
        output: z.unknown().describe('Output returned by the tool'),
      })
    )
    .optional()
    .describe('Array of tool calls made during the conversation'),
  iterations: z
    .number()
    .describe('Number of back-and-forth iterations in the agent workflow'),
  error: z
    .string()
    .describe('Error message of the run, undefined if successful'),
  success: z
    .boolean()
    .describe('Whether the agent execution completed successfully'),
});

type SlackFormatterAgentParams = z.input<
  typeof SlackFormatterAgentParamsSchema
>;
type SlackFormatterAgentParamsParsed = z.output<
  typeof SlackFormatterAgentParamsSchema
>;

type SlackFormatterAgentResult = z.output<
  typeof SlackFormatterAgentResultSchema
>;

export class SlackFormatterAgentBubble extends WorkflowBubble<
  SlackFormatterAgentParamsParsed,
  SlackFormatterAgentResult
> {
  static readonly type = 'service' as const;
  static readonly service = 'slack-formatter-agent';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName: BubbleName = 'slack-formatter-agent';
  static readonly schema = SlackFormatterAgentParamsSchema;
  static readonly resultSchema = SlackFormatterAgentResultSchema;
  static readonly shortDescription =
    'AI agent for creating well-formatted Slack messages with adjustable verbosity and technicality';
  static readonly longDescription = `
    An AI agent that specializes in generating properly formatted Slack messages with:
    - Adjustable verbosity levels (1-5): from concise bullet points to comprehensive explanations
    - Adjustable technicality levels (1-5): from plain English to expert terminology
    - Native Slack markdown formatting (bold, italic, code blocks, lists)
    - Optional Slack Block Kit JSON for rich interactive messages
    - Tool integration for dynamic content generation
    
    Perfect for:
    - Creating consistent Slack notifications with appropriate detail level
    - Adapting any content for different audiences
    - Generating interactive Slack messages with Block Kit
    - Formatting summaries, reports, and updates for Slack channels
    - Building engaging team communications with proper structure
    - Converting any information into Slack-friendly format
  `;
  static readonly alias = 'slack-format';

  private factory: BubbleFactory;

  constructor(
    params: SlackFormatterAgentParams = {
      message: 'Hello, format this for Slack',
      verbosity: '3',
      technicality: '3',
    },
    context?: BubbleContext
  ) {
    super(params, context);
    this.factory = new BubbleFactory();
  }

  public async testCredential(): Promise<boolean> {
    // Make a test API call to the model provider
    const llm = this.initializeModel(this.params.model);
    const response = await llm.invoke(['Hello, test formatting']);
    if (response.content) {
      return true;
    }
    return false;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<SlackFormatterAgentResult> {
    // Context is available but not currently used in this implementation
    void context;
    const {
      message,
      verbosity,
      technicality,
      includeBlockKit,
      model,
      tools,
      maxIterations,
    } = this.params;

    try {
      // Initialize the language model
      const llm = this.initializeModel(model);

      // Initialize tools
      const agentTools = await this.initializeTools(tools);

      // Create the specialized system prompt for Slack formatting
      const systemPrompt = this.createSlackFormatterPrompt(
        verbosity,
        technicality,
        includeBlockKit,
        this.params.includeQuery,
        this.params.includeExplanation
      );

      // Create the agent graph
      const graph = await this.createAgentGraph(llm, agentTools, systemPrompt);

      // Execute the agent
      const result = await this.executeAgent(graph, message, maxIterations);

      // Parse the response to extract blocks if included
      const blocks = includeBlockKit
        ? this.extractSlackBlocks(result.response)
        : undefined;

      // Calculate metadata
      const wordCount = result.response.split(/\s+/).length;
      const blockCount = blocks?.length || 0;

      const finalResult = {
        ...result,
        blocks,
        metadata: {
          verbosityLevel: verbosity,
          technicalityLevel: technicality,
          wordCount,
          blockCount,
        },
      };

      return finalResult;
    } catch (error) {
      return {
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        iterations: 0,
        metadata: {
          verbosityLevel: verbosity,
          technicalityLevel: technicality,
          wordCount: 0,
        },
      };
    }
  }

  protected chooseCredential(): string | undefined {
    const { model } = this.params;
    const credentials = this.params.credentials as
      | Record<CredentialType, string>
      | undefined;
    const [provider] = model.model.split('/');

    // If no credentials were injected, throw error immediately
    if (!credentials || typeof credentials !== 'object') {
      throw new Error(`No ${provider.toUpperCase()} credentials provided`);
    }

    // Choose credential based on the model provider
    switch (provider) {
      case 'openai':
        return credentials[CredentialType.OPENAI_CRED];
      case 'google':
        return credentials[CredentialType.GOOGLE_GEMINI_CRED];
      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  private createSlackFormatterPrompt(
    verbosity: string,
    technicality: string,
    includeBlockKit: boolean,
    includeQuery: boolean,
    includeExplanation: boolean
  ): string {
    const verbosityDescriptions = {
      '1': 'very concise - key numbers only, minimal text',
      '2': 'brief - essential points in short sentences',
      '3': 'balanced - clear but not lengthy',
      '4': 'detailed - thorough coverage without excess',
      '5': 'comprehensive - complete analysis when needed',
    };

    const technicalityDescriptions = {
      '1': 'non-technical - plain English, no jargon, explain like to a child',
      '2': 'basic - simple terms, minimal technical language',
      '3': 'intermediate - some technical terms with brief explanations',
      '4': 'advanced - technical language appropriate for professionals',
      '5': 'expert - full technical terminology and complex concepts',
    };

    let prompt = `You're a helpful assistant who communicates clearly and effectively. Always be precise but accessible, proactive about providing context, and comfortable admitting limitations when information is incomplete.

Additional context:
${this.params.additionalContext}

**Core principles (apply regardless of verbosity):**
- Be precise but accessible - use specific details and clear explanations
- Proactively provide relevant context and background information
- Comfortable admitting when information is incomplete or uncertain  
- Always clarify key definitions, timeframes, and important assumptions

**Response style:**
- Verbosity: ${verbosityDescriptions[verbosity as keyof typeof verbosityDescriptions]}
- Technical level: ${technicalityDescriptions[technicality as keyof typeof technicalityDescriptions]}

Use standard Slack formatting (*bold*, _italic_, \`code\`) and structure your response:
`;

    // Add verbosity-specific guidelines
    switch (verbosity) {
      case '1':
        prompt += `
- Numbers and key finding only
- Single line answers when possible`;
        break;
      case '2':
        prompt += `
- Essential findings in 2-3 short sentences
- Focus on what matters most`;
        break;
      case '3':
        prompt += `
- Clear summary with necessary context
- Key insights without extra detail`;
        break;
      case '4':
        prompt += `
- Thorough analysis with supporting data
- Include trends and implications concisely`;
        break;
      case '5':
        prompt += `
- Comprehensive analysis when complexity requires it
- Include methodology only when essential`;
        break;
    }

    prompt += `\n\n**Technical approach:**\n`;
    switch (technicality) {
      case '1':
        prompt += `
- Plain language, avoid technical jargon
- Focus on practical impact and implications`;
        break;
      case '2':
        prompt += `
- Basic terminology with simple explanations
- Connect information to relevant outcomes`;
        break;
      case '3':
        prompt += `
- Standard terms with brief explanations when needed
- Balance technical accuracy with clarity`;
        break;
      case '4':
        prompt += `
- Professional terminology appropriate for the domain
- Include methodology and process notes when relevant`;
        break;
      case '5':
        prompt += `
- Full technical vocabulary and detailed methods
- Include limitations, assumptions, and methodological details`;
        break;
    }

    if (includeBlockKit) {
      prompt += `

IMPORTANT: After your formatted message, include a section labeled "SLACK_BLOCKS_JSON" with a valid JSON array of Slack Block Kit blocks.

Block Kit Guidelines:
- Use section blocks for main content
- Use header blocks for titles (max 150 chars)
- Use divider blocks to separate sections
- Use context blocks for metadata or footnotes (ONLY if you have actual content for them)
- Include mrkdwn formatting in text objects
- Ensure all JSON is valid and properly escaped
- DO NOT include empty context blocks - omit them entirely if you have no context to add

Example structure:
\`\`\`json
[
  {
    "type": "header",
    "text": {
      "type": "plain_text",
      "text": "Title Here",
      "emoji": true
    }
  },
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "*Bold text* and _italic text_ with \`code\`"
    }
  },
  {
    "type": "context",
    "elements": [
      {
        "type": "mrkdwn",
        "text": "Context information here"
      }
    ]
  }
]
\`\`\`

CRITICAL: For context blocks, ensure the "elements" field is always an ARRAY of objects, never a single object.`;
    }

    // Add query and explanation instructions
    if (includeQuery || includeExplanation) {
      prompt += `

**Query Information:**`;

      if (includeQuery) {
        prompt += `
- Always include the actual query that was executed (SQL, API call, etc.)
- Show it in a code block with proper formatting`;
      }

      if (includeExplanation) {
        prompt += `
- Explain what the query does and why this approach was chosen
- Include any important query logic or filtering decisions`;
      }
    }

    prompt += `

**Important practices:**
- Always clarify key definitions and assumptions (e.g., "Recent means within last 30 days")
- Explain scope, boundaries, and time periods clearly
- Add quick notes about how information was gathered or processed when relevant
- Mention limitations or uncertainties naturally

Make your response clear and actionable.`;

    return prompt;
  }

  private initializeModel(
    modelConfig: SlackFormatterAgentParamsParsed['model']
  ) {
    const { model, temperature, maxTokens } = modelConfig;
    const [provider, modelName] = model.split('/');

    // Use chooseCredential to get the appropriate credential
    const apiKey = this.chooseCredential();

    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          model: modelName,
          temperature,
          maxTokens,
          apiKey,
        });
      case 'google':
        return new SafeGeminiChat({
          model: modelName,
          temperature,
          maxOutputTokens: maxTokens,
          apiKey,
          // Disable safety filters to reduce content blocking
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
          ],
        });
      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  private async initializeTools(
    toolConfigs: SlackFormatterAgentParamsParsed['tools']
  ): Promise<DynamicStructuredTool[]> {
    const tools: DynamicStructuredTool[] = [];
    await this.factory.registerDefaults();
    for (const toolConfig of toolConfigs) {
      try {
        // Get the tool bubble class from the factory
        const ToolBubbleClass = this.factory.get(toolConfig.name as BubbleName);

        if (!ToolBubbleClass) {
          console.warn(`Tool bubble '${toolConfig.name}' not found in factory`);
          continue;
        }

        // Check if it's a tool bubble (has toAgentTool method)
        if (!('type' in ToolBubbleClass) || ToolBubbleClass.type !== 'tool') {
          console.warn(`Bubble '${toolConfig.name}' is not a tool bubble`);
          continue;
        }

        // Convert to LangGraph tool and add to tools array
        if (!ToolBubbleClass.toolAgent) {
          console.warn(
            `Tool bubble '${toolConfig.name}' does not have a toolAgent method`
          );
          continue;
        }

        const langGraphTool = ToolBubbleClass.toolAgent(
          toolConfig.credentials || {},
          toolConfig.config || {}
        );

        // Convert LangGraph tool to DynamicStructuredTool for compatibility
        const dynamicTool = new DynamicStructuredTool({
          name: langGraphTool.name,
          description: langGraphTool.description,
          schema: langGraphTool.schema as any,
          func: langGraphTool.func as any,
        });

        tools.push(dynamicTool);
      } catch (error) {
        console.error(`Error initializing tool '${toolConfig.name}':`, error);
        continue;
      }
    }

    return tools;
  }

  private async createAgentGraph(
    llm: ChatOpenAI | ChatGoogleGenerativeAI,
    tools: DynamicStructuredTool[],
    systemPrompt: string
  ) {
    // Define the agent node
    const agentNode = async ({ messages }: typeof MessagesAnnotation.State) => {
      const systemMessage = new HumanMessage(systemPrompt);
      const allMessages = [systemMessage, ...messages];

      // If we have tools, bind them to the LLM
      const modelWithTools = tools.length > 0 ? llm.bindTools(tools) : llm;

      const response = await modelWithTools.invoke(allMessages);

      return { messages: [response] };
    };

    // Define conditional edge function
    const shouldContinue = ({ messages }: typeof MessagesAnnotation.State) => {
      const lastMessage = messages[messages.length - 1] as AIMessage;

      // Check if the last message has tool calls
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return 'tools';
      }
      return '__end__';
    };

    // Build the graph
    const graph = new StateGraph(MessagesAnnotation).addNode(
      'agent',
      agentNode
    );

    if (tools.length > 0) {
      // Use the official ToolNode for tool execution
      const toolNode = new ToolNode(tools);

      graph
        .addNode('tools', toolNode)
        .addEdge('__start__', 'agent')
        .addConditionalEdges('agent', shouldContinue)
        .addEdge('tools', 'agent');
    } else {
      graph.addEdge('__start__', 'agent').addEdge('agent', '__end__');
    }

    return graph.compile();
  }

  private async executeAgent(
    graph: ReturnType<typeof StateGraph.prototype.compile>,
    message: string,
    maxIterations: number
  ): Promise<SlackFormatterAgentResult> {
    const toolCalls: SlackFormatterAgentResult['toolCalls'] = [];
    let iterations = 0;

    try {
      const result = await graph.invoke(
        { messages: [new HumanMessage(message)] },
        { recursionLimit: maxIterations }
      );

      iterations = result.messages.length;

      // Extract tool calls from messages
      const toolCallMap = new Map<string, { name: string; args: unknown }>();

      for (let i = 0; i < result.messages.length; i++) {
        const msg = result.messages[i];

        if (msg instanceof AIMessage && msg.tool_calls) {
          const typedToolCalls = msg.tool_calls as ToolCall[];
          for (const toolCall of typedToolCalls) {
            toolCallMap.set(toolCall.id, {
              name: toolCall.name,
              args: toolCall.args,
            });
          }
        } else if (msg instanceof ToolMessage) {
          // Match tool response to its call
          const toolCall = toolCallMap.get(msg.tool_call_id);
          if (toolCall) {
            // Parse content if it's a JSON string
            let output = msg.content;
            if (typeof output === 'string') {
              try {
                output = JSON.parse(output);
              } catch {
                // Keep as string if not valid JSON
              }
            }

            toolCalls.push({
              tool: toolCall.name,
              input: toolCall.args,
              output,
            });
          }
        }
      }

      // Get the final AI message response
      const aiMessages = result.messages.filter(
        (msg: BaseMessage) => msg instanceof AIMessage
      );
      const finalMessage = aiMessages[aiMessages.length - 1] as AIMessage;

      // Check for MAX_TOKENS finish reason
      if (finalMessage?.additional_kwargs?.finishReason === 'MAX_TOKENS') {
        throw new Error(
          'Response was truncated due to max tokens limit. Please increase maxTokens in model configuration.'
        );
      }

      const response = finalMessage?.content || 'No response generated';

      return {
        response:
          typeof response === 'string' ? response : JSON.stringify(response),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        iterations,
        error: '',
        success: true,
        metadata: {
          verbosityLevel: '3',
          technicalityLevel: '3',
          wordCount: 0,
        },
      };
    } catch (error) {
      return {
        response: `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        iterations,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          verbosityLevel: '3',
          technicalityLevel: '3',
          wordCount: 0,
        },
      };
    }
  }

  private extractSlackBlocks(
    response: string
  ): SlackFormatterAgentResult['blocks'] {
    try {
      // Look for the SLACK_BLOCKS_JSON section
      const jsonMatch = response.match(
        /SLACK_BLOCKS_JSON[\s\S]*?```json\n([\s\S]*?)\n```/
      );

      if (!jsonMatch || !jsonMatch[1]) {
        // Try to find any JSON code block that looks like Slack blocks
        const anyJsonMatch = response.match(/```json\n(\[[\s\S]*?\])\n```/);
        if (anyJsonMatch && anyJsonMatch[1]) {
          const parsed = JSON.parse(anyJsonMatch[1]);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
            return this.validateAndFixSlackBlocks(parsed);
          }
        }
        return undefined;
      }

      const blocksJson = jsonMatch[1];
      const blocks = JSON.parse(blocksJson);

      if (!Array.isArray(blocks)) {
        console.warn('Slack blocks JSON is not an array');
        return undefined;
      }

      return this.validateAndFixSlackBlocks(blocks);
    } catch (error) {
      console.warn('Failed to extract Slack blocks from response:', error);
      return undefined;
    }
  }

  private validateAndFixSlackBlocks(
    blocks: unknown[]
  ): SlackFormatterAgentResult['blocks'] {
    const processedBlocks = blocks.map((block: any) => {
      // Fix context blocks - they must have elements field
      if (block.type === 'context') {
        if (!block.elements) {
          // If no elements at all, remove this block entirely
          return null;
        }
        // If elements is not an array, wrap it in an array
        if (!Array.isArray(block.elements)) {
          block.elements = [block.elements];
        }
        // Ensure each element has proper structure
        block.elements = block.elements.map((element: any) => {
          if (typeof element === 'object' && element.text && !element.type) {
            return {
              type: 'mrkdwn',
              text: element.text,
            };
          }
          return element;
        });
      }

      // Validate other required fields
      if (block.type === 'header' && block.text && !block.text.type) {
        block.text.type = 'plain_text';
      }

      if (block.type === 'section' && block.text && !block.text.type) {
        block.text.type = 'mrkdwn';
      }

      return block;
    });

    return processedBlocks.filter((block) => block !== null); // Remove null blocks
  }
}
