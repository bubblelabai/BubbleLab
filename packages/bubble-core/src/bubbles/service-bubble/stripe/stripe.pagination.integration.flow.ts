import {
  BubbleFlow,
  StripeBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  totalCreated: number;
  totalFound: number;
  missingCustomerIds: string[];
  retrievedCustomer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  paginationStats: {
    totalPages: number;
    totalCustomersFetched: number;
  };
  success: boolean;
  error?: string;
}

/**
 * Payload for the Stripe Pagination Test workflow.
 */
export interface StripePaginationTestPayload extends WebhookEvent {
  /**
   * Number of customers to create for the test.
   * @default 500
   * @canBeFile false
   */
  customerCount?: number;

  /**
   * Page size for listing customers.
   * @default 100
   * @canBeFile false
   */
  pageSize?: number;

  /**
   * Optional prefix for test resources to help identify them.
   * @canBeFile false
   */
  testPrefix?: string;
}

/**
 * Stripe Pagination Integration Test Flow
 *
 * Tests pagination functionality by:
 * 1. Creating a large batch of customers (default 500)
 * 2. Using cursor-based pagination to list all customers
 * 3. Verifying all created customers are found
 * 4. Retrieving a specific customer by ID
 */
export class StripePaginationTest extends BubbleFlow<'webhook/http'> {
  // ============================================================================
  // CUSTOMER OPERATIONS
  // ============================================================================

  private async createCustomer(name: string, email: string) {
    const result = await new StripeBubble({
      operation: 'create_customer',
      name,
      email,
      metadata: { test: 'pagination-test', created_by: 'bubblelab' },
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_customer' ||
      !result.data.customer
    ) {
      throw new Error(`Failed to create customer: ${result.error}`);
    }

    return result.data.customer;
  }

  private async listCustomersPage(limit: number, cursor?: string) {
    const result = await new StripeBubble({
      operation: 'list_customers',
      limit,
      cursor,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'list_customers' ||
      !result.data.customers
    ) {
      throw new Error(`Failed to list customers: ${result.error}`);
    }

    return {
      customers: result.data.customers,
      hasMore: result.data.has_more ?? false,
      nextCursor: result.data.next_cursor ?? null,
    };
  }

  private async retrieveCustomer(customerId: string) {
    const result = await new StripeBubble({
      operation: 'retrieve_customer',
      customer_id: customerId,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'retrieve_customer' ||
      !result.data.customer
    ) {
      throw new Error(`Failed to retrieve customer: ${result.error}`);
    }

    return {
      customer: result.data.customer,
      deleted: result.data.deleted ?? false,
    };
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  private async createCustomersBatch(
    prefix: string,
    startIndex: number,
    count: number,
    timestamp: number
  ): Promise<string[]> {
    const customerIds: string[] = [];
    const batchSize = 10; // Create in smaller batches to avoid rate limits

    for (let i = 0; i < count; i += batchSize) {
      const batchPromises: Promise<{ id: string }>[] = [];
      const currentBatchSize = Math.min(batchSize, count - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const index = startIndex + i + j;
        batchPromises.push(
          this.createCustomer(
            `${prefix} Customer ${index} - ${timestamp}`,
            `test-${timestamp}-${index}@bubblelab.test`
          )
        );
      }

      const results = await Promise.all(batchPromises);
      customerIds.push(...results.map((c) => c.id));
    }

    return customerIds;
  }

  private async listAllCustomersWithPagination(
    pageSize: number
  ): Promise<{ customers: Set<string>; pages: number; total: number }> {
    const allCustomerIds = new Set<string>();
    let cursor: string | undefined;
    let hasMore = true;
    let pages = 0;

    while (hasMore) {
      const page = await this.listCustomersPage(pageSize, cursor);
      pages++;

      for (const customer of page.customers) {
        allCustomerIds.add(customer.id);
      }

      hasMore = page.hasMore;
      cursor = page.nextCursor ?? undefined;
    }

    return {
      customers: allCustomerIds,
      pages,
      total: allCustomerIds.size,
    };
  }

  // ============================================================================
  // MAIN FLOW
  // ============================================================================

  async handle(payload: StripePaginationTestPayload): Promise<Output> {
    const {
      customerCount = 500,
      pageSize = 100,
      testPrefix = 'PaginationTest',
    } = payload;

    const timestamp = Date.now();
    const createdCustomerIds: string[] = [];

    try {
      // ========================================================================
      // 1. CREATE CUSTOMERS IN BATCHES
      // ========================================================================
      console.log(`Creating ${customerCount} customers...`);

      const batchSize = 50;
      for (let i = 0; i < customerCount; i += batchSize) {
        const currentBatchSize = Math.min(batchSize, customerCount - i);
        const batchIds = await this.createCustomersBatch(
          testPrefix,
          i,
          currentBatchSize,
          timestamp
        );
        createdCustomerIds.push(...batchIds);
        console.log(
          `Created ${createdCustomerIds.length}/${customerCount} customers`
        );
      }

      console.log(
        `Successfully created ${createdCustomerIds.length} customers`
      );

      // ========================================================================
      // 2. LIST ALL CUSTOMERS USING PAGINATION
      // ========================================================================
      console.log(`Listing all customers with page size ${pageSize}...`);

      const paginationResult =
        await this.listAllCustomersWithPagination(pageSize);

      console.log(
        `Fetched ${paginationResult.total} customers across ${paginationResult.pages} pages`
      );

      // ========================================================================
      // 3. VERIFY ALL CREATED CUSTOMERS ARE FOUND
      // ========================================================================
      const missingCustomerIds: string[] = [];
      for (const customerId of createdCustomerIds) {
        if (!paginationResult.customers.has(customerId)) {
          missingCustomerIds.push(customerId);
        }
      }

      const allFound = missingCustomerIds.length === 0;
      console.log(
        allFound
          ? `All ${createdCustomerIds.length} customers found in paginated list`
          : `Missing ${missingCustomerIds.length} customers from paginated list`
      );

      // ========================================================================
      // 4. RETRIEVE A SPECIFIC CUSTOMER
      // ========================================================================
      let retrievedCustomer: Output['retrievedCustomer'] = null;

      if (createdCustomerIds.length > 0) {
        const customerToRetrieve = createdCustomerIds[0];
        console.log(`Retrieving customer ${customerToRetrieve}...`);

        const retrieved = await this.retrieveCustomer(customerToRetrieve);
        retrievedCustomer = {
          id: retrieved.customer.id,
          name: retrieved.customer.name ?? null,
          email: retrieved.customer.email ?? null,
        };

        console.log(
          `Retrieved customer: ${retrievedCustomer.id} (${retrievedCustomer.name})`
        );
      }

      // ========================================================================
      // 5. RETURN RESULTS
      // ========================================================================
      return {
        totalCreated: createdCustomerIds.length,
        totalFound: createdCustomerIds.filter((id) =>
          paginationResult.customers.has(id)
        ).length,
        missingCustomerIds,
        retrievedCustomer,
        paginationStats: {
          totalPages: paginationResult.pages,
          totalCustomersFetched: paginationResult.total,
        },
        success: allFound && retrievedCustomer !== null,
      };
    } catch (error) {
      return {
        totalCreated: createdCustomerIds.length,
        totalFound: 0,
        missingCustomerIds: [],
        retrievedCustomer: null,
        paginationStats: {
          totalPages: 0,
          totalCustomersFetched: 0,
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
