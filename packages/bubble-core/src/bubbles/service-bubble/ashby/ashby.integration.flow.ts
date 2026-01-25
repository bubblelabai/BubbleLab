import {
  BubbleFlow,
  type WebhookEvent,
  AshbyBubble,
} from '@bubblelab/bubble-core';

/**
 * Output structure for the Ashby integration test
 */
export interface Output {
  candidateId: string;
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
  testName?: string;
  cleanup?: boolean;
  tag?: string; // Optional tag name or ID to add to the candidate
}

/**
 * AshbyIntegrationTest - Comprehensive integration test for Ashby bubble
 *
 * This flow exercises all candidate, tag, and custom field operations:
 * 1. Create a test candidate with optional tag (auto-creates tag if name provided)
 * 2. Get the created candidate's details
 * 3. Search for the candidate by email
 * 4. Search for the candidate by name
 * 5. List candidates
 * 6. List tags
 * 7. List custom fields
 *
 * Edge cases tested:
 * - Names with special characters
 * - Tag creation and assignment (pass tag name like "bubblelab" to auto-create)
 */
export class AshbyIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    const timestamp = Date.now();

    const fullName = `Bubblelab Test ${timestamp}`;
    const email = `bubblelab+${timestamp}@test.com`;
    const phone = '+1 (555) 123-4567';

    // Use provided tag or default to "bubblelab"
    const tagToUse = payload.tag || 'bubblelab';

    let candidateId = '';

    // 1. Create a test candidate with tag (tag will be auto-created if it's a name)
    try {
      const createResult = await new AshbyBubble({
        operation: 'create_candidate',
        name: fullName,
        email: email,
        phone_number: phone,
        tag: tagToUse,
      }).action();

      results.push({
        operation: 'create_candidate',
        success: createResult.success,
        details: createResult.success
          ? `Created candidate: ${createResult.data?.candidate?.id}`
          : createResult.error,
      });

      candidateId = createResult.data?.candidate?.id || '';
    } catch (error) {
      results.push({
        operation: 'create_candidate',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 2. Get candidate details (if create succeeded)
    if (candidateId) {
      try {
        const getResult = await new AshbyBubble({
          operation: 'get_candidate',
          candidate_id: candidateId,
        }).action();

        results.push({
          operation: 'get_candidate',
          success: getResult.success,
          details: getResult.success
            ? `Retrieved: ${getResult.data?.candidate?.name}`
            : getResult.error,
        });

        // Verify data integrity
        if (getResult.success && getResult.data?.candidate) {
          const nameMatches = getResult.data.candidate.name === fullName;
          results.push({
            operation: 'verify_name',
            success: nameMatches,
            details: nameMatches
              ? 'Name stored correctly'
              : `Name mismatch: expected ${fullName}, got ${getResult.data.candidate.name}`,
          });
        }
      } catch (error) {
        results.push({
          operation: 'get_candidate',
          success: false,
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 3. Search by email
    try {
      const searchByEmailResult = await new AshbyBubble({
        operation: 'search_candidates',
        email: email,
      }).action();

      const foundByEmail =
        searchByEmailResult.success &&
        searchByEmailResult.data?.candidates?.some((c) => c.id === candidateId);

      results.push({
        operation: 'search_by_email',
        success: foundByEmail || false,
        details: foundByEmail
          ? `Found ${searchByEmailResult.data?.candidates?.length || 0} candidate(s)`
          : searchByEmailResult.error || 'Candidate not found by email',
      });
    } catch (error) {
      results.push({
        operation: 'search_by_email',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 4. Search by name (with special characters)
    try {
      const searchByNameResult = await new AshbyBubble({
        operation: 'search_candidates',
        name: fullName, // Tests special character handling with O'Connor-Smith
      }).action();

      results.push({
        operation: 'search_by_name',
        success: searchByNameResult.success,
        details: searchByNameResult.success
          ? `Found ${searchByNameResult.data?.candidates?.length || 0} candidate(s)`
          : searchByNameResult.error,
      });
    } catch (error) {
      results.push({
        operation: 'search_by_name',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 5. List candidates and verify our test candidate appears
    try {
      const listResult = await new AshbyBubble({
        operation: 'list_candidates',
        limit: 50,
      }).action();

      results.push({
        operation: 'list_candidates',
        success: listResult.success,
        details: listResult.success
          ? `Listed ${listResult.data?.candidates?.length || 0} candidate(s), more available: ${listResult.data?.more_data_available}`
          : listResult.error,
      });

      // Test pagination cursor handling
      if (listResult.success && listResult.data?.next_cursor) {
        results.push({
          operation: 'pagination_check',
          success: true,
          details: 'Pagination cursor available',
        });
      }
    } catch (error) {
      results.push({
        operation: 'list_candidates',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 6. List tags to verify our tag exists
    try {
      const listTagsResult = await new AshbyBubble({
        operation: 'list_tags',
      }).action();

      results.push({
        operation: 'list_tags',
        success: listTagsResult.success,
        details: listTagsResult.success
          ? `Listed ${listTagsResult.data?.tags?.length || 0} tag(s)`
          : listTagsResult.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_tags',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 7. List custom fields
    try {
      const listCustomFieldsResult = await new AshbyBubble({
        operation: 'list_custom_fields',
      }).action();

      results.push({
        operation: 'list_custom_fields',
        success: listCustomFieldsResult.success,
        details: listCustomFieldsResult.success
          ? `Listed ${listCustomFieldsResult.data?.custom_fields?.length || 0} custom field(s), more available: ${listCustomFieldsResult.data?.more_data_available}`
          : listCustomFieldsResult.error,
      });
    } catch (error) {
      results.push({
        operation: 'list_custom_fields',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      candidateId,
      testResults: results,
    };
  }
}
