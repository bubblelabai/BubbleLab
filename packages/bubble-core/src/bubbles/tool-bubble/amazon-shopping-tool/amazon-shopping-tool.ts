import { ToolBubble } from '../../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import {
  BrowserBaseBubble,
  BrowserSessionDataSchema,
  type CDPCookie,
} from '../../service-bubble/browserbase/index.js';
import { StorageBubble } from '../../service-bubble/storage.js';
import {
  AmazonShoppingToolParamsSchema,
  AmazonShoppingToolResultSchema,
  type AmazonShoppingToolParams,
  type AmazonShoppingToolParamsInput,
  type AmazonShoppingToolResult,
  type CartItem,
  type SearchResult,
  type ProductDetails,
} from './amazon-shopping-tool.schema.js';

// Debug logging helper - only logs when ENABLE_DEBUG_LOGS env var is set
const DEBUG = process.env.ENABLE_DEBUG_LOGS;
function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * Amazon Shopping Tool
 *
 * A tool bubble for automating Amazon shopping operations including
 * adding items to cart, viewing cart, and completing checkout.
 *
 * This tool uses the BrowserBase service bubble internally to
 * manage browser sessions with authenticated Amazon credentials.
 *
 * Features:
 * - Add products to cart by URL or ASIN
 * - View current cart contents and totals
 * - Complete checkout with saved payment methods
 * - Search for products
 * - Get detailed product information
 *
 * Required Credentials:
 * - AMAZON_CRED: Browser session credential with Amazon cookies
 *
 * Security:
 * - Uses BrowserBase cloud browsers (isolated)
 * - Credentials are encrypted at rest
 * - Session data is not persisted beyond operation
 */
export class AmazonShoppingTool<
  T extends AmazonShoppingToolParamsInput = AmazonShoppingToolParamsInput,
> extends ToolBubble<
  T,
  Extract<AmazonShoppingToolResult, { operation: T['operation'] }>
