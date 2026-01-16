import { z } from 'zod';
import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * Amazon Cart Item schema
 */
export const CartItemSchema = z.object({
  asin: z.string().describe('Amazon Standard Identification Number'),
  title: z.string().describe('Product title'),
  price: z.string().describe('Product price as displayed'),
  quantity: z.number().describe('Quantity in cart'),
  image: z.string().optional().describe('Product image URL'),
  url: z.string().optional().describe('Product URL'),
});

export type CartItem = z.infer<typeof CartItemSchema>;

/**
 * Amazon Shopping Tool parameters schema
 * Multi-operation tool for Amazon shopping automation
 */
export const AmazonShoppingToolParamsSchema = z.discriminatedUnion(
  'operation',
  [
    // Add to cart operation
    z.object({
      operation: z
        .literal('add_to_cart')
        .describe('Add a product to the Amazon shopping cart'),
      product_url: z
        .string()
        .min(1)
        .describe(
          'Amazon product URL or ASIN (e.g., https://amazon.com/dp/B08N5WRWNW or B08N5WRWNW)'
        ),
      quantity: z
        .number()
        .min(1)
        .optional()
        .default(1)
        .describe('Number of items to add (default: 1)'),
      credentials: z
        .record(z.nativeEnum(CredentialType), z.string())
        .optional()
        .describe('Required: AMAZON_CRED for authenticated Amazon session'),
    }),

    // Get cart operation
    z.object({
      operation: z
        .literal('get_cart')
        .describe('View current Amazon cart contents'),
      credentials: z
        .record(z.nativeEnum(CredentialType), z.string())
        .optional()
        .describe('Required: AMAZON_CRED for authenticated Amazon session'),
    }),

    // Checkout operation
    z.object({
      operation: z
        .literal('checkout')
        .describe(
          'Complete the checkout process (requires saved payment method)'
        ),
      credentials: z
        .record(z.nativeEnum(CredentialType), z.string())
        .optional()
        .describe('Required: AMAZON_CRED for authenticated Amazon session'),
    }),

    // Search products operation
    z.object({
      operation: z.literal('search').describe('Search for products on Amazon'),
      query: z.string().min(1).describe('Search query'),
      max_results: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe('Maximum number of results to return'),
      credentials: z
        .record(z.nativeEnum(CredentialType), z.string())
        .optional()
        .describe('Required: AMAZON_CRED for authenticated Amazon session'),
    }),

    // Get product details operation
    z.object({
      operation: z
        .literal('get_product')
        .describe('Get detailed information about a product'),
      product_url: z.string().min(1).describe('Amazon product URL or ASIN'),
      credentials: z
        .record(z.nativeEnum(CredentialType), z.string())
        .optional()
        .describe('Required: AMAZON_CRED for authenticated Amazon session'),
    }),

    // Screenshot operation
    z.object({
      operation: z
        .literal('screenshot')
        .describe(
          'Take a screenshot of the current page and upload to cloud storage'
        ),
      url: z
        .string()
        .url()
        .optional()
        .describe('Optional URL to navigate to before taking screenshot'),
      full_page: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether to capture the full scrollable page'),
      credentials: z
        .record(z.nativeEnum(CredentialType), z.string())
        .optional()
        .describe(
          'Required: AMAZON_CRED for browser session, CLOUDFLARE_R2_* for storage'
        ),
    }),
  ]
);

/**
 * Search result item
 */
