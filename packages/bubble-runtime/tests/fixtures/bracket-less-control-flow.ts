import { z } from 'zod';
import {
  BubbleFlow,
  GoogleDriveBubble,
  AIAgentBubble,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  processedFileId: string;
  processedFileName: string;
  totalEvents: number;
  businessEvents: number;
  possibleBusinessEvents: number;
  personalEvents: number;
  driveLink: string;
  emailSent: boolean;
}

export interface CalendarExpensePayload extends WebhookEvent {
  /**
   * Google Drive folder ID where your calendar CSV file is located.
   * Open the folder in Google Drive, the ID is the last part of the URL after /folders/
   * @canBeFile false
   */
  inputFolderId: string;
  /**
   * Exact filename of your calendar CSV file in Google Drive.
   * @canBeFile false
   */
  inputFileName: string;
  /**
   * Email address where the processed results should be sent.
   * @canBeFile false
   */
  recipientEmail: string;
  /**
   * Google Drive folder ID where the processed file should be saved.
   * Open the folder in Google Drive, the ID is the last part of the URL after /folders/
   * @canBeFile false
   */
  outputFolderId?: string;
  /**
   * Comma-separated list of column names in your CSV file. Defaults to standard calendar export columns.
   * @canBeFile false
   */
  csvColumns?: string;
}

interface CalendarEvent {
  [key: string]: string;
}

interface ClassificationResult {
  category: 'Business' | 'Possible' | 'Personal';
  reasoning?: string;
  businessActivity?: string;
}

// Handles CSV values that may contain commas within quotes
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  values.push(currentValue.trim());
  return values;
}

