import { z } from 'zod';
import {
  BubbleFlow,
  ResearchAgentTool,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface WeatherResearchPayload extends WebhookEvent {
  /** The state or region to research weather records for. */
  state?: string;

  /** Number of years to look back for records. */
  yearsCount?: number;

  /** Email address to send the research results to. */
  recipientEmail?: string;
}

export interface WeatherRecord {
  year: number;
  temperatureCelsius: number;
  date: string;
  district: string;
  reason: string;
}

export interface Output {
  records: WeatherRecord[];
  summary: string;
  emailSent: boolean;
}

export class KarnatakaWeatherFlow extends BubbleFlow<'webhook/http'> {
  // Performs deep research to find lowest temperature records for the specified state and years
  private async performResearch(
    state: string,
    yearsCount: number
  ): Promise<{ records: WeatherRecord[]; summary: string }> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - yearsCount + 1; // e.g., 2025 - 5 + 1 = 2021..2025 (5 years)
    // Actually user said "last 5 years... including this year". So 2021, 22, 23, 24, 25.

    // Searches for lowest temperature records in the specified state for each year in the range
    // Using gemini-3-pro-preview for its superior research and reasoning capabilities to find specific historical data
    // Returns a structured list of records containing temperature, date, district, and reason
    const researchTool = new ResearchAgentTool({
      task: `Find the lowest temperature recorded in ${state} for each of the last ${yearsCount} years (from ${startYear} to ${currentYear}). 
             For each year, identify:
             1. The lowest temperature in Celsius
             2. The specific date it was recorded
             3. The district name
             4. The reason for this low temperature (e.g., cold wave, storm, altitude)
             Ensure you have one record for EACH year. If exact lowest is not clear, find the most prominent cold record reported in news.`,
      model: 'google/gemini-3-pro-preview',
      expectedResultSchema: z.object({
        records: z
          .array(
            z.object({
              year: z.number().describe('The year of the record'),
              temperatureCelsius: z
                .number()
                .describe('The lowest temperature recorded in Celsius'),
              date: z
                .string()
                .describe(
                  'The specific date when this lowest temperature was recorded'
                ),
              district: z.string().describe('The name of the district'),
              reason: z.string().describe('The reason for the lowest record'),
            })
          )
          .describe(
            `List of lowest temperature records for the last ${yearsCount} years`
          ),
        summary: z
          .string()
          .describe(
            'A brief summary of the temperature trends observed over these years'
          ),
      }),
    });

    const result = await researchTool.action();

    if (!result.success || !result.data) {
      throw new Error(`Research failed: ${result.error}`);
    }

    // The result.data.result is typed as unknown in the tool definition, but we know it matches our schema
    // We need to cast or validate it. The tool already validates it against the schema.
    const data = result.data.result as {
      records: WeatherRecord[];
      summary: string;
    };

    return data;
  }

  // Formats the research results into a readable HTML email body
  private formatEmailContent(
    state: string,
    data: { records: WeatherRecord[]; summary: string }
  ): string {
    const rows = data.records
      .map(
        (r) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${r.year}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${r.temperatureCelsius}°C</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${r.date}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${r.district}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${r.reason}</td>
      </tr>
    `
      )
      .join('');

    return `
      <h2>Lowest Temperature Records in ${state} (Last 5 Years)</h2>
      <p><strong>Summary:</strong> ${data.summary}</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Year</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Temp</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Date</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">District</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Reason</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  // Sends the formatted research results via email
  // Condition: Only runs if a recipient email is provided
  private async sendResultsEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    // Sends the email using Bubble Lab's default sender since no custom domain is configured
    // The 'from' parameter is omitted to use the system default
    const emailer = new ResendBubble({
      operation: 'send_email',
      to,
      subject,
      html,
    });

    const result = await emailer.action();

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }
  }

  async handle(payload: WeatherResearchPayload): Promise<Output> {
    const { state = 'Karnataka', yearsCount = 5, recipientEmail } = payload;

    const researchData = await this.performResearch(state, yearsCount);

    let emailSent = false;
    if (recipientEmail) {
      const emailHtml = this.formatEmailContent(state, researchData);
      await this.sendResultsEmail(
        recipientEmail,
        `Lowest Temperature Records for ${state}`,
        emailHtml
      );
      emailSent = true;
    } else {
      // Log info if no email provided, as per instructions to use logger if output location unknown
      this.logger?.info(
        `Research completed for ${state}. No email provided. Summary: ${researchData.summary}`
      );
    }

    return {
      records: researchData.records,
      summary: researchData.summary,
      emailSent,
    };
  }
}
