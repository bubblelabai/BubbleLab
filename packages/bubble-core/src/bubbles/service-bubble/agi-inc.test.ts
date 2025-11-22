import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AGIIncBubble } from './agi-inc.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AGIIncBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCredentials = {
    [CredentialType.AGI_API_KEY]: 'test-api-key',
  };

  describe('Static Properties', () => {
    it('should have correct static metadata', () => {
      expect(AGIIncBubble.bubbleName).toBe('agi-inc');
      expect(AGIIncBubble.type).toBe('service');
      expect(AGIIncBubble.authType).toBe('apikey');
      expect(AGIIncBubble.service).toBe('agi-inc');
      expect(AGIIncBubble.shortDescription).toContain('AGI Agent');
    });

    it('should have valid schema', () => {
      expect(AGIIncBubble.schema).toBeDefined();
      expect(AGIIncBubble.resultSchema).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    it('should validate create_session operation', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'create_session',
        agent_name: 'agi-0',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it('should validate list_sessions operation', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'list_sessions',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it('should validate get_session operation', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'get_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it('should validate send_message operation', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'send_message',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        message: 'Find flights from SFO to JFK',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it('should validate send_message with start_url', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'send_message',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        message: 'Compare prices',
        start_url: 'https://www.example.com',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it('should validate get_messages operation with defaults', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'get_messages',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.after_id).toBe(0);
        expect(result.data.sanitize).toBe(true);
      }
    });

    it('should validate delete_session operation', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'delete_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        save_snapshot_mode: 'filesystem',
        save_as_default: true,
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it('should validate navigate operation', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'navigate',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        url: 'https://www.google.com',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid session_id format', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'get_session',
        session_id: 'invalid-uuid',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty message', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'send_message',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        message: '',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL in navigate', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'navigate',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        url: 'not-a-url',
        credentials: mockCredentials,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('API Operations', () => {
    it('should create a session successfully', async () => {
      const mockResponse = {
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        vnc_url: 'https://vnc.agi.tech/session/550e8400',
        agent_name: 'agi-0',
        status: 'ready',
        created_at: '2025-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const bubble = new AGIIncBubble({
        operation: 'create_session',
        agent_name: 'agi-0',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('create_session');
      expect(result.session_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.agent_name).toBe('agi-0');
      expect(result.status).toBe('ready');
    });

    it('should list sessions successfully', async () => {
      const mockResponse = [
        {
          session_id: '550e8400-e29b-41d4-a716-446655440000',
          agent_name: 'agi-0',
          status: 'running',
          created_at: '2025-01-01T00:00:00.000Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const bubble = new AGIIncBubble({
        operation: 'list_sessions',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('list_sessions');
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions?.[0].session_id).toBe(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should get execution status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'running' }),
      });

      const bubble = new AGIIncBubble({
        operation: 'get_status',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('get_status');
      expect(result.status).toBe('running');
    });

    it('should send message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Message sent successfully',
          }),
      });

      const bubble = new AGIIncBubble({
        operation: 'send_message',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        message: 'Find flights from SFO to JFK',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('send_message');
    });

    it('should get messages successfully', async () => {
      const mockResponse = {
        messages: [
          {
            id: 1,
            type: 'THOUGHT',
            content: 'Searching for flights...',
            timestamp: '2025-01-01T00:00:00.000Z',
            metadata: {},
          },
        ],
        status: 'running',
        has_agent: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const bubble = new AGIIncBubble({
        operation: 'get_messages',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        after_id: 0,
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('get_messages');
      expect(result.messages).toHaveLength(1);
      expect(result.messages?.[0].type).toBe('THOUGHT');
      expect(result.has_agent).toBe(true);
    });

    it('should navigate successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ current_url: 'https://www.google.com' }),
      });

      const bubble = new AGIIncBubble({
        operation: 'navigate',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        url: 'https://www.google.com',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('navigate');
      expect(result.current_url).toBe('https://www.google.com');
    });

    it('should get screenshot successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            screenshot: 'data:image/jpeg;base64,/9j/...',
            url: 'https://www.example.com',
            title: 'Example Page',
          }),
      });

      const bubble = new AGIIncBubble({
        operation: 'get_screenshot',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('get_screenshot');
      expect(result.screenshot).toContain('data:image/jpeg');
      expect(result.url).toBe('https://www.example.com');
      expect(result.title).toBe('Example Page');
    });

    it('should pause session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Session paused successfully',
          }),
      });

      const bubble = new AGIIncBubble({
        operation: 'pause_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('pause_session');
    });

    it('should resume session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Session resumed successfully',
          }),
      });

      const bubble = new AGIIncBubble({
        operation: 'resume_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('resume_session');
    });

    it('should cancel session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: 'Session cancelled successfully',
          }),
      });

      const bubble = new AGIIncBubble({
        operation: 'cancel_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('cancel_session');
    });

    it('should delete session successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            deleted: true,
            message: 'Session deleted successfully',
          }),
      });

      const bubble = new AGIIncBubble({
        operation: 'delete_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('delete_session');
      expect(result.deleted).toBe(true);
    });

    it('should delete all sessions successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            deleted: true,
            message: 'Sessions deleted successfully',
          }),
      });

      const bubble = new AGIIncBubble({
        operation: 'delete_all_sessions',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(true);
      expect(result.operation).toBe('delete_all_sessions');
      expect(result.deleted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Session not found' }),
      });

      const bubble = new AGIIncBubble({
        operation: 'get_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const bubble = new AGIIncBubble({
        operation: 'list_sessions',
        credentials: mockCredentials,
      });

      const result = await bubble.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should throw error when credentials are missing', async () => {
      const bubble = new AGIIncBubble({
        operation: 'list_sessions',
        credentials: {},
      });

      const result = await bubble.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('AGI API key is required');
    });
  });

  describe('Default Values', () => {
    it('should use default agent_name for create_session', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'create_session',
        credentials: mockCredentials,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data.operation === 'create_session') {
        expect(result.data.agent_name).toBe('agi-0');
      }
    });

    it('should use default values for get_messages', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'get_messages',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data.operation === 'get_messages') {
        expect(result.data.after_id).toBe(0);
        expect(result.data.sanitize).toBe(true);
      }
    });

    it('should use default values for delete_session', () => {
      const result = AGIIncBubble.schema.safeParse({
        operation: 'delete_session',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        credentials: mockCredentials,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data.operation === 'delete_session') {
        expect(result.data.save_snapshot_mode).toBe('none');
        expect(result.data.save_as_default).toBe(false);
      }
    });
  });
});
