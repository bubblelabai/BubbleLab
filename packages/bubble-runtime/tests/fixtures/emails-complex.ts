import {
  BubbleFlow,
  PostgreSQLBubble,
  ResendBubble,
} from '@bubblelab/bubble-core';

export interface Output {
  status: string;
  total_sent: number;
}

export class UserOutreachFlow extends BubbleFlow<'webhook/http'> {
  async handle(_payload): Promise<Output> {
    const MAX_USERS = 10;

    // Get list of contacted users
    const contactedResult = await new PostgreSQLBubble({
      query: 'SELECT DISTINCT user_id FROM admin_comment',
    }).action();

    if (!contactedResult.success) {
      throw new Error(
        'Failed to fetch contacted users: ' + contactedResult.error
      );
    }

    const sentUserIds: number[] = contactedResult.data.rows.map((row: any) =>
      Number(row.user_id)
    );

    let totalSent = 0;

    // Sequential processing to limit total to MAX_USERS
    const seg1 = await this.processUserSegment(
      "SELECT DISTINCT user_id, first_name, email FROM user_subscription_profile WHERE onboarding_complete = false AND last_logged IS NULL AND created_at < NOW() - INTERVAL '24 hours'",
      sentUserIds,
      Math.max(0, MAX_USERS - totalSent),
      this.sendNotOnboardedEmail.bind(this),
      'Sent not onboarded email template via automation on'
    );
    totalSent += seg1;

    const seg2 = await this.processUserSegment(
      "SELECT user_id, username, email, first_name FROM user_subscription_profile WHERE onboarding_complete = True AND (last_logged IS NULL) AND created_at < NOW() - INTERVAL '3 days' AND created_at > NOW() - INTERVAL '30 days'",
      sentUserIds,
      Math.max(0, MAX_USERS - totalSent),
      this.sendNotLoggedEmail.bind(this),
      'Sent not logged meal template via'
    );
    totalSent += seg2;

    const seg3 = await this.processUserSegment(
      "SELECT user_id, username, email, first_name, created_at, last_logged, product_id, status FROM user_subscription_profile WHERE onboarding_complete = true AND (last_logged IS NOT NULL) AND (product_id IS NULL) AND created_at < NOW() - INTERVAL '7 days' AND created_at > NOW() - INTERVAL '30 days'",
      sentUserIds,
      Math.max(0, MAX_USERS - totalSent),
      this.sendPremiumOfferEmail.bind(this),
      'Sent offer for interview in exchange 2 month free via'
    );
    totalSent += seg3;

    return {
      status: 'Workflow completed successfully',
      total_sent: totalSent,
    };
  }

  private async processUserSegment(
    query: string,
    sentUserIds: number[],
    maxUsers: number,
    sendEmail: (user: any) => Promise<boolean>,
    logMessage: string
  ): Promise<number> {
    if (maxUsers <= 0) return 0;

    const queryResult = await new PostgreSQLBubble({
      query: query,
    }).action();

    if (!queryResult.success) {
      this.logger?.error('Query failed for segment: ' + queryResult.error);
      return 0; // Skip this segment if query fails
    }

    const filteredUsers = queryResult.data.rows
      .filter((user: any) => !sentUserIds.includes(Number(user.user_id)))
      .slice(0, maxUsers);

    let sentCount = 0;

    for (const user of filteredUsers) {
      const emailSent = await sendEmail(user);
      if (emailSent) {
        await this.saveToAdminComment(
          Number(user.user_id),
          `${logMessage} ${new Date()}`
        );
        sentCount++;
      }
    }

    return sentCount;
  }