> {
  static readonly bubbleName: BubbleName = 'amazon-shopping-tool';
  static readonly schema = AmazonShoppingToolParamsSchema;
  static readonly resultSchema = AmazonShoppingToolResultSchema;
  static readonly shortDescription =
    'Amazon shopping automation - add to cart, view cart, checkout, search products';
  static readonly longDescription = `
    Amazon Shopping Tool for automating shopping operations.

    Features:
    - Add products to cart by URL or ASIN
    - View current cart contents and totals
    - Complete checkout with saved payment methods
    - Search for products on Amazon
    - Get detailed product information

    Required Credentials:
    - AMAZON_CRED: Browser session credential (authenticate via browser session)

    Note: Checkout requires saved payment and shipping information in Amazon account.
    The tool operates using authenticated browser sessions to ensure security.
  `;
  static readonly alias = 'amazon';
  static readonly type = 'tool';

  private sessionId: string | null = null;
  private contextId: string | null = null;
  private cookies: CDPCookie[] | null = null;

  constructor(
    params: T = { operation: 'get_cart' } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  /**
   * Choose the credential to use for Amazon operations
   * Returns AMAZON_CRED which contains contextId and cookies
   */
  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.AMAZON_CRED];
  }

  /**
   * Parse the AMAZON_CRED to extract contextId and cookies
   * Credential is base64-encoded JSON to avoid escaping issues
   */
  private parseBrowserSessionData(): {
    contextId: string;
    cookies: CDPCookie[];
  } | null {
    const credential = this.chooseCredential();
    if (!credential) {
      return null;
    }

    try {
      // Credential is base64-encoded JSON
      const jsonString = Buffer.from(credential, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonString);
      const validated = BrowserSessionDataSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      console.error(
        '[AmazonShoppingTool] Invalid credential format:',
        validated.error
      );
      return null;
    } catch (error) {
      console.error('[AmazonShoppingTool] Failed to parse credential:', error);
      return null;
    }
  }

  /**
   * Extract ASIN from Amazon URL or return as-is if already an ASIN
   */
  private extractAsin(productUrlOrAsin: string): string {
    // If it's already an ASIN (10 characters, alphanumeric)
    if (/^[A-Z0-9]{10}$/i.test(productUrlOrAsin)) {
      return productUrlOrAsin.toUpperCase();
    }

    // Try to extract ASIN from URL patterns
    // Pattern 1: /dp/ASIN
    const dpMatch = productUrlOrAsin.match(/\/dp\/([A-Z0-9]{10})/i);
    if (dpMatch) return dpMatch[1].toUpperCase();

    // Pattern 2: /gp/product/ASIN
    const gpMatch = productUrlOrAsin.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (gpMatch) return gpMatch[1].toUpperCase();

    // Pattern 3: ASIN in query string
    const asinMatch = productUrlOrAsin.match(/[?&]ASIN=([A-Z0-9]{10})/i);
    if (asinMatch) return asinMatch[1].toUpperCase();

    // If we can't extract, return the original (might fail later)
    return productUrlOrAsin;
  }

  /**
   * Build Amazon product URL from ASIN
   */
  private buildProductUrl(asin: string): string {
    return `https://www.amazon.com/dp/${asin}`;
  }

  /**
   * Start a browser session using BrowserBase
   * Extracts contextId and cookies from AMAZON_CRED and passes them explicitly
   */
  private async startBrowserSession(): Promise<string> {
    debugLog('[AmazonShoppingTool] Starting browser session');
    debugLog('[AmazonShoppingTool] Session ID:', this.sessionId);
    if (this.sessionId) {
      return this.sessionId;
    }

    // Parse credential to get contextId and cookies
    const sessionData = this.parseBrowserSessionData();
    if (sessionData) {
      this.contextId = sessionData.contextId;
      this.cookies = sessionData.cookies;
      debugLog(
        `[AmazonShoppingTool] Loaded session data: contextId=${this.contextId}, cookies=${this.cookies.length}`
      );
    } else {
      debugLog(
        '[AmazonShoppingTool] No AMAZON_CRED found, creating new context'
      );
    }

    // Create BrowserBaseBubble with explicit context_id and cookies

    const startsession_browserbase = new BrowserBaseBubble(
      {
        operation: 'start_session' as const,
        context_id: this.contextId || undefined,
        cookies: this.cookies || undefined,
        credentials: this.params.credentials,
      },
      this.context,
      'startsession_browserbase'
    );

    const result = await startsession_browserbase.action();

    if (!result.data.success || !result.data.session_id) {
      throw new Error(result.data.error || 'Failed to start browser session');
    }

    this.sessionId = result.data.session_id;
    // Store the contextId from the result in case a new one was created
    if (result.data.context_id) {
      this.contextId = result.data.context_id;
    }
    debugLog(
      `[AmazonShoppingTool] Browser session started: ${this.sessionId}, context: ${this.contextId}`
    );

    // Emit browser session start event with Amazon Shopping Tool's variableId
    // so the live session shows on this tool's step in the UI
    if (this.context?.logger && result.data.debug_url) {
      this.context.logger.logBrowserSessionStart(
        this.sessionId,
        result.data.debug_url,
        this.context.variableId
      );
    }

    return this.sessionId;
  }

  /**
   * End the browser session
   */
  private async endBrowserSession(): Promise<void> {
    if (!this.sessionId) return;

    const sessionIdToEnd = this.sessionId;

    try {
      const endsession_browserbase = new BrowserBaseBubble(
        {
          operation: 'end_session' as const,
          session_id: sessionIdToEnd,
        },
        this.context,
        'endsession_browserbase'
      );

      await endsession_browserbase.action();
      debugLog(`[AmazonShoppingTool] Browser session ended: ${sessionIdToEnd}`);
    } catch (error) {
      console.error('[AmazonShoppingTool] Error ending session:', error);
    } finally {
      // Emit browser session end event to stop showing live view in UI
      if (this.context?.logger) {
        this.context.logger.logBrowserSessionEnd(
          sessionIdToEnd,
          this.context.variableId
        );
      }
      this.sessionId = null;
    }
  }

  /**
   * Navigate to a URL
   */
  private async navigateTo(url: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const navigate_browserbase = new BrowserBaseBubble(
      {
        operation: 'navigate' as const,
        session_id: this.sessionId,
        url,
        wait_until: 'domcontentloaded',
        timeout: 30000,
      },
      this.context,
      'navigate_browserbase'
    );

    const result = await navigate_browserbase.action();
    if (!result.data.success) {
      throw new Error(result.data.error || 'Navigation failed');
    }
  }

  /**
   * Click an element
   */
  private async clickElement(
    selector: string,
    waitForNav = false
  ): Promise<boolean> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const click_browserbase = new BrowserBaseBubble(
      {
        operation: 'click' as const,
        session_id: this.sessionId,
        selector,
        wait_for_navigation: waitForNav,
        timeout: 5000,
      },
      this.context,
      'click_browserbase'
    );

    const result = await click_browserbase.action();
    return result.data.success;
  }

  /**
   * Evaluate JavaScript in page
   */
  private async evaluate(script: string): Promise<unknown> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const evaluate_browserbase = new BrowserBaseBubble(
      {
        operation: 'evaluate' as const,
        session_id: this.sessionId,
        script,
      },
      this.context,
      'evaluate_browserbase'
    );

    const result = await evaluate_browserbase.action();
    if (!result.data.success) {
      throw new Error(result.data.error || 'Script evaluation failed');
    }

    return result.data.result;
  }

  /**
   * Wait for selector
   */
  private async waitForSelector(
    selector: string,
    timeout = 5000
  ): Promise<boolean> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const waitselector_browserbase = new BrowserBaseBubble(
      {
        operation: 'wait' as const,
        session_id: this.sessionId,
        wait_type: 'selector',
        selector,
        timeout,
      },
      this.context,
      'waitselector_browserbase'
    );

    const result = await waitselector_browserbase.action();
    return result.data.success;
  }

  /**
   * Wait for navigation to complete
   */
  private async waitForNavigation(timeout = 30000): Promise<boolean> {
    if (!this.sessionId) {
      throw new Error('No active browser session');
    }

    const waitnavigation_browserbase = new BrowserBaseBubble(
      {
        operation: 'wait' as const,
        session_id: this.sessionId,
        wait_type: 'navigation',
        timeout,
      },
      this.context,
      'waitnavigation_browserbase'
    );

    const result = await waitnavigation_browserbase.action();
    return result.data.success;
  }

  /**
   * Take a screenshot and upload to Cloudflare R2
   * Returns the URL of the uploaded screenshot
   */
  private async takeScreenshotAndUpload(
    label: string,
    fullPage = false
  ): Promise<string | null> {
    if (!this.sessionId) {
      console.error('[AmazonShoppingTool] No session for screenshot');
      return null;
    }

    try {
      debugLog(`[AmazonShoppingTool] Taking screenshot: ${label}`);

      // Take screenshot using BrowserBase
      const screenshot_browserbase = new BrowserBaseBubble(
        {
          operation: 'screenshot' as const,
          session_id: this.sessionId,
          full_page: fullPage,
          format: 'png',
          credentials: this.params.credentials,
        },
        this.context,
        'screenshot_browserbase'
      );

      const screenshotResult = await screenshot_browserbase.action();
      if (!screenshotResult.data.success || !screenshotResult.data.data) {
        console.error(
          '[AmazonShoppingTool] Screenshot failed:',
          screenshotResult.data.error
        );
        return null;
      }

      const base64Data = screenshotResult.data.data;
      debugLog(
        `[AmazonShoppingTool] Screenshot captured, size: ${base64Data.length} chars`
      );

      // Upload to Cloudflare R2 using StorageBubble
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `amazon-${label}-${timestamp}.png`;

      const updatefile_storagebubble = new StorageBubble(
        {
          operation: 'updateFile' as const,
          bucketName: 'bubble-lab-bucket',
          fileName,
          fileContent: `data:image/png;base64,${base64Data}`,
          contentType: 'image/png',
          credentials: this.params.credentials,
        },
        this.context,
        'updatefile_storagebubble'
      );

      const uploadResult = await updatefile_storagebubble.action();
      if (!uploadResult.data.success || !uploadResult.data.fileName) {
        console.error(
          '[AmazonShoppingTool] Upload failed:',
          uploadResult.data.error
        );
        return null;
      }

      debugLog(
        `[AmazonShoppingTool] Screenshot uploaded: ${uploadResult.data.fileName}`
      );

      // Get the download URL for the uploaded file
      const getfile_storagebubble = new StorageBubble(
        {
          operation: 'getFile' as const,
          bucketName: 'bubble-lab-bucket',
          fileName: uploadResult.data.fileName,
          expirationMinutes: 60 * 24 * 7, // 7 days expiry
          credentials: this.params.credentials,
        },
        this.context,
        'getfile_storagebubble'
      );

      const fileResult = await getfile_storagebubble.action();
      if (!fileResult.data.success || !fileResult.data.downloadUrl) {
        console.error(
          '[AmazonShoppingTool] Failed to get download URL:',
          fileResult.data.error
        );
        return null;
      }

      debugLog(
        `[AmazonShoppingTool] Screenshot URL generated: ${fileResult.data.downloadUrl.substring(0, 80)}...`
      );
      return fileResult.data.downloadUrl;
    } catch (error) {
      console.error('[AmazonShoppingTool] Screenshot error:', error);
      return null;
    }
  }

  async performAction(): Promise<
    Extract<AmazonShoppingToolResult, { operation: T['operation'] }>
  > {
    const { operation } = this.params;
    // Cast to output type since base class already parsed input through Zod
    const parsedParams = this.params as AmazonShoppingToolParams;

    try {
      // Start browser session
      await this.startBrowserSession();

      const result = await (async (): Promise<AmazonShoppingToolResult> => {
        switch (operation) {
          case 'add_to_cart':
            return await this.addToCart(
              parsedParams as Extract<
                AmazonShoppingToolParams,
                { operation: 'add_to_cart' }
              >
            );
          case 'get_cart':
            return (await this.getCart()) as Extract<
              AmazonShoppingToolResult,
              { operation: 'get_cart' }
            >;
          case 'checkout':
            return (await this.checkout()) as Extract<
              AmazonShoppingToolResult,
              { operation: 'checkout' }
            >;
          case 'search':
            return await this.searchProducts(
              parsedParams as Extract<
                AmazonShoppingToolParams,
                { operation: 'search' }
              >
            );
          case 'get_product':
            return await this.getProduct(
              parsedParams as Extract<
                AmazonShoppingToolParams,
                { operation: 'get_product' }
              >
            );
          case 'screenshot':
            return await this.takeScreenshot(
              parsedParams as Extract<
                AmazonShoppingToolParams,
                { operation: 'screenshot' }
              >
            );
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
      })();

      return result as Extract<
        AmazonShoppingToolResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      console.error('[AmazonShoppingTool] Error:', error);
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<AmazonShoppingToolResult, { operation: T['operation'] }>;
    } finally {
      // Always clean up the session
      await this.endBrowserSession();
    }
  }

  /**
   * Add a product to cart
   */
  private async addToCart(
    params: Extract<AmazonShoppingToolParams, { operation: 'add_to_cart' }>
  ): Promise<Extract<AmazonShoppingToolResult, { operation: 'add_to_cart' }>> {
    const asin = this.extractAsin(params.product_url);
    const productUrl = this.buildProductUrl(asin);

    debugLog(`[AmazonShoppingTool] Adding to cart: ${asin}`);

    // Navigate to product page
    await this.navigateTo(productUrl);

    // Wait for and click Add to Cart button
    const addToCartSelectors = [
      '#submit\\.add-to-cart',
      '#add-to-cart-button',
      'input[name="submit.add-to-cart"]',
    ];

    let clicked = false;
    for (const selector of addToCartSelectors) {
      const exists = await this.waitForSelector(selector, 2000);
      if (exists) {
        clicked = await this.clickElement(selector, true);
        break;
      }
    }

    // Wait a moment for any modal/popup to appear
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if we've already navigated away from product page (to cart confirmation)
    // If so, skip the "No thanks" check entirely - we're done
    let currentUrlAfterAdd: string;
    try {
      currentUrlAfterAdd = await this.getCurrentUrl();
      debugLog(
        `[AmazonShoppingTool] URL after Add to Cart click: ${currentUrlAfterAdd}`
      );

      // If we've navigated to cart or confirmation page, we're done - skip No Thanks check
      if (
        currentUrlAfterAdd.includes('/cart') ||
        currentUrlAfterAdd.includes('/gp/aw/d/') ||
        currentUrlAfterAdd.includes('sw_pt=') ||
        currentUrlAfterAdd.includes('/gp/product/handle-buy-box')
      ) {
        debugLog(
          '[AmazonShoppingTool] Already navigated to cart/confirmation - skipping No Thanks check'
        );
        return {
          operation: 'add_to_cart',
          success: true,
          message: `Added ${asin} to cart`,
          cart_count: undefined,
          error: '',
        };
      }
    } catch {
      debugLog(
        '[AmazonShoppingTool] Could not get URL (navigation may have occurred)'
      );
    }

    // Handle protection plan modal - click "No thanks" if it appears
    // This modal asks "Add to your order" with protection plan options
    // Try multiple times as modal may take time to fully render
    // NOTE: If "No thanks" is not found, we just skip and proceed - it's optional
    debugLog('[AmazonShoppingTool] Checking for protection plan modal...');

    // First, try to click using BrowserBase click operation with selector
    // This handles Amazon's dynamically rendered modals better
    // The attachSiNoCoverage button is in the side sheet (NOT in a-popover-preload)
    const noThanksSelectors = [
      '#attachSiNoCoverage',
      '#attachSiNoCoverage input',
      '#attachSiNoCoverage-ld',
      '#attachSiNoCoverage-ld input',
      '#attachSiNoCoverage-eu-enhanced',
      '#attachSiNoCoverage-eu-enhanced input',
      '.a-popover-wrapper .mbb__no button',
      '.a-sheet-content .mbb__no button',
    ];

    for (const selector of noThanksSelectors) {
      try {
        const selectorClicked = await this.clickElement(selector, false);
        if (selectorClicked) {
          debugLog(
            `[AmazonShoppingTool] Clicked No Thanks via selector: ${selector}`
          );
          clicked = true;
          // Wait for navigation after dismissing modal
          debugLog(
            '[AmazonShoppingTool] Waiting for navigation after No Thanks click...'
          );
          try {
            await this.waitForNavigation(5000);
            debugLog(
              '[AmazonShoppingTool] Navigation complete after No Thanks'
            );
          } catch {
            debugLog(
              '[AmazonShoppingTool] Navigation wait completed or timed out'
            );
          }
          break;
        }
      } catch (err) {
        // Selector not found or error during click, continue
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('navigation') || errorMsg.includes('context')) {
          // Navigation happened, which means click succeeded
          debugLog('[AmazonShoppingTool] Click caused navigation (success)');
          clicked = true;
          break;
        }
      }
    }

    // If selector-based click didn't work, try evaluate-based approach
    if (!clicked) {
      const noThanksResult = (await this.evaluate(`
      (() => {
        // Helper function to check if element is truly visible (not in preload/hidden containers)
        function isElementVisible(el) {
          // Check if inside a-popover-preload (hidden preload content)
          if (el.closest('.a-popover-preload')) {
            return false;
          }
          // Check computed style
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
          // Check bounding rect
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }

        // First try: Look for attachSiNoCoverage buttons (the visible side sheet buttons)
        const attachSiButtons = ['#attachSiNoCoverage', '#attachSiNoCoverage-ld', '#attachSiNoCoverage-eu-enhanced'];
        for (const id of attachSiButtons) {
          const btn = document.querySelector(id);
          if (btn && isElementVisible(btn)) {
            console.log('[Debug] Clicking attachSi button:', id);
            btn.click();
            return { clicked: true, text: 'No thanks', method: 'attachSi' };
          }
        }

        // Second try: Look for visible mbb__no buttons (not in preload)
        const mbbNoButtons = document.querySelectorAll('.mbb__no button, span.mbb__no');
        console.log('[Debug] Found mbb__no elements:', mbbNoButtons.length);
        for (const btn of mbbNoButtons) {
          if (isElementVisible(btn)) {
            console.log('[Debug] Clicking visible mbb__no button:', btn.textContent?.trim());
            btn.click();
            return { clicked: true, text: btn.textContent?.trim() || 'mbb__no', method: 'mbb__no' };
          }
        }

        // Third try: Look for visible "No thanks" text buttons (not in preload)
        const allButtons = document.querySelectorAll('button, input[type="submit"], a, span[role="button"]');
        for (const btn of allButtons) {
          const text = (btn.value || btn.innerText || btn.textContent || '').trim().toLowerCase();
          if (text === 'no thanks' || text === 'no, thanks') {
            if (isElementVisible(btn)) {
              console.log('[Debug] Clicking visible no thanks button:', text);
              btn.click();
              return { clicked: true, text: text, method: 'text-match' };
            }
          }
        }

        // Log debug info about what we found
        const preloadCount = document.querySelectorAll('.a-popover-preload .mbb__no').length;
        const attachSiExists = document.querySelector('#attachSiNoCoverage') ? 'yes' : 'no';
        console.log('[Debug] attachSiNoCoverage exists:', attachSiExists);
        console.log('[Debug] mbb__no in preload (hidden):', preloadCount);
        console.log('[Debug] No visible No Thanks button found');
        return { clicked: false };
      })()
    `)) as { clicked: boolean; text?: string; method?: string };

      if (noThanksResult.clicked) {
        clicked = true;
        debugLog(
          `[AmazonShoppingTool] Dismissed protection plan modal by clicking "${noThanksResult.text}" (method: ${noThanksResult.method})`
        );
        // Wait for navigation after dismissing modal
        debugLog('[AmazonShoppingTool] Waiting for navigation...');
        try {
          await this.waitForNavigation(4000);
          debugLog('[AmazonShoppingTool] Navigation complete after No thanks');
        } catch {
          debugLog(
            '[AmazonShoppingTool] Navigation wait timed out, continuing...'
          );
        }
      } else {
        debugLog(
          '[AmazonShoppingTool] No protection plan modal detected (via evaluate)'
        );
      }
    } // Close if (!clicked) block

    // Debug: Save current page state for inspection (may fail after navigation)
    try {
      const currentUrl = await this.getCurrentUrl();
      debugLog(
        `[AmazonShoppingTool] Current URL after add to cart: ${currentUrl}`
      );
      await this.saveDebugState('add-to-cart-after');
    } catch {
      debugLog(
        '[AmazonShoppingTool] Could not save debug state (page may have navigated)'
      );
    }

    // Try to get cart count (may fail after navigation)
    let cartCount: number | undefined;
    try {
      const countResult = (await this.evaluate(`
        (() => {
          const cartEl = document.querySelector('#nav-cart-count');
          if (cartEl) {
            const count = parseInt(cartEl.textContent || '0', 10);
            return isNaN(count) ? 0 : count;
          }
          return 0;
        })()
      `)) as number;
      cartCount = countResult;
    } catch {
      // Cart count is optional, may fail if page navigated
      debugLog(
        '[AmazonShoppingTool] Could not get cart count (page may have navigated)'
      );
    }

    if (!clicked) {
      return {
        operation: 'add_to_cart',
        success: false,
        error: 'Could not find Add to Cart button. Product may be unavailable.',
      };
    }

    return {
      operation: 'add_to_cart',
      success: true,
      message: `Added ${asin} to cart`,
      cart_count: cartCount,
      error: '',
    };
  }

  /**
   * Get cart contents
   */
  private async getCart(): Promise<
    Extract<AmazonShoppingToolResult, { operation: 'get_cart' }>
  > {
    debugLog('[AmazonShoppingTool] Getting cart contents');

    // Navigate to cart page
    await this.navigateTo('https://www.amazon.com/gp/cart/view.html');

    // Wait for cart to load
    await this.waitForSelector('#sc-active-cart', 5000);

    // Extract cart items using JavaScript
    const cartData = (await this.evaluate(`
      (() => {
        const items = [];
        const cartItems = document.querySelectorAll('[data-asin]');

        cartItems.forEach(item => {
          const asin = item.getAttribute('data-asin');
          if (!asin) return;

          const titleEl = item.querySelector('.sc-product-title, .a-truncate-cut');
          const priceEl = item.querySelector('.sc-product-price, .sc-price');
          const quantityEl = item.querySelector('select[name*="quantity"], .sc-quantity-textfield');
          const imageEl = item.querySelector('img.sc-product-image, img[data-a-hires]');

          items.push({
            asin,
            title: titleEl?.textContent?.trim() || 'Unknown Product',
            price: priceEl?.textContent?.trim() || '',
            quantity: quantityEl ? parseInt(quantityEl.value || '1', 10) : 1,
            image: imageEl?.src || '',
            url: 'https://www.amazon.com/dp/' + asin,
          });
        });

        // Get subtotal
        const subtotalEl = document.querySelector('#sc-subtotal-amount-activecart, .sc-subtotal-amount-activecart');
        const subtotal = subtotalEl?.textContent?.trim() || '';

        return { items, subtotal, totalItems: items.reduce((sum, i) => sum + i.quantity, 0) };
      })()
    `)) as { items: CartItem[]; subtotal: string; totalItems: number };

    // Take confirmation screenshot of the cart
    const screenshotUrl = await this.takeScreenshotAndUpload('cart', false);

    return {
      operation: 'get_cart',
      success: true,
      items: cartData.items,
      subtotal: cartData.subtotal,
      total_items: cartData.totalItems,
      screenshot_url: screenshotUrl || undefined,
      error: '',
    };
  }

  /**
   * Get current page URL
   */
  private async getCurrentUrl(): Promise<string> {
    const result = (await this.evaluate(`window.location.href`)) as string;
    return result;
  }

  /**
   * Complete checkout - uses same heuristics as amazon-cart-browserbase.ts
   */
  private async checkout(): Promise<
    Extract<AmazonShoppingToolResult, { operation: 'checkout' }>
  > {
    debugLog('[AmazonShoppingTool] Starting checkout');

    // Step 1: Go to cart
    debugLog('[AmazonShoppingTool] Step 1: Loading cart...');
    await this.navigateTo('https://www.amazon.com/gp/cart/view.html');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check cart has items
    const cartItemCount = (await this.evaluate(`
      document.querySelectorAll('[data-asin]:not([data-asin=""])').length
    `)) as number;
    debugLog(`[AmazonShoppingTool] Found ${cartItemCount} items in cart`);

    if (cartItemCount === 0) {
      return {
        operation: 'checkout',
        success: false,
        error: 'Cart is empty',
      };
    }

    // Step 2: Click proceed to checkout
    debugLog('[AmazonShoppingTool] Step 2: Looking for checkout button...');
    const checkoutClickResult = (await this.evaluate(`
      (() => {
        // Prioritize input/button over span/a - input.value is the actual clickable form element
        const priorityOrder = ['input', 'button', 'a', 'span'];
        for (const tagName of priorityOrder) {
          const elements = document.querySelectorAll(tagName);
          for (const el of elements) {
            const text = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
            if (text === 'proceed to checkout' || text === 'proceed to retail checkout') {
              el.click();
              return { clicked: true, tag: el.tagName, className: el.className, text: text };
            }
          }
        }
        return { clicked: false };
      })()
    `)) as {
      clicked: boolean;
      tag?: string;
      className?: string;
      text?: string;
    };

    if (!checkoutClickResult.clicked) {
      return {
        operation: 'checkout',
        success: false,
        error: 'Could not find checkout button',
      };
    }
    debugLog(
      `[AmazonShoppingTool] Clicked Proceed to checkout: <${checkoutClickResult.tag} class="${checkoutClickResult.className}">${checkoutClickResult.text}`
    );

    await new Promise((resolve) => setTimeout(resolve, 5000));
    let currentUrl = await this.getCurrentUrl();
    debugLog(`[AmazonShoppingTool] Current URL: ${currentUrl}`);

    // Check for sign-in redirect
    if (currentUrl.includes('/ap/signin')) {
      return {
        operation: 'checkout',
        success: false,
        error: 'Password re-authentication required',
      };
    }

    // Step 2.5: Handle "Continue to checkout" intermediate screen (BYG page)
    debugLog(
      '[AmazonShoppingTool] Step 2.5: Checking for Continue to checkout screen...'
    );

    const continueClickResult = (await this.evaluate(`
      (() => {
        const priorityOrder = ['input', 'button', 'a', 'span'];
        for (const tagName of priorityOrder) {
          const elements = document.querySelectorAll(tagName);
          for (const el of elements) {
            const text = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
            if (text === 'continue to checkout') {
              el.click();
              return { clicked: true, tag: el.tagName, className: el.className, text: text };
            }
          }
        }
        return { clicked: false };
      })()
    `)) as {
      clicked: boolean;
      tag?: string;
      className?: string;
      text?: string;
    };

    if (continueClickResult.clicked) {
      debugLog(
        `[AmazonShoppingTool] Clicked Continue to checkout: <${continueClickResult.tag} class="${continueClickResult.className}">${continueClickResult.text}`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
      currentUrl = await this.getCurrentUrl();
      debugLog(
        `[AmazonShoppingTool] After Continue to checkout URL: ${currentUrl}`
      );
    } else {
      debugLog(
        '[AmazonShoppingTool] No Continue to checkout button found, continuing...'
      );
    }

    // Check for sign-in redirect again
    if (currentUrl.includes('/ap/signin')) {
      return {
        operation: 'checkout',
        success: false,
        error: 'Password re-authentication required',
      };
    }

    // Step 3: Navigate through checkout steps (up to 5 pages: address, payment, review, etc.)
    debugLog('[AmazonShoppingTool] Step 3: Navigating checkout steps...');

    for (let attempt = 1; attempt <= 5; attempt++) {
      currentUrl = await this.getCurrentUrl();
      debugLog(`[AmazonShoppingTool] Step 3.${attempt}: URL = ${currentUrl}`);

      // Check for sign-in redirect
      if (currentUrl.includes('/ap/signin')) {
        return {
          operation: 'checkout',
          success: false,
          error: 'Password re-authentication required',
        };
      }

      // Try to click "Use this payment method" button if visible (before Place your order)
      const usePaymentMethodResult = (await this.evaluate(`
        (() => {
          // First try by specific IDs (most reliable)
          const primaryBtn = document.querySelector('#checkout-primary-continue-button-id');
          const secondaryBtn = document.querySelector('#checkout-secondary-continue-button-id');

          // Check if either button contains "use this payment method" text (case-insensitive)
          for (const btn of [primaryBtn, secondaryBtn]) {
            if (btn) {
              const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
              if (text.includes('use this payment method')) {
                // Find the clickable input inside the button span
                const input = btn.querySelector('input.a-button-input');
                if (input) {
                  input.click();
                  return { clicked: true, tag: 'input', className: input.className, text: text, method: 'input-click' };
                }
                // Fallback to clicking the button span itself
                btn.click();
                return { clicked: true, tag: btn.tagName, className: btn.className, text: text, method: 'span-click' };
              }
            }
          }

          // Fallback: search all elements for "use this payment method" text (case-insensitive)
          const priorityOrder = ['input', 'button', 'a', 'span'];
          for (const tagName of priorityOrder) {
            const elements = document.querySelectorAll(tagName);
            for (const el of elements) {
              const text = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
              if (text.includes('use this payment method')) {
                el.click();
                return { clicked: true, tag: el.tagName, className: el.className, text: text, method: 'fallback' };
              }
            }
          }
          return { clicked: false };
        })()
      `)) as {
        clicked: boolean;
        tag?: string;
        className?: string;
        text?: string;
        method?: string;
      };

      if (usePaymentMethodResult.clicked) {
        debugLog(
          `[AmazonShoppingTool] Clicked "Use this payment method": <${usePaymentMethodResult.tag} class="${usePaymentMethodResult.className}"> via ${usePaymentMethodResult.method}`
        );
        // Wait for the page to process the payment method selection
        await new Promise((resolve) => setTimeout(resolve, 4000));
        // Continue to next iteration to check for Place your order button
        continue;
      }

      // Try to click "Place your order" button
      const placeOrderResult = (await this.evaluate(`
        (() => {
          const priorityOrder = ['input', 'button', 'a', 'span'];
          for (const tagName of priorityOrder) {
            const elements = document.querySelectorAll(tagName);
            for (const el of elements) {
              const text = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
              if (text === 'place your order' || text === 'place order') {
                el.click();
                return { clicked: true, tag: el.tagName, className: el.className, text: text };
              }
            }
          }
          return { clicked: false };
        })()
      `)) as {
        clicked: boolean;
        tag?: string;
        className?: string;
        text?: string;
      };

      if (placeOrderResult.clicked) {
        debugLog(
          `[AmazonShoppingTool] Clicked Place Order: <${placeOrderResult.tag} class="${placeOrderResult.className}">${placeOrderResult.text}`
        );
        // Wait for navigation to confirmation page
        debugLog('[AmazonShoppingTool] Waiting for navigation...');
        try {
          await this.waitForNavigation(15000);
          debugLog('[AmazonShoppingTool] Navigation complete');
        } catch {
          debugLog(
            '[AmazonShoppingTool] Navigation wait timed out, continuing...'
          );
        }
        break; // Order placed, exit loop
      }

      // Try to click "Continue" button to advance to next checkout page
      const continueResult = (await this.evaluate(`
        (() => {
          const priorityOrder = ['input', 'button', 'a', 'span'];
          for (const tagName of priorityOrder) {
            const elements = document.querySelectorAll(tagName);
            for (const el of elements) {
              const text = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
              if (text === 'continue' || text === 'continue to checkout') {
                el.click();
                return { clicked: true, tag: el.tagName, className: el.className, text: text };
              }
            }
          }
          return { clicked: false };
        })()
      `)) as {
        clicked: boolean;
        tag?: string;
        className?: string;
        text?: string;
      };

      if (continueResult.clicked) {
        debugLog(
          `[AmazonShoppingTool] Clicked Continue: <${continueResult.tag} class="${continueResult.className}">${continueResult.text}`
        );
        await new Promise((resolve) => setTimeout(resolve, 4000));
      } else {
        debugLog(
          '[AmazonShoppingTool] No actionable button found, moving to confirmation check...'
        );
        break;
      }
    }

    // Step 4: Handle duplicate order warning
    debugLog('[AmazonShoppingTool] Step 4: Checking page state...');
    currentUrl = await this.getCurrentUrl();
    debugLog(`[AmazonShoppingTool] Current URL: ${currentUrl}`);

    if (currentUrl.includes('duplicateOrder')) {
      debugLog(
        '[AmazonShoppingTool] Detected duplicate order warning - clicking Place Order again...'
      );
      const duplicateResult = (await this.evaluate(`
        (() => {
          const priorityOrder = ['input', 'button', 'a', 'span'];
          for (const tagName of priorityOrder) {
            const elements = document.querySelectorAll(tagName);
            for (const el of elements) {
              const text = (el.value || el.innerText || el.textContent || '').trim().toLowerCase();
              if (text === 'place your order' || text === 'place order') {
                el.click();
                return { clicked: true, tag: el.tagName, className: el.className, text: text };
              }
            }
          }
          return { clicked: false };
        })()
      `)) as {
        clicked: boolean;
        tag?: string;
        className?: string;
        text?: string;
      };

      if (duplicateResult.clicked) {
        debugLog(
          `[AmazonShoppingTool] Clicked Place Order to confirm duplicate: <${duplicateResult.tag} class="${duplicateResult.className}">${duplicateResult.text}`
        );
        debugLog('[AmazonShoppingTool] Waiting for navigation...');
        try {
          await this.waitForNavigation(15000);
          debugLog('[AmazonShoppingTool] Navigation complete');
        } catch {
          debugLog(
            '[AmazonShoppingTool] Navigation wait timed out, continuing...'
          );
        }
      }
    }

    // Step 5: Check for confirmation
    debugLog('[AmazonShoppingTool] Step 5: Checking for order confirmation...');
    let finalUrl = await this.getCurrentUrl();
    debugLog(`[AmazonShoppingTool] Current URL: ${finalUrl}`);

    // If on intermediate page (payment verification, etc.), wait for another navigation
    if (finalUrl.includes('/cpe/') || finalUrl.includes('executions')) {
      debugLog(
        '[AmazonShoppingTool] On intermediate page, waiting for redirect...'
      );
      try {
        await this.waitForNavigation(30000);
        finalUrl = await this.getCurrentUrl();
        debugLog(`[AmazonShoppingTool] After redirect URL: ${finalUrl}`);
      } catch {
        debugLog('[AmazonShoppingTool] No further redirect, continuing...');
      }
    }

    debugLog(`[AmazonShoppingTool] Final URL: ${finalUrl}`);

    // Extract order number from URL if available (purchaseId parameter)
    const urlOrderMatch = finalUrl.match(/purchaseId=(\d{3}-\d{7}-\d{7})/);
    const orderNumberFromUrl = urlOrderMatch?.[1];
    if (orderNumberFromUrl) {
      debugLog(
        `[AmazonShoppingTool] Order number from URL: ${orderNumberFromUrl}`
      );
    }

    const isConfirmationUrl =
      finalUrl.includes('thankyou') ||
      finalUrl.includes('confirmation') ||
      finalUrl.includes('order-details') ||
      finalUrl.includes('your-orders') ||
      finalUrl.includes('gp/buy/thankyou');
    debugLog(
      `[AmazonShoppingTool] URL indicates confirmation: ${isConfirmationUrl}`
    );

    // Extract confirmation info
    const confirmInfo = (await this.evaluate(`
      ((urlIsConfirmation) => {
        const fullText = document.body.innerText;

        // Skip navigation text - find where main content starts
        const mainContentStart = fullText.indexOf('Order placed') !== -1 ? fullText.indexOf('Order placed') :
                                 fullText.indexOf('Thank you') !== -1 ? fullText.indexOf('Thank you') :
                                 fullText.indexOf('Arriving') !== -1 ? fullText.indexOf('Arriving') :
                                 fullText.indexOf('Delivery') !== -1 ? fullText.indexOf('Delivery') :
                                 0;
        const text = fullText.substring(mainContentStart);

        // Check for various success indicators
        const hasOrderPlaced = text.toLowerCase().includes("order placed");
        const hasThankYou = text.toLowerCase().includes("thank you");
        const hasConfirmed = text.toLowerCase().includes("order confirmed");
        const hasOnItsWay = text.toLowerCase().includes("on its way");
        const hasOrderNumber = /\\d{3}-\\d{7}-\\d{7}/.test(text);

        const hasSuccess = hasOrderPlaced || hasThankYou || hasConfirmed || hasOnItsWay || hasOrderNumber;

        // Extract order details
        const orderMatch = text.match(/(\\d{3}-\\d{7}-\\d{7})/);

        // Delivery date - look for day of week + date pattern
        const dayDateMatch = text.match(/((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.\\s]*\\d{1,2})/i);
        const tomorrowMatch = text.match(/(Tomorrow,?\\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?[.\\s]*\\d{0,2})/i);
        const arrivingMatch = text.match(/Arriving\\s+([\\w\\s,]+\\d{1,2})/i);
        const deliveryMatch = dayDateMatch || tomorrowMatch || arrivingMatch;

        // Order total - look near beginning, not in recommendations
        // Note: Amazon's thank you page often doesn't show detailed pricing - that's on the order details page
        const firstPart = text.substring(0, 1500);
        const totalMatch = firstPart.match(/Order total[:\\s]*\\$([\\d,.]+)/i) ||
                          firstPart.match(/Grand total[:\\s]*\\$([\\d,.]+)/i);

        // Subtotal, shipping, tax - must be specifically labeled (avoid Prime savings messages)
        const subtotalMatch = firstPart.match(/(?:^|\\n)\\s*Subtotal[:\\s]*\\$([\\d,.]+)/im) ||
                              firstPart.match(/Items?\\s*\\(\\d+\\)[:\\s]*\\$([\\d,.]+)/i);
        // Shipping cost - must be "Shipping:" or "Shipping cost" not "shipping fees" (which is Prime savings)
        const shippingMatch = firstPart.match(/(?:Shipping cost|Shipping & handling)[:\\s]*\\$([\\d,.]+)/i) ||
                              firstPart.match(/(?:^|\\n)\\s*Shipping[:\\s]*\\$([\\d,.]+)/im);
        const taxMatch = firstPart.match(/(?:^|\\n)\\s*(?:Estimated )?[Tt]ax[:\\s]*\\$([\\d,.]+)/m);

        // Shipping address - look for address after "Shipping to" but before any price or newline
        const addressMatch = text.match(/(?:Shipping to|Delivering to|Ship to)[:\\s]*([A-Z][^\\n\\$]{10,150})/i);

        // Payment method - look for card info
        const paymentMatch = text.match(/(Visa|Mastercard|Amex|American Express|Discover)[^\\n]*ending in (\\d{4})/i) ||
                             text.match(/Payment method[:\\s]*([^\\n]{5,40})/i);

        // Items - look for product titles (be more conservative to avoid promotional content)
        const items = [];

        return {
          isSuccess: hasSuccess || urlIsConfirmation,
          hasOrderPlaced,
          hasThankYou,
          hasConfirmed,
          hasOnItsWay,
          hasOrderNumber,
          orderNumber: orderMatch?.[1],
          deliveryDate: deliveryMatch?.[1]?.trim(),
          total: totalMatch ? '$' + totalMatch[1] : undefined,
          subtotal: subtotalMatch ? '$' + subtotalMatch[1] : undefined,
          shippingCost: shippingMatch ? '$' + shippingMatch[1] : undefined,
          tax: taxMatch ? '$' + taxMatch[1] : undefined,
          address: addressMatch?.[1]?.trim(),
          paymentMethod: paymentMatch?.[0]?.trim(),
          items: items.length > 0 ? items : undefined,
        };
      })(${isConfirmationUrl})
    `)) as {
      isSuccess: boolean;
      hasOrderPlaced: boolean;
      hasThankYou: boolean;
      hasConfirmed: boolean;
      hasOnItsWay: boolean;
      hasOrderNumber: boolean;
      orderNumber?: string;
      deliveryDate?: string;
      total?: string;
      subtotal?: string;
      shippingCost?: string;
      tax?: string;
      address?: string;
      paymentMethod?: string;
      items?: Array<{ title: string; price: string; quantity?: number }>;
    };

    debugLog(
      `[AmazonShoppingTool] Success indicators: orderPlaced=${confirmInfo.hasOrderPlaced}, thankYou=${confirmInfo.hasThankYou}, confirmed=${confirmInfo.hasConfirmed}, onItsWay=${confirmInfo.hasOnItsWay}, hasOrderNumber=${confirmInfo.hasOrderNumber}`
    );
    debugLog(
      `[AmazonShoppingTool] Order number: ${confirmInfo.orderNumber || 'not found'}`
    );
    debugLog(
      `[AmazonShoppingTool] Delivery: ${confirmInfo.deliveryDate || 'not found'}`
    );
    debugLog(`[AmazonShoppingTool] Total: ${confirmInfo.total || 'not found'}`);
    debugLog(
      `[AmazonShoppingTool] Subtotal: ${confirmInfo.subtotal || 'not found'}`
    );
    debugLog(
      `[AmazonShoppingTool] Shipping: ${confirmInfo.shippingCost || 'not found'}`
    );
    debugLog(`[AmazonShoppingTool] Tax: ${confirmInfo.tax || 'not found'}`);
    debugLog(
      `[AmazonShoppingTool] Address: ${confirmInfo.address || 'not found'}`
    );
    debugLog(
      `[AmazonShoppingTool] Payment: ${confirmInfo.paymentMethod || 'not found'}`
    );
    debugLog(
      `[AmazonShoppingTool] Items: ${confirmInfo.items?.length || 0} found`
    );

    // Save debug state before returning
    await this.saveDebugState('checkout-final');

    // If URL indicates success OR text indicates success, consider it successful
    if (!confirmInfo.isSuccess && !isConfirmationUrl) {
      debugLog('[AmazonShoppingTool] ERROR: No success indicators found');
      return {
        operation: 'checkout',
        success: false,
        error: 'Order may not have been placed',
      };
    }

    debugLog('[AmazonShoppingTool] SUCCESS: Order confirmed!');

    // Take confirmation screenshot of the order
    const screenshotUrl = await this.takeScreenshotAndUpload(
      'checkout-confirmation',
      false
    );

    return {
      operation: 'checkout',
      success: true,
      order_number: confirmInfo.orderNumber || orderNumberFromUrl,
      estimated_delivery: confirmInfo.deliveryDate,
      total: confirmInfo.total,
      subtotal: confirmInfo.subtotal,
      shipping_cost: confirmInfo.shippingCost,
      tax: confirmInfo.tax,
      shipping_address: confirmInfo.address,
      payment_method: confirmInfo.paymentMethod,
      items: confirmInfo.items,
      screenshot_url: screenshotUrl || undefined,
      error: '',
    };
  }

  /**
   * Save current DOM state to file for debugging
   * Only saves when DEBUG env var is set
   */
  private async saveDebugState(label: string): Promise<string | null> {
    // Skip saving if DEBUG is not enabled
    if (!DEBUG) {
      return null;
    }

    try {
      const fs = await import('fs/promises');
      const htmlContent = (await this.evaluate(
        `document.documentElement.outerHTML`
      )) as string;
      const currentUrl = await this.getCurrentUrl();
      const timestamp = Date.now();
      const debugPath = `/tmp/amazon-debug-${label}-${timestamp}.html`;

      // Add URL as comment at top of file
      const contentWithUrl = `<!-- URL: ${currentUrl} -->\n${htmlContent}`;
      await fs.writeFile(debugPath, contentWithUrl);
      debugLog(`[AmazonShoppingTool] Saved debug DOM to: ${debugPath}`);
      return debugPath;
    } catch (e) {
      console.error('[AmazonShoppingTool] Failed to save debug state:', e);
      return null;
    }
  }

  /**
   * Search for products
   */
  private async searchProducts(
    params: Extract<AmazonShoppingToolParams, { operation: 'search' }>
  ): Promise<Extract<AmazonShoppingToolResult, { operation: 'search' }>> {
    debugLog(`[AmazonShoppingTool] Searching for: ${params.query}`);

    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(params.query)}`;
    await this.navigateTo(searchUrl);

    // Wait for results
    await this.waitForSelector('[data-component-type="s-search-result"]', 7000);

    const maxResults = params.max_results || 5;

    // Debug: Save page state before extracting results
    debugLog(
      '[AmazonShoppingTool] Saving debug state before search extraction...'
    );
    await this.saveDebugState('search-before-extract');

    // Debug: Log current URL and page title
    const currentSearchUrl = await this.getCurrentUrl();
    debugLog(`[AmazonShoppingTool] Search URL: ${currentSearchUrl}`);

    // Extract search results with enhanced debugging
    const searchData = (await this.evaluate(`
      (() => {
        const results = [];
        const items = document.querySelectorAll('[data-component-type="s-search-result"]');
        const maxResults = ${maxResults};

        console.log('[AmazonSearch Debug] Found ' + items.length + ' search result items');

        for (let i = 0; i < Math.min(items.length, maxResults); i++) {
          const item = items[i];
          const asin = item.getAttribute('data-asin');
          if (!asin) {
            console.log('[AmazonSearch Debug] Item ' + i + ' has no ASIN, skipping');
            continue;
          }

          // Extract title - Amazon has TWO h2 elements:
          // 1. First h2: Brand name only (e.g., "Amazon Basics")
          // 2. Second h2: Full title with aria-label (inside anchor element)
          // We need to get the SECOND h2 which has the full title
          let title = 'Unknown Product';
          let titleSelectorUsed = '';

          // Approach 1: Look for h2 with aria-label attribute (contains full title)
          const h2WithAriaLabel = item.querySelector('h2[aria-label]');
          if (h2WithAriaLabel) {
            const ariaLabel = h2WithAriaLabel.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.length > 10) {
              // Remove "Sponsored Ad - " prefix if present
              title = ariaLabel.replace(/^Sponsored Ad - /i, '').trim();
              titleSelectorUsed = 'h2[aria-label]';
            }
          }

          // Approach 2: Look for anchor > h2 (full title h2 is inside anchor)
          if (titleSelectorUsed === '') {
            const anchorWithH2 = item.querySelector('a > h2, a h2.a-text-normal');
            if (anchorWithH2) {
              const h2Text = anchorWithH2.textContent?.trim();
              if (h2Text && h2Text.length > 10) {
                title = h2Text;
                titleSelectorUsed = 'a > h2';
              }
            }
          }

          // Approach 3: Look for [data-cy="title-recipe"] anchor text
          if (titleSelectorUsed === '') {
            const titleRecipe = item.querySelector('[data-cy="title-recipe"] a.a-text-normal, [data-cy="title-recipe"] a.s-link-style');
            if (titleRecipe) {
              const linkText = titleRecipe.textContent?.trim();
              if (linkText && linkText.length > 10) {
                title = linkText;
                titleSelectorUsed = '[data-cy="title-recipe"] a';
              }
            }
          }

          // Approach 4: Fallback to image alt text (usually has full product name)
          if (titleSelectorUsed === '' || title.length < 20) {
            const imgEl = item.querySelector('.s-image');
            if (imgEl) {
              const altText = imgEl.getAttribute('alt');
              if (altText && altText.length > (title?.length || 0)) {
                // Remove "Sponsored Ad - " prefix if present
                title = altText.replace(/^Sponsored Ad - /i, '').trim();
                titleSelectorUsed = 'img[alt]';
              }
            }
          }

          console.log('[AmazonSearch Debug] Item ' + i + ' ASIN=' + asin + ' title="' + title.substring(0, 100) + '" selector=' + titleSelectorUsed);

          const priceEl = item.querySelector('.a-price .a-offscreen');
          const ratingEl = item.querySelector('.a-icon-alt');
          const reviewsEl = item.querySelector('.a-size-small .a-link-normal');
          const imageEl = item.querySelector('.s-image');
          const primeEl = item.querySelector('.s-prime, .aok-relative');

          results.push({
            asin,
            title,
            price: priceEl?.textContent?.trim() || '',
            rating: ratingEl?.textContent?.match(/[0-9.]+/)?.[0] || '',
            reviews_count: reviewsEl?.textContent?.match(/[0-9,]+/)?.[0] || '',
            url: 'https://www.amazon.com/dp/' + asin,
            image: imageEl?.src || '',
            prime: !!primeEl,
            _debug_titleSelector: titleSelectorUsed
          });
        }

        const totalEl = document.querySelector('.s-breadcrumb .a-color-state');
        const totalMatch = totalEl?.textContent?.match(/([0-9,]+)/);

        return {
          results,
          totalResults: totalMatch ? parseInt(totalMatch[1].replace(/,/g, ''), 10) : results.length
        };
      })()
    `)) as { results: SearchResult[]; totalResults: number };

    // Log extracted results for debugging
    debugLog(
      `[AmazonShoppingTool] Extracted ${searchData.results.length} results`
    );
    searchData.results.forEach((r, i) => {
      debugLog(
        `[AmazonShoppingTool] Result ${i}: ASIN=${r.asin}, title="${r.title.substring(0, 50)}..."`
      );
    });

    return {
      operation: 'search',
      success: true,
      results: searchData.results,
      total_results: searchData.totalResults,
      error: '',
    };
  }

  /**
   * Get product details
   */
  private async getProduct(
    params: Extract<AmazonShoppingToolParams, { operation: 'get_product' }>
  ): Promise<Extract<AmazonShoppingToolResult, { operation: 'get_product' }>> {
    const asin = this.extractAsin(params.product_url);
    const productUrl = this.buildProductUrl(asin);

    debugLog(`[AmazonShoppingTool] Getting product details: ${asin}`);

    await this.navigateTo(productUrl);

    // Wait for product page
    await this.waitForSelector('#productTitle', 5000);

    // Extract product details
    const productData = (await this.evaluate(`
      (() => {
        const titleEl = document.querySelector('#productTitle');
        const priceEl = document.querySelector('.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice');
        const ratingEl = document.querySelector('#acrPopover .a-icon-alt');
        const reviewsEl = document.querySelector('#acrCustomerReviewText');
        const descEl = document.querySelector('#productDescription p, #feature-bullets');
        const availEl = document.querySelector('#availability span');

        // Get feature bullets
        const features = [];
        document.querySelectorAll('#feature-bullets li span').forEach(el => {
          const text = el.textContent?.trim();
          if (text) features.push(text);
        });

        // Get images
        const images = [];
        document.querySelectorAll('#altImages img').forEach(img => {
          const src = img.src?.replace(/._[^.]+_./, '._AC_SL1500_.');
          if (src && !src.includes('play-button')) images.push(src);
        });

        return {
          asin: '${asin}',
          title: titleEl?.textContent?.trim() || 'Unknown Product',
          price: priceEl?.textContent?.trim() || '',
          rating: ratingEl?.textContent?.match(/[0-9.]+/)?.[0] || '',
          reviews_count: reviewsEl?.textContent?.match(/[0-9,]+/)?.[0] || '',
          description: descEl?.textContent?.trim() || '',
          features,
          availability: availEl?.textContent?.trim() || '',
          url: '${productUrl}',
          images,
        };
      })()
    `)) as ProductDetails;

    return {
      operation: 'get_product',
      success: true,
      product: productData,
      error: '',
    };
  }

  /**
   * Take a screenshot operation - navigate to URL if provided, then capture screenshot
   */
  private async takeScreenshot(
    params: Extract<AmazonShoppingToolParams, { operation: 'screenshot' }>
  ): Promise<Extract<AmazonShoppingToolResult, { operation: 'screenshot' }>> {
    debugLog('[AmazonShoppingTool] Screenshot operation');

    // Navigate to URL if provided
    if (params.url) {
      debugLog(`[AmazonShoppingTool] Navigating to: ${params.url}`);
      await this.navigateTo(params.url);
      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Take and upload screenshot
    const screenshotUrl = await this.takeScreenshotAndUpload(
      'page',
      params.full_page
    );

    if (!screenshotUrl) {
      return {
        operation: 'screenshot',
        success: false,
        error: 'Failed to capture or upload screenshot',
      };
    }

    return {
      operation: 'screenshot',
      success: true,
      screenshot_url: screenshotUrl,
      error: '',
    };
  }
}
