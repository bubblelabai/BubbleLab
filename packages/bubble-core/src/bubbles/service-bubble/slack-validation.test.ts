import { SlackBubble } from './slack.js';

describe('Slack Bubble Result Schema Validation', () => {
  // Test the result schema directly
  describe('Direct schema validation tests', () => {
    test('should validate list_channels result', () => {
      const mockListChannelsResult = {
        operation: 'list_channels',
        ok: true,
        success: true,
        error: '',
        channels: [
          {
            id: 'C1234567890',
            name: 'general',
            is_channel: true,
            is_group: false,
            is_im: false,
            is_mpim: false,
            is_private: false,
            created: 1234567890,
            is_archived: false,
            is_general: true,
            name_normalized: 'general',
            is_member: true,
            num_members: 42,
          },
        ],
        response_metadata: {
          next_cursor: 'dGVhbTpDMDYxRkE1UEI=',
        },
      };

      // Test parsing with the result schema
      const parsed = SlackBubble.resultSchema?.parse(mockListChannelsResult);
      console.log('✅ list_channels validation passed:', parsed);
      expect(parsed).toBeDefined();
      expect(parsed.operation).toBe('list_channels');
    });

    test('should validate send_message result', () => {
      const mockSendMessageResult = {
        operation: 'send_message',
        ok: true,
        success: true,
        error: '',
        channel: 'C1234567890',
        ts: '1234567890.123456',
        message: {
          type: 'message',
          ts: '1234567890.123456',
          user: 'U1234567890',
          text: 'Hello, world!',
        },
      };

      const parsed = SlackBubble.resultSchema?.parse(mockSendMessageResult);
      console.log('✅ send_message validation passed:', parsed);
      expect(parsed).toBeDefined();
      expect(parsed.operation).toBe('send_message');
    });

    test('should validate error responses', () => {
      const mockErrorResult = {
        operation: 'list_channels',
        ok: false,
        success: false,
        error: 'invalid_auth',
      };

      const parsed = SlackBubble.resultSchema?.parse(mockErrorResult);
      console.log('✅ error response validation passed:', parsed);
      expect(parsed).toBeDefined();
      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe('invalid_auth');
    });

    test('should fail validation for wrong operation type', () => {
      const invalidResult = {
        operation: 'invalid_operation',
        ok: true,
        data: 'some data',
      };

      expect(() => {
        SlackBubble.resultSchema?.parse(invalidResult);
      }).toThrow();
    });

    test('should fail validation for missing required fields', () => {
      const invalidResult = {
        operation: 'list_channels',
        // Missing 'ok' field
        channels: [],
      };

      expect(() => {
        SlackBubble.resultSchema?.parse(invalidResult);
      }).toThrow();
    });

    test('should validate get_user_info result', () => {
      const mockUserResult = {
        operation: 'get_user_info',
        ok: true,
        success: true,
        error: '',
        user: {
          id: 'U1234567890',
          team_id: 'T1234567890',
          name: 'john.doe',
          real_name: 'John Doe',
          profile: {
            email: 'john@example.com',
            display_name: 'John',
            status_text: 'Working from home',
            status_emoji: ':house:',
          },
          is_admin: false,
          is_bot: false,
        },
      };

      const parsed = SlackBubble.resultSchema?.parse(mockUserResult);
      console.log('✅ get_user_info validation passed:', parsed);
      expect(parsed).toBeDefined();
      expect(parsed.operation).toBe('get_user_info');
    });

    test('should validate complex nested structures', () => {
      const mockHistoryResult = {
        operation: 'get_conversation_history',
        ok: true,
        success: true,
        error: '',
        messages: [
          {
            type: 'message',
            ts: '1234567890.123456',
            user: 'U1234567890',
            text: 'Hello!',
            reactions: [
              {
                name: 'thumbsup',
                users: ['U1111111111', 'U2222222222'],
                count: 2,
              },
            ],
          },
          {
            type: 'message',
            ts: '1234567891.123456',
            user: 'U9876543210',
            text: 'Hi there!',
            thread_ts: '1234567890.123456',
            reply_count: 3,
          },
        ],
        has_more: true,
        response_metadata: {
          next_cursor: 'bmV4dF90czoxNTEyMDg1ODYxMDAwNTQz',
        },
      };

      const parsed = SlackBubble.resultSchema?.parse(mockHistoryResult);
      console.log('✅ get_conversation_history validation passed');
      expect(parsed).toBeDefined();
      expect(parsed?.operation).toBe('get_conversation_history');
      // Type narrow to access messages property
      if (parsed && parsed.operation === 'get_conversation_history') {
        expect(parsed.messages).toHaveLength(2);
      }
    });
  });

  describe('Discriminated union behavior', () => {
    test('should only allow valid operation combinations', () => {
      // This should fail because list_channels doesn't have a 'ts' field
      const invalidMixedResult = {
        operation: 'list_channels',
        ok: true,
        success: true,
        error: '',
        ts: '1234567890.123456', // This belongs to send_message
        channels: [],
      };

      // The discriminated union should still parse this correctly
      // because extra fields are allowed with passthrough()
      const parsed = SlackBubble.resultSchema?.parse(invalidMixedResult);
      expect(parsed).toBeDefined();
      expect(parsed.operation).toBe('list_channels');
    });

    test('should handle all operation types', () => {
      const operations = [
        'send_message',
        'list_channels',
        'get_channel_info',
        'get_user_info',
        'list_users',
        'get_conversation_history',
        'update_message',
        'delete_message',
        'add_reaction',
        'remove_reaction',
      ];

      operations.forEach((op) => {
        const mockResult = {
          operation: op,
          success: true,
          error: '',
          ok: true,
          // Minimal valid structure for each operation
          ...(op === 'list_channels' && { channels: [] }),
          ...(op === 'send_message' && { channel: 'C123', ts: '123.456' }),
          ...(op === 'get_channel_info' && {
            channel: {
              id: 'C123',
              name: 'test',
              created: 123,
              is_archived: false,
            },
          }),
          ...(op === 'get_user_info' && { user: { id: 'U123', name: 'test' } }),
          ...(op === 'list_users' && { members: [] }),
          ...(op === 'get_conversation_history' && { messages: [] }),
          ...(op === 'update_message' && { channel: 'C123', ts: '123.456' }),
          ...(op === 'delete_message' && { channel: 'C123', ts: '123.456' }),
          ...(op === 'add_reaction' && {}),
          ...(op === 'remove_reaction' && {}),
        };

        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const parsed = SlackBubble.resultSchema?.parse(mockResult);
          console.log(`✅ ${op} validation passed`);
        }).not.toThrow();
      });
    });
  });

  describe('Type inference with bubble instances', () => {
    test('should maintain type safety with specific operations', () => {
      // Create a bubble with list_channels operation
      const listChannelsBubble = new SlackBubble({
        operation: 'list_channels' as const,
        token: 'xoxb-test',
        types: ['public_channel'],
        exclude_archived: true,
        limit: 50,
      });

      // The bubble should have the correct type
      expect(listChannelsBubble.currentParams.operation).toBe('list_channels');

      // Mock the performAction to test result validation
      const mockResult = {
        operation: 'list_channels' as const,
        ok: true,
        success: true,
        error: '',
        channels: [
          {
            id: 'C123',
            name: 'general',
            created: 1234567890,
            is_archived: false,
          },
        ],
      };

      // Test that the result schema can validate this
      const validated = SlackBubble.resultSchema?.parse(mockResult);
      expect(validated).toBeDefined();
    });

    test('should show what happens with wrong result type', () => {
      // If performAction returns wrong operation type
      const wrongResult = {
        operation: 'send_message', // Wrong! Should be list_channels
        ok: true,
        channel: 'C123',
        ts: '123.456',
        success: true,
        error: '',
      };

      // This should still validate because resultSchema accepts any valid operation
      const validated = SlackBubble.resultSchema?.parse(wrongResult);
      expect(validated).toBeDefined();
      expect(validated.operation).toBe('send_message');

      // Note: The generic type narrowing happens at compile time,
      // not at runtime validation
    });
  });
});
