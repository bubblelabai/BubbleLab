import { z } from 'zod';
import crypto from 'crypto';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define the parameters schema for the Eleven Labs bubble
export const ElevenLabsParamsSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z
      .literal('get_signed_url')
      .describe('Get a signed URL for authenticated WebSocket connection'),
    agentId: z.string().describe('The ID of the agent to connect to'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z
      .literal('trigger_outbound_call')
      .describe('Trigger an outbound call to a phone number'),
    agentId: z.string().describe('The ID of the agent to use for the call'),
    toPhoneNumber: z
      .string()
      .describe('The phone number to call (E.164 format)'),
    phoneNumberId: z
      .string()
      .optional()
      .describe('The ID of the phone number to call from (optional)'),
    variables: z
      .record(z.string())
      .optional()
      .describe('Dynamic variables to pass to the agent'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z.literal('get_agent').describe('Get details about an agent'),
    agentId: z.string().describe('The ID of the agent to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z
      .literal('validate_webhook_signature')
      .describe('Validate a webhook signature from Eleven Labs'),
    signature: z
      .string()
      .describe('The signature header from the webhook request'),
    timestamp: z
      .string()
      .describe('The timestamp header from the webhook request'),
    body: z.string().describe('The raw body of the webhook request'),
    webhookSecret: z
      .string()
      .describe('The webhook secret to validate against'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z
      .literal('get_conversation')
      .describe('Get details of a specific conversation'),
    conversationId: z
      .string()
      .describe('The ID of the conversation to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
  z.object({
    operation: z
      .literal('get_conversations')
      .describe('Get a list of conversations'),
    agentId: z.string().optional().describe('Filter conversations by agent ID'),
    pageSize: z
      .number()
      .optional()
      .describe('Number of conversations to return (default: 30)'),
    cursor: z.string().optional().describe('Cursor for pagination'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

export type ElevenLabsParamsInput = z.input<typeof ElevenLabsParamsSchema>;
export type ElevenLabsParamsParsed = z.output<typeof ElevenLabsParamsSchema>;

export const ElevenLabsResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('get_signed_url'),
    signedUrl: z
      .string()
      .optional()
      .describe('The signed URL for WebSocket connection'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('trigger_outbound_call'),
    callSid: z
      .string()
      .optional()
      .describe('The unique identifier for the call'),
    conversationId: z
      .string()
      .optional()
      .describe('The unique identifier for the conversation'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('get_agent'),
    agent: z.record(z.unknown()).optional().describe('The agent details'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('validate_webhook_signature'),
    isValid: z.boolean().describe('Whether the signature is valid'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('get_conversation'),
    conversation: z
      .record(z.unknown())
      .optional()
      .describe('The conversation details'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
  z.object({
    operation: z.literal('get_conversations'),
    conversations: z
      .array(z.record(z.unknown()))
      .optional()
      .describe('List of conversations'),
    hasMore: z
      .boolean()
      .optional()
      .describe('Whether there are more conversations to retrieve'),
    nextCursor: z
      .string()
      .optional()
      .describe('Cursor for the next page of results'),
    success: z.boolean().describe('Whether the operation was successful'),
    error: z.string().describe('Error message if the operation failed'),
  }),
]);

export type ElevenLabsResult = z.output<typeof ElevenLabsResultSchema>;

export class ElevenLabsBubble extends ServiceBubble<
  ElevenLabsParamsParsed,
  ElevenLabsResult
> {
  static readonly type = 'service' as const;
  static readonly service = 'eleven-labs';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'eleven-labs';
  static readonly schema = ElevenLabsParamsSchema;
  static readonly resultSchema = ElevenLabsResultSchema;
  static readonly shortDescription =
    'Eleven Labs integration for Conversational AI';
  static readonly longDescription = `
    Integrate with Eleven Labs Conversational AI agents.
    Use cases:
    - Generate signed URLs for secure WebSocket connections to agents
    - Trigger outbound calls
    - Get agent details
    - Validate webhook signatures
    - Get conversation history
  `;
  static readonly alias = 'elevenlabs';

  constructor(params: ElevenLabsParamsInput, context?: BubbleContext) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.ELEVENLABS_API_KEY];
  }

  public async performAction(
    context?: BubbleContext
  ): Promise<ElevenLabsResult> {
    void context;
    const params = this.params;
    switch (params.operation) {
      case 'get_signed_url':
        return this.getSignedUrl(params);
      case 'trigger_outbound_call':
        return this.triggerOutboundCall(params);
      case 'get_agent':
        return this.getAgent(params);
      case 'validate_webhook_signature':
        return this.validateWebhookSignature(params);
      case 'get_conversation':
        return this.getConversation(params);
      case 'get_conversations':
        return this.getConversations(params);
      default:
        throw new Error(`Unknown operation: ${(params as any).operation}`);
    }
  }

  public async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) return false;
    // Simple test: try to get user info (requires a valid key but invalid agent ID might still return 404,
    // so we just check if we can make a request that doesn't return 401)
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async getSignedUrl(
    params: Extract<ElevenLabsParamsParsed, { operation: 'get_signed_url' }>
  ): Promise<Extract<ElevenLabsResult, { operation: 'get_signed_url' }>> {
    const { agentId } = params;
    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'get_signed_url',
        success: false,
        error: 'Eleven Labs API Key is required',
      };
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'get_signed_url',
          success: false,
          error: `Failed to get signed URL: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as { signed_url: string };
      return {
        operation: 'get_signed_url',
        signedUrl: data.signed_url,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_signed_url',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async triggerOutboundCall(
    params: Extract<
      ElevenLabsParamsParsed,
      { operation: 'trigger_outbound_call' }
    >
  ): Promise<
    Extract<ElevenLabsResult, { operation: 'trigger_outbound_call' }>
  > {
    const { agentId, toPhoneNumber, phoneNumberId, variables } = params;
    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'trigger_outbound_call',
        success: false,
        error: 'Eleven Labs API Key is required',
      };
    }

    try {
      const body: Record<string, unknown> = {
        to_number: toPhoneNumber,
        agent_id: agentId,
      };

      if (phoneNumberId) {
        body.agent_phone_number_id = phoneNumberId;
      }

      if (variables) {
        body.conversation_initiation_client_data = {
          dynamic_variables: variables,
        };
      }

      const response = await fetch(
        'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'trigger_outbound_call',
          success: false,
          error: `Failed to trigger outbound call: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        callSid: string;
        conversation_id: string;
      };
      return {
        operation: 'trigger_outbound_call',
        success: true,
        callSid: data.callSid,
        conversationId: data.conversation_id,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'trigger_outbound_call',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async getAgent(
    params: Extract<ElevenLabsParamsParsed, { operation: 'get_agent' }>
  ): Promise<Extract<ElevenLabsResult, { operation: 'get_agent' }>> {
    const { agentId } = params;
    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'get_agent',
        success: false,
        error: 'Eleven Labs API Key is required',
      };
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'get_agent',
          success: false,
          error: `Failed to get agent: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        operation: 'get_agent',
        success: true,
        agent: data,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_agent',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async validateWebhookSignature(
    params: Extract<
      ElevenLabsParamsParsed,
      { operation: 'validate_webhook_signature' }
    >
  ): Promise<
    Extract<ElevenLabsResult, { operation: 'validate_webhook_signature' }>
  > {
    const { signature, timestamp, body, webhookSecret } = params;

    try {
      const signedPayload = `${timestamp}.${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      const isValid = signature === expectedSignature;

      return {
        operation: 'validate_webhook_signature',
        success: true,
        isValid,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'validate_webhook_signature',
        success: false,
        isValid: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during signature validation',
      };
    }
  }

  private async getConversation(
    params: Extract<ElevenLabsParamsParsed, { operation: 'get_conversation' }>
  ): Promise<Extract<ElevenLabsResult, { operation: 'get_conversation' }>> {
    const { conversationId } = params;
    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'get_conversation',
        success: false,
        error: 'Eleven Labs API Key is required',
      };
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'get_conversation',
          success: false,
          error: `Failed to get conversation: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        operation: 'get_conversation',
        success: true,
        conversation: data,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_conversation',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async getConversations(
    params: Extract<ElevenLabsParamsParsed, { operation: 'get_conversations' }>
  ): Promise<Extract<ElevenLabsResult, { operation: 'get_conversations' }>> {
    const { agentId, pageSize, cursor } = params;
    const apiKey = this.chooseCredential();

    if (!apiKey) {
      return {
        operation: 'get_conversations',
        success: false,
        error: 'Eleven Labs API Key is required',
      };
    }

    try {
      const queryParams = new URLSearchParams();
      if (agentId) queryParams.append('agent_id', agentId);
      if (pageSize) queryParams.append('page_size', pageSize.toString());
      if (cursor) queryParams.append('cursor', cursor);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          operation: 'get_conversations',
          success: false,
          error: `Failed to get conversations: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        conversations: Record<string, unknown>[];
        has_more: boolean;
        next_cursor: string;
      };
      return {
        operation: 'get_conversations',
        success: true,
        conversations: data.conversations,
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
        error: '',
      };
    } catch (error) {
      return {
        operation: 'get_conversations',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
