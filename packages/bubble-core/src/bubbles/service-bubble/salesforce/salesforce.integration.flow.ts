import { BubbleFlow, type WebhookEvent } from '../../../index.js';
import { SalesforceBubble } from './salesforce.js';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

/**
 * Integration flow test for the Salesforce bubble.
 * Exercises all operations: get_account, search_accounts, get_contact,
 * search_contacts, and arbitrary SOQL query.
 */
export class SalesforceIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. Search accounts by name
    const searchResult = await new SalesforceBubble({
      operation: 'search_accounts',
      where_clause: 'Name != null',
      fields: ['Id', 'Name', 'Industry', 'BillingCity'],
      limit: 5,
    }).action();

    results.push({
      operation: 'search_accounts',
      success: searchResult.success,
      details: searchResult.success
        ? `Found ${searchResult.totalSize} accounts`
        : searchResult.error,
    });

    // 2. Get a specific account (use the first result from search if available)
    if (
      searchResult.success &&
      searchResult.records &&
      searchResult.records.length > 0
    ) {
      const accountId = searchResult.records[0].Id as string;

      const getResult = await new SalesforceBubble({
        operation: 'get_account',
        record_id: accountId,
        fields: ['Id', 'Name', 'Industry', 'BillingCity', 'Website', 'Phone'],
      }).action();

      results.push({
        operation: 'get_account',
        success: getResult.success,
        details: getResult.success
          ? `Retrieved account: ${(getResult.record as Record<string, unknown>)?.Name}`
          : getResult.error,
      });
    } else {
      results.push({
        operation: 'get_account',
        success: false,
        details: 'Skipped — no accounts found in search to test with',
      });
    }

    // 3. Search contacts
    const contactSearch = await new SalesforceBubble({
      operation: 'search_contacts',
      where_clause: 'LastName != null',
      fields: ['Id', 'FirstName', 'LastName', 'Email'],
      limit: 5,
    }).action();

    results.push({
      operation: 'search_contacts',
      success: contactSearch.success,
      details: contactSearch.success
        ? `Found ${contactSearch.totalSize} contacts`
        : contactSearch.error,
    });

    // 4. Get a specific contact
    if (
      contactSearch.success &&
      contactSearch.records &&
      contactSearch.records.length > 0
    ) {
      const contactId = contactSearch.records[0].Id as string;

      const getContact = await new SalesforceBubble({
        operation: 'get_contact',
        record_id: contactId,
      }).action();

      results.push({
        operation: 'get_contact',
        success: getContact.success,
        details: getContact.success
          ? `Retrieved contact: ${(getContact.record as Record<string, unknown>)?.FirstName} ${(getContact.record as Record<string, unknown>)?.LastName}`
          : getContact.error,
      });
    } else {
      results.push({
        operation: 'get_contact',
        success: false,
        details: 'Skipped — no contacts found in search to test with',
      });
    }

    // 5. Run arbitrary SOQL query
    const queryResult = await new SalesforceBubble({
      operation: 'query',
      soql: 'SELECT Id, Name, Industry FROM Account ORDER BY Name LIMIT 3',
    }).action();

    results.push({
      operation: 'query',
      success: queryResult.success,
      details: queryResult.success
        ? `Query returned ${queryResult.totalSize} records`
        : queryResult.error,
    });

    return { testResults: results };
  }
}
