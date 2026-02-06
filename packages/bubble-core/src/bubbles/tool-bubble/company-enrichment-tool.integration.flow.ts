import {
  BubbleFlow,
  GoogleSheetsBubble,
  CompanyEnrichmentTool,
  PeopleSearchTool,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  spreadsheetId: string;
  spreadsheetUrl: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
    cost?: string;
  }[];
}

/**
 * Payload for the Company Enrichment Integration Test workflow.
 */
export interface CompanyEnrichmentTestPayload extends WebhookEvent {
  /**
   * The title for the test spreadsheet that will be created.
   * @canBeFile false
   */
  testTitle?: string;
  /**
   * The Google Spreadsheet ID to append results to.
   * If not provided, a new spreadsheet will be created.
   * @canBeFile false
   */
  spreadsheetId?: string;
}

/**
 * Integration flow test for CompanyEnrichmentTool and PeopleSearchTool
 *
 * Tests the Crustdata-based enrichment tools and appends results to Google Sheets.
 *
 * Operations tested:
 * 1. Company Enrichment - identify + enrich a company by domain
 * 2. People Search - search for people by company name (limited results)
 *
 * Pricing (per operation):
 * - identify: $0.0105 per company
 * - enrich: $0.105 per company
 * - person_search_db: $0.0315 per result
 */
export class CompanyEnrichmentIntegrationTest extends BubbleFlow<'webhook/http'> {
  /**
   * Test company enrichment by domain
   * Cost: ~$0.12 per company (identify + enrich)
   */
  private async testCompanyEnrichment(companyIdentifier: string) {
    const tool = new CompanyEnrichmentTool({
      companyIdentifier,
      limit: 5,
    });

    const result = await tool.action();

    return {
      success: result.success && result.data.success,
      contacts: result.data.contacts,
      company: result.data.company,
      totalContacts: result.data.totalContacts,
      error: result.data.error,
    };
  }

  /**
   * Test people search by company name
   * Cost: ~$0.0315 per result
   */
  private async testPeopleSearch(companyName: string, limit: number) {
    const tool = new PeopleSearchTool({
      companyName,
      limit,
    });

    const result = await tool.action();

    return {
      success: result.success && result.data.success,
      people: result.data.people,
      totalCount: result.data.totalCount,
      error: result.data.error,
    };
  }

