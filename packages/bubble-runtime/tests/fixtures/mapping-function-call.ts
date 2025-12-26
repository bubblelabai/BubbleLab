import { z } from 'zod';
import {
  BubbleFlow,
  ResearchAgentTool,
  AIAgentBubble,
  ResendBubble,
  GoogleDriveBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface IndustryInnovationResearchPayload extends WebhookEvent {
  /**
   * The email address where the final report should be sent.
   * @canBeFile false
   */
  recipientEmail: string;

  /**
   * List of industries to research.
   * Defaults to ['Healthcare', 'Logistics', 'Manufacturing', 'Fintech'] if not provided.
   * @canBeFile false
   */
  industries?: string[];

  /**
   * Whether to save the generated report to Google Drive.
   * Defaults to false.
   */
  saveToDrive?: boolean;

  /**
   * The Google Drive folder ID where the report should be saved.
   * Required if saveToDrive is true.
   * @canBeFile false
   */
  driveFolderId?: string;
}

export interface Output {
  message: string;
  reportSentTo: string;
  savedToDrive: boolean;
  driveFileId?: string;
}

export class IndustryInnovationResearchFlow extends BubbleFlow<'webhook/http'> {
  // Validates and normalizes the list of industries to research
  private getTargetIndustries(industries?: string[]): string[] {
    if (!industries || industries.length === 0) {
      return ['Healthcare', 'Logistics', 'Manufacturing', 'Fintech'];
    }
    return industries;
  }

  // Performs deep research on a specific industry using the Research Agent
  // Returns structured data including innovations, trends, and sources
  private async performIndustryResearch(industry: string): Promise<any> {
    const taskDescription =
      `Research recent innovations, AI applications, case studies, and articles in the ${industry} industry. ` +
      `Focus on finding specific examples, source dates, and references. Look for major trends and how AI is driving innovation.`;

    const researchTool = new ResearchAgentTool({
      task: taskDescription,
      model: 'google/gemini-3-pro-preview',
      expectedResultSchema: z.object({
        industry: z.string().describe('The name of the industry'),
        innovations: z
          .array(
            z.object({
              title: z
                .string()
                .describe('Title of the innovation or case study'),
              description: z
                .string()
                .describe(
                  'Detailed description of the innovation and its impact'
                ),
              aiApplication: z
                .string()
                .describe('How AI is specifically applied in this instance'),
              source: z.string().describe('URL or name of the source'),
              date: z
                .string()
                .describe('Date of the article or innovation announcement'),
            })
          )
          .describe('List of specific innovations and case studies'),
        summary: z
          .string()
          .describe(
            'A high-level summary of the state of innovation in this industry'
          ),
      }),
    });

    const result = await researchTool.action();

    if (!result.success) {
      // Log error but return a partial result so the whole flow doesn't fail
      const errorMsg = `Research failed for ${industry}: ${result.error}`;
      console.error(errorMsg);
      return {
        industry,
        error: result.error,
        innovations: [],
        summary: 'Research failed.',
      };
    }

    return result.data.result;
  }

  // Synthesizes all research findings into a comprehensive HTML report using an AI Agent
  private async generateHtmlReport(researchResults: any[]): Promise<string> {
    const context = JSON.stringify(researchResults, null, 2);

    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt: `You are an expert industry analyst. Your goal is to synthesize research findings into a professional, well-structured HTML report.
                     The report should be visually appealing with clear headings, bullet points, and sections for each industry.
                     Include an Executive Summary at the beginning.
                     Ensure all sources and dates are cited properly.
                     Use inline CSS for styling to ensure it renders well in email clients.`,
      message: `Create a comprehensive innovation report based on the following research data:\n\n${context}`,
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`Report generation failed: ${result.error}`);
    }

    return result.data.response;
  }

  // Sends the generated HTML report to the recipient via email
  private async sendReportEmail(
    recipient: string,
    htmlContent: string
  ): Promise<string> {
    const emailer = new ResendBubble({
      operation: 'send_email',
      to: [recipient],
      subject: 'Industry Innovation & AI Research Report',
      html: htmlContent,
    });

    const result = await emailer.action();

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    return result.data.email_id || 'unknown-id';
  }

  // Saves the HTML report as a file to a specific Google Drive folder
  // Condition: Only runs if saveToDrive is true and a folder ID is provided
  private async saveReportToDrive(
    htmlContent: string,
    folderId: string
  ): Promise<string> {
    const uploader = new GoogleDriveBubble({
      operation: 'upload_file',
      name: `Innovation_Report_${new Date().toISOString().split('T')[0]}.html`,
      content: htmlContent,
      mimeType: 'text/html',
      parent_folder_id: folderId,
    });

    const result = await uploader.action();

    if (!result.success) {
      throw new Error(`Failed to save to Google Drive: ${result.error}`);
    }

    return result.data.file?.id || 'unknown-file-id';
  }

  // Main workflow orchestration
  async handle(payload: IndustryInnovationResearchPayload): Promise<Output> {
    const {
      recipientEmail,
      industries,
      saveToDrive = false,
      driveFolderId,
    } = payload;

    // 1. Setup and Validation
    const targetIndustries = this.getTargetIndustries(industries);

    // 2. Conduct Research (Parallel execution for efficiency)
    // We map each industry to a research promise and wait for all to complete
    const researchPromises = targetIndustries.map((industry) =>
      this.performIndustryResearch(industry)
    );
    const researchResults = await Promise.all(researchPromises);

    // 3. Synthesize Report
    const htmlReport = await this.generateHtmlReport(researchResults);

    // 4. Deliver Report via Email
    await this.sendReportEmail(recipientEmail, htmlReport);

    // 5. Save to Drive (Optional)
    let driveFileId: string | undefined;
    if (saveToDrive && driveFolderId) {
      driveFileId = await this.saveReportToDrive(htmlReport, driveFolderId);
    }

    return {
      message: 'Research completed and report delivered successfully.',
      reportSentTo: recipientEmail,
      savedToDrive: !!driveFileId,
      driveFileId,
    };
  }
}
