import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
// HelloWorld doesn't need credential imports since it doesn't use any

// Define the parameters schema for the hello world bubble
const HelloWorldParamsSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .describe('Name to include in the greeting message'),
  message: z
    .string()
    .optional()
    .default('Hello from NodeX!')
    .describe('Custom greeting message'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

// Input type (what the constructor accepts)
type HelloWorldParamsInput = z.input<typeof HelloWorldParamsSchema>;
// Output type (what gets validated and stored)
type HelloWorldParams = z.output<typeof HelloWorldParamsSchema>;

// Define the result schema for validation
const HelloWorldResultSchema = z.object({
  greeting: z.string().describe('The generated greeting message'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type HelloWorldResult = z.output<typeof HelloWorldResultSchema>;

export class HelloWorldBubble extends ServiceBubble<
  HelloWorldParams,
  HelloWorldResult
> {
  static readonly service = 'nodex-core';
  static readonly authType = 'none' as const;
  static readonly bubbleName = 'hello-world';
  static readonly type = 'service' as const;
  static readonly schema = HelloWorldParamsSchema;
  static readonly resultSchema = HelloWorldResultSchema;
  static readonly shortDescription =
    'Simple hello world bubble for testing purposes';
  static readonly longDescription = `
    A basic hello world bubble that demonstrates the NodeX bubble system.
    Use cases:
    - Testing the bubble execution system
    - Validating NodeX integration
    - Learning bubble development patterns
  `;
  static readonly alias = 'hello';

  constructor(
    params: HelloWorldParamsInput = {
      name: 'World',
      message: 'Hello from NodeX!',
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    // HelloWorld bubble doesn't need any credentials
    return undefined;
  }

  public async testCredential(): Promise<boolean> {
    // HelloWorld bubble doesn't need any credentials
    return true;
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<HelloWorldResult> {
    // Context is available but not currently used in this implementation
    void context;
    // Simulate some processing, random delay between 2- 5 seconds
    const delay = Math.floor(Math.random() * 3000) + 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const greeting = `${this.params.message} ${this.params.name}!`;
    return { greeting, success: true, error: '' };
  }
}
