/**
 * TOOL BUBBLE TEMPLATE
 *
 * This template provides a starting point for creating new tool bubbles in the NodeX system.
 * Tool bubbles are specialized bubbles that provide utility functions for other bubbles,
 * particularly useful for AI agents that need to perform specific operations.
 *
 * NEW FEATURES (v2):
 * - Automatic credential injection via base class
 * - Config parameter support for runtime configuration
 * - No need to implement toAgentTool() - handled automatically
 * - IMPORTANT: credentials and config are HIDDEN from AI agents
 *   - AI agents only see your actual tool parameters (inputData, options, etc.)
 *   - credentials and config are injected at runtime and available in performAction()
 *   - This keeps the tool interface clean for AI while providing access to secrets
 *
 * To create a new tool bubble:
 * 1. Copy this template and rename it (e.g., my-custom-tool.ts)
 * 2. Replace all instances of "MyCustomTool" with your tool name
 * 3. Update the schema to define your input parameters
 * 4. Add credentials/config fields if needed (see examples below)
 * 5. Update the result schema to define your output structure
 * 6. Implement the performAction method with your tool logic
 * 7. Update all static metadata (bubbleName, descriptions, etc.)
 * 8. Register your tool in the BubbleFactory
 */

import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
// Import BubbleFactory if you need to access other bubbles
// import { BubbleFactory } from '../../bubble-factory.js';

/**
 * Define the parameters schema using Zod
 * This schema validates and types the input parameters for your tool
 *
 * Common patterns:
 * - Required string: z.string().min(1, 'Field is required')
 * - Optional string: z.string().optional()
 * - Number with range: z.number().min(0).max(100)
 * - Enum: z.enum(['option1', 'option2'])
 * - Array: z.array(z.string())
 * - Object: z.object({ key: z.string() })
 * - Credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional()
 */
const MyCustomToolParamsSchema = z.object({
  // Example required parameter
  inputData: z.string().min(1, 'Input data is required'),

  // Example optional parameter with description
  options: z
    .object({
      includeDetails: z.boolean().default(false),
      maxResults: z.number().min(1).max(100).default(10),
    })
    .optional()
    .describe('Configuration options for the tool'),

  // IMPORTANT: These fields are AUTOMATICALLY REMOVED from AI agent schema
  // AI agents will NOT see these parameters - they're injected at runtime

  // Credentials (if your tool needs API keys or other secrets)
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Database credentials (HIDDEN from AI - injected at runtime)'),

  // Optional configuration passed from the agent system
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Configuration for the tool bubble (HIDDEN from AI - injected at runtime)'
    ),
});

/**
 * Type definitions derived from schemas
 * These provide TypeScript types for compile-time type safety
 */
type MyCustomToolParamsInput = z.input<typeof MyCustomToolParamsSchema>;
type MyCustomToolParams = z.output<typeof MyCustomToolParamsSchema>;
type MyCustomToolResult = z.output<typeof MyCustomToolResultSchema>;

/**
 * Define the result schema
 * This schema defines what your tool returns
 * Always include success and error fields for consistent error handling
 */
const MyCustomToolResultSchema = z.object({
  // Your custom result fields
  processedData: z.string(),
  metadata: z.object({
    processedAt: z.string(),
    itemsProcessed: z.number(),
  }),

  // Standard result fields (always include these)
  success: z.boolean(),
  error: z.string(),
});

/**
 * Main tool class implementation
 * Extends ToolBubble with your parameter and result types
 */
export class MyCustomTool extends ToolBubble<
  MyCustomToolParams,
  MyCustomToolResult
