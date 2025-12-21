import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  GoogleSheetsBubble,
  GoogleCalendarBubble,
  TelegramBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface DentalClinicOutput {
  /** The final response from the AI assistant. */
  response: string;
  /** Whether the request was processed successfully. */
  success: boolean;
}

export interface DentalClinicPayload extends WebhookEvent {
  /**
   * The message or inquiry from the patient.
   * @canBeFile true
   */
  message: string;

  /**
   * Telegram Chat ID to send the response back to.
   * Right-click a message in the chat and select "Copy Link" or use a bot like @userinfobot to find it.
   * @canBeFile false
   */
  chatId?: string;

  /**
   * The Google Sheets spreadsheet ID where appointments are recorded.
   * Found in the URL: docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   * @canBeFile false
   */
  spreadsheetId: string;

  /**
   * The Google Calendar ID for checking availability and booking.
   * Usually your email address or found in Calendar Settings -> Integrate calendar.
   * @canBeFile false
   */
  calendarId: string;

  /**
   * The name of the sheet within the spreadsheet to use.
   * Defaults to 'Appointments' if not provided.
   * @canBeFile false
   */
  sheetName?: string;
}

export class DentalClinicFlow extends BubbleFlow<'webhook/http'> {
  /**
   * Orchestrates the dental clinic assistant logic by defining tools and running the AI agent.
   */
  private async runDentalAssistant(
    message: string,
    spreadsheetId: string,
    calendarId: string,
    sheetName: string = 'Appointments'
  ) {
    const now = new Date().toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
    });

    // Defines the core AI agent that acts as a front-desk assistant for the dental clinic.
    // It uses custom tools to check calendar availability, book appointments, and record data in sheets.
    // The system prompt is configured to maintain a professional, friendly KL-based clinic persona.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-3-pro-preview' },
      message: message,
      systemPrompt: `
# Role
Act as a front-desk assistant for a dental clinic located in Kuala Lumpur (KLCC), specializing in managing patient inquiries, scheduling appointments, and handling bookings through Google Sheets and Google Calendar.

# Task
- Collect customer information for their inquiry, including name, phone number, and email.
- Schedule appointments based on availability in Google Calendar, ensuring to offer alternative slots if the requested time is unavailable.
- Use Google Sheets to record confirmed appointments accurately.
- Redirect medical or diagnosis-related questions to licensed professionals, emphasizing the need to consult with a dentist during their appointment.

## Specifics
- Confirm available slots before booking and suggest the nearest available time if the requested slot is taken.
- Politely gather all necessary details for booking: name, phone, email, and service type.
- If a user is unsure about the service they need, suggest starting with a Dental Checkup.
- Remind users of the clinic's operating hours and services offered when necessary.
- Do not provide medical advice or imply diagnosis; instead, encourage consultation with a dentist.
- Ask the user how can you help them first. Ask if they need to make an appointment.

# Tools
1. **checkAvailability** — To check for appointment availability in Google Calendar.
2. **bookAppointment** — To create a new appointment in Google Calendar AND record it in Google Sheets.
3. **getAppointmentData** — To retrieve existing appointment information from Google Sheets.

# Notes
- **Tone:** Maintain a friendly, calm, and professional demeanor throughout interactions, mirroring a helpful clinic receptionist.
- **Style:** Be polite and conversational, using simple language to ensure clarity and ease of understanding for all patients.
- **Behavior to Avoid:** Never provide or imply medical advice. Avoid overly technical or robotic phrasing and ensure the conversation flows smoothly, prioritizing a human-like interaction.
- **Confirmation and Clarification:** Always confirm details clearly before proceeding with bookings and clarify any uncertainties by asking for more information or redirecting to clinic professionals.
- Current time in Kuala Lumpur: ${now}
- Keep messages short and sweet.
- Only create the event when you have all the information (Name, phone, email, date and time of appointment and services requested).
      `,
      customTools: [
        {
          name: 'checkAvailability',
          description:
            'Checks for existing events in the Google Calendar within a specific time range to determine availability.',
          schema: z.object({
            timeMin: z.string().describe('Lower bound (RFC3339 timestamp)'),
            timeMax: z.string().describe('Upper bound (RFC3339 timestamp)'),
          }),
          func: async (input: Record<string, unknown>) => {
            const { timeMin, timeMax } = input as {
              timeMin: string;
              timeMax: string;
            };
            // Lists events from the specified Google Calendar to check for scheduling conflicts.
            const result = await new GoogleCalendarBubble({
              operation: 'list_events',
              calendar_id: calendarId,
              time_min: timeMin,
              time_max: timeMax,
              single_events: true,
            }).action();
            return result.data;
          },
        },
        {
          name: 'bookAppointment',
          description:
            'Creates a calendar event and appends the appointment details to a Google Sheet.',
          schema: z.object({
            name: z.string(),
            phone: z.string(),
            email: z.string(),
            serviceType: z.string(),
            startTime: z.string().describe('RFC3339 timestamp'),
            endTime: z.string().describe('RFC3339 timestamp'),
          }),
          func: async (input: Record<string, unknown>) => {
            const { name, phone, email, serviceType, startTime, endTime } =
              input as {
                name: string;
                phone: string;
                email: string;
                serviceType: string;
                startTime: string;
                endTime: string;
              };
            // Creates a new event in the Google Calendar for the confirmed appointment slot.
            const calResult = await new GoogleCalendarBubble({
              operation: 'create_event',
              calendar_id: calendarId,
              summary: `Dental Appt: ${name} (${serviceType})`,
              description: `Patient: ${name}\nPhone: ${phone}\nEmail: ${email}\nService: ${serviceType}`,
              start: { dateTime: startTime },
              end: { dateTime: endTime },
            }).action();

            // Appends the appointment details as a new row in the specified Google Sheet for record-keeping.
            const sheetResult = await new GoogleSheetsBubble({
              operation: 'append_values',
              spreadsheet_id: spreadsheetId,
              range: `${sheetName}!A:E`,
              values: [[name, phone, email, serviceType, startTime]],
              value_input_option: 'USER_ENTERED',
            }).action();

            return { calendar: calResult.data, sheets: sheetResult.data };
          },
        },
        {
          name: 'getAppointmentData',
          description: 'Retrieves appointment records from the Google Sheet.',
          schema: z.object({
            range: z
              .string()
              .optional()
              .describe('A1 notation range, e.g., "Sheet1!A1:E10"'),
          }),
          func: async (input: Record<string, unknown>) => {
            const { range } = input as { range?: string };
            // Reads appointment data from the Google Sheet to retrieve existing records or verify bookings.
            const result = await new GoogleSheetsBubble({
              operation: 'read_values',
              spreadsheet_id: spreadsheetId,
              range: range || `${sheetName}!A:E`,
            }).action();
            return result.data;
          },
        },
      ],
    });

    const result = await agent.action();
    if (!result.success || !result.data) {
      throw new Error(`AI Agent failed: ${result.error || 'No data returned'}`);
    }

    return result.data.response;
  }

  /**
   * Sends the AI's response back to the user via Telegram.
   */
  private async sendTelegramReply(chatId: string, text: string) {
    // Sends a text message to the specified Telegram chat ID using the bot integration.
    const result = await new TelegramBubble({
      operation: 'send_message',
      chat_id: chatId,
      text: text,
    }).action();

    if (!result.success) {
      this.logger?.error(`Failed to send Telegram message: ${result.error}`);
    }
  }

  /**
   * Main workflow orchestration for the Dental Clinic Assistant.
   */
  async handle(payload: DentalClinicPayload): Promise<DentalClinicOutput> {
    const {
      message,
      chatId,
      spreadsheetId,
      calendarId,
      sheetName = 'Appointments',
    } = payload;

    const aiResponse = await this.runDentalAssistant(
      message,
      spreadsheetId,
      calendarId,
      sheetName
    );

    // If a Telegram chat ID is provided, send the response back to the user on Telegram.
    if (chatId) {
      await this.sendTelegramReply(chatId, aiResponse as unknown as string);
    }

    return {
      response: aiResponse as unknown as string,
      success: true,
    };
  }
}
