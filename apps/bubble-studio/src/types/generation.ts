import { ServiceUsage, StreamingEvent } from '@bubblelab/shared-schemas';

// Extended type for generation streaming events (includes standard StreamingEvent + generation-specific events)
export type GenerationStreamingEvent =
  | StreamingEvent
  | {
      type: 'generation_complete';
      data: {
        generatedCode?: string;
        bubbleParameters?: Record<string, unknown>;
        serviceUsage?: ServiceUsage[];
        inputsSchema?: string;
        isValid?: boolean;
        success?: boolean;
        error?: string;
      };
    }
  | { type: 'stream_complete'; data: Record<string, unknown> }
  | { type: 'heartbeat'; timestamp?: string }
  | {
      type: 'retry_attempt';
      data: {
        attempt: number;
        maxRetries: number;
        delay: number;
        error: string;
      };
    };