export const SearchResultSchema = z.object({
  asin: z.string().describe('Amazon Standard Identification Number'),
  title: z.string().describe('Product title'),
  price: z.string().optional().describe('Product price'),
  rating: z.string().optional().describe('Product rating'),
  reviews_count: z.string().optional().describe('Number of reviews'),
  url: z.string().describe('Product URL'),
  image: z.string().optional().describe('Product image URL'),
  prime: z.boolean().optional().describe('Whether product has Prime delivery'),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Product details
 */
export const ProductDetailsSchema = z.object({
  asin: z.string().describe('Amazon Standard Identification Number'),
  title: z.string().describe('Product title'),
  price: z.string().optional().describe('Product price'),
  rating: z.string().optional().describe('Product rating'),
  reviews_count: z.string().optional().describe('Number of reviews'),
  description: z.string().optional().describe('Product description'),
  features: z
    .array(z.string())
    .optional()
    .describe('Product features/bullet points'),
  availability: z.string().optional().describe('Stock availability status'),
  url: z.string().describe('Product URL'),
  images: z.array(z.string()).optional().describe('Product image URLs'),
});

export type ProductDetails = z.infer<typeof ProductDetailsSchema>;

/**
 * Amazon Shopping Tool result schemas
 */
export const AmazonShoppingToolResultSchema = z.discriminatedUnion(
  'operation',
  [
    // Add to cart result
    z.object({
      operation: z.literal('add_to_cart'),
      success: z.boolean().describe('Whether the operation was successful'),
      message: z.string().optional().describe('Success or status message'),
      cart_count: z
        .number()
        .optional()
        .describe('Total items in cart after adding'),
      error: z.string().describe('Error message if operation failed'),
    }),

    // Get cart result
    z.object({
      operation: z.literal('get_cart'),
      success: z.boolean().describe('Whether the operation was successful'),
      items: z.array(CartItemSchema).optional().describe('Items in the cart'),
      subtotal: z.string().optional().describe('Cart subtotal'),
      total_items: z.number().optional().describe('Total number of items'),
      screenshot_url: z
        .string()
        .optional()
        .describe('URL to screenshot image of cart confirmation'),
      error: z.string().describe('Error message if operation failed'),
    }),

    // Checkout result
    z.object({
      operation: z.literal('checkout'),
      success: z.boolean().describe('Whether the operation was successful'),
      order_number: z.string().optional().describe('Order confirmation number'),
      estimated_delivery: z
        .string()
        .optional()
        .describe('Estimated delivery date'),
      total: z.string().optional().describe('Order total'),
      subtotal: z
        .string()
        .optional()
        .describe('Order subtotal before tax/shipping'),
      shipping_cost: z.string().optional().describe('Shipping cost'),
      tax: z.string().optional().describe('Tax amount'),
      shipping_address: z.string().optional().describe('Shipping address'),
      payment_method: z.string().optional().describe('Payment method used'),
      items: z
        .array(
          z.object({
            title: z.string().describe('Item title'),
            quantity: z.number().optional().describe('Quantity ordered'),
            price: z.string().optional().describe('Item price'),
          })
        )
        .optional()
        .describe('Items in the order'),
      screenshot_url: z
        .string()
        .optional()
        .describe('URL to screenshot image of order confirmation'),
      error: z.string().describe('Error message if operation failed'),
    }),

    // Search result
    z.object({
      operation: z.literal('search'),
      success: z.boolean().describe('Whether the operation was successful'),
      results: z
        .array(SearchResultSchema)
        .optional()
        .describe('Search results'),
      total_results: z
        .number()
        .optional()
        .describe('Total number of results found'),
      error: z.string().describe('Error message if operation failed'),
    }),

    // Get product result
    z.object({
      operation: z.literal('get_product'),
      success: z.boolean().describe('Whether the operation was successful'),
      product: ProductDetailsSchema.optional().describe('Product details'),
      error: z.string().describe('Error message if operation failed'),
    }),

    // Screenshot result
    z.object({
      operation: z.literal('screenshot'),
      success: z.boolean().describe('Whether the operation was successful'),
      screenshot_url: z
        .string()
        .optional()
        .describe('URL to the uploaded screenshot image'),
      error: z.string().describe('Error message if operation failed'),
    }),
  ]
);

// Type exports
export type AmazonShoppingToolParams = z.output<
  typeof AmazonShoppingToolParamsSchema
>;
export type AmazonShoppingToolParamsInput = z.input<
  typeof AmazonShoppingToolParamsSchema
>;
export type AmazonShoppingToolResult = z.output<
  typeof AmazonShoppingToolResultSchema
>;
