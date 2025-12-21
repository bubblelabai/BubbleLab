import { OpenAPIHono } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { milkTeaRoute, pearlRoute, speechToTextRoute } from '../schemas/ai.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { runMilkTea } from '../services/ai/milktea.js';
import { runPearl } from '../services/ai/pearl.js';
import { env } from '../config/env.js';
import { CredentialType } from '../schemas/index.js';
import type { StreamingEvent } from '@bubblelab/shared-schemas';
import { posthog } from 'src/services/posthog.js';
import { getUserId } from 'src/middleware/auth.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

app.openapi(milkTeaRoute, async (c) => {
  // const userId = getUserId(c);
  const request = c.req.valid('json');

  // Execute MilkTea agent
  const result = await runMilkTea(request, {
    [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
    [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
    [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
  });

  if (!result.success) {
    return c.json(
      {
        error: result.error || 'MilkTea agent execution failed',
      },
      500
    );
  }

  return c.json(result, 200);
});

app.openapi(pearlRoute, async (c) => {
  const request = c.req.valid('json');
  const { stream } = c.req.valid('query');

  // If stream is not true, fall back to regular route
  if (!stream) {
    const result = await runPearl(request, {
      [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
      [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
      [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
      [CredentialType.FIRECRAWL_API_KEY]: env.FIRE_CRAWL_API_KEY!,
    });

    if (!result.success) {
      return c.json(
        {
          error: result.error || 'Pearl agent execution failed',
        },
        500
      );
    }

    return c.json(result, 200);
  }

  // Streaming mode
  return streamSSE(c, async (stream) => {
    try {
      const streamingCallback = async (event: StreamingEvent) => {
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: event.type,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        });
      };

      const result = await runPearl(
        request,
        {
          [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
          [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
          [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
          [CredentialType.FIRECRAWL_API_KEY]: env.FIRE_CRAWL_API_KEY,
        },
        streamingCallback
      );

      // Send final result
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'complete',
          data: {
            result,
            totalDuration: 0, // We don't track duration in Pearl
          },
        }),
        event: 'complete',
      });

      // Send stream completion
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'stream_complete',
          timestamp: new Date().toISOString(),
        }),
        event: 'stream_complete',
      });
      if (result.success) {
        posthog.captureEvent(
          {
            userId: getUserId(c),
            requestPath: c.req.path,
            requestMethod: c.req.method,
            prompt: request.userRequest,
            code: result.snippet,
          },
          'pearl_success'
        );
      } else {
        posthog.captureErrorEvent(
          result.error,
          {
            userId: getUserId(c),
            requestPath: c.req.path,
            requestMethod: c.req.method,
            prompt: request.userRequest,
          },
          'pearl_error'
        );
      }
    } catch (error) {
      console.error('[API] Pearl streaming error:', error);
      posthog.captureErrorEvent(
        error,
        {
          userId: getUserId(c),
          requestPath: c.req.path,
          requestMethod: c.req.method,
          prompt: request.userRequest,
        },
        'pearl_error'
      );
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          error:
            error instanceof Error ? error.message : 'Unknown streaming error',
          recoverable: false,
        }),
        event: 'error',
      });
    }
  });
});

app.openapi(speechToTextRoute, async (c) => {
  const { audio, language } = c.req.valid('json');
  if (!env.WISPR_API_KEY) {
    return c.json(
      {
        error: 'WISPR_API_KEY is not configured',
      },
      500
    );
  }

  try {
    const response = await fetch(
      'https://platform-api.wisprflow.ai/api/v1/dash/api',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.WISPR_API_KEY}`,
        },
        body: JSON.stringify({
          audio,
          language: language || ['en'],
        }),
      }
    );

    if (!response.ok) {
      return c.json(
        {
          error: `Error generating transcript`,
        },
        500
      );
    }

    const result = (await response.json()) as {
      text: string;
      api_duration?: number;
    };

    return c.json(
      {
        text: result.text || '',
        duration: result.api_duration,
      },
      200
    );
  } catch (error) {
    console.error(
      '[API] speech-to-text error:',
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error.stack : undefined
    );
    return c.json(
      {
        error: 'Internal server error during speech-to-text',
      },
      500
    );
  }
});

export default app;
