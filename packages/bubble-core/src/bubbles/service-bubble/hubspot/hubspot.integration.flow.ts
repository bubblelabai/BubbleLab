import {
  BubbleFlow,
  HubSpotBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  contactId: string;
  companyId: string;
  dealId: string;
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

export class HubSpotIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    let contactId = '';
    let companyId = '';
    let dealId = '';
    let ticketId = '';

    // ===== CONTACT TESTS =====

    // 1. Create contact with edge case characters
    try {
      const createContact = await new HubSpotBubble({
        operation: 'create_record',
        object_type: 'contacts',
        properties: {
          email: `test-${Date.now()}@example.com`,
          firstname: "Test O'Brien",
          lastname: 'Contact \u00e9l\u00e8ve',
          phone: '+1-555-0123',
        },
      }).action();

      contactId = createContact.data?.record?.id || '';
      results.push({
        operation: 'create_contact',
        success: createContact.success,
        details: createContact.success
          ? `Created contact: ${contactId}`
          : createContact.error,
      });
    } catch (error) {
      results.push({
        operation: 'create_contact',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 2. Get contact
    if (contactId) {
      try {
        const getContact = await new HubSpotBubble({
          operation: 'get_record',
          object_type: 'contacts',
          record_id: contactId,
          properties: ['email', 'firstname', 'lastname', 'phone'],
        }).action();

        results.push({
          operation: 'get_contact',
          success: getContact.success,
          details: getContact.success
            ? `Retrieved contact: ${getContact.data?.record?.properties?.email}`
            : getContact.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_contact',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 3. Update contact
    if (contactId) {
      try {
        const updateContact = await new HubSpotBubble({
          operation: 'update_record',
          object_type: 'contacts',
          record_id: contactId,
          properties: {
            lastname: 'Updated L\u00e4stname',
            company: 'Test Corp',
          },
        }).action();

        results.push({
          operation: 'update_contact',
          success: updateContact.success,
          details: updateContact.success
            ? `Updated contact: ${contactId}`
            : updateContact.error,
        });
      } catch (error) {
        results.push({
          operation: 'update_contact',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 4. Search contacts
    try {
      const searchContacts = await new HubSpotBubble({
        operation: 'search_records',
        object_type: 'contacts',
        filter_groups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'CONTAINS_TOKEN',
                value: 'example.com',
              },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname'],
        limit: 5,
      }).action();

      results.push({
        operation: 'search_contacts',
        success: searchContacts.success,
        details: searchContacts.success
          ? `Found ${searchContacts.data?.total} contacts`
          : searchContacts.error,
      });
    } catch (error) {
      results.push({
        operation: 'search_contacts',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ===== COMPANY TESTS =====

    // 5. Create company
    try {
      const createCompany = await new HubSpotBubble({
        operation: 'create_record',
        object_type: 'companies',
        properties: {
          name: `Test Company ${Date.now()}`,
          domain: 'testcompany.example.com',
          industry: 'Technology',
        },
      }).action();

      companyId = createCompany.data?.record?.id || '';
      results.push({
        operation: 'create_company',
        success: createCompany.success,
        details: createCompany.success
          ? `Created company: ${companyId}`
          : createCompany.error,
      });
    } catch (error) {
      results.push({
        operation: 'create_company',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 6. Get company
    if (companyId) {
      try {
        const getCompany = await new HubSpotBubble({
          operation: 'get_record',
          object_type: 'companies',
          record_id: companyId,
          properties: ['name', 'domain', 'industry'],
        }).action();

        results.push({
          operation: 'get_company',
          success: getCompany.success,
          details: getCompany.success
            ? `Retrieved company: ${getCompany.data?.record?.properties?.name}`
            : getCompany.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_company',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 7. Update company
    if (companyId) {
      try {
        const updateCompany = await new HubSpotBubble({
          operation: 'update_record',
          object_type: 'companies',
          record_id: companyId,
          properties: {
            industry: 'Software',
          },
        }).action();

        results.push({
          operation: 'update_company',
          success: updateCompany.success,
          details: updateCompany.success
            ? `Updated company: ${companyId}`
            : updateCompany.error,
        });
      } catch (error) {
        results.push({
          operation: 'update_company',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 8. Search companies
    try {
      const searchCompanies = await new HubSpotBubble({
        operation: 'search_records',
        object_type: 'companies',
        filter_groups: [
          {
            filters: [
              {
                propertyName: 'domain',
                operator: 'CONTAINS_TOKEN',
                value: 'example',
              },
            ],
          },
        ],
        limit: 5,
      }).action();

      results.push({
        operation: 'search_companies',
        success: searchCompanies.success,
        details: searchCompanies.success
          ? `Found ${searchCompanies.data?.total} companies`
          : searchCompanies.error,
      });
    } catch (error) {
      results.push({
        operation: 'search_companies',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // ===== DEAL TESTS =====

    // 9. Create deal
    try {
      const createDeal = await new HubSpotBubble({
        operation: 'create_record',
        object_type: 'deals',
        properties: {
          dealname: `Test Deal ${Date.now()}`,
          amount: '10000',
          pipeline: 'default',
          dealstage: 'appointmentscheduled',
        },
      }).action();

      dealId = createDeal.data?.record?.id || '';
      results.push({
        operation: 'create_deal',
        success: createDeal.success,
        details: createDeal.success
          ? `Created deal: ${dealId}`
          : createDeal.error,
      });
    } catch (error) {
      results.push({
        operation: 'create_deal',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 10. Get deal
    if (dealId) {
      try {
        const getDeal = await new HubSpotBubble({
          operation: 'get_record',
          object_type: 'deals',
          record_id: dealId,
          properties: ['dealname', 'amount', 'dealstage'],
        }).action();

        results.push({
          operation: 'get_deal',
          success: getDeal.success,
          details: getDeal.success
            ? `Retrieved deal: ${getDeal.data?.record?.properties?.dealname}`
            : getDeal.error,
        });
      } catch (error) {
        results.push({
          operation: 'get_deal',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ===== TICKET TESTS =====

    // 11. Create ticket
    try {
      const createTicket = await new HubSpotBubble({
        operation: 'create_record',
        object_type: 'tickets',
        properties: {
          subject: `Test Ticket ${Date.now()}`,
          content:
            'Integration test ticket with special chars: \u00e9\u00e0\u00fc',
          hs_pipeline: '0',
          hs_pipeline_stage: '1',
        },
      }).action();

      ticketId = createTicket.data?.record?.id || '';
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

    // 12. Search tickets
    try {
      const searchTickets = await new HubSpotBubble({
        operation: 'search_records',
        object_type: 'tickets',
        filter_groups: [
          {
            filters: [
              {
                propertyName: 'subject',
                operator: 'CONTAINS_TOKEN',
                value: 'Test',
              },
            ],
          },
        ],
        limit: 5,
      }).action();

      results.push({
        operation: 'search_tickets',
        success: searchTickets.success,
        details: searchTickets.success
          ? `Found ${searchTickets.data?.total} tickets`
          : searchTickets.error,
      });
    } catch (error) {
      results.push({
        operation: 'search_tickets',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      contactId,
      companyId,
      dealId,
      ticketId,
      testResults: results,
    };
  }
}
