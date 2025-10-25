import { OpenAPIHono } from '@hono/zod-openapi';
import { ResendBubble, SlackBubble } from '@bubblelab/bubble-core';
import { CredentialType } from '../schemas/index.js';
import { joinWaitlistRoute } from '../schemas/waitlist.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { requireJsonContentType } from '../middleware/content-type.js';
import { clerk } from '@/utils/clerk-client.js';
import { db } from '../db/index.js';
import { users, waitlistedUsers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { env } from '@/config/env.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);
app.use('*', requireJsonContentType);

const EMAIL_CONFIG = {
  recipients: ['hello@bubblelab.ai'],
  subject: 'New Nodex Access Request',
  from: 'Nodex Team <welcome@hello.bubblelab.ai>',
  welcomeSubject: 'Your Nodex Early Access Request',
  postgresWelcomeSubject: 'Your Nodex Account Is Ready',
  replyTo: 'hello@bubblelab.ai',
};

const createWelcomeEmailContent = (formData: {
  name: string;
  email: string;
}) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a1a1a; color: #ffffff;">
      <div style="padding: 40px 30px;">
        <div style="margin-bottom: 30px;">
          <h2 style="color: #ffffff; margin: 0; font-size: 28px;">Thank you for your interest in Nodex</h2>
        </div>
        <div style="padding: 20px 0;">
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            Hi ${formData.name},
          </p>
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            We received your request for early access to <strong>Nodex</strong> - our AI data scientist platform for Slack.
          </p>
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            Our team will review your request and contact you within <strong>2-3 business days</strong> to discuss your requirements.
          </p>
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            For any questions, please contact us at <a href="mailto:hello@bubblelab.ai" style="color: #a78bfa; text-decoration: none;">hello@bubblelab.ai</a>
          </p>
          <p style="color: #ffffff; line-height: 1.8; margin-top: 30px; font-size: 16px;">
            Best regards,<br>
            The Nodex Team
          </p>
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333333;">
          <p style="margin: 0; font-size: 14px; color: #999999;">This email was sent to ${formData.email} because you requested early access to Nodex.</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #999999;">Bubble Lab Inc.</p>
        </div>
      </div>
    </div>
  `;
};

const generateTemporaryPassword = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

const createPostgresWelcomeEmailContent = async (formData: {
  name: string;
  email: string;
}) => {
  const [firstName, ...lastNameParts] = formData.name.split(' ');
  const lastName = lastNameParts.join(' ') || null;
  const temporaryPassword = generateTemporaryPassword();
  const clerkUser = await clerk?.users.createUser({
    emailAddress: [formData.email],
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    password: temporaryPassword,
    skipPasswordChecks: true,
  });

  if (!clerkUser) {
    throw new Error(
      'Failed to create your account, if issue persists, please contact us at hello@bubblelab.ai'
    );
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1a1a1a; color: #ffffff;">
      <div style="padding: 40px 30px;">
        <div style="margin-bottom: 30px;">
          <h2 style="color: #ffffff; margin: 0; font-size: 28px;">Your Nodex Account Is Ready</h2>
        </div>
        <div style="padding: 20px 0;">
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            Hi ${formData.name},
          </p>
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 24px; font-size: 16px;">
            Your Nodex account has been created successfully. You can now access our AI data scientist platform for Slack.
          </p>
          <div style="background: #2a2a2a; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #333333;">
            <h3 style="color: #ffffff; margin-top: 0; font-size: 20px; margin-bottom: 16px;">Account Information</h3>
            <p style="color: #ffffff; margin-bottom: 12px; font-size: 16px;"><strong>Email:</strong> ${formData.email}</p>
            <p style="color: #cccccc; margin-bottom: 0; font-size: 15px; line-height: 1.6;">
              To log in, enter your email address on the login page. You will receive a verification code to access your account.
            </p>
          </div>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.NODEX_DASHBOARD_URL}" style="background: #8b5cf6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: 500;">
              Log in to Nodex Dashboard
            </a>
          </div>
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            Start building powerful data workflows within Slack today.
          </p>
          <p style="color: #ffffff; line-height: 1.8; margin-bottom: 20px; font-size: 16px;">
            Need help? Contact us at <a href="mailto:hello@bubblelab.ai" style="color: #a78bfa; text-decoration: none;">hello@bubblelab.ai</a>
          </p>
          <p style="color: #ffffff; line-height: 1.8; margin-top: 30px; font-size: 16px;">
            Best regards,<br>
            The Nodex Team
          </p>
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333333;">
          <p style="margin: 0; font-size: 14px; color: #999999;">This email was sent to ${formData.email} because an account was created for you.</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #999999;">Bubble Lab Inc.</p>
        </div>
      </div>
    </div>
  `;
};

