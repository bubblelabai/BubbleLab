import { PostHog } from 'posthog-node';

// PostHog Error Tracking Service
// Provides centralized error tracking with environment-based toggle

interface PostHogConfig {
  apiKey: string;
  host: string;
  enabled: boolean;
}

class PostHogService {
  private client: PostHog | null = null;
  private initialized = false;
  private enabled = false;

  /**
   * Initialize PostHog with configuration
   */
  init(config: PostHogConfig): void {
    this.enabled = config.enabled;

    if (!this.enabled) {
      console.log('[PostHog] Error tracking disabled via configuration');
      return;
    }

    if (!config.apiKey) {
      console.warn('[PostHog] API key not provided, error tracking disabled');
      this.enabled = false;
      return;
    }

    try {
      this.client = new PostHog(config.apiKey, {
        host: config.host || 'https://us.i.posthog.com',
      });

      this.initialized = true;
      console.log('[PostHog] Error tracking initialized successfully');
    } catch (error) {
      console.error('[PostHog] Failed to initialize:', error);
      this.enabled = false;
    }
  }

  /**
   * Capture an exception/error
   */
  captureException(
    error: Error | unknown,
    properties?: Record<string, unknown>
  ): void {
    if (!this.enabled || !this.initialized || !this.client) {
      return;
    }

    try {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.client.capture({
        distinctId: 'backend-server',
        event: '$exception',
        properties: {
          $exception_message: errorMessage,
          $exception_stack: errorStack,
          $exception_type: error instanceof Error ? error.name : 'Unknown',
          ...properties,
        },
      });
    } catch (err) {
      // Silently fail to avoid breaking error handling
      console.error('[PostHog] Failed to capture exception:', err);
    }
  }

  /**
   * Capture a validation error event
   */
  captureValidationError(properties: {
    userId?: string;
    bubbleFlowId?: number;
    errorMessages: string[];
    code?: string;
    source?: 'create' | 'update' | 'ai_generation' | 'manual';
  }): void {
    if (!this.enabled || !this.initialized || !this.client) {
      return;
    }

    try {
      console.log('[PostHog] Capturing validation error:', properties);
      this.client.capture({
        distinctId: properties.userId || 'anonymous',
        event: 'validation_error',
        properties: {
          bubble_flow_id: properties.bubbleFlowId,
          error_count: properties.errorMessages.length,
          error_messages: properties.errorMessages,
          code_length: properties.code?.length,
          source: properties.source,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[PostHog] Failed to capture validation error:', err);
    }
  }

  /**
   * Capture a code generation event
   */
  captureCodeGenerated(properties: {
    userId?: string;
    bubbleFlowId?: number;
    codeLength: number;
    bubbleCount: number;
    generationSource: 'pearl' | 'milktea' | 'template' | 'other';
    validationPassed: boolean;
    credentialTypes?: string[];
    trigger?: string;
  }): void {
    if (!this.enabled || !this.initialized || !this.client) {
      return;
    }

    try {
      this.client.capture({
        distinctId: properties.userId || 'anonymous',
        event: 'code_generated',
        properties: {
          bubble_flow_id: properties.bubbleFlowId,
          code_length: properties.codeLength,
          bubble_count: properties.bubbleCount,
          generation_source: properties.generationSource,
          validation_passed: properties.validationPassed,
          credential_types: properties.credentialTypes,
          trigger: properties.trigger,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[PostHog] Failed to capture code generation:', err);
    }
  }

  captureEvent(event: string, properties?: Record<string, unknown>): void {
    if (!this.enabled || !this.initialized || !this.client) {
      return;
    }

    try {
      this.client.capture({
        distinctId: 'backend-server',
        event: event,
        properties: properties,
      });
    } catch (err) {
      console.error('[PostHog] Failed to capture event:', err);
    }
  }

  /**
   * Capture a critical error with context
   */
  captureErrorEvent(
    error: Error | unknown,
    context?: {
      userId?: string;
      requestPath?: string;
      requestMethod?: string;
      bubbleFlowId?: number;
      executionId?: number;
      [key: string]: unknown;
    },
    event?: string
  ): void {
    if (!this.enabled || !this.initialized || !this.client) {
      return;
    }

    try {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.client.capture({
        distinctId: context?.userId || 'backend-server',
        event: event || 'critical_error',
        properties: {
          error_message: errorMessage,
          error_stack: errorStack,
          error_type: error instanceof Error ? error.name : 'Unknown',
          request_path: context?.requestPath,
          request_method: context?.requestMethod,
          bubble_flow_id: context?.bubbleFlowId,
          execution_id: context?.executionId,
          ...Object.fromEntries(
            Object.entries(context || {}).filter(
              ([key]) =>
                ![
                  'userId',
                  'requestPath',
                  'requestMethod',
                  'bubbleFlowId',
                  'executionId',
                ].includes(key)
            )
          ),
        },
      });
    } catch (err) {
      // Silently fail to avoid breaking error handling
      console.error('[PostHog] Failed to capture error:', err);
    }
  }

  /**
   * Shutdown PostHog client (call before process exit)
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.shutdown();
        console.log('[PostHog] Shutdown complete');
      } catch (error) {
        console.error('[PostHog] Error during shutdown:', error);
      }
    }
  }

  /**
   * Check if PostHog is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.initialized;
  }
}

// Export singleton instance
export const posthog = new PostHogService();
