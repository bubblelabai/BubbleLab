import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import {
  CredentialType,
  BUBBLE_CREDENTIAL_OPTIONS,
} from '@bubblelab/shared-schemas';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AvailableModels } from '@bubblelab/shared-schemas';
import {
  AvailableTools,
  type AvailableTool,
} from '../../types/available-tools.js';
import { BubbleFactory } from '../../bubble-factory.js';
import type { BubbleName, BubbleResult } from '@bubblelab/shared-schemas';
import type { StreamingEvent } from '@bubblelab/shared-schemas';
import {
  extractAndStreamThinkingTokens,
  formatFinalResponse,
} from '../../utils/agent-formatter.js';
import { isAIMessage, isAIMessageChunk } from '@langchain/core/messages';

// Define tool hook context - provides access to messages and tool call details
export type ToolHookContext = {
  toolName: AvailableTool;
  toolInput: unknown;
  toolOutput?: BubbleResult<unknown>; // Only available in afterToolCall
  messages: BaseMessage[];
};

// Tool hooks can modify the entire messages array (including system prompt)
export type ToolHookAfter = (
  context: ToolHookContext
) => Promise<{ messages: BaseMessage[]; shouldStop?: boolean }>;

export type ToolHookBefore = (
  context: ToolHookContext
) => Promise<{ messages: BaseMessage[]; toolInput: Record<string, any> }>;

// Type for streaming callback function
export type StreamingCallback = (event: StreamingEvent) => Promise<void> | void;

// Define model configuration
const ModelConfigSchema = z.object({
  model: AvailableModels.default('google/gemini-2.5-flash').describe(
    'AI model to use (format: provider/model-name).'
  ),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .default(1)
    .describe(
      'Temperature for response randomness (0 = deterministic, 2 = very random)'
    ),
  maxTokens: z
    .number()
    .positive()
    .optional()
    .default(40000)
    .describe(
      'Maximum number of tokens to generate in response, keep at default of 40000 unless the response is expected to be certain length'
    ),
  jsonMode: z
    .boolean()
    .default(false)
    .describe(
      'When true, strips markdown formatting and returns clean JSON response'
    ),
});

// Define tool configuration for pre-registered tools
const ToolConfigSchema = z.object({
  name: AvailableTools.describe(
    'Name of the tool type or tool bubble to enable for the AI agent'
  ),
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
    .describe('Configuration for the tool or tool bubble'),
});

// Define custom tool schema for runtime-defined tools
const CustomToolSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('Unique name for your custom tool (e.g., "calculate-tax")'),
  description: z
    .string()
    .min(1)
    .describe(
      'Description of what the tool does - helps the AI know when to use it'
    ),
  schema: z
    .record(z.string(), z.unknown())
    .describe(
      'Zod schema object defining the tool parameters. Example: { amount: z.number().describe("Amount to calculate tax on"), rate: z.number().describe("Tax rate") }'
    ),
  func: z
    .function()
    .args(z.record(z.string(), z.unknown()))
    .returns(z.promise(z.unknown()))
    .describe(
      'Async function that executes the tool logic. Receives params matching the schema and returns a result.'
    ),
});

// Define image input schemas - supports both base64 data and URLs
const Base64ImageSchema = z.object({
  type: z.literal('base64').default('base64'),
  data: z
    .string()
    .describe('Base64 encoded image data (without data:image/... prefix)'),
  mimeType: z
    .string()
    .default('image/png')
    .describe('MIME type of the image (e.g., image/png, image/jpeg)'),
  description: z
    .string()
    .optional()
    .describe('Optional description or context for the image'),
});

const UrlImageSchema = z.object({
  type: z.literal('url'),
  url: z.string().url().describe('URL to the image (http/https)'),
  description: z
    .string()
    .optional()
    .describe('Optional description or context for the image'),
});

const ImageInputSchema = z.discriminatedUnion('type', [
  Base64ImageSchema,
  UrlImageSchema,
]);

