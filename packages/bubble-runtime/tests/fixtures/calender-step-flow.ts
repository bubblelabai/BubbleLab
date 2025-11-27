import { z } from 'zod';
import {
  BubbleFlow,
  GoogleCalendarBubble,
  AIAgentBubble,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  eventCount: number;
  emailSentTo: string;
}

export interface CalendarSummaryPayload extends WebhookEvent {
  /** Email address where the summary should be sent. */
  email: string;

  /** The ID of the calendar to read. Defaults to 'primary'. */
  calendarId?: string;

  /** How many hours ahead to look for events. Defaults to 24. */
  lookAheadHours?: number;
}

export class CalendarSummaryFlow extends BubbleFlow<'webhook/http'> {
  // Transformation Step: Calculate time range for the calendar query
  private calculateTimeRange(hours: number): {
    timeMin: string;
    timeMax: string;
  } {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return {
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
    };
  }

  // Bubble Step: Fetch events from Google Calendar
  private async fetchEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string
  ): Promise<any[]> {
    // Lists events within the specified time range, expanding recurring events into single instances
    // and sorting them by start time so the summary is chronological.
    const calendarBubble = new GoogleCalendarBubble({
      operation: 'list_events',
      calendar_id: calendarId,
      time_min: timeMin,
      time_max: timeMax,
      single_events: true,
      order_by: 'startTime',
      max_results: 50, // Reasonable limit for a summary
    });

    const result = await calendarBubble.action();

    if (!result.success) {
      throw new Error(`Failed to fetch calendar events: ${result.error}`);
    }

    return result.data?.events || [];
  }

  // Bubble Step: Generate a summary using AI
  private async generateSummary(events: any[]): Promise<string> {
    if (events.length === 0) {
      return '<p>No events found for the specified time range.</p>';
    }

    const eventsJson = JSON.stringify(
      events.map((e: any) => ({
        summary: e.summary,
        start: e.start,
        end: e.end,
        description: e.description,
        location: e.location,
        status: e.status,
      }))
    );

    // Uses a fast AI model to process the raw JSON event data and turn it into a clean,
    // readable HTML email body. The prompt ensures the output is formatted as a list
    // with times and details.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt:
        'You are a helpful personal assistant. Your task is to format calendar events into a clean, professional HTML email summary.',
      message: `Here are the calendar events for the upcoming period in JSON format:\n${eventsJson}\n\nPlease create a concise HTML summary of these events. Use <ul> and <li> tags for the list. Bold the event titles and include the time range for each. If there is a location or description, include it briefly. Do not include the JSON in the output, just the HTML content for the email body.`,
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`AI Agent failed to summarize events: ${result.error}`);
    }

    return result.data.response;
  }

  // Bubble Step: Send the summary via email
  private async sendEmail(to: string, htmlContent: string): Promise<void> {
    // Sends the generated HTML summary to the user's email address.
    // The 'from' address is automatically handled by the system.
    const emailBubble = new ResendBubble({
      operation: 'send_email',
      to: [to],
      subject: 'Your Calendar Summary',
      html: htmlContent,
    });

    const result = await emailBubble.action();

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }
  }

  async handle(payload: CalendarSummaryPayload): Promise<Output> {
    // Destructure with default values
    const { email, calendarId = 'primary', lookAheadHours = 24 } = payload;

    // Step 1: Calculate time range
    const { timeMin, timeMax } = this.calculateTimeRange(lookAheadHours);

    // Step 2: Fetch events
    const events = await this.fetchEvents(calendarId, timeMin, timeMax);

    // Step 3: Generate summary
    const summaryHtml = await this.generateSummary(events);

    // Step 4: Send email
    await this.sendEmail(email, summaryHtml);

    return {
      message: 'Calendar summary sent successfully',
      eventCount: events.length,
      emailSentTo: email,
    };
  }
}
