import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ResendBubble } from '@bubblelab/bubble-core';
import { CredentialType } from '../schemas/index.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { requireJsonContentType } from '../middleware/content-type.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);
app.use('*', requireJsonContentType);

const templateSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  code: z.string().min(1, 'Code is required'),
  authorName: z.string().optional(),
  additionalNotes: z.string().optional(),
});

const templateSubmissionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

const submitTemplateRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: templateSubmissionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: templateSubmissionResponseSchema,
        },
      },
      description: 'Template submitted successfully',
    },
    500: {
      content: {
        'application/json': {
          schema: templateSubmissionResponseSchema,
        },
      },
      description: 'Failed to submit template',
    },
  },
});

const EMAIL_CONFIG = {
  recipient: 'selinali@bubblelab.ai',
  from: 'BubbleLab Templates <welcome@hello.bubblelab.ai>',
  replyTo: 'hello@bubblelab.ai',
};

const createSubmissionEmailHtml = (data: {
  title: string;
  description: string;
  code: string;
  authorName?: string;
  additionalNotes?: string;
}) => {
  return `
    <div style="font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; max-width: 800px; margin: 0 auto; background-color: #0d1117; color: #c9d1d9; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #238636 0%, #1f6feb 100%); padding: 24px 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">📬 New Template Submission</h1>
      </div>
      
      <div style="padding: 30px;">
        <div style="margin-bottom: 24px;">
          <h2 style="color: #58a6ff; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Template Title</h2>
          <p style="color: #f0f6fc; margin: 0; font-size: 20px; font-weight: 600;">${data.title}</p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <h2 style="color: #58a6ff; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Author</h2>
          <p style="color: #c9d1d9; margin: 0; font-size: 16px;">${data.authorName || 'Anonymous'}</p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <h2 style="color: #58a6ff; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Description</h2>
          <p style="color: #c9d1d9; margin: 0; font-size: 16px; line-height: 1.6;">${data.description}</p>
        </div>
        
        ${
          data.additionalNotes
            ? `
        <div style="margin-bottom: 24px;">
          <h2 style="color: #58a6ff; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Additional Notes</h2>
          <p style="color: #c9d1d9; margin: 0; font-size: 16px; line-height: 1.6;">${data.additionalNotes}</p>
        </div>
        `
            : ''
        }
        
        <div style="margin-bottom: 16px;">
          <h2 style="color: #58a6ff; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Code</h2>
          <div style="background-color: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; overflow-x: auto;">
            <pre style="color: #c9d1d9; margin: 0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;"><code>${data.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
          </div>
        </div>
      </div>
      
      <div style="padding: 20px 30px; background-color: #161b22; border-top: 1px solid #30363d;">
        <p style="margin: 0; font-size: 12px; color: #8b949e;">Submitted via BubbleLab Template Submission • ${new Date().toISOString()}</p>
      </div>
    </div>
  `;
};

const createSubmissionEmailText = (data: {
  title: string;
  description: string;
  code: string;
  authorName?: string;
  additionalNotes?: string;
}) => {
  return `
NEW TEMPLATE SUBMISSION
=======================

TITLE: ${data.title}

AUTHOR: ${data.authorName || 'Anonymous'}

DESCRIPTION:
${data.description}

${data.additionalNotes ? `ADDITIONAL NOTES:\n${data.additionalNotes}\n` : ''}
CODE:
\`\`\`typescript
${data.code}
\`\`\`

---
Submitted via BubbleLab Template Submission
${new Date().toISOString()}
  `.trim();
};

app.openapi(submitTemplateRoute, async (c) => {
  const { title, description, code, authorName, additionalNotes } =
    c.req.valid('json');

  try {
    const credentials = {
      [CredentialType.RESEND_CRED]: process.env.RESEND_API_KEY!,
    };

    const emailBubble = new ResendBubble({
      operation: 'send_email',
      from: EMAIL_CONFIG.from,
      to: [EMAIL_CONFIG.recipient],
      subject: `[Template Submission] ${title}`,
      html: createSubmissionEmailHtml({
        title,
        description,
        code,
        authorName,
        additionalNotes,
      }),
      text: createSubmissionEmailText({
        title,
        description,
        code,
        authorName,
        additionalNotes,
      }),
      replyTo: EMAIL_CONFIG.replyTo,
      headers: {
        'X-Entity-Ref-ID': `template-submission-${Date.now()}`,
      },
      credentials,
    });

    await emailBubble.action();

    return c.json({
      success: true,
      message: 'Template submitted successfully! We will review it shortly.',
    });
  } catch (error) {
    console.error('Failed to submit template:', error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to submit template. Please try again later.',
      },
      500
    );
  }
});

export default app;
