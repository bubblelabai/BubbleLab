import {
  BubbleFlow,
  AIAgentBubble,
  type WebhookEvent,
  StripeBubble,
} from '@bubblelab/bubble-core';
import { z } from 'zod';

export interface Output {
  response: string;
}

export interface CustomWebhookPayload extends WebhookEvent {
  /**
   * The question or prompt to send to the AI agent.
   * @canBeFile false
   */
  query?: string;
}

export class UntitledFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { query = 'What is the top news headline?' } = payload;

    const response = await this.askAIAgent(query);

    return { response };
  }

  // Sends the user query to an AI agent with web search capability and returns the response
  private async askAIAgent(query: string) {
    const agent = new AIAgentBubble({
      message: query,
      systemPrompt: 'You are a helpful assistant.',
      tools: [
        {
          name: 'web-search-tool',
          config: {
            limit: 1,
          },
        },
      ],
      customTools: [
        {
          name: 'stripe-create-invoice',
          description: 'Create a new invoice for a customer',
          schema: z.object({
            customer: z
              .string()
              .min(1)
              .describe('ID of the customer to invoice'),
            auto_advance: z
              .boolean()
              .describe('Whether to auto-finalize the invoice')
              .default(true),
            collection_method: z
              .enum(['charge_automatically', 'send_invoice'])
              .describe('How to collect payment')
              .default('charge_automatically'),
            days_until_due: z
              .number()
              .int()
              .gte(1)
              .describe(
                'Days until invoice is due (for send_invoice collection)'
              )
              .optional(),
            items: z
              .array(
                z
                  .object({
                    unit_amount: z
                      .number()
                      .int()
                      .gte(1)
                      .describe(
                        'Unit price in smallest currency unit (e.g., cents). Total = unit_amount * quantity'
                      ),
                    description: z
                      .string()
                      .describe('Description of the line item')
                      .optional(),
                    quantity: z
                      .number()
                      .int()
                      .gte(1)
                      .describe('Quantity of items (default: 1)')
                      .default(1),
                  })
                  .strict()
              )
              .describe(
                'Line items to add to the invoice after creation. Each item will be created as an invoice item.'
              )
              .optional(),
            metadata: z
              .record(z.string())
              .describe('Arbitrary metadata to attach to the invoice')
              .optional(),
          }),
          func: async (params) => {
            const bubble = new StripeBubble({
              operation: 'create_invoice',
              ...params,
            } as any);

            const result = await bubble.action();

            if (!result.success) {
              return {
                success: false,
                message: `Failed: ${result.error}`,
              };
            }

            return {
              success: true,
              message: 'create invoice completed successfully',
              data: JSON.stringify(result.data),
            };
          },
        },
        {
          name: 'stripe-list-invoices',
          description: 'List invoices from Stripe',
          schema: z.object({
            limit: z
              .number()
              .int()
              .gte(1)
              .lte(100)
              .describe('Maximum number of invoices to return (1-100)')
              .default(10),
            customer: z.string().describe('Filter by customer ID').optional(),
            status: z
              .enum(['draft', 'open', 'paid', 'uncollectible', 'void'])
              .describe('Filter by invoice status')
              .optional(),
          }),
          func: async (params) => {
            const bubble = new StripeBubble({
              operation: 'list_invoices',
              ...params,
            } as any);

            const result = await bubble.action();

            if (!result.success) {
              return {
                success: false,
                message: `Failed: ${result.error}`,
              };
            }

            return {
              success: true,
              message: 'list invoices completed successfully',
              data: JSON.stringify(result.data),
            };
          },
        },
        {
          name: 'stripe-retrieve-invoice',
          description: 'Retrieve a specific invoice by ID',
          schema: z.object({
            invoice_id: z
              .string()
              .min(1)
              .describe('ID of the invoice to retrieve'),
          }),
          func: async (params) => {
            const bubble = new StripeBubble({
              operation: 'retrieve_invoice',
              ...params,
            } as any);

            const result = await bubble.action();

            if (!result.success) {
              return {
                success: false,
                message: `Failed: ${result.error}`,
              };
            }

            return {
              success: true,
              message: 'retrieve invoice completed successfully',
              data: JSON.stringify(result.data),
            };
          },
        },
        {
          name: 'stripe-finalize-invoice',
          description: 'Finalize a draft invoice to make it ready for payment',
          schema: z.object({
            invoice_id: z
              .string()
              .min(1)
              .describe('ID of the draft invoice to finalize'),
            auto_advance: z
              .boolean()
              .describe(
                'Whether to automatically advance the invoice after finalizing'
              )
              .optional(),
          }),
          func: async (params) => {
            const bubble = new StripeBubble({
              operation: 'finalize_invoice',
              ...params,
            } as any);

            const result = await bubble.action();

            if (!result.success) {
              return {
                success: false,
                message: `Failed: ${result.error}`,
              };
            }

            return {
              success: true,
              message: 'finalize invoice completed successfully',
              data: JSON.stringify(result.data),
            };
          },
        },
      ],
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`AI Agent failed: ${result.error}`);
    }

    return result.data.response;
  }
}
