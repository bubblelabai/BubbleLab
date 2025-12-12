import { z } from 'zod';
import {
  BubbleFlow,
  ResearchAgentTool,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  processed: boolean;
}

export interface ShoeResearchPayload extends WebhookEvent {
  /** Email address where the research results should be sent. */
  email: string;
  /** Type of shoes to look for (e.g., "running shoes", "dress shoes"). Default: "running shoes" */
  shoeType?: string;
  /** Gender for the shoe search (e.g., "men", "women", "unisex"). Default: "unisex" */
  gender?: string;
}

export class FindBestShoesFlow extends BubbleFlow<'webhook/http'> {
  // Validates the email address format
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Generates the research task string based on user inputs
  private createResearchTask(shoeType: string, gender: string): string {
    return `Find the best ${gender} ${shoeType} available in 2024/2025. Look for top-rated reviews from reputable sources like Runner's World, TechRadar, or major fashion blogs. Identify the top 5 options with their pros, cons, and price points.`;
  }

  // Uses the Research Agent to find the best shoes from the web
  // Condition: Always runs to gather data
  private async findShoes(task: string): Promise<any> {
    // Searches for the best shoes based on the generated task, extracting structured data including top picks and an overall verdict.
    // Using google/gemini-3-pro-preview for deep research capabilities to analyze multiple review sites.
    const researchTool = new ResearchAgentTool({
      task: task,
      model: 'google/gemini-3-pro-preview',
      expectedResultSchema: z.object({
        topPicks: z
          .array(
            z.object({
              name: z.string().describe('Name of the shoe model'),
              brand: z.string().describe('Brand of the shoe'),
              price: z.string().describe('Approximate price'),
              reason: z.string().describe('Why it is a top pick'),
              url: z
                .string()
                .optional()
                .describe('URL to the product or review'),
            })
          )
          .describe('List of top 5 best shoes found'),
        overallVerdict: z
          .string()
          .describe(
            'A detailed summary of the findings and final recommendations'
          ),
      }),
    });

    const result = await researchTool.action();

    if (!result.success) {
      throw new Error(`Research failed: ${result.error}`);
    }

    return result.data.result;
  }

  // Formats the research results into an HTML email body
  private formatEmailContent(data: any, shoeType: string): string {
    const { topPicks, overallVerdict } = data;

    let html = `<h1>Best ${shoeType} Recommendations</h1>`;
    html += `<p>${overallVerdict}</p>`;
    html += `<h2>Top Picks:</h2><ul>`;

    if (Array.isArray(topPicks)) {
      topPicks.forEach((shoe: any) => {
        html += `<li>
          <strong>${shoe.brand} ${shoe.name}</strong> (${shoe.price})<br/>
          <em>${shoe.reason}</em><br/>
          ${shoe.url ? `<a href="${shoe.url}">View Details</a>` : ''}
        </li><br/>`;
      });
    }

    html += `</ul>`;
    html += `<p><small>Research conducted by BubbleFlow AI Agent.</small></p>`;

    return html;
  }

  // Sends the formatted research results via email
  // Condition: Runs only if research was successful and email is valid
  private async sendEmail(
    recipient: string,
    subject: string,
    htmlContent: string
  ): Promise<void> {
    // Sends the HTML formatted research report to the user's email address.
    // The 'from' address is automatically handled by the system default.
    const emailer = new ResendBubble({
      operation: 'send_email',
      to: [recipient],
      subject: subject,
      html: htmlContent,
    });

    const result = await emailer.action();

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }
  }

  async handle(payload: ShoeResearchPayload): Promise<Output> {
    // Destructure with default values
    const { email, shoeType = 'running shoes', gender = 'unisex' } = payload;

    if (!email || !this.validateEmail(email)) {
      throw new Error('A valid email address is required.');
    }

    const task = this.createResearchTask(shoeType, gender);

    // Perform the research
    const researchData = await this.findShoes(task);

    // Format the email
    const emailHtml = this.formatEmailContent(researchData, shoeType);

    // Send the email
    await this.sendEmail(
      email,
      `Your Research Results: Best ${shoeType}`,
      emailHtml
    );

    return {
      message: `Research completed and email sent to ${email}`,
      processed: true,
    };
  }
}
