import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElevenLabsBubble } from './eleven-labs.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Mock fetch
const globalFetch = global.fetch;
const mockFetch = vi.fn();

describe('ElevenLabsBubble', () => {
  let bubble: ElevenLabsBubble;
  const mockApiKey = 'xi-mock-api-key';

  beforeEach(() => {
    global.fetch = mockFetch;
    bubble = new ElevenLabsBubble({
      operation: 'get_signed_url',
      agentId: 'agent-123',
      credentials: {
        [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
      },
    });
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.clearAllMocks();
  });

  describe('get_signed_url', () => {
    it('should successfully get a signed URL', async () => {
      const mockAgentId = 'agent-123';
      const mockSignedUrl =
        'wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent-123&token=mock-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ signed_url: mockSignedUrl }),
      });

      const result = await bubble.performAction({
        operation: 'get_signed_url',
        agentId: mockAgentId,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${mockAgentId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': mockApiKey,
          },
        }
      );

      expect(result).toEqual({
        operation: 'get_signed_url',
        success: true,
        signedUrl: mockSignedUrl,
        error: '',
      });
    });

    it('should handle API errors', async () => {
      const mockAgentId = 'agent-123';
      const errorMessage = 'Unauthorized';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => errorMessage,
      });

      const result = await bubble.performAction({
        operation: 'get_signed_url',
        agentId: mockAgentId,
      });

      expect(result).toEqual({
        operation: 'get_signed_url',
        success: false,
        error: `Failed to get signed URL: 401 Unauthorized - ${errorMessage}`,
      });
    });

    it('should handle missing credentials', async () => {
      const bubbleNoCreds = new ElevenLabsBubble({
        operation: 'get_signed_url',
        agentId: 'agent-123',
      });

      const result = await bubbleNoCreds.performAction({
        operation: 'get_signed_url',
        agentId: 'agent-123',
      });

      expect(result).toEqual({
        operation: 'get_signed_url',
        success: false,
        error: 'Eleven Labs API Key is required',
      });
    });
  });

  describe('testCredential', () => {
    it('should return true for valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await bubble.testCredential();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/user',
        {
          method: 'GET',
          headers: {
            'xi-api-key': mockApiKey,
          },
        }
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });

    it('should return false if fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });
  });

  describe('trigger_outbound_call', () => {
    it('should successfully trigger an outbound call', async () => {
      const mockCallSid = 'call-123';
      const mockConversationId = 'conv-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          callSid: mockCallSid,
          conversation_id: mockConversationId,
        }),
      });

      const callBubble = new ElevenLabsBubble({
        operation: 'trigger_outbound_call',
        agentId: 'agent-123',
        toPhoneNumber: '+1234567890',
        phoneNumberId: 'phnum_123',
        variables: { name: 'John' },
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      const result = await callBubble.performAction();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
        {
          method: 'POST',
          headers: {
            'xi-api-key': mockApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to_number: '+1234567890',
            agent_id: 'agent-123',
            agent_phone_number_id: 'phnum_123',
            conversation_initiation_client_data: {
              dynamic_variables: { name: 'John' },
            },
          }),
        }
      );

      expect(result).toEqual({
        operation: 'trigger_outbound_call',
        success: true,
        callSid: mockCallSid,
        conversationId: mockConversationId,
        error: '',
      });
    });
  });

  describe('get_agent', () => {
    it('should successfully get agent details', async () => {
      const mockAgent = { agent_id: 'agent-123', name: 'Test Agent' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent,
      });

      const agentBubble = new ElevenLabsBubble({
        operation: 'get_agent',
        agentId: 'agent-123',
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      const result = await agentBubble.performAction();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/agents/agent-123',
        {
          method: 'GET',
          headers: {
            'xi-api-key': mockApiKey,
          },
        }
      );

      expect(result).toEqual({
        operation: 'get_agent',
        success: true,
        agent: mockAgent,
        error: '',
      });
    });
  });

  describe('validate_webhook_signature', () => {
    it('should validate a correct signature', async () => {
      const secret = 'secret';
      const body = '{"event":"test"}';
      const timestamp = '1234567890';

      // Calculate expected signature using node crypto (which is available in test env)
      const crypto = await import('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      const validateBubble = new ElevenLabsBubble({
        operation: 'validate_webhook_signature',
        signature,
        timestamp,
        body,
        webhookSecret: secret,
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      const result = await validateBubble.performAction();

      expect(result).toEqual({
        operation: 'validate_webhook_signature',
        success: true,
        isValid: true,
        error: '',
      });
    });

    it('should reject an incorrect signature', async () => {
      const validateBubble = new ElevenLabsBubble({
        operation: 'validate_webhook_signature',
        signature: 'invalid-signature',
        timestamp: '1234567890',
        body: '{}',
        webhookSecret: 'secret',
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      const result = await validateBubble.performAction();

      expect(result).toEqual({
        operation: 'validate_webhook_signature',
        success: true,
        isValid: false,
        error: '',
      });
    });
  });

  describe('get_conversation', () => {
    it('should successfully get conversation details', async () => {
      const mockConversationId = 'conv-123';
      const mockConversation = {
        conversation_id: mockConversationId,
        status: 'completed',
        transcript: [{ role: 'agent', message: 'Hello' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockConversation,
      });

      const conversationBubble = new ElevenLabsBubble({
        operation: 'get_conversation',
        conversationId: mockConversationId,
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      const result = await conversationBubble.performAction();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.elevenlabs.io/v1/convai/conversations/${mockConversationId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': mockApiKey,
          },
        }
      );

      expect(result).toEqual({
        operation: 'get_conversation',
        success: true,
        conversation: mockConversation,
        error: '',
      });
    });

    it('should handle errors when getting conversation', async () => {
      const mockConversationId = 'conv-123';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Conversation not found',
      });

      const conversationBubble = new ElevenLabsBubble({
        operation: 'get_conversation',
        conversationId: mockConversationId,
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      const result = await conversationBubble.performAction();

      expect(result).toEqual({
        operation: 'get_conversation',
        success: false,
        error:
          'Failed to get conversation: 404 Not Found - Conversation not found',
      });
    });
  });

  describe('get_conversations', () => {
    it('should successfully list conversations', async () => {
      const mockConversations = [
        { conversation_id: 'conv-1', status: 'completed' },
        { conversation_id: 'conv-2', status: 'processing' },
      ];
      const mockResponse = {
        conversations: mockConversations,
        has_more: true,
        next_cursor: 'cursor-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const conversationsBubble = new ElevenLabsBubble({
        operation: 'get_conversations',
        agentId: 'agent-123',
        pageSize: 10,
        cursor: 'prev-cursor',
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      const result = await conversationsBubble.performAction();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.elevenlabs.io/v1/convai/conversations'
        ),
        {
          method: 'GET',
          headers: {
            'xi-api-key': mockApiKey,
          },
        }
      );

      // Check query params
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get('agent_id')).toBe('agent-123');
      expect(url.searchParams.get('page_size')).toBe('10');
      expect(url.searchParams.get('cursor')).toBe('prev-cursor');

      expect(result).toEqual({
        operation: 'get_conversations',
        success: true,
        conversations: mockConversations,
        hasMore: true,
        nextCursor: 'cursor-123',
        error: '',
      });
    });
  });

  describe('action() method integration', () => {
    it('should work when calling .action() inherited from BaseBubble', async () => {
      const mockCallSid = 'call-action-123';
      const mockConversationId = 'conv-action-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          callSid: mockCallSid,
          conversation_id: mockConversationId,
        }),
      });

      const callBubble = new ElevenLabsBubble({
        operation: 'trigger_outbound_call',
        agentId: 'agent-123',
        toPhoneNumber: '+1234567890',
        variables: { name: 'John' },
        credentials: {
          [CredentialType.ELEVENLABS_API_KEY]: mockApiKey,
        },
      });

      // Call .action() instead of .performAction()
      const result = await callBubble.action();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        operation: 'trigger_outbound_call',
        success: true,
        callSid: mockCallSid,
        conversationId: mockConversationId,
        error: '',
      });
    });
  });
});