  private async sendNotOnboardedEmail(user: any): Promise<boolean> {
    try {
      const result = await new ResendBubble({
        operation: 'send_email',
        to: 'zachzhong@bubblelab.ai', // Test recipient
        subject: `Welcome to gymii 💚, ${user.first_name}`,
        text: `Hi ${user.first_name},

I'm Selina, cofounder and CEO of gymii.ai. Just wanted to personally welcome you and say thanks for checking us out!

I noticed you haven't completed onboarding yet — no pressure at all, but if you're curious to learn more before diving in, feel free to check out our website or Instagram to see what we're all about.

And if you ever decide gymii's not for you, just reply with "No thanks" and I won't bug you again, I promise!

Hope to see you inside soon ✨

Selina`,
        from: 'selinali@gymii.ai',
      }).action();

      if (result.success) {
        this.logger?.info(
          `Actual sending email to zachzhong@bubblelab.ai for user ${user.first_name} (${user.email}) - not onboarded`
        );
        return true;
      } else {
        this.logger?.error(
          `Failed to send email for user ${user.user_id}: ${result.error}`
        );
        return false;
      }
    } catch (error) {
      this.logger?.error(
        `Error sending not onboarded email for user ${user.user_id}: ${error}`
      );
      return false;
    }
  }

  private async sendNotLoggedEmail(user: any): Promise<boolean> {
    try {
      const result = await new ResendBubble({
        operation: 'send_email',
        to: 'zachzhong@bubblelab.ai', // Test recipient
        subject: `Need help getting started on gymii?`,
        text: `Hi ${user.first_name},

I'm Selina, cofounder and CEO of gymii.ai. So excited to have you in the gymii community!

I saw you've joined but haven't logged your first meal yet- totally normal, and I'd love to help if anything's unclear. Just tap the ? icon in the app for a step-by-step guide, or feel free to reply to this email with any questions!

And of course, if you'd rather not get emails from me, just reply "No thanks" and I'll make sure of it.

Here if you need anything 💌

Selina`,
        from: 'selinali@gymii.ai',
      }).action();

      if (result.success) {
        this.logger?.info(
          `Actual sending email to zachzhong@bubblelab.ai for user ${user.first_name} (${user.email}) - not logged`
        );
        return true;
      } else {
        this.logger?.error(
          `Failed to send email for user ${user.user_id}: ${result.error}`
        );
        return false;
      }
    } catch (error) {
      this.logger?.error(
        `Error sending not logged email for user ${user.user_id}: ${error}`
      );
      return false;
    }
  }

  private async sendPremiumOfferEmail(user: any): Promise<boolean> {
    try {
      const result = await new ResendBubble({
        operation: 'send_email',
        to: 'zachzhong@bubblelab.ai', // Test recipient
        subject: `2 months of gymii Premium — on us 💚`,
        text: `Hi ${user.first_name},

I'm Selina, cofounder and CEO of gymii.ai. Thanks so much for giving gymii a try, I hope it's been helpful on your nutrition journey so far!

We love learning directly from our users. If you're open to a quick 20-minute feedback chat, I'd love to offer you 2 months of gymii Premium as a thank you. That includes unlimited meal logging and full access to our 24/7 AI nutrition chatbot.

Just reply to this email if you're interested, and we'll set up a time that works for you!

And if you'd prefer not to receive emails from me, just reply "No thanks" — I totally understand.

Grateful to have you in the gymii community 💚

Selina`,
        from: 'selinali@gymii.ai',
      }).action();

      if (result.success) {
        this.logger?.info(
          `Actual sending email to zachzhong@bubblelab.ai for user ${user.first_name} (${user.email}) - premium offer`
        );
        return true;
      } else {
        this.logger?.error(
          `Failed to send email for user ${user.user_id}: ${result.error}`
        );
        return false;
      }
    } catch (error) {
      this.logger?.error(
        `Error sending premium offer email for user ${user.user_id}: ${error}`
      );
      return false;
    }
  }

  private async saveToAdminComment(
    userId: number,
    text: string
  ): Promise<void> {
    const result = await new PostgreSQLBubble({
      query:
        'INSERT INTO admin_comment (user_id, text, author_id) VALUES ($1, $2, $3)',
      parameters: [userId, text, 45],
    }).action();

    if (!result.success) {
      this.logger?.error(
        `Failed to save admin comment for user ${userId}: ${result.error}`
      );
    }
  }
}