> {
  /**
   * REQUIRED STATIC METADATA
   * These fields are used by the BubbleFactory and AI agents
   */

  // Bubble type - always 'tool' for tool bubbles
  static readonly type = 'tool' as const;

  // Unique identifier for your tool (use kebab-case)
  static readonly bubbleName = 'my-custom-tool';

  // Schemas for validation
  static readonly schema = MyCustomToolParamsSchema;
  static readonly resultSchema = MyCustomToolResultSchema;

  // Short description (one line, used in lists and summaries)
  static readonly shortDescription = 'Brief description of what your tool does';

  // Long description with detailed information
  static readonly longDescription = `
    A comprehensive description of your tool bubble.
    
    What it does:
    - Main functionality point 1
    - Main functionality point 2
    
    How it works:
    - Implementation detail 1
    - Implementation detail 2
    
    Use cases:
    - When an AI agent needs to perform X
    - When processing Y type of data
    - When integrating with Z system
  `;

  // Optional: Short alias for the tool (e.g., 'custom' instead of 'my-custom-tool')
  static readonly alias = 'custom';

  // Optional: Define which credentials this tool can use
  // static readonly credentialOptions = [CredentialType.OPENAI_CRED];

  /**
   * Constructor
   * Initialize your tool with parameters and optional context
   */
  constructor(params: MyCustomToolParamsInput, context?: BubbleContext) {
    super(params, context);
    // Initialize any instance variables here
    // Example: this.factory = new BubbleFactory();
  }

  /**
   * Main action method - this is where your tool logic goes
   * This method is called when the tool is executed
   *
   * @param context - Optional bubble context (contains metadata, credentials, etc.)
   * @returns Promise with your result object
   */
  async performAction(context?: BubbleContext): Promise<MyCustomToolResult> {
    // Context is available but often not used in tools
    void context;

    try {
      // Extract parameters
      // NOTE: credentials and config are automatically injected by the base class
      // AI agents only provided inputData and options - never see credentials/config
      const { inputData, options } = this.params;

      // Access credentials if needed (injected by runtime, not provided by AI)
      // const dbConnection = credentials?.DATABASE_CRED;
      // const apiKey = credentials?.OPENAI_CRED;

      // Access config if needed (injected by runtime, not provided by AI)
      // const customSetting = config?.customSetting;

      // Implement your tool logic here
      // Example: Process the input data
      const processedData = await this.processData(inputData, options);

      // Return successful result
      return {
        processedData,
        metadata: {
          processedAt: new Date().toISOString(),
          itemsProcessed: 1,
        },
        success: true,
        error: '',
      };
    } catch (error) {
      // Handle errors gracefully
      return {
        processedData: '',
        metadata: {
          processedAt: new Date().toISOString(),
          itemsProcessed: 0,
        },
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Note: The toAgentTool() static method is now implemented in the base ToolBubble class
  // It automatically handles credential and config injection
  // You don't need to implement it unless you need custom behavior

  /**
   * PRIVATE HELPER METHODS
   * Add your internal logic methods here
   */

  private async processData(
    data: string,
    options?: { includeDetails: boolean; maxResults: number }
  ): Promise<string> {
    // Example processing logic
    const includeDetails = options?.includeDetails ?? false;
    const maxResults = options?.maxResults ?? 10;

    // Your actual processing logic here
    return `Processed: ${data} (details: ${includeDetails}, max: ${maxResults})`;
  }

  // Add more helper methods as needed
  // Examples from existing tools:
  // - formatDescriptionForAI(): Format output for AI consumption
  // - generateExampleParams(): Create example usage
  // - extractMetadata(): Parse complex data structures
  // - validateInput(): Additional validation beyond schema
}

/**
 * REGISTRATION AND USAGE
 *
 * 1. Register your tool in the BubbleFactory:
 * ```typescript
 * import { MyCustomTool } from './bubbles/tool-bubble/my-custom-tool.js';
 *
 * // In registerDefaults() method:
 * this.register('my-custom-tool', MyCustomTool as BubbleClassWithMetadata);
 * ```
 *
 * 2. Direct usage:
 * ```typescript
 * const tool = new MyCustomTool({
 *   inputData: 'some data',
 *   options: { includeDetails: true },
 *   credentials: { DATABASE_CRED: 'connection_string' }
 * });
 * const result = await tool.action();
 * ```
 *
 * 3. AI Agent usage:
 * ```typescript
 * // When AI agent calls your tool, it ONLY sees these parameters:
 * {
 *   "inputData": "some data",
 *   "options": { "includeDetails": true }
 * }
 *
 * // The AI agent configuration provides credentials/config separately:
 * tools: [{
 *   name: 'my-custom-tool',
 *   credentials: { DATABASE_CRED: 'connection_string' },  // Runtime injection
 *   config: { someOption: true }  // Runtime injection
 * }]
 * ```
 *
 * IMPORTANT SECURITY FEATURE:
 * - AI agents NEVER see credentials or config in the tool schema
 * - The base ToolBubble class automatically strips these from the AI-visible schema
 * - Runtime injects credentials/config before calling performAction()
 * - This prevents AI from accidentally exposing or misusing secrets
 */
