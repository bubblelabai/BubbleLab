import {
  BubbleFlow,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export class EmailFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: WebhookEvent): Promise<Output> {
    const users = [
      { email: 'user1@example.com', name: 'Alice' },
      { email: 'user2@example.com', name: 'Bob' },
    ];

    // INSERT_LOCATION
    const sendResults = await Promise.all(
      users.map((u) =>
        new ResendBubble({
          operation: 'send_email',
          to: u.email,
          subject: 'Team Update',
          html: '<h1>Hello</h1><p>Important team announcement</p>',
        }).action()
      )
    );

    const failures = sendResults.filter((r) => !r.success);
    if (failures.length) {
      throw new Error(
        `resend failed for ${failures.length} recipient(s): ${failures
          .map((f) => f.error)
          .join(', ')}`
      );
    }

    return {
      message: 'Emails sent',
    };
  }
}
