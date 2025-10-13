import {
  // Base classes
  BubbleFlow,

  // Types and utilities
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  eventsExist: boolean;
  count: number;
  events?: any[];
}

// Define your custom input interface

export class CalendarEventChecker extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    // STEP 1: Generate mock CSV data to simulate 100,000 rows from spreadsheet
    this.logger?.info('Generating mock CSV data for 100,000 events');

    // Generate mock CSV data programmatically
    const generateMockCSV = (rowCount: number): string => {
      const header =
        '"Event Name","Date","Start Time","End Time","Location","Description","Category","Organizer","Capacity","Status"';
      const rows: string[] = [header];

      const categories = [
        'Workshop',
        'Keynote',
        'Panel Discussion',
        'Networking',
        'Hackathon',
        'Demo Day',
      ];
      const locations = [
        'Main Hall',
        'Room A',
        'Room B',
        'Virtual',
        'Auditorium',
        'Outdoor Space',
      ];
      const statuses = ['Confirmed', 'Pending', 'Cancelled'];

      for (let i = 1; i <= rowCount; i++) {
        const eventNum = i;
        const eventName = `TechWeek Event ${eventNum}`;
        const date = `2025-10-${(i % 28) + 1}`; // Cycle through days of October
        const startHour = 9 + (i % 12); // 9 AM to 8 PM
        const startTime = `${startHour.toString().padStart(2, '0')}:00`;
        const endTime = `${(startHour + 1).toString().padStart(2, '0')}:00`;
        const location = locations[i % locations.length];
        const description = `This is a detailed description for event ${eventNum}. It covers various topics in technology and innovation.`;
        const category = categories[i % categories.length];
        const organizer = `Organizer ${(i % 50) + 1}`;
        const capacity = ((i % 10) + 1) * 50; // 50 to 500
        const status = statuses[i % statuses.length];

        const row = `"${eventName}","${date}","${startTime}","${endTime}","${location}","${description}","${category}","${organizer}",${capacity},"${status}"`;
        rows.push(row);
      }

      return rows.join('\n');
    };

    const csvText = generateMockCSV(100000);
    this.logger?.info(
      `Generated mock CSV data with 100,000 rows, length: ${csvText.length} characters`
    );

    // Simple CSV parser for Google Sheets export
    const parseCSVRow = (row: string): string[] => {
      const fields: string[] = [];
      let currentField = '';
      let insideQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (char === '"') {
          if (insideQuotes && row[i + 1] === '"') {
            currentField += '"';
            i++; // Skip escaped quote
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());
      return fields;
    };

    const rows = csvText
      .split('\n')
      .map((row) => row.trim())
      .filter((row) => row.length > 0)
      .map(parseCSVRow);

    this.logger?.info(`Parsed ${rows.length} rows from CSV (including header)`);

    if (rows.length < 2) {
      throw new Error(
        `Sheet has insufficient data. Only ${rows.length} rows found.`
      );
    }

    // Extract headers and data rows
    const headers = rows[0];
    const dataRows = rows.slice(1);

    this.logger?.info(`Processing ${dataRows.length} event rows`);

    // Convert rows to event objects (sample first 100 for the return value to avoid memory issues)
    const sampleEvents = dataRows.slice(0, 100).map((row, index) => ({
      id: index + 1,
      eventName: row[0],
      date: row[1],
      startTime: row[2],
      endTime: row[3],
      location: row[4],
      description: row[5],
      category: row[6],
      organizer: row[7],
      capacity: parseInt(row[8]) || 0,
      status: row[9],
    }));

    return {
      eventsExist: dataRows.length > 0,
      count: dataRows.length,
      events: sampleEvents, // Only return first 100 to avoid memory issues
    };
  }
}
