import { WebhookEvent } from '@bubblelab/shared-schemas';
import { BubbleFlow } from '../../../bubble-flow/bubble-flow-class';
import { StripeBubble } from './stripe';

export interface Output {
  testCustomerId: string;
  testCustomerEmail?: string;
  testSubscriptionIds: string[];
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
    error?: string;
  }[];
}

export interface StripeIntegrationTestPayload extends WebhookEvent {
  /**
   * Test customer email (optional, will generate if not provided)
   * @canBeFile false
   */
  testEmail?: string;
  /**
   * Stripe Price ID for testing subscriptions (required)
   * @canBeFile false
   */
  testPriceId: string;

  /**
   * Optional second price ID for multi-item subscription tests
   * @canBeFile false
   */
  testPriceId2?: string;
}

export class StripeStressTest extends BubbleFlow<'webhook/http'> {
  // Create new Stripe Customer
  private async createTestCustomer(email?: string, name?: string) {
    const result = await new StripeBubble({
      operation: 'create_customer',
      email,
      name,
    }).action();

    if (
      !result.success ||
      result.data?.operation !== 'create_customer' ||
      !result.data?.data
    ) {
      throw new Error(`Failed to create customer: ${result.error}`);
    }

    return result.data.data;
  }

  //   Create new Stripe Subscription
  private async createTestSubscription(customer: string, price: string) {
    const result = await new StripeBubble({
      operation: 'create_subscription',
      customerId: customer,
      items: [{ price }],
    }).action();
    if (
      !result.success ||
      result.data?.operation !== 'create_subscription' ||
      !result.data?.data
    ) {
      throw new Error(`Failed to create subscription: ${result.error}`);
    }

    return result.data.data;
  }

  private async cancelTestSubscription(subscriptionId: string) {
    const result = await new StripeBubble({
      operation: 'cancel_subscription',
      subscriptionId: subscriptionId,
    }).action();
    if (
      !result.success ||
      result.data?.operation !== 'cancel_subscription' ||
      !result.data?.data
    ) {
      throw new Error(`Failed to cancel subscription: ${result.error}`);
    }
    return result.data.data;
  }

  async handle(payload: StripeIntegrationTestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    const subscriptionIds: string[] = [];
    //  1 Setup
    const testEmail = payload.testEmail || `test-${Date.now()}@example.com`;

    // Create Customer
    const customer = await this.createTestCustomer(testEmail);
    results.push({ operation: 'create_customer', success: true });

    if (!customer?.id) {
      throw new Error('Customer data is missing');
    }

    // 2. Create Subscription(s)
    const subscription = await this.createTestSubscription(
      customer.id,
      payload.testPriceId
    );

    if (!subscription?.id) {
      throw new Error('Subscription data is missing');
    }
    subscriptionIds.push(subscription.id);
    results.push({ operation: 'create_subscription', success: true });

    // 3. Delete Subscription
    for (const subId of subscriptionIds) {
      await this.cancelTestSubscription(subId);
      results.push({ operation: 'cancel_subscription', success: true });
    }

    return {
      testCustomerId: customer.id,
      testCustomerEmail: testEmail,
      testSubscriptionIds: subscriptionIds,
      testResults: results,
    };
  }
}