// Wraps CSV values in quotes if they contain commas, quotes, or newlines
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export class CalendarExpenseClassifier extends BubbleFlow<'webhook/http'> {
  // Locates the CSV file in the specified Google Drive folder by matching the filename
  private async findInputFile(folderId: string, fileName: string) {
    const listFiles = new GoogleDriveBubble({
      operation: 'list_files',
      folder_id: folderId,
      query: `name = '${fileName}'`,
      max_results: 1,
    });

    const result = await listFiles.action();

    if (!result.success) {
      throw new Error(`Failed to list files: ${result.error}`);
    }

    if (!result.data?.files || result.data.files.length === 0) {
      throw new Error(`File "${fileName}" not found in folder ${folderId}`);
    }

    return result.data.files[0];
  }

  // Downloads the CSV file content from Google Drive as plain text
  private async downloadFile(fileId: string) {
    const download = new GoogleDriveBubble({
      operation: 'download_file',
      file_id: fileId,
      export_format: 'text/csv',
    });

    const result = await download.action();

    if (!result.success) {
      throw new Error(`Failed to download file: ${result.error}`);
    }

    if (!result.data?.content) {
      throw new Error('Downloaded file has no content');
    }

    return result.data.content;
  }

  // Parses CSV text into an array of event objects using the provided column names
  private parseCSV(csvContent: string, columns: string[]): CalendarEvent[] {
    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      throw new Error(
        'CSV file must have at least a header row and one data row'
      );
    }

    const events: CalendarEvent[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      if (values.length !== columns.length) {
        this.logger?.info(
          `Warning: Row ${i + 1} has ${values.length} values but expected ${columns.length} columns. Skipping.`
        );
        continue;
      }

      const event: CalendarEvent = {};
      for (let j = 0; j < columns.length; j++) {
        event[columns[j]] = values[j];
      }
      events.push(event);
    }

    return events;
  }

  // Handles CSV values that may contain commas within quotes
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue.trim());
    return values;
  }

  // Analyzes a single calendar event using AI to determine if it qualifies as a business expense under Israeli tax law
  // Returns classification (Business/Possible/Personal), reasoning for vague cases, and business activity description
  private async classifyEvent(
    event: CalendarEvent,
    israeliTaxContext: string
  ): Promise<ClassificationResult> {
    const eventDetails = Object.entries(event)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const agent = new AIAgentBubble({
      model: {
        model: 'google/gemini-3-flash-preview',
        temperature: 0.3,
      },
      systemPrompt: `You are a tax classification expert specializing in Israeli tax law for self-employed individuals and small business owners.

Your task is to analyze calendar events and determine if they qualify as legitimate business expenses according to Israeli tax regulations.

ISRAELI TAX CONTEXT:
${israeliTaxContext}

CLASSIFICATION RULES:
1. "Business" - Clear business activity with direct connection to income generation:
   - Client meetings, consultations, or service delivery
   - Business development meetings
   - Professional conferences or training directly related to business
   - Supplier or vendor meetings
   - Business travel with clear purpose
   
2. "Possible" - Ambiguous cases that may qualify but need accountant review:
   - Mixed personal/business events (e.g., lunch with potential client)
   - Networking events that could lead to business
   - Events with vague descriptions that could be business-related
   - Professional development that's tangentially related
   
3. "Personal" - Clearly personal with no business connection:
   - Personal appointments (doctor, dentist, personal errands)
   - Social events with no business purpose
   - Personal reminders or notes
   - Family activities
   - Entertainment without business purpose

OUTPUT FORMAT:
Return a JSON object with:
- category: "Business" | "Possible" | "Personal"
- reasoning: (ONLY for "Possible" cases - explain what makes it ambiguous and what the accountant should consider)
- businessActivity: (ONLY for "Business" cases - brief description of the business activity, e.g., "Client consultation for web development project")

IMPORTANT:
- For "Personal" events, ONLY return {"category": "Personal"} - no reasoning or businessActivity
- Be conservative: when in doubt between Business and Possible, choose Possible
- Consider Israeli tax authority expectations for documentation and proof`,
      message: `Analyze this calendar event and classify it:\n\n${eventDetails}`,
      expectedOutputSchema: z.object({
        category: z.enum(['Business', 'Possible', 'Personal']),
        reasoning: z.string().optional(),
        businessActivity: z.string().optional(),
      }),
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`AI classification failed: ${result.error}`);
    }

    return JSON.parse(result.data.response);
  }

  // Converts the classified events array back to CSV format with new classification columns
  private formatResultsToCSV(
    results: (CalendarEvent & ClassificationResult)[],
    originalColumns: string[]
  ): string {
    const headers = [
      ...originalColumns,
      'Classification',
      'Business Activity',
      'Reasoning',
    ];
    const csvLines = [headers.join(',')];

    for (const result of results) {
      const row: string[] = [];

      for (const col of originalColumns) {
        const value = result[col] || '';
        row.push(escapeCSVValue(value));
      }

      row.push(escapeCSVValue(result.category));
      row.push(escapeCSVValue(result.businessActivity || ''));
      row.push(escapeCSVValue(result.reasoning || ''));

      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  // Generates a unique output filename using Unix timestamp to avoid overwriting previous results
  private generateOutputFileName(originalFileName: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const nameWithoutExt = originalFileName.replace(/\.csv$/i, '');
    return `${nameWithoutExt}_classified_${timestamp}.csv`;
  }

  // Uploads the processed CSV file to Google Drive in the specified output folder
  private async uploadResultsToDrive(
    csvContent: string,
    fileName: string,
    folderId: string
  ) {
    const upload = new GoogleDriveBubble({
      operation: 'upload_file',
      name: fileName,
      content: csvContent,
      mimeType: 'text/csv',
      parent_folder_id: folderId,
    });

    const result = await upload.action();

    if (!result.success) {
      throw new Error(`Failed to upload file to Drive: ${result.error}`);
    }

    return result.data?.file;
  }

  // Sends the processed CSV file as an email attachment to the specified recipient
  private async emailResults(
    csvContent: string,
    fileName: string,
    recipientEmail: string,
    stats: {
      total: number;
      business: number;
      possible: number;
      personal: number;
    }
  ) {
    const emailBody = `
<h2>Calendar Expense Classification Complete</h2>

<p>Your calendar events have been analyzed and classified according to Israeli tax regulations.</p>

<h3>Summary:</h3>
<ul>
  <li><strong>Total Events:</strong> ${stats.total}</li>
  <li><strong>Business Expenses:</strong> ${stats.business}</li>
  <li><strong>Possible Business Expenses:</strong> ${stats.possible} (requires accountant review)</li>
  <li><strong>Personal Events:</strong> ${stats.personal}</li>
</ul>

<p>The classified results are attached as a CSV file. Events marked as "Business" include a description of the business activity. Events marked as "Possible" include reasoning about what makes them ambiguous.</p>

<p><strong>Next Steps:</strong></p>
<ol>
  <li>Review the "Business" and "Possible" classifications</li>
  <li>Share this file with your accountant for final verification</li>
  <li>Your accountant can use the "Business Activity" and "Reasoning" columns to make final determinations</li>
</ol>

<p>Note: This classification is based on general Israeli tax principles. Your accountant should make the final determination based on your specific business circumstances.</p>
    `.trim();

    const send = new ResendBubble({
      operation: 'send_email',
      to: [recipientEmail],
      subject: `Calendar Expense Classification Results - ${stats.business} Business Events Found`,
      html: emailBody,
      attachments: [
        {
          filename: fileName,
          content: csvContent,
          content_type: 'text/csv',
        },
      ],
    });

    const result = await send.action();

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    return result.data?.email_id;
  }

  // Retrieves Israeli tax law context from web search results to inform AI classification decisions
  private buildIsraeliTaxContext(): string {
    return `
ISRAELI TAX LAW - BUSINESS EXPENSE RECOGNITION:

Key Principles for Self-Employed/Small Business Owners:
1. Expenses must be "ordinary and necessary" for business purposes
2. Mixed expenses (personal + business) may be partially deductible based on percentage of business use
3. Documentation is critical - receipts, invoices, and clear business purpose required
4. Israeli Tax Authority expects reasonable connection between expenses and income generation

Common Deductible Business Expenses:
- Client meetings and consultations
- Professional development directly related to business activities
- Business travel and transportation for business purposes
- Office expenses and supplies
- Professional services (legal, accounting, consulting)
- Marketing and business development activities
- Equipment and tools used for business

Red Flags (Likely NOT Deductible):
- Personal appointments (medical, personal errands)
- Social events without clear business purpose
- Entertainment without documented business connection
- Family activities
- Personal notes and reminders

Ambiguous Cases Requiring Documentation:
- Meals with clients (need proof of business discussion)
- Networking events (need connection to business development)
- Conferences/training (must be directly relevant to business)
- Mixed personal/business travel (only business portion deductible)

Source: Israeli Tax Authority guidelines for small business owners and self-employed individuals.
    `.trim();
  }

  async handle(payload: CalendarExpensePayload): Promise<Output> {
    const {
      inputFolderId,
      inputFileName,
      recipientEmail,
      outputFolderId = '1sws7xg0wIKYjVD8QGXhKA4a7dwchwWCx',
      csvColumns = 'event_id,calendar_name,unique_id,calendar_item_identifier,calendar_item_external_identifier,title,location,notes,url,conference_url,video_link_extracted,structured_location,start_datetime_iso,end_datetime_iso,timezone,occurrence_date_iso,availability_code,status_code,start_date,start_time,end_date,end_time,duration_hours,duration_seconds,duration_display,travel_time_seconds,travel_time_display,is_all_day,is_detached,is_floating,has_attendees,has_invitees,has_recurrence,has_alarms,recurrence_frequency,recurrence_frequency_code,recurrence_interval,recurrence_display,attendee_count,attendees_details,organizer,alarm_count,alarms_details,availability,event_status,priority,privacy_level_code,privacy_level,created_datetime_iso,modified_datetime_iso',
    } = payload;

    const columns = csvColumns.split(',').map((col) => col.trim());

    const inputFile = await this.findInputFile(inputFolderId, inputFileName);
    const csvContent = await this.downloadFile(inputFile.id);
    const events = this.parseCSV(csvContent, columns);

    this.logger?.info(`Found ${events.length} events to classify`);

    const israeliTaxContext = this.buildIsraeliTaxContext();
    const results: (CalendarEvent & ClassificationResult)[] = [];
    let businessCount = 0;
    let possibleCount = 0;
    let personalCount = 0;

    for (let i = 0; i < events.length; i++) {
      this.logger?.info(`Processing event ${i + 1} of ${events.length}...`);

      const classification = await this.classifyEvent(
        events[i],
        israeliTaxContext
      );

      results.push({
        ...events[i],
        ...classification,
      });

      if (classification.category === 'Business') businessCount++;
      else if (classification.category === 'Possible') possibleCount++;
      else personalCount++;
    }

    const outputCSV = this.formatResultsToCSV(results, columns);
    const outputFileName = this.generateOutputFileName(inputFileName);

    const uploadedFile = await this.uploadResultsToDrive(
      outputCSV,
      outputFileName,
      outputFolderId
    );

    await this.emailResults(outputCSV, outputFileName, recipientEmail, {
      total: events.length,
      business: businessCount,
      possible: possibleCount,
      personal: personalCount,
    });

    return {
      processedFileId: uploadedFile?.id || '',
      processedFileName: outputFileName,
      totalEvents: events.length,
      businessEvents: businessCount,
      possibleBusinessEvents: possibleCount,
      personalEvents: personalCount,
      driveLink: uploadedFile?.webViewLink || '',
      emailSent: true,
    };
  }
}
