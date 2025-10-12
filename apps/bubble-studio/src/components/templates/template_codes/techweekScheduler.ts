// Template for LA Tech Week Personalized Calendar
// This file contains the template code and metadata for the Tech Week calendar workflow

export const templateCode = `import {
    BubbleFlow,
    AIAgentBubble,
    ResendBubble,
    GoogleSheetsBubble,
    type WebhookEvent,
  } from '@bubblelab/bubble-core';

  export interface Output {
    success: boolean;
    message: string;
  }

  export interface CustomWebhookPayload extends WebhookEvent {
    productInfo: string;
    recipientEmail: string;
  }

  interface Event {
    title: string ;
    date: string;
    time: string;
    location: string;
    inviteOnly: string;
    link: string;
  }

  export class TechweekSchedulerFlow extends BubbleFlow<'webhook/http'> {
    async handle(payload: CustomWebhookPayload): Promise<Output> {
      const { productInfo, recipientEmail } = payload;

      // STEP 1: Read events from Google Sheets
      const sheetsResult = await new GoogleSheetsBubble({
        operation: 'read_values',
        spreadsheet_id: '1x3GLPIpeesH_OzwgdYN-c_I18_8HvubW2nJN6WBnBr0',
        range: 'techweek_sf_events!A:F',
        major_dimension: 'ROWS',
      }).action();

      if (!sheetsResult.success || !sheetsResult.data?.values || sheetsResult.data.values.length < 2) {
        throw new Error('Failed to retrieve data from Google Sheets or the sheet has no content.');
      }

      // Parse the sheet data into structured events
      const [headerRow, ...dataRows] = sheetsResult.data.values;
      let events: Event[] = dataRows.map(row => ({
        title: row[0] as string,
        date: row[1] as string,
        time: row[2] as string,
        location: row[3] as string,
        inviteOnly: row[4] as string,
        link: row[5] as string,
      })).slice(2);


      // STEP 3: Process each day and send personalized schedule emails
      const dates = ['Oct 6', 'Oct 7', 'Oct 8', 'Oct 9', 'Oct 10', 'Oct 11', 'Oct 12'];

      for (const date of dates) {
        // Filter events for this specific date
        const dayEvents = events.filter(event => event.date === date);
        
        if (dayEvents.length === 0) {
          this.logger?.info(\`No events found for \${date}\`);
          continue;
        }

        const prompt = \`
Based on the following product information and list of Techweek events, please create a proposed schedule for \${date}.

**Product Information:**
\${productInfo}

**All Techweek Events for \${date} (JSON format):**
\${JSON.stringify(dayEvents, null, 2)}

**Instructions:**
1. From the filtered list, select the most relevant events based on the product information provided. Prioritize events that align with our product goals.
2. Create a detailed schedule for the day. Ensure there are no overlapping events.
3. Consider the event locations and create a schedule that is geographically logical, allowing for reasonable travel time between venues.
4. Exclude "invite only" events where inviteOnly is "Yes".
5. Return a JSON object with the following structure:
{
  "hasEvents": true/false,
  "events": [
    {
      "title": "Event Name",
      "time": "Start Time only (no end time)",
      "location": "Venue Name and Address",
      "description": "Brief description of the event and why it's relevant",
      "url": "Event URL if available"
    }
  ]
}
6. If no relevant events are found for the day, return: {"hasEvents": false, "events": []}
        \`;

        const aiResult = await new AIAgentBubble({
          message: prompt,
          systemPrompt: 'You are an expert assistant specializing in creating optimized event schedules for tech professionals. Return only valid JSON.',
          model: { model: 'google/gemini-2.5-flash', jsonMode: true },
        }).action();

        if (aiResult.success && aiResult.data?.response) {
          let scheduleData;
          try {
            scheduleData = JSON.parse(aiResult.data.response);
          } catch (error) {
            this.logger?.warn(\`Failed to parse AI response for \${date}\`);
            continue;
          }

          // STEP 4: Create beautifully formatted HTML email
          let eventsHtml = '';
          
          if (scheduleData.hasEvents && scheduleData.events && scheduleData.events.length > 0) {
            eventsHtml = '<tr><td style="padding: 30px;"><h2 style="margin: 0 0 20px 0; color: #c92a2a; font-size: 20px;">📅 Your Curated Events</h2>';
            
            for (const event of scheduleData.events) {
              const eventUrlHtml = event.url 
                ? \`<a href="\${event.url}" style="display: inline-block; margin-top: 8px; padding: 8px 16px; background-color: #ff6b6b; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">View Event Details</a>\`
                : '';
              
              eventsHtml += \`
                <div style="margin-bottom: 20px; padding: 20px; background-color: #fff5f5; border-radius: 8px; border-left: 4px solid #ff6b6b;">
                  <h3 style="margin: 0 0 10px 0; color: #c92a2a; font-size: 18px;">\${event.title}</h3>
                  <p style="margin: 0 0 8px 0; color: #495057; font-size: 14px;">
                    <strong>⏰ Time:</strong> \${event.time}
                  </p>
                  <p style="margin: 0 0 8px 0; color: #495057; font-size: 14px;">
                    <strong>📍 Location:</strong> \${event.location}
                  </p>
                  <p style="margin: 0 0 10px 0; color: #495057; font-size: 14px; line-height: 1.5;">\${event.description}</p>
                  \${eventUrlHtml}
                </div>
              \`;
            }
            
            eventsHtml += '</td></tr>';
          } else {
            eventsHtml = \`
              <tr>
                <td style="padding: 60px 30px; text-align: center;">
                  <div style="font-size: 48px; margin-bottom: 20px;">📅</div>
                  <h2 style="margin: 0 0 10px 0; color: #495057; font-size: 20px;">No Relevant Events Today</h2>
                  <p style="margin: 0; color: #868e96; font-size: 15px;">Enjoy your day! Check back tomorrow for more curated events.</p>
                </td>
              </tr>
            \`;
          }

          const htmlEmail = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Techweek Schedule - \${date}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🚀 Techweek Daily Schedule</h1>
              <p style="margin: 10px 0 0 0; color: #ffe0e0; font-size: 16px;">\${date}, 2025</p>
            </td>
          </tr>
          \${eventsHtml}
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="margin: 0 0 15px 0; color: #495057; font-size: 15px; line-height: 1.6;">
                ⚡ This workflow is powered by <a href="https://bubblelab.ai" style="color: #ff6b6b; text-decoration: none; font-weight: 600;">Bubble Lab</a> — an open-source AI automation platform (with code exports and observability) launching very soon!
              </p>
              <a href="https://x.com/Selinaliyy" style="display: inline-block; padding: 10px 24px; background-color: #1DA1F2; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-right: 10px;">Follow on X</a>
              <a href="https://www.instagram.com/selina.builds/" style="display: inline-block; padding: 10px 24px; background-color: #E4405F; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-right: 10px;">Follow on Instagram</a>
              <a href="https://github.com/bubblelabai/BubbleLab" style="display: inline-block; padding: 10px 24px; background-color: #212529; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">⭐ Star on GitHub</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #212529; text-align: center;">
              <p style="margin: 0; color: #adb5bd; font-size: 14px;">Made with ❤️ by <a href="https://bubblelab.ai" style="color: #ff6b6b; text-decoration: none; font-weight: 600;">Bubble Lab</a></p>
              <p style="margin: 10px 0 0 0; color: #6c757d; font-size: 12px;">Open Source • Agentic Workflows • Launching Soon</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          \`;

          // STEP 5: Send the formatted email
          await new ResendBubble({
            operation: 'send_email',
            to: [recipientEmail],
            bcc: ['selinali@bubblelab.ai'],
            from: 'Bubble Lab Team <welcome@hello.bubblelab.ai>',
            subject: \`🚀 Your Techweek Schedule: \${date}\`,
            html: htmlEmail,
          }).action();

          this.logger?.info(\`Email sent for \${date}\`);
        } else {
          this.logger?.warn(\`AI agent failed to generate a schedule for \${date}.\`);
        }
      }

      return {
        success: true,
        message: 'Daily schedule emails have been processed and sent.',
      };
    }
  }`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      productInfo: {
        type: 'string',
        description:
          'Information about your product/interests to help curate relevant events',
      },
      recipientEmail: {
        type: 'string',
        description:
          'Email address to receive the personalized daily schedules',
      },
    },
    required: ['productInfo', 'recipientEmail'],
  }),
  requiredCredentials: {
    'google-sheets': ['read'],
    resend: ['send'],
  },
};