// Define the parameters schema for the AI Agent bubble
const AIAgentParamsSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .describe('The message or question to send to the AI agent'),
  images: z
    .array(ImageInputSchema)
    .default([])
    .describe(
      'Array of base64 encoded images to include with the message (for multimodal AI models). Example: [{type: "base64", data: "base64...", mimeType: "image/png", description: "A beautiful image of a cat"}] or [{type: "url", url: "https://example.com/image.png", description: "A beautiful image of a cat"}]'
    ),
  systemPrompt: z
    .string()
    .default('You are a helpful AI assistant')
    .describe(
      'System prompt that defines the AI agents behavior and personality'
    ),
  name: z
    .string()
    .default('AI Agent')
    .optional()
    .describe('A friendly name for the AI agent'),
  model: ModelConfigSchema.default({
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 50000,
    jsonMode: false,
  }).describe(
    'AI model configuration including provider, temperature, and tokens. For model unless otherwise specified, use google/gemini-2.5-flash as default. Use google/gemini-2.5-flash-image-preview to edit and generate images.'
  ),
  tools: z
    .array(ToolConfigSchema)
    .default([
      {
        name: 'web-search-tool',
        config: {
          maxResults: 5,
        },
      },
    ])
    .describe(
      'Array of pre-registered tools the AI agent can use. Can be tool types (web-search-tool, web-scrape-tool, web-crawl-tool, web-extract-tool, instagram-tool). If using image models, set the tools to []'
    ),
  customTools: z
    .array(CustomToolSchema)
    .default([])
    .optional()
    .describe(
      'Array of custom runtime-defined tools with their own schemas and functions. Use this to add domain-specific tools without pre-registration. Example: [{ name: "calculate-tax", description: "Calculates sales tax", schema: { amount: z.number() }, func: async (input) => {...} }]'
    ),
  maxIterations: z
    .number()
    .positive()
    .min(2)
    .default(10)
    .describe(
      'Maximum number of iterations for the agent workflow, 2 iterations per turn of conversation'
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
  streaming: z
    .boolean()
    .default(false)
    .describe(
      'Enable real-time streaming of tokens, tool calls, and iteration progress'
    ),
  // Note: beforeToolCall and afterToolCall are function hooks added via TypeScript interface
  // They cannot be part of the Zod schema but are available in the params
});
const AIAgentResultSchema = z.object({
  response: z
    .string()
    .describe(
      'The AI agents final response to the user message. For text responses, returns plain text or JSON string. For image generation models (like gemini-2.5-flash-image-preview), returns base64-encoded image data with data URI format (data:image/png;base64,...)'
    ),
  toolCalls: z
    .array(
      z.object({
        tool: z.string().describe('Name of the tool that was called'),
        input: z.unknown().describe('Input parameters passed to the tool'),
        output: z.unknown().describe('Output returned by the tool'),
      })
    )
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

type AIAgentParams = z.input<typeof AIAgentParamsSchema> & {
  // Optional hooks for intercepting tool calls
  beforeToolCall?: ToolHookBefore;
  afterToolCall?: ToolHookAfter;
  streamingCallback?: StreamingCallback;
};
type AIAgentParamsParsed = z.output<typeof AIAgentParamsSchema> & {
  beforeToolCall?: ToolHookBefore;
  afterToolCall?: ToolHookAfter;
  streamingCallback?: StreamingCallback;
};

type AIAgentResult = z.output<typeof AIAgentResultSchema>;

export class AIAgentBubble extends ServiceBubble<
  AIAgentParamsParsed,
  AIAgentResult
> {
  static readonly type = 'service' as const;
  static readonly service = 'ai-agent';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName: BubbleName = 'ai-agent';
  static readonly schema = AIAgentParamsSchema;
  static readonly resultSchema = AIAgentResultSchema;
  static readonly shortDescription =
    'AI agent with LangGraph for tool-enabled conversations, multimodal support, and JSON mode';
  static readonly longDescription = `
    An AI agent powered by LangGraph that can use any tool bubble to answer questions.
    Use cases:
    - Add tools to enhance the AI agent's capabilities (web-search-tool, web-scrape-tool)
    - Multi-step reasoning with tool assistance
    - Tool-augmented conversations with any registered tool
    - JSON mode for structured output (strips markdown formatting)
  `;
  static readonly alias = 'agent';

  private factory: BubbleFactory;
  private beforeToolCallHook: ToolHookBefore | undefined;
  private afterToolCallHook: ToolHookAfter | undefined;
  private streamingCallback: StreamingCallback | undefined;
  private shouldStopAfterTools = false;

  constructor(
    params: AIAgentParams = {
      message: 'Hello, how are you?',
      systemPrompt: 'You are a helpful AI assistant',
    },
    context?: BubbleContext
  ) {
    super(params, context);
    this.beforeToolCallHook = params.beforeToolCall;
    this.afterToolCallHook = params.afterToolCall;
    this.streamingCallback = params.streamingCallback;
    this.factory = new BubbleFactory();
  }

  public async testCredential(): Promise<boolean> {
    // Make a test API call to the model provider
    const llm = this.initializeModel(this.params.model);

    const response = await llm.invoke(['Hello, how are you?']);
    if (response.content) {
      return true;
    }
    return false;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<AIAgentResult> {
    // Context is available but not currently used in this implementation
    void context;
    const {
      message,
      images,
      systemPrompt,
      model,
      tools,
      customTools,
      maxIterations,
    } = this.params;

    try {
      // Initialize the language model
      const llm = this.initializeModel(model);

      // Initialize tools (both pre-registered and custom)
      const agentTools = await this.initializeTools(tools, customTools);

      // Create the agent graph
      const graph = await this.createAgentGraph(llm, agentTools, systemPrompt);

      // Execute the agent
      const result = await this.executeAgent(
        graph,
        message,
        images,
        maxIterations,
        model.jsonMode
      );

      return result;
    } catch (error) {
      // Return error information but mark as recoverable
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn('[AIAgent] Execution error (continuing):', errorMessage);

      return {
        response: `Error: ${errorMessage}`,
        success: false, // Still false but execution can continue
        toolCalls: [],
        error: errorMessage,
        iterations: 0,
      };
    }
  }

  /**
   * Execute the AI agent with streaming support for real-time feedback
   */
  public async actionWithStreaming(
    streamingCallback: StreamingCallback,
    context?: BubbleContext
  ): Promise<AIAgentResult> {
    // Context is available but not currently used in this implementation
    void context;
    const {
      message,
      images,
      systemPrompt,
      model,
      tools,
      customTools,
      maxIterations,
    } = this.params;

    const startTime = Date.now();
    // Send start event
    await streamingCallback({
      type: 'start',
      data: {
        message: `Analyzing with ${this.params.name || 'AI Agent'}`,
        maxIterations,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      // Send LLM start event
      await streamingCallback({
        type: 'llm_start',
        data: {
          model: model.model,
          temperature: model.temperature,
        },
      });

      // Initialize the language model
      const llm = this.initializeModel(model);

      // Initialize tools (both pre-registered and custom)
      const agentTools = await this.initializeTools(tools, customTools);

      // Create the agent graph
      const graph = await this.createAgentGraph(llm, agentTools, systemPrompt);

      // Execute the agent with streaming
      const result = await this.executeAgentWithStreaming(
        graph,
        message,
        images,
        maxIterations,
        model.jsonMode,
        streamingCallback
      );

      const totalDuration = Date.now() - startTime;

      // Send completion event
      await streamingCallback({
        type: 'complete',
        data: {
          result,
          totalDuration,
        },
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Send error event as recoverable
      await streamingCallback({
        type: 'error',
        data: {
          error: errorMessage,
          recoverable: true, // Mark as recoverable to continue execution
        },
      });

      console.warn(
        '[AIAgent] Streaming execution error (continuing):',
        errorMessage
      );

      return {
        response: `Error: ${errorMessage}`,
        success: false, // Still false but execution can continue
        toolCalls: [],
        error: errorMessage,
        iterations: 0,
      };
    }
  }

  protected chooseCredential(): string | undefined {
    const { model } = this.params;
    const credentials = this.params.credentials as
      | Record<CredentialType, string>
      | undefined;
    const [provider] = model.model.split('/');

    // If no credentials were injected, throw error immediately (like PostgreSQL)
    if (!credentials || typeof credentials !== 'object') {
      throw new Error(`No ${provider.toUpperCase()} credentials provided`);
    }

    // Choose credential based on the model provider
    switch (provider) {
      case 'openai':
        return credentials[CredentialType.OPENAI_CRED];
      case 'google':
        return credentials[CredentialType.GOOGLE_GEMINI_CRED];
      case 'anthropic':
        return credentials[CredentialType.ANTHROPIC_CRED];
      case 'openrouter':
        return credentials[CredentialType.OPENROUTER_CRED];
      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  private initializeModel(modelConfig: AIAgentParamsParsed['model']) {
    const { model, temperature, maxTokens } = modelConfig;
    const slashIndex = model.indexOf('/');
    const provider = model.substring(0, slashIndex);
    const modelName = model.substring(slashIndex + 1);

    // Use chooseCredential to get the appropriate credential
    // This will throw immediately if credentials are missing
    const apiKey = this.chooseCredential();

    // Enable streaming if streamingCallback is provided
    const enableStreaming = !!this.streamingCallback;

    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          model: modelName,
          temperature,
          maxTokens,
          apiKey,
          streaming: enableStreaming,
        });
      case 'google':
        return new ChatGoogleGenerativeAI({
          model: modelName,
          temperature,
          maxOutputTokens: maxTokens,
          apiKey,
          streaming: enableStreaming,
        });
      case 'anthropic':
        return new ChatAnthropic({
          model: modelName,
          temperature,
          anthropicApiKey: apiKey,
          maxTokens,
          streaming: enableStreaming,
          apiKey,
        });
      case 'openrouter':
        console.log('openrouter', modelName);
        return new ChatOpenAI({
          model: modelName,
          __includeRawResponse: true,
          temperature,
          maxTokens,
          apiKey,
          streaming: enableStreaming,
          configuration: {
            baseURL: 'https://openrouter.ai/api/v1',
          },
          modelKwargs: {
            reasoning: {
              effort: 'medium',
              exclude: false,
            },
          },
        });
      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  private async initializeTools(
    toolConfigs: AIAgentParamsParsed['tools'],
    customToolConfigs: AIAgentParamsParsed['customTools'] = []
  ): Promise<DynamicStructuredTool[]> {
    const tools: DynamicStructuredTool[] = [];
    await this.factory.registerDefaults();

    // First, initialize custom tools
    for (const customTool of customToolConfigs) {
      try {
        console.log(
          `🛠️ [AIAgent] Initializing custom tool: ${customTool.name}`
        );

        const dynamicTool = new DynamicStructuredTool({
          name: customTool.name,
          description: customTool.description,
          schema: z.object(customTool.schema as z.ZodRawShape) as z.ZodTypeAny,
          func: customTool.func as (input: any) => Promise<any>,
        } as any);

        tools.push(dynamicTool);
      } catch (error) {
        console.error(
          `Error initializing custom tool '${customTool.name}':`,
          error
        );
        // Continue with other tools even if one fails
        continue;
      }
    }

    // Then, initialize pre-registered tools from factory
    for (const toolConfig of toolConfigs) {
      try {
        const ToolBubbleClass = this.factory.get(toolConfig.name as BubbleName);

        if (!ToolBubbleClass) {
          if (this.context && this.context.logger) {
            this.context.logger.warn(
              `Tool bubble '${toolConfig.name}' not found in factory. This tool will not be used.`
            );
          }
          console.warn(
            `Tool bubble '${toolConfig.name}' not found in factory. This tool will not be used.`
          );
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

        // Get tool's credential requirements and pass relevant credentials from AI agent
        const toolCredentialOptions =
          BUBBLE_CREDENTIAL_OPTIONS[toolConfig.name as BubbleName] || [];
        const toolCredentials: Record<string, string> = {};

        // Pass AI agent's credentials to tools that need them
        for (const credType of toolCredentialOptions) {
          if (this.params.credentials && this.params.credentials[credType]) {
            toolCredentials[credType] = this.params.credentials[credType];
          }
        }

        // Merge with any explicitly provided tool credentials (explicit ones take precedence)
        const finalToolCredentials = {
          ...toolCredentials,
          ...(toolConfig.credentials || {}),
        };

        console.log(
          `🔍 [AIAgent] Passing credentials to ${toolConfig.name}:`,
          Object.keys(finalToolCredentials)
        );

        const langGraphTool = ToolBubbleClass.toolAgent(
          finalToolCredentials,
          toolConfig.config || {},
          this.context
        );

        const dynamicTool = new DynamicStructuredTool({
          name: langGraphTool.name,
          description: langGraphTool.description,
          schema: langGraphTool.schema as unknown as z.ZodTypeAny,
          func: langGraphTool.func as (input: any) => Promise<any>,
        } as any);

        tools.push(dynamicTool);
      } catch (error) {
        console.error(`Error initializing tool '${toolConfig.name}':`, error);
        // Continue with other tools even if one fails
        continue;
      }
    }

    return tools;
  }

  /**
   * Custom tool execution node that supports hooks
   */
  private async executeToolsWithHooks(
    state: typeof MessagesAnnotation.State,
    tools: DynamicStructuredTool[]
  ): Promise<{ messages: BaseMessage[] }> {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1] as AIMessage;
    const toolCalls = lastMessage.tool_calls || [];

    const toolMessages: BaseMessage[] = [];
    let currentMessages = [...messages];

    // Reset stop flag at the start of tool execution
    this.shouldStopAfterTools = false;

    // Execute each tool call
    for (const toolCall of toolCalls) {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        console.warn(`Tool ${toolCall.name} not found`);
        toolMessages.push(
          new ToolMessage({
            content: `Error: Tool ${toolCall.name} not found`,
            tool_call_id: toolCall.id!,
          })
        );
        continue;
      }

      try {
        // Call beforeToolCall hook if provided
        const hookResult_before = await this.beforeToolCallHook?.({
          toolName: toolCall.name as AvailableTool,
          toolInput: toolCall.args,
          messages: currentMessages,
        });

        const startTime = Date.now();

        this.streamingCallback?.({
          type: 'tool_start',
          data: {
            tool: toolCall.name,
            input: toolCall.args,
            callId: toolCall.id!,
          },
        });

        // If hook returns modified messages/toolInput, apply them
        if (hookResult_before) {
          if (hookResult_before.messages) {
            currentMessages = hookResult_before.messages;
          }
          toolCall.args = hookResult_before.toolInput;
        }

        // Execute the tool
        const toolOutput = await tool.invoke(toolCall.args);

        // Create tool message
        const toolMessage = new ToolMessage({
          content:
            typeof toolOutput === 'string'
              ? toolOutput
              : JSON.stringify(toolOutput),
          tool_call_id: toolCall.id!,
        });

        toolMessages.push(toolMessage);
        currentMessages = [...currentMessages, toolMessage];

        // Call afterToolCall hook if provided
        const hookResult_after = await this.afterToolCallHook?.({
          toolName: toolCall.name as AvailableTool,
          toolInput: toolCall.args,
          toolOutput,
          messages: currentMessages,
        });

        // If hook returns modified messages, update current messages
        if (hookResult_after) {
          if (hookResult_after.messages) {
            currentMessages = hookResult_after.messages;
          }
          // Check if hook wants to stop execution
          if (hookResult_after.shouldStop === true) {
            this.shouldStopAfterTools = true;
          }
        }
        this.streamingCallback?.({
          type: 'tool_complete',
          data: {
            callId: toolCall.id!,
            tool: toolCall.name,
            output: toolOutput,
            duration: Date.now() - startTime,
          },
        });
      } catch (error) {
        console.error(`Error executing tool ${toolCall.name}:`, error);
        const errorMessage = new ToolMessage({
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tool_call_id: toolCall.id!,
        });
        toolMessages.push(errorMessage);
        currentMessages = [...currentMessages, errorMessage];
      }
    }

    // Return the updated messages
    // If hooks modified messages, use those; otherwise use the original messages + tool messages
    if (currentMessages.length !== messages.length + toolMessages.length) {
      return { messages: currentMessages };
    }

    return { messages: toolMessages };
  }

  private async createAgentGraph(
    llm: ChatOpenAI | ChatGoogleGenerativeAI | ChatAnthropic,
    tools: DynamicStructuredTool[],
    systemPrompt: string
  ) {
    // Define the agent node
    const agentNode = async ({ messages }: typeof MessagesAnnotation.State) => {
      // Enhance system prompt for JSON mode

      const systemMessage = new HumanMessage(systemPrompt);
      const allMessages = [systemMessage, ...messages];

      // If we have tools, bind them to the LLM
      const modelWithTools = tools.length > 0 ? llm.bindTools(tools) : llm;

      // Use streaming if streamingCallback is provided
      if (this.streamingCallback) {
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Use invoke with callbacks for streaming
        const response = await modelWithTools.invoke(allMessages, {
          callbacks: [
            {
              handleLLMStart: async (): Promise<void> => {
                await this.streamingCallback?.({
                  type: 'llm_start',
                  data: {
                    model: this.params.model.model,
                    temperature: this.params.model.temperature,
                  },
                });
              },
              handleLLMEnd: async (output): Promise<void> => {
                // Extract thinking tokens from different model providers
                const thinking = extractAndStreamThinkingTokens(output);
                if (thinking) {
                  await this.streamingCallback?.({
                    type: 'think',
                    data: {
                      content: thinking,
                      messageId,
                    },
                  });
                }
                await this.streamingCallback?.({
                  type: 'llm_complete',
                  data: {
                    messageId,
                    totalTokens: output.llmOutput?.usage_metadata?.total_tokens,
                  },
                });
              },
            },
          ],
        });

        return { messages: [response] };
      } else {
        // Non-streaming fallback
        const response = await modelWithTools.invoke(allMessages);
        return { messages: [response] };
      }
    };

    // Define conditional edge function
    const shouldContinue = ({ messages }: typeof MessagesAnnotation.State) => {
      const lastMessage = messages[messages.length - 1] as
        | AIMessage
        | AIMessageChunk;

      // Check if the last message has tool calls
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        return 'tools';
      }
      return '__end__';
    };

    // Define conditional edge after tools to check if we should stop
    const shouldContinueAfterTools = () => {
      // Check if the afterToolCall hook requested stopping
      if (this.shouldStopAfterTools) {
        return '__end__';
      }
      // Otherwise continue back to agent
      return 'agent';
    };

    // Build the graph
    const graph = new StateGraph(MessagesAnnotation).addNode(
      'agent',
      agentNode
    );

    if (tools.length > 0) {
      // Use custom tool node with hooks support
      const toolNode = async (state: typeof MessagesAnnotation.State) => {
        return await this.executeToolsWithHooks(state, tools);
      };

      graph
        .addNode('tools', toolNode)
        .addEdge('__start__', 'agent')
        .addConditionalEdges('agent', shouldContinue)
        .addConditionalEdges('tools', shouldContinueAfterTools);
    } else {
      graph.addEdge('__start__', 'agent').addEdge('agent', '__end__');
    }

    return graph.compile();
  }

  private async executeAgent(
    graph: ReturnType<typeof StateGraph.prototype.compile>,
    message: string,
    images: AIAgentParamsParsed['images'],
    maxIterations: number,
    jsonMode?: boolean
  ): Promise<AIAgentResult> {
    const toolCalls: AIAgentResult['toolCalls'] = [];
    let iterations = 0;

    console.log(
      '[AIAgent] Starting execution with message:',
      message.substring(0, 100) + '...'
    );
    console.log('[AIAgent] Max iterations:', maxIterations);

    try {
      console.log('[AIAgent] Invoking graph...');

      // Create human message with text and optional images
      let humanMessage: HumanMessage;

      if (images && images.length > 0) {
        console.log(
          '[AIAgent] Creating multimodal message with',
          images.length,
          'images'
        );

        // Create multimodal content array
        const content: Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }> = [{ type: 'text', text: message }];

        // Add images to content
        for (const image of images) {
          let imageUrl: string;

          if (image.type === 'base64') {
            // Base64 encoded image
            imageUrl = `data:${image.mimeType};base64,${image.data}`;
          } else {
            // URL image - fetch and convert to base64 for Google Gemini compatibility
            try {
              console.log('[AIAgent] Fetching image from URL:', image.url);
              const response = await fetch(image.url);
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch image: ${response.status} ${response.statusText}`
                );
              }

              const arrayBuffer = await response.arrayBuffer();
              const base64Data = Buffer.from(arrayBuffer).toString('base64');

              // Detect MIME type from response or default to PNG
              const contentType =
                response.headers.get('content-type') || 'image/png';
              imageUrl = `data:${contentType};base64,${base64Data}`;

              console.log(
                '[AIAgent] Successfully converted URL image to base64'
              );
            } catch (error) {
              console.error('[AIAgent] Error fetching image from URL:', error);
              throw new Error(
                `Failed to load image from URL ${image.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }

          content.push({
            type: 'image_url',
            image_url: { url: imageUrl },
          });

          // Add image description if provided
          if (image.description) {
            content.push({
              type: 'text',
              text: `Image description: ${image.description}`,
            });
          }
        }

        humanMessage = new HumanMessage({ content });
      } else {
        // Text-only message
        humanMessage = new HumanMessage(message);
      }

      const result = await graph.invoke(
        { messages: [humanMessage] },
        { recursionLimit: maxIterations }
      );

      console.log('[AIAgent] Graph execution completed');
      console.log('[AIAgent] Total messages:', result.messages.length);
      iterations = result.messages.length;

      // Extract tool calls from messages and track individual LLM calls
      // Store tool calls temporarily to match with their responses
      const toolCallMap = new Map<string, { name: string; args: unknown }>();

      for (let i = 0; i < result.messages.length; i++) {
        const msg = result.messages[i];
        if (
          msg instanceof AIMessage ||
          (msg instanceof AIMessageChunk && msg.tool_calls)
        ) {
          const typedToolCalls = msg.tool_calls;
          // Log and track tool calls
          for (const toolCall of typedToolCalls || []) {
            toolCallMap.set(toolCall.id!, {
              name: toolCall.name,
              args: toolCall.args,
            });

            console.log(
              '[AIAgent] Tool call:',
              toolCall.name,
              'with args:',
              toolCall.args
            );
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

            console.log(
              '[AIAgent] Tool output preview:',
              typeof output === 'string'
                ? output.substring(0, 100) + '...'
                : JSON.stringify(output).substring(0, 100) + '...'
            );

            toolCalls.push({
              tool: toolCall.name,
              input: toolCall.args,
              output,
            });
          }
        }
      }

      // Get the final AI message response
      console.log('[AIAgent] Filtering AI messages...');
      const aiMessages = result.messages.filter(
        (msg: any) => isAIMessage(msg) || isAIMessageChunk(msg)
      );
      console.log('[AIAgent] Found', aiMessages.length, 'AI messages');
      const finalMessage = aiMessages[aiMessages.length - 1] as
        | AIMessage
        | AIMessageChunk;

      // Check for MAX_TOKENS finish reason
      if (finalMessage?.additional_kwargs?.finishReason === 'MAX_TOKENS') {
        throw new Error(
          'Response was truncated due to max tokens limit. Please increase maxTokens in model configuration.'
        );
      }

      // Track token usage from ALL AI messages (not just the final one)
      // This is critical for multi-iteration workflows where the agent calls tools multiple times
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalTokensSum = 0;

      for (const msg of result.messages) {
        if (
          msg instanceof AIMessage ||
          (msg instanceof AIMessageChunk && msg.usage_metadata)
        ) {
          totalInputTokens +=
            (msg as AIMessage | AIMessageChunk).usage_metadata?.input_tokens ||
            0;
          totalOutputTokens +=
            (msg as AIMessage | AIMessageChunk).usage_metadata?.output_tokens ||
            0;
          totalTokensSum +=
            (msg as AIMessage | AIMessageChunk).usage_metadata?.total_tokens ||
            0;
        }
      }

      if (totalTokensSum > 0 && this.context && this.context.logger) {
        this.context.logger.logTokenUsage(
          {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalTokensSum,
            modelName: this.params.model.model,
          },
          `LLM completion: ${totalInputTokens} input + ${totalOutputTokens} output = ${totalTokensSum} total tokens`,
          {
            bubbleName: 'ai-agent',
            variableId: this.context?.variableId,
            operationType: 'bubble_execution',
          }
        );
      }

      const response = finalMessage?.content || 'No response generated';

      // Use shared formatting method
      const formattedResult = await formatFinalResponse(
        response,
        this.params.model.model,
        jsonMode
      );

      // If there's an error from formatting (e.g., invalid JSON), return early
      if (formattedResult.error) {
        return {
          response: formattedResult.response,
          toolCalls: toolCalls.length > 0 ? toolCalls : [],
          iterations,
          error: formattedResult.error,
          success: false,
        };
      }

      const finalResponse = formattedResult.response;

      console.log(
        '[AIAgent] Final response length:',
        typeof finalResponse === 'string'
          ? finalResponse.length
          : JSON.stringify(finalResponse).length
      );
      console.log('[AIAgent] Tool calls made:', toolCalls.length);
      console.log(
        '[AIAgent] Execution completed with',
        iterations,
        'iterations'
      );

      return {
        response:
          typeof finalResponse === 'string'
            ? finalResponse
            : JSON.stringify(finalResponse),
        toolCalls: toolCalls.length > 0 ? toolCalls : [],
        iterations,
        error: '',
        success: true,
      };
    } catch (error) {
      console.warn('[AIAgent] Execution error (continuing):', error);
      console.log('[AIAgent] Tool calls before error:', toolCalls.length);
      console.log('[AIAgent] Iterations before error:', iterations);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Return partial results to allow execution to continue
      // Include any tool calls that were completed before the error
      return {
        response: `Execution error: ${errorMessage}`,
        success: false, // Still false but don't completely halt execution
        iterations,
        toolCalls: toolCalls.length > 0 ? toolCalls : [], // Preserve completed tool calls
        error: errorMessage,
      };
    }
  }

  /**
   * Execute agent with streaming support using LangGraph streamEvents
   */
  private async executeAgentWithStreaming(
    graph: ReturnType<typeof StateGraph.prototype.compile>,
    message: string,
    images: AIAgentParamsParsed['images'],
    maxIterations: number,
    jsonMode?: boolean,
    streamingCallback?: StreamingCallback
  ): Promise<AIAgentResult> {
    const toolCalls: AIAgentResult['toolCalls'] = [];
    let iterations = 0;
    let currentMessageId = '';

    console.log(
      '[AIAgent] Starting streaming execution with message:',
      message.substring(0, 100) + '...'
    );

    try {
      // Create human message with text and optional images
      let humanMessage: HumanMessage;

      if (images && images.length > 0) {
        console.log(
          '[AIAgent] Creating multimodal message with',
          images.length,
          'images'
        );

        // Create multimodal content array
        const content: Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }> = [{ type: 'text', text: message }];

        // Add images to content
        for (const image of images) {
          let imageUrl: string;

          if (image.type === 'base64') {
            // Base64 encoded image
            imageUrl = `data:${image.mimeType};base64,${image.data}`;
          } else {
            // URL image - fetch and convert to base64 for Google Gemini compatibility
            try {
              console.log('[AIAgent] Fetching image from URL:', image.url);
              const response = await fetch(image.url);
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch image: ${response.status} ${response.statusText}`
                );
              }

              const arrayBuffer = await response.arrayBuffer();
              const base64Data = Buffer.from(arrayBuffer).toString('base64');

              // Detect MIME type from response or default to PNG
              const contentType =
                response.headers.get('content-type') || 'image/png';
              imageUrl = `data:${contentType};base64,${base64Data}`;

              console.log(
                '[AIAgent] Successfully converted URL image to base64'
              );
            } catch (error) {
              console.error('[AIAgent] Error fetching image from URL:', error);
              throw new Error(
                `Failed to load image from URL ${image.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }

          content.push({
            type: 'image_url',
            image_url: { url: imageUrl },
          });

          // Add image description if provided
          if (image.description) {
            content.push({
              type: 'text',
              text: `Image description: ${image.description}`,
            });
          }
        }

        humanMessage = new HumanMessage({ content });
      } else {
        // Text-only message
        humanMessage = new HumanMessage(message);
      }

      // Stream events from the graph
      const eventStream = graph.streamEvents(
        { messages: [humanMessage] },
        {
          version: 'v2',
          recursionLimit: maxIterations,
        }
      );

      let currentIteration = 0;
      const toolCallMap = new Map<
        string,
        { name: string; args: unknown; startTime: number }
      >();
      let accumulatedContent = '';

      // Track processed events to prevent duplicates
      const processedIterationEvents = new Set<string>();

      for await (const event of eventStream) {
        if (!event || typeof event !== 'object') continue;

        // Handle different types of streaming events
        switch (event.event) {
          case 'on_chat_model_start':
            currentIteration++;
            currentMessageId = `msg-${Date.now()}-${currentIteration}`;

            if (streamingCallback) {
              await streamingCallback({
                type: 'iteration_start',
                data: { iteration: currentIteration },
              });
            }
            break;

          case 'on_chat_model_stream':
            // Stream individual tokens
            if (event.data?.chunk?.content && streamingCallback) {
              const content = event.data.chunk.content;
              accumulatedContent += content;

              await streamingCallback({
                type: 'token',
                data: {
                  content,
                  messageId: currentMessageId,
                },
              });
            }
            break;

          case 'on_chat_model_end':
            if (streamingCallback) {
              const usageMetadata = event.data?.output?.usage_metadata;
              const totalTokens = usageMetadata?.total_tokens;

              // Track token usage if available
              if (
                usageMetadata &&
                this.context != null &&
                this.context.logger != null
              ) {
                const tokenUsage = {
                  inputTokens: usageMetadata.input_tokens || 0,
                  outputTokens: usageMetadata.output_tokens || 0,
                  totalTokens: totalTokens || 0,
                  modelName: this.params.model.model,
                };

                this.context.logger.logTokenUsage(
                  tokenUsage,
                  `LLM completion: ${tokenUsage.inputTokens} input + ${tokenUsage.outputTokens} output = ${tokenUsage.totalTokens} total tokens`,
                  {
                    bubbleName: 'ai-agent',
                    variableId: this.context?.variableId,
                    operationType: 'bubble_execution',
                  }
                );
              }

              await streamingCallback({
                type: 'llm_complete',
                data: {
                  messageId: currentMessageId,
                  totalTokens,
                },
              });
            }
            break;

          case 'on_tool_start':
            if (event.name && event.data?.input && streamingCallback) {
              const callId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              toolCallMap.set(callId, {
                name: event.name,
                args: event.data.input,
                startTime: Date.now(),
              });

              await streamingCallback({
                type: 'tool_start',
                data: {
                  tool: event.name,
                  input: event.data.input,
                  callId,
                },
              });
            }
            break;

          case 'on_tool_end':
            if (event.name && event.data?.output && streamingCallback) {
              // Find matching tool call
              const matchingCall = Array.from(toolCallMap.entries()).find(
                ([, callData]) => callData.name === event.name
              );

              if (matchingCall) {
                const [callId, callData] = matchingCall;
                const duration = Date.now() - callData.startTime;

                toolCalls.push({
                  tool: callData.name,
                  input: callData.args,
                  output: event.data.output,
                });

                await streamingCallback({
                  type: 'tool_complete',
                  data: {
                    callId,
                    tool: callData.name,
                    output: event.data.output,
                    duration,
                  },
                });

                toolCallMap.delete(callId);
              }
            }
            break;

          case 'on_chain_end':
            // This indicates the completion of the entire graph
            if (event.data?.output) {
              iterations = currentIteration;

              // Prevent duplicate iteration_complete events
              const iterationKey = `iteration_${currentIteration}`;
              if (
                streamingCallback &&
                !processedIterationEvents.has(iterationKey)
              ) {
                processedIterationEvents.add(iterationKey);
                await streamingCallback({
                  type: 'iteration_complete',
                  data: {
                    iteration: currentIteration,
                    hasToolCalls: toolCalls.length > 0,
                  },
                });
              }
            }
            break;
        }
      }

      // Process final result
      const accumulatedResponse = accumulatedContent || 'No response generated';

      // Use shared formatting method
      const formattedResult = await formatFinalResponse(
        accumulatedResponse,
        this.params.model.model,
        jsonMode
      );

      // If there's an error from formatting (e.g., invalid JSON), return early with consistent behavior
      if (formattedResult.error) {
        return {
          response: formattedResult.response,
          toolCalls: toolCalls.length > 0 ? toolCalls : [],
          iterations,
          error: formattedResult.error,
          success: false,
        };
      }

      const finalResponse = formattedResult.response;

      console.log(
        '[AIAgent] Streaming execution completed with',
        iterations,
        'iterations and',
        toolCalls.length,
        'tool calls'
      );

      return {
        response:
          typeof finalResponse === 'string'
            ? finalResponse
            : JSON.stringify(finalResponse),
        toolCalls: toolCalls.length > 0 ? toolCalls : [],
        iterations,
        error: '',
        success: true,
      };
    } catch (error) {
      console.warn('[AIAgent] Streaming execution error (continuing):', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        response: `Execution error: ${errorMessage}`,
        success: false, // Still false but don't completely halt execution
        iterations,
        toolCalls: toolCalls.length > 0 ? toolCalls : [], // Preserve completed tool calls
        error: errorMessage,
      };
    }
  }
}
