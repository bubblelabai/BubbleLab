import {
  BubbleFlow,
  AmazonShoppingTool,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

/**
 * Payload for the Amazon Shopping Tool Integration Test workflow.
 */
export interface AmazonShoppingTestPayload extends WebhookEvent {
  /**
   * Search query to test with
   * @canBeFile false
   */
  searchQuery?: string;
  /**
   * ASIN to test product details with
   * @canBeFile false
   */
  testAsin?: string;
  /**
   * Skip the search step and use testAsin directly
   * @canBeFile false
   */
  skipSearch?: boolean;
  /**
   * Skip the product details step
   * @canBeFile false
   */
  skipProductDetails?: boolean;
  /**
   * Execute checkout step (WARNING: will complete real purchase if enabled)
   * @canBeFile false
   */
  executeCheckout?: boolean;
}

export class AmazonShoppingIntegrationTest extends BubbleFlow<'webhook/http'> {
  // Searches for products on Amazon
  private async searchProducts(query: string, maxResults: number) {
    const result = await new AmazonShoppingTool({
      operation: 'search',
      query: query,
      max_results: maxResults,
    }).action();

    if (!result.success || result.data?.operation !== 'search') {
      throw new Error(`Failed to search products: ${result.error}`);
    }

    return result.data;
  }

  // Gets detailed information about a product
  private async getProductDetails(productUrl: string) {
    const result = await new AmazonShoppingTool({
      operation: 'get_product',
      product_url: productUrl,
    }).action();

    if (!result.success || result.data?.operation !== 'get_product') {
      throw new Error(`Failed to get product details: ${result.error}`);
    }

    return result.data;
  }

  // Gets current cart contents
  private async getCartContents() {
    const result = await new AmazonShoppingTool({
      operation: 'get_cart',
    }).action();

    if (!result.success || result.data?.operation !== 'get_cart') {
      throw new Error(`Failed to get cart: ${result.error}`);
    }

    return result.data;
  }

  // Adds a product to the cart (commented out by default to avoid modifying real cart)
  private async addToCart(productUrl: string, quantity: number) {
    const result = await new AmazonShoppingTool({
      operation: 'add_to_cart',
      product_url: productUrl,
      quantity: quantity,
    }).action();

    if (!result.success || result.data?.operation !== 'add_to_cart') {
      throw new Error(`Failed to add to cart: ${result.error}`);
    }

    return result.data;
  }

  // Executes checkout process (WARNING: will complete real purchase!)
  private async executeCheckout() {
    const result = await new AmazonShoppingTool({
      operation: 'checkout',
    }).action();

    if (!result.success || result.data?.operation !== 'checkout') {
      throw new Error(`Failed to checkout: ${result.error}`);
    }

    return result.data;
  }

  async handle(payload: AmazonShoppingTestPayload): Promise<Output> {
    const {
      searchQuery = 'wireless mouse',
      testAsin = 'B07D7TV5J3',
      skipSearch = false,
      skipProductDetails = false,
      executeCheckout = false,
    } = payload;
    const results: Output['testResults'] = [];

    let productUrl = testAsin;

    // 1. Search for products (optional, can be skipped)
    if (!skipSearch) {
      const searchData = await this.searchProducts(searchQuery, 5);
      results.push({
        operation: 'search',
        success: true,
        details: `Found ${searchData.results?.length || 0} products for "${searchQuery}"`,
      });
      productUrl = searchData.results?.[0]?.url || testAsin;
    } else {
      results.push({
        operation: 'search',
        success: true,
        details: 'Skipped search, using provided testAsin',
      });
    }

    // 2. Get product details for first result or test ASIN (optional, can be skipped)
    if (!skipProductDetails) {
      const productData = await this.getProductDetails(productUrl);
      results.push({
        operation: 'get_product',
        success: true,
        details: `Product: ${productData.product?.title?.substring(0, 50) || 'Unknown'}... (${productData.product?.asin})`,
      });
    } else {
      results.push({
        operation: 'get_product',
        success: true,
        details: 'Skipped product details',
      });
    }

    // 3. Get cart contents (read-only, safe to run)
    const cartData = await this.getCartContents();
    results.push({
      operation: 'get_cart',
      success: true,
      details: `Cart has ${cartData.items?.length || 0} items, subtotal: ${cartData.subtotal || 'N/A'}`,
    });

    // 4. Add to cart (UNCOMMENT ONLY FOR FULL INTEGRATION TEST)
    // WARNING: This will modify the actual Amazon cart!

    const addResult = await this.addToCart(productUrl, 1);
    results.push({
      operation: 'add_to_cart',
      success: true,
      details: `Added item, cart now has ${addResult.cart_count || 'unknown'} items`,
    });

    // 5. Checkout (controlled by executeCheckout parameter)
    // WARNING: This will complete a real purchase if enabled!
    if (executeCheckout) {
      const checkoutData = await this.executeCheckout();

      // Build comprehensive checkout details
      const checkoutDetails = [
        `Order: ${checkoutData.order_number || 'N/A'}`,
        `Delivery: ${checkoutData.estimated_delivery || 'N/A'}`,
        checkoutData.items
          ? `Items: ${checkoutData.items.length} (${checkoutData.items.map((i) => `${i.title} x${i.quantity || 1} @ ${i.price || 'N/A'}`).join(', ')})`
          : null,
        checkoutData.subtotal ? `Subtotal: ${checkoutData.subtotal}` : null,
        checkoutData.shipping_cost
          ? `Shipping: ${checkoutData.shipping_cost}`
          : null,
        checkoutData.tax ? `Tax: ${checkoutData.tax}` : null,
        checkoutData.total ? `Total: ${checkoutData.total}` : null,
        checkoutData.shipping_address
          ? `Address: ${checkoutData.shipping_address}`
          : null,
        checkoutData.payment_method
          ? `Payment: ${checkoutData.payment_method}`
          : null,
      ]
        .filter(Boolean)
        .join(' | ');

      results.push({
        operation: 'checkout',
        success: checkoutData.success || false,
        details: checkoutDetails,
      });
    } else {
      results.push({
        operation: 'checkout',
        success: true,
        details: 'Skipped checkout (set executeCheckout to true to enable)',
      });
    }

    return {
      testResults: results,
    };
  }
}
