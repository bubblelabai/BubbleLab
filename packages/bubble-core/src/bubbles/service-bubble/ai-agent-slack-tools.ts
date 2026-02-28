import { z } from 'zod';
import {
  type CredentialType,
  RECOMMENDED_MODELS,
} from '@bubblelab/shared-schemas';

interface CustomTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  func: (input: Record<string, unknown>) => Promise<string>;
}

export function buildSlackReadImageTool(
  slackToken: string,
  credentials: Partial<Record<CredentialType, string>>
): CustomTool {
  return {
    name: 'read_slack_image',
    description:
      'Read and describe an image from a Slack file URL. Use this when a user shares an image in Slack and you need to see its contents. Pass the Slack file URL (url_private or url_private_download).',
    schema: z.object({
      url: z
        .string()
        .describe(
          'The Slack file URL (url_private or url_private_download) to read'
        ),
      question: z
        .string()
        .optional()
        .describe(
          'Optional specific question about the image (e.g. "what text is shown?"). If not provided, gives a general description.'
        ),
    }),
    func: async (input: Record<string, unknown>): Promise<string> => {
      const url = input.url as string;
      const question = input.question as string | undefined;

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${slackToken}` },
        });
        if (!response.ok) {
          return `Failed to download image: ${response.status} ${response.statusText}`;
        }

        const buffer = await response.arrayBuffer();
        const mimeType = response.headers.get('content-type') || 'image/png';
        const base64 = Buffer.from(buffer).toString('base64');

        const { AIAgentBubble } = await import('./ai-agent.js');
        const prompt = question
          ? `Answer this question about the image: ${question}`
          : 'Describe this image in detail, including any text, logos, colors, and visual elements you see.';

        const agent = new AIAgentBubble(
          {
            message: prompt,
            systemPrompt:
              'You are an image analysis assistant. Describe images accurately and concisely.',
            name: 'Capability Agent: Image Reader',
            model: {
              model: RECOMMENDED_MODELS.GOOGLE_FLAGSHIP,
              temperature: 0,
              maxTokens: 2048,
            },
            images: [
              {
                type: 'base64' as const,
                data: base64,
                mimeType,
              },
            ],
            credentials,
            maxIterations: 10,
          },
          undefined,
          'image-reader'
        );

        const result = await agent.action();
        return result.data?.response ?? 'Unable to describe the image.';
      } catch (err) {
        return `Error reading image: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  };
}