app.openapi(joinWaitlistRoute, async (c) => {
  const { name, email, database, otherDatabase } = c.req.valid('json');
  const credentials_resend = {
    [CredentialType.RESEND_CRED]: process.env.RESEND_API_KEY!,
  };
  const credentials_slack = {
    [CredentialType.SLACK_CRED]: process.env.SLACK_BOT_TOKEN!,
  };
  // If email is already in the waitlist or user table, just return success
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existingUser) {
    return c.json(
      {
        success: true,
        error:
          'Congratulations! You have already been granted access to Nodex, please login to your account.',
      },
      409
    );
  }

  const existingWaitlistUser = await db.query.waitlistedUsers.findFirst({
    where: eq(waitlistedUsers.email, email),
  });
  if (existingWaitlistUser) {
    return c.json(
      {
        success: true,
        error:
          'You are already in the waitlist, we will get back to you shortly!',
      },
      409
    );
  }

  try {
    if (database !== 'postgres') {
      const welcomeEmailBubble = new ResendBubble({
        operation: 'send_email',
        from: EMAIL_CONFIG.from,
        to: [email],
        subject: EMAIL_CONFIG.welcomeSubject,
        html: createWelcomeEmailContent({ name, email }),
        text: `Hi ${name},\n\nWe received your request for early access to Nodex, our AI data scientist platform for Slack.\n\nOur team will review your request and contact you within 2-3 business days to discuss your requirements.\n\nFor any questions, please contact us at hello@bubblelab.ai\n\nBest regards,\nThe Nodex Team`,
        replyTo: EMAIL_CONFIG.replyTo,
        headers: {
          'X-Entity-Ref-ID': `nodex-waitlist-${Date.now()}`,
          'List-Unsubscribe': '<mailto:hello@bubblelab.ai?subject=Unsubscribe>',
        },
        credentials: credentials_resend,
      });
      await welcomeEmailBubble.action();
      await db.insert(waitlistedUsers).values({
        email,
        name,
        database,
        otherDatabase,
        status: 'pending',
      });
      await new SlackBubble({
        operation: 'send_message',
        channel: env.SLACK_REMINDER_CHANNEL!,
        text: `[Nodex] New user ${name} joined the waitlist with email ${email} and database ${database}.`,
        credentials: credentials_slack,
      }).action();
    } else {
      const welcomeEmailBubble = new ResendBubble({
        operation: 'send_email',
        from: EMAIL_CONFIG.from,
        to: [email],
        subject: EMAIL_CONFIG.postgresWelcomeSubject,
        html: await createPostgresWelcomeEmailContent({ name, email }),
        text: `Hi ${name},\n\nYour Nodex account has been created successfully. You can now access our AI data scientist platform for Slack.\n\nAccount Information:\nEmail: ${email}\n\nTo log in, enter your email address on the login page. You will receive a verification code to access your account.\n\nLog in at: ${process.env.NODEX_DASHBOARD_URL}\n\nNeed help? Contact us at hello@bubblelab.ai\n\nBest regards,\nThe Nodex Team`,
        replyTo: EMAIL_CONFIG.replyTo,
        headers: {
          'X-Entity-Ref-ID': `nodex-account-${Date.now()}`,
          'List-Unsubscribe': '<mailto:hello@bubblelab.ai?subject=Unsubscribe>',
        },
        credentials: credentials_resend,
      });
      await welcomeEmailBubble.action();
      await new SlackBubble({
        operation: 'send_message',
        channel: env.SLACK_REMINDER_CHANNEL!,
        text: `[Nodex] New user ${name} signed up for Nodex with email ${email}!`,
        credentials: credentials_slack,
      }).action();
    }
  } catch (error) {
    console.error(error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to sign up, if issue persists, please contact us at hello@bubblelab.ai',
      },
      500
    );
  }
  return c.json({
    success: true,
    error: '',
    message:
      'Successfully joined the waitlist! Check your email for next steps.',
  });
});

export default app;
