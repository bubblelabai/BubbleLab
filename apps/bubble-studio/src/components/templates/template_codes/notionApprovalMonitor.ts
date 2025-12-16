// Template for Notion Approval Monitor
// - Creates/monitors a Notion approval database
// - Sends approved drafts via Resend email
// - Optional daily mock lead generation at midnight UTC

export const templateCode = `import { z } from 'zod';
import {
  BubbleFlow,
  NotionBubble,
  ResendBubble,
  type CronEvent,
} from '@bubblelab/bubble-core';

export interface NotionApprovalMonitorPayload extends CronEvent {
  /**
   * TEST MODE: Set to true to create a test Notion database with sample approval records.
   *
   * When enabled, this workflow will:
   * 1. Create a new Notion database in your workspace with proper schema (Email, Approved, Status, Draft columns)
   * 2. Populate it with 5 test records showing different approval states
   * 3. Return the new database ID in the output
   *
   * After creation, copy the returned database ID and use it in future runs with createMockDb=false
   * to test the actual approval monitoring workflow. The mock database includes records that:
   * - Should trigger emails (approved + "Pending Review" status)
   * - Should be skipped (not approved, already sent, or invalid status)
   *
   * This is perfect for testing the workflow without setting up a real approval process.
   * Default: false
   * @canBeFile false
   */
  createMockDb?: boolean;

  /**
   * The ID of the Notion database to monitor.
   * Open the database in Notion as a full page, the ID is the 32-character string in the URL.
   * Example: https://www.notion.so/myworkspace/a8aec43384f447ed84390e8e42c2e089?v=... -> a8aec43384f447ed84390e8e42c2e089
   * @canBeFile false
   */
  databaseId: string;

  /**
   * The name of the column in Notion that contains the recipient's email address.
   * Default: "Email"
   * @canBeFile false
   */
  emailField?: string;

  /**
   * The name of the Checkbox column in Notion that indicates approval.
   * Default: "Approved"
   * @canBeFile false
   */
  approvedField?: string;

  /**
   * The name of the column in Notion that contains the current status.
   * Default: "Status"
   * @canBeFile false
   */
  statusField?: string;

  /**
   * The list of valid status values that should trigger email sending when approved.
   * Default: ["Pending Review"]
   * @canBeFile false
   */
  validStatusValues?: string[];

  /**
   * The name of the column in Notion that contains the draft content to send.
   * Default: "Draft"
   * @canBeFile false
   */
  draftField?: string;

  /**
   * The subject line for the approval email.
   * Default: "Your draft has been approved"
   * @canBeFile false
   */
  emailSubject?: string;

  /**
   * Whether to automatically generate new lead records at midnight each day.
   * When enabled, the workflow will create mock lead records in the database at 00:00 UTC.
   * Set to false to disable automatic lead generation.
   * Default: true
   * @canBeFile false
   */
  generateLead?: boolean;
}

export class NotionApprovalMonitor extends BubbleFlow<'schedule/cron'> {
  // Run every 5 minutes
  readonly cronSchedule = '*/5 * * * *';

  /**
   * Creates a mock Notion database with the proper schema and sample data for testing. Replace with lead generation in real use case.
   * The database includes columns: Email (email), Approved (checkbox), Status (status), Draft (rich_text).
   * Returns the ID of the newly created database and its first data source.
   */

  private async createMockDatabase(): Promise<{ databaseId: string; dataSourceId: string }> {
    // Creates a new database with the approval workflow schema using multi_select for Status

    const dbCreator = new NotionBubble({
      operation: 'create_database',
      parent: {
        type: 'workspace',
        workspace: true,
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Approval Monitor Test Database',
          },
        },
      ],
      description: [
        {
          type: 'text',
          text: {
            content: 'Test database for the Approval Monitor workflow. Contains 5 sample records with different scenarios: approved records ready to send, pending approvals, already sent items, and not generated drafts. Columns: Email (recipient), Approved (checkbox), Status (multi-select: Pending Review/Sent/Not Generated), Draft (email content), Created At, and Sent At timestamps. Use this to test the workflow before connecting to your real approval database.',
          },
        },
      ],
      icon: {
        type: 'emoji',
        emoji: '✅',
      },
      initial_data_source: {
        properties: {
          Name: {
            title: {},
          },
          Email: {
            email: {},
          },
          Approved: {
            checkbox: {},
          },
          Status: {
            multi_select: {
              options: [
                {
                  name: 'Pending Review',
                  color: 'yellow',
                },
                {
                  name: 'Not Generated',
                  color: 'gray',
                },
                {
                  name: 'Sent',
                  color: 'green',
                },
              ],
            },
          },
          Draft: {
            rich_text: {},
          },
          'Created At': {
            date: {},
          },
          'Sent At': {
            date: {},
          },
        },
      },
    });

    const createResult = await dbCreator.action();

    if (!createResult.success) {
      throw new Error(\`Failed to create mock database: \${createResult.error}\`);
    }

    const database = (createResult.data as any).database;
    const databaseId = database.id;
    const dataSourceId = database.data_sources[0].id;

    // Mock data to populate the database
    const mockRecords = [
      {
        name: 'Test Record 1 - Should Send Email',
        email: 'test1@example.com',
        approved: true,
        status: 'Pending Review',
        draft: 'Hello! This is a test draft for record 1. It should be sent via email.',
      },
      {
        name: 'Test Record 2 - Should Send Email',
        email: 'test2@example.com',
        approved: true,
        status: 'Pending Review',
        draft: 'This is another test draft for record 2. Ready for approval!',
      },
      {
        name: 'Test Record 3 - Not Approved',
        email: 'test3@example.com',
        approved: false,
        status: 'Pending Review',
        draft: 'This record is pending but not yet approved.',
      },
      {
        name: 'Test Record 4 - Already Sent',
        email: 'test4@example.com',
        approved: true,
        status: 'Sent',
        draft: 'This email was already sent previously.',
      },
      {
        name: 'Test Record 5 - Not Generated',
        email: 'test5@example.com',
        approved: false,
        status: 'Not Generated',
        draft: '',
      },
    ];

    // Populates the database with mock records to test different workflow scenarios
    for (const record of mockRecords) {
      const pageCreator = new NotionBubble({
        operation: 'create_page',
        parent: {
          type: 'data_source_id',
          data_source_id: dataSourceId,
        },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: record.name,
                },
              },
            ],
          },
          Email: {
            email: record.email,
          },
          Approved: {
            checkbox: record.approved,
          },
          Status: {
            multi_select: [
              {
                name: record.status,
              },
            ],
          },
          Draft: {
            rich_text: [
              {
                text: {
                  content: record.draft,
                },
              },
            ],
          },
          'Created At': {
            date: {
              start: new Date().toISOString(),
            },
          },
        },
      });

      const pageResult = await pageCreator.action();

      if (!pageResult.success) {
        // Failed to create mock record - silently continue
      }
    }

    return { databaseId, dataSourceId };
  }

  /**
   * Fetches recent records from the Notion database.
   * First retrieves the database to get its data sources, then queries the data source for records.
   * We fetch the last 100 records sorted by last_edited_time to ensure we catch recent updates.
   */
  private async fetchRecentRecords(databaseId: string): Promise<any[]> {
    // First, retrieve the database to get its data sources
    const dbRetriever = new NotionBubble({
      operation: 'retrieve_database',
      database_id: databaseId,
    });

    const dbResult = await dbRetriever.action();

    if (!dbResult.success) {
      throw new Error(\`Failed to retrieve Notion database: \${dbResult.error}\`);
    }

    // Extract data sources from the database
    const database = (dbResult.data as any).database;
    const dataSources = database?.data_sources;

    if (!dataSources || dataSources.length === 0) {
      throw new Error('No data sources found in this database');
    }

    // Use the first data source (or you could make this configurable)
    const dataSourceId = dataSources[0].id;

    // Now query the data source for records
    const notionQuery = new NotionBubble({
      operation: 'query_data_source',
      data_source_id: dataSourceId,
      page_size: 100,
      sorts: [
        {
          timestamp: 'last_edited_time',
          direction: 'descending',
        },
      ],
    });

    const result = await notionQuery.action();

    if (!result.success) {
      throw new Error(\`Failed to query Notion data source: \${result.error}\`);
    }

    // The result.data.results contains the list of pages (flattened schema)
    return (result.data).results || [];
  }

  /**
   * Extracts the value of a property from a Notion page object safely.
   * Handles different property types (Rich Text, Email, Select, Checkbox, Title).
   */
  private getPropertyValue(page: any, propertyName: string): string | boolean | null {
    const property = page.properties?.[propertyName];

    if (!property) return null;

    switch (property.type) {
      case 'email':
        return property.email;
      case 'select':
        return property.select?.name || null;
      case 'multi_select':
        // Return the first selected option name, or null if empty
        return property.multi_select?.[0]?.name || null;
      case 'checkbox':
        return property.checkbox;
      case 'rich_text':
        return property.rich_text?.[0]?.plain_text || '';
      case 'title':
        return property.title?.[0]?.plain_text || '';
      default:
        return null;
    }
  }

  /**
   * Sends an email to the recipient using Resend.
   */
  private async sendEmail(to: string, subject: string, content: string): Promise<void> {
    // Sends the approval email with the draft content
    const emailer = new ResendBubble({
      operation: 'send_email',
      to: [to],
      subject: subject,
      html: \`<p>\${content}</p>\`,
    });

    const result = await emailer.action();

    if (!result.success) {
      throw new Error(\`Failed to send email to \${to}: \${result.error}\`);
    }
  }

  /**
   * Updates the Notion record's Status column to "Sent".
   * This prevents the workflow from sending duplicate emails for the same approval.
   */
  private async markAsSent(pageId: string, statusField: string): Promise<void> {
    // Updates the Status column to "Sent" and sets the Sent At timestamp
    const updater = new NotionBubble({
      operation: 'update_page',
      page_id: pageId,
      properties: {
        [statusField]: {
          multi_select: [
            {
              name: 'Sent',
            },
          ],
        },
        'Sent At': {
          date: {
            start: new Date().toISOString(),
          },
        },
      },
    });

    const result = await updater.action();

    if (!result.success) {
      throw new Error(\`Failed to update Notion page \${pageId}: \${result.error}\`);
    }
  }

  /**
   * Checks if the current timestamp is at midnight (00:00:00) in UTC.
   * Used to trigger daily lead generation at a specific time.
   */
  private isTimestampMidnight(timestamp: string): boolean {
    const date = new Date(timestamp);
    return date.getUTCHours() === 0 && date.getUTCMinutes() === 0;
  }


  /**
   * Retrieves the data source ID from a database and generates mock leads if at midnight.
   * Returns the number of leads generated, or 0 if conditions aren't met.
   */
  private async checkAndGenerateLeads(databaseId: string, timestamp: string, shouldGenerate: boolean): Promise<number> {
    // Check if midnight
    const date = new Date(timestamp);
    const isMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0;

    if (!shouldGenerate || !isMidnight) {
      return 0;
    }

    // Retrieves the database to access its data source for lead generation
    const dbRetriever = new NotionBubble({
      operation: 'retrieve_database',
      database_id: databaseId,
    });

    const dbResult = await dbRetriever.action();
    if (!dbResult.success) {
      return 0;
    }

    const database = (dbResult.data as any).database;
    const dataSources = database?.data_sources;
    if (!dataSources || dataSources.length === 0) {
      return 0;
    }

    const dataSourceId = dataSources[0].id;

    // Generate mock leads inline
    const timestampStr = new Date().toISOString().split('T')[0];
    const mockLeads = [
      {
        name: \`Lead \${timestampStr} - 1\`,
        email: \`lead1-\${Date.now()}@example.com\`,
        approved: false,
        status: 'Pending Review',
        draft: 'This is a generated lead draft awaiting approval.',
      },
      {
        name: \`Lead \${timestampStr} - 2\`,
        email: \`lead2-\${Date.now()}@example.com\`,
        approved: false,
        status: 'Pending Review',
        draft: 'Another generated lead draft for your review.',
      },
    ];

    let createdCount = 0;
    for (const lead of mockLeads) {
      const pageCreator = new NotionBubble({
        operation: 'create_page',
        parent: {
          type: 'data_source_id',
          data_source_id: dataSourceId,
        },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: lead.name,
                },
              },
            ],
          },
          Email: {
            email: lead.email,
          },
          Approved: {
            checkbox: lead.approved,
          },
          Status: {
            multi_select: [
              {
                name: lead.status,
              },
            ],
          },
          Draft: {
            rich_text: [
              {
                text: {
                  content: lead.draft,
                },
              },
            ],
          },
          'Created At': {
            date: {
              start: new Date().toISOString(),
            },
          },
        },
      });

      const result = await pageCreator.action();
      if (result.success) {
        createdCount++;
      }
    }

    return createdCount;
  }

  async handle(payload: NotionApprovalMonitorPayload): Promise<{ processed: number; message: string; databaseId?: string }> {
    const {
      createMockDb = false,
      generateLead = true,
      emailField = 'Email',
      approvedField = 'Approved',
      statusField = 'Status',
      validStatusValues = ['Pending Review'],
      draftField = 'Draft',
      emailSubject = 'Your draft has been approved',
    } = payload;

    let { databaseId, timestamp } = payload;

    // If createMockDb is true, create a new database with mock data
    if (createMockDb) {
      const mockDb = await this.createMockDatabase();
      databaseId = mockDb.databaseId;

      return {
        processed: 0,
        message: \`Successfully created mock database. Use this database ID in future runs: \${databaseId}\`,
        databaseId: databaseId,
      }
    } else {
      // Check if we should generate leads at midnight
      const leadsGenerated = await this.checkAndGenerateLeads(databaseId, timestamp, generateLead);

    // 1. Fetch recent records from Notion
    const records = await this.fetchRecentRecords(databaseId);
    let processedCount = 0;

    // 2. Iterate through records and process approvals
    for (const record of records) {
      // Extract properties
      const isApproved = this.getPropertyValue(record, approvedField) as boolean;
      const status = this.getPropertyValue(record, statusField) as string;
      const email = this.getPropertyValue(record, emailField) as string;
      const draft = this.getPropertyValue(record, draftField) as string;

      // Check conditions: Approved checkbox is TRUE AND Status is in valid list
      if (isApproved === true && validStatusValues.includes(status)) {
        if (email && draft) {
          // 3. Send the email
          await this.sendEmail(email, emailSubject, draft);

          // 4. Update the Status to "Sent" to prevent re-sending
          await this.markAsSent(record.id, statusField);

          processedCount++;
        }
      }
    }

    return {
      processed: processedCount,
      message: \`Successfully processed \${processedCount} approved records.\${leadsGenerated > 0 ? \` Generated \${leadsGenerated} new leads.\` : ''}\`,
      databaseId: databaseId,
    };
    }
  }
}
`;