  /**
   * Create a new spreadsheet for test results
   */
  private async createSpreadsheet(title: string) {
    const result = await new GoogleSheetsBubble({
      operation: 'create_spreadsheet',
      title,
      sheet_titles: ['Test Results', 'Contacts', 'People Search'],
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_spreadsheet' ||
      !result.data.spreadsheet
    ) {
      throw new Error(`Failed to create spreadsheet: ${result.error}`);
    }

    return result.data.spreadsheet;
  }

  /**
   * Append values to a sheet
   */
  private async appendToSheet(
    spreadsheetId: string,
    sheetName: string,
    values: (string | number | boolean | null)[][]
  ) {
    const result = await new GoogleSheetsBubble({
      operation: 'append_values',
      spreadsheet_id: spreadsheetId,
      range: sheetName,
      values: values.map((row) =>
        row.map((v) => (v === null || v === undefined ? '' : v))
      ) as (string | number | boolean)[][],
      insert_data_option: 'INSERT_ROWS',
      value_input_option: 'RAW',
    }).action();

    if (!result.success) {
      throw new Error(`Failed to append to sheet: ${result.error}`);
    }

    return result.data;
  }

  async handle(payload: CompanyEnrichmentTestPayload): Promise<Output> {
    const { testTitle = 'Company Enrichment Integration Test' } = payload;
    const results: Output['testResults'] = [];
    const timestamp = new Date().toISOString();

    // 1. Create or use existing spreadsheet
    let spreadsheetId = payload.spreadsheetId || '';
    let spreadsheetUrl = '';

    if (!spreadsheetId) {
      const spreadsheet = await this.createSpreadsheet(testTitle);
      spreadsheetId = spreadsheet.spreadsheetId;
      spreadsheetUrl = spreadsheet.spreadsheetUrl || '';
      results.push({
        operation: 'create_spreadsheet',
        success: true,
        details: `Created: ${spreadsheetId}`,
      });

      // Write headers
      await this.appendToSheet(spreadsheetId, 'Test Results', [
        [
          'Timestamp',
          'Operation',
          'Query',
          'Success',
          'Count',
          'Error',
          'Cost',
        ],
      ]);
      await this.appendToSheet(spreadsheetId, 'Contacts', [
        ['Timestamp', 'Company', 'Name', 'Title', 'Role', 'LinkedIn', 'Email'],
      ]);
      await this.appendToSheet(spreadsheetId, 'People Search', [
        [
          'Timestamp',
          'Query',
          'Name',
          'Title',
          'Company',
          'LinkedIn',
          'Seniority',
        ],
      ]);
    } else {
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      results.push({
        operation: 'use_existing_spreadsheet',
        success: true,
        details: `Using: ${spreadsheetId}`,
      });
    }

    // 2. Test Company Enrichment (stripe.com) - Cost: ~$0.12
    try {
      const enrichResult = await this.testCompanyEnrichment('stripe.com');

      results.push({
        operation: 'company_enrichment',
        success: enrichResult.success,
        details: `Found ${enrichResult.totalContacts} contacts`,
        cost: '$0.12',
      });

      await this.appendToSheet(spreadsheetId, 'Test Results', [
        [
          timestamp,
          'company_enrichment',
          'stripe.com',
          enrichResult.success,
          enrichResult.totalContacts,
          enrichResult.error || '',
          '$0.12',
        ],
      ]);

      // Log first 3 contacts
      if (enrichResult.contacts?.length) {
        const contactRows = enrichResult.contacts
          .slice(0, 3)
          .map((c) => [
            timestamp,
            enrichResult.company?.name || 'stripe.com',
            c.name || '',
            c.title || '',
            c.role || '',
            c.linkedinUrl || '',
            c.emails?.join(', ') || '',
          ]);
        await this.appendToSheet(spreadsheetId, 'Contacts', contactRows);
      }
    } catch (error) {
      results.push({
        operation: 'company_enrichment',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
        cost: '$0.12',
      });
    }

    // 3. Test People Search (Anthropic, limit 3) - Cost: ~$0.09
    try {
      const peopleResult = await this.testPeopleSearch('Anthropic', 3);

      results.push({
        operation: 'people_search',
        success: peopleResult.success,
        details: `Found ${peopleResult.people?.length || 0} people (total: ${peopleResult.totalCount})`,
        cost: '$0.09',
      });

      await this.appendToSheet(spreadsheetId, 'Test Results', [
        [
          timestamp,
          'people_search',
          'Anthropic',
          peopleResult.success,
          peopleResult.people?.length || 0,
          peopleResult.error || '',
          '$0.09',
        ],
      ]);

      // Log people found
      if (peopleResult.people?.length) {
        const peopleRows = peopleResult.people.map((p) => [
          timestamp,
          'Anthropic',
          p.name || '',
          p.title || '',
          p.currentEmployers?.[0]?.companyName || '',
          p.linkedinUrl || '',
          p.seniorityLevel || '',
        ]);
        await this.appendToSheet(spreadsheetId, 'People Search', peopleRows);
      }
    } catch (error) {
      results.push({
        operation: 'people_search',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
        cost: '$0.09',
      });
    }

    // Summary
    results.push({
      operation: 'summary',
      success: results
        .filter((r) => r.operation !== 'summary')
        .every((r) => r.success),
      details: 'Total estimated cost: ~$0.21',
      cost: '$0.21',
    });

    return {
      spreadsheetId,
      spreadsheetUrl,
      testResults: results,
    };
  }
}
