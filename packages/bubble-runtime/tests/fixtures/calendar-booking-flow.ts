import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  GoogleCalendarBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  /** Friendly confirmation message for the user. */
  message: string;
  /** Whether the booking was successful. */
  success: boolean;
  /** The link to the created calendar event, if successful. */
  eventLink?: string;
}

export interface CalendarBookingPayload extends WebhookEvent {
  /**
   * The natural language request to book an appointment.
   * Example: "Book a meeting with john@example.com for next Friday at 2pm"
   * @canBeFile true
   */
  bookingRequest?: string;
}

export class CalendarBookingFlow extends BubbleFlow<'webhook/http'> {
  /**
   * Uses an AI agent to parse the natural language request and book the appointment using a custom tool.
   * The agent identifies the meeting details and calls the Google Calendar bubble to create the event.
   */
  private async bookAppointmentWithAI(request: string) {
    const now = new Date().toISOString();

    // Configures an AI agent with a custom tool to handle the Google Calendar booking process.
    // The agent uses gemini-3-pro-preview for reliable tool calling and complex reasoning.
    // It is provided with the current timestamp to accurately resolve relative dates like "tomorrow" or "next Friday".
    const agent = new AIAgentBubble({
      model: {
        model: 'google/gemini-3-pro-preview',
        temperature: 0.1, // Low temperature for deterministic tool calling
      },
      systemPrompt: `You are a calendar booking assistant.
      The current time is ${now}.
      Parse the user's request and use the 'book_calendar_event' tool to create the appointment.
      If the user doesn't specify an end time, assume the meeting lasts 1 hour.
      If the user doesn't specify a timezone, assume UTC.
      Always confirm the details back to the user after booking.`,
      message: request,
      customTools: [
        {
          name: 'book_calendar_event',
          description:
            "Creates a new event in the user's primary Google Calendar.",
          schema: z.object({
            summary: z.string().describe('The title of the meeting'),
            description: z
              .string()
              .optional()
              .describe('A brief description of the meeting'),
            startTime: z
              .string()
              .describe(
                'The start time in RFC3339 format (e.g., 2025-09-10T10:00:00Z)'
              ),
            endTime: z
              .string()
              .describe(
                'The end time in RFC3339 format (e.g., 2025-09-10T11:00:00Z)'
              ),
            attendees: z
              .array(z.string())
              .optional()
              .describe('List of attendee email addresses'),
          }),
          func: async (input: Record<string, unknown>) => {
            const data = input as {
              summary: string;
              description?: string;
              startTime: string;
              endTime: string;
              attendees?: string[];
            };
            // Instantiates the Google Calendar bubble to perform the 'create_event' operation.
            // It maps the parsed AI data to the bubble's expected input structure, including start/end times and attendees.
            const calendar = new GoogleCalendarBubble({
              operation: 'create_event',
              calendar_id: 'primary',
              summary: data.summary,
              description: data.description,
              start: { dateTime: data.startTime },
              end: { dateTime: data.endTime },
              attendees: data.attendees?.map((email) => ({ email })),
              conference: true, // Automatically add a Google Meet link
            });

            const result = await calendar.action();

            if (!result.success) {
              return { success: false, error: result.error };
            }

            return {
              success: true,
              eventLink: result.data?.event?.htmlLink,
              eventId: result.data?.event?.id,
            };
          },
        },
      ],
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`AI Agent failed: ${result.error}`);
    }

    return result.data;
  }

  /**
   * Orchestrates the calendar booking workflow by calling the AI parsing and booking method.
   */
  async handle(payload: CalendarBookingPayload): Promise<Output> {
    const {
      bookingRequest = 'Book a meeting with test@example.com tomorrow at 10am',
    } = payload;

    const agentResult = await this.bookAppointmentWithAI(bookingRequest);

    // Extract the event link from the tool calls if available
    const bookingToolCall = agentResult.toolCalls?.find(
      (call) => call.tool === 'book_calendar_event'
    );
    const toolOutput = bookingToolCall?.output as
      | { success: boolean; eventLink?: string; error?: string }
      | undefined;

    return {
      message: agentResult.response,
      success: toolOutput?.success ?? false,
      eventLink: toolOutput?.eventLink,
    };
  }
}
