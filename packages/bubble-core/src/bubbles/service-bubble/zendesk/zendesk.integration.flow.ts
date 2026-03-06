import {
  BubbleFlow,
  ZendeskBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  ticketId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

export class ZendeskIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    let ticketId = '';

    // ===== USER TESTS =====

    // 1. List users
    try {
      const listUsers = await new ZendeskBubble({
        operation: 'list_users',
        per_page: 5,
      }).action();

      results.push({
        operation: 'list_users',
        success: listUsers.success,
        details: listUsers.success
          ? `Found ${listUsers.data?.users?.length || 0} users`
          : listUsers.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_users',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ===== ORGANIZATION TESTS =====

    // 2. List organizations
    try {
      const listOrgs = await new ZendeskBubble({
        operation: 'list_organizations',
        per_page: 5,
      }).action();

      results.push({
        operation: 'list_organizations',
        success: listOrgs.success,
        details: listOrgs.success
          ? `Found ${listOrgs.data?.organizations?.length || 0} organizations`
          : listOrgs.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_organizations',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ===== TICKET TESTS =====

    // 3. Create ticket with edge case characters
    try {
      const createTicket = await new ZendeskBubble({
        operation: 'create_ticket',
        subject: `Integration test: O'Brien résumé ${Date.now()}`,
        body: `Test ticket body with special chars: éàüñ — created at ${new Date().toISOString()}`,
        priority: 'low',
        type: 'question',
        tags: ['integration-test', 'automated'],
      }).action();

      ticketId = String(createTicket.data?.ticket?.id || '');
      results.push({
        operation: 'create_ticket',
        success: createTicket.success,
        details: createTicket.success
          ? `Created ticket: ${ticketId}`
          : createTicket.error,
      });
    } catch (error) {
      results.push({
        operation: 'create_ticket',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 4. Get ticket
    if (ticketId) {
      try {
        const getTicket = await new ZendeskBubble({
          operation: 'get_ticket',
          ticket_id: ticketId,
        }).action();

        results.push({
          operation: 'get_ticket',
          success: getTicket.success,
          details: getTicket.success
            ? `Retrieved ticket: ${getTicket.data?.ticket?.subject}`
            : getTicket.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_ticket',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 5. Update ticket (add a comment)
    if (ticketId) {
      try {
        const updateTicket = await new ZendeskBubble({
          operation: 'update_ticket',
          ticket_id: ticketId,
          comment: 'Integration test reply — internal note',
          public: false,
          priority: 'normal',
        }).action();

        results.push({
          operation: 'update_ticket',
          success: updateTicket.success,
          details: updateTicket.success
            ? `Updated ticket ${ticketId} with internal note`
            : updateTicket.error,
        });
      } catch (error) {
        results.push({
          operation: 'update_ticket',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 6. List ticket comments
    if (ticketId) {
      try {
        const listComments = await new ZendeskBubble({
          operation: 'list_ticket_comments',
          ticket_id: ticketId,
        }).action();

        results.push({
          operation: 'list_ticket_comments',
          success: listComments.success,
          details: listComments.success
            ? `Found ${listComments.data?.comments?.length || 0} comments on ticket ${ticketId}`
            : listComments.error,
        });
      } catch (error) {
        results.push({
          operation: 'list_ticket_comments',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 7. List tickets (with status filter)
    try {
      const listTickets = await new ZendeskBubble({
        operation: 'list_tickets',
        per_page: 5,
      }).action();

      results.push({
        operation: 'list_tickets',
        success: listTickets.success,
        details: listTickets.success
          ? `Found ${listTickets.data?.tickets?.length || 0} tickets`
          : listTickets.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_tickets',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ===== SEARCH TEST =====

    // 8. Search
    try {
      const searchResult = await new ZendeskBubble({
        operation: 'search',
        query: 'type:ticket integration-test',
        per_page: 5,
      }).action();

      results.push({
        operation: 'search',
        success: searchResult.success,
        details: searchResult.success
          ? `Search returned ${searchResult.data?.results?.length || 0} results`
          : searchResult.error,
      });
    } catch (error) {
      results.push({
        operation: 'search',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      ticketId,
      testResults: results,
    };
  }
}
