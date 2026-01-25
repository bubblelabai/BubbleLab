import {
  BubbleFlow,
  type WebhookEvent,
  FullEnrichBubble,
} from '@bubblelab/bubble-core';

/**
 * Output structure for the FullEnrich integration test
 */
export interface Output {
  enrichmentId: string;
  status: string;
  contacts: Array<{
    firstname?: string;
    lastname?: string;
    email?: string;
    emails?: Array<{ email?: string; status?: string }>;
    personal_email?: string;
    personal_emails?: Array<{ email?: string; status?: string }>;
    phone?: string;
  }>;
  creditsUsed: number;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Test payload for the integration flow
 */
export interface TestPayload extends WebhookEvent {
  /**
   * Contacts to enrich (optional - defaults to test contact)
   */
  contacts?: Array<{
    firstname: string;
    lastname: string;
    domain?: string;
    company_name?: string;
    linkedin_url?: string;
  }>;
  /**
   * Name for the enrichment batch
   */
  name?: string;
  /**
   * Maximum seconds to wait for enrichment to complete (default: 120)
   */
  maxWaitSeconds?: number;
  /**
   * Seconds between poll attempts (default: 5)
   */
  pollIntervalSeconds?: number;
}

/**
 * Default test contact
 */
const DEFAULT_CONTACTS = [
  {
    firstname: 'Zach',
    lastname: 'Zhong',
    domain: 'bubblelab.ai',
    company_name: 'Bubble Lab',
    linkedin_url: 'https://www.linkedin.com/in/zzy0516/',
  },
  {
    firstname: 'Selina',
    lastname: 'Li',
    domain: 'bubblelab.ai',
    company_name: 'Bubble Lab',
    linkedin_url: 'https://www.linkedin.com/in/selina-li-2624a4198/',
  },
];

/**
 * FullEnrichIntegrationTest - Start enrichment and poll until done
 *
 * This flow:
 * 1. Starts a bulk enrichment for the provided contacts
 * 2. Polls until the enrichment is FINISHED or times out
 * 3. Returns the enriched contact data
 */
export class FullEnrichIntegrationTest extends BubbleFlow<'webhook/http'> {
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    const maxWaitSeconds = payload.maxWaitSeconds ?? 120;
    const pollIntervalSeconds = payload.pollIntervalSeconds ?? 5;
    const inputContacts = payload.contacts ?? DEFAULT_CONTACTS;
    const enrichmentName =
      payload.name ?? `Integration Test - ${new Date().toISOString()}`;

    // 1. Start bulk enrichment
    const startResult = await new FullEnrichBubble({
      operation: 'start_bulk_enrichment',
      name: enrichmentName,
      contacts: inputContacts.map((contact) => ({
        firstname: contact.firstname,
        lastname: contact.lastname,
        domain: contact.domain,
        company_name: contact.company_name,
        linkedin_url: contact.linkedin_url,
        enrich_fields: ['contact.emails', 'contact.personal_emails'],
      })),
    }).action();

    if (!startResult.success || !startResult.data?.enrichment_id) {
      results.push({
        operation: 'start_bulk_enrichment',
        success: false,
        details: startResult.error || 'Failed to start enrichment',
      });

      return {
        enrichmentId: '',
        status: 'FAILED',
        contacts: [],
        creditsUsed: 0,
        testResults: results,
      };
    }

    const enrichmentId = startResult.data.enrichment_id;
    results.push({
      operation: 'start_bulk_enrichment',
      success: true,
      details: `Started enrichment: ${enrichmentId}`,
    });

    // 2. Poll until done
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    let status = 'IN_PROGRESS';
    let enrichedData: Array<Record<string, unknown>> = [];
    let creditsUsed = 0;

    while (Date.now() - startTime < maxWaitMs) {
      await this.sleep(pollIntervalSeconds * 1000);

      const pollResult = await new FullEnrichBubble({
        operation: 'get_enrichment_result',
        enrichment_id: enrichmentId,
        force_results: false,
      }).action();

      if (!pollResult.success) {
        results.push({
          operation: 'poll_enrichment',
          success: false,
          details: pollResult.error || 'Failed to poll enrichment',
        });
        continue;
      }

      status = pollResult.data?.status ?? 'UNKNOWN';

      if (
        status === 'FINISHED' ||
        status === 'CANCELED' ||
        status === 'CREDITS_INSUFFICIENT'
      ) {
        enrichedData =
          (pollResult.data?.results as Array<Record<string, unknown>>) ?? [];
        creditsUsed = pollResult.data?.cost?.credits ?? 0;

        results.push({
          operation: 'poll_enrichment',
          success: status === 'FINISHED',
          details: `Status: ${status}, Records: ${enrichedData.length}, Credits: ${creditsUsed}`,
        });
        break;
      }

      results.push({
        operation: 'poll_enrichment',
        success: true,
        details: `Status: ${status}, waiting...`,
      });
    }

    // 3. Extract contact data
    const enrichedContacts = enrichedData.map((record) => {
      const contact = record.contact as Record<string, unknown> | undefined;
      return {
        firstname: contact?.firstname as string | undefined,
        lastname: contact?.lastname as string | undefined,
        email: contact?.most_probable_email as string | undefined,
        emails: contact?.emails as
          | Array<{ email?: string; status?: string }>
          | undefined,
        personal_email: contact?.most_probable_personal_email as
          | string
          | undefined,
        personal_emails: contact?.personal_emails as
          | Array<{ email?: string; status?: string }>
          | undefined,
        phone: contact?.most_probable_phone as string | undefined,
      };
    });

    return {
      enrichmentId,
      status,
      contacts: enrichedContacts,
      creditsUsed,
      testResults: results,
    };
  }
}
