import posthog from 'posthog-js';

// PostHog Analytics Service
// Provides centralized analytics tracking with environment-based toggle

interface AnalyticsConfig {
  apiKey: string;
  host: string;
  enabled: boolean;
}

class AnalyticsService {
  private initialized = false;
  private enabled = false;

  /**
   * Initialize PostHog with configuration
   */
  init(config: AnalyticsConfig): void {
    this.enabled = config.enabled;

    if (!this.enabled) {
      console.log('[Analytics] PostHog analytics disabled via configuration');
      return;
    }

    if (!config.apiKey) {
      console.warn(
        '[Analytics] PostHog API key not provided, analytics disabled'
      );
      this.enabled = false;
      return;
    }

    try {
      posthog.init(config.apiKey, {
        api_host: config.host || 'https://us.i.posthog.com',
        defaults: '2025-05-24',
        // Capture page views automatically
        capture_pageview: true,
        // Capture automatically captured events (clicks, form submissions, etc.)
        autocapture: true,
        // Persistence configuration
        persistence: 'localStorage+cookie',
        // Session recording (optional - can be disabled for privacy)
        disable_session_recording: false,
        // Respect user's Do Not Track setting
        respect_dnt: true,
      });

      this.initialized = true;
      console.log('[Analytics] PostHog initialized successfully');
    } catch (error) {
      console.error('[Analytics] Failed to initialize PostHog:', error);
      this.enabled = false;
    }
  }

  /**
   * Track a custom event
   */
  track(eventName: string, properties?: Record<string, unknown>): void {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      posthog.capture(eventName, properties);
    } catch (error) {
      console.error('[Analytics] Failed to track event:', eventName, error);
    }
  }

  /**
   * Identify a user (for authenticated users)
   */
  identify(userId: string, userProperties?: Record<string, unknown>): void {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      posthog.identify(userId, userProperties);
    } catch (error) {
      console.error('[Analytics] Failed to identify user:', error);
    }
  }

  /**
   * Set user properties (for anonymous or identified users)
   */
  setUserProperties(properties: Record<string, unknown>): void {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      posthog.setPersonProperties(properties);
    } catch (error) {
      console.error('[Analytics] Failed to set user properties:', error);
    }
  }

  /**
   * Reset user identity (on logout)
   */
  reset(): void {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      posthog.reset();
    } catch (error) {
      console.error('[Analytics] Failed to reset user:', error);
    }
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.initialized;
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Specific event tracking functions with typed parameters

export interface WorkflowExecutionEventProps {
  flowId: number;
  flowName: string;
  bubbleCount: number;
  hasInputSchema: boolean;
  executionDuration?: number;
  success: boolean;
  errorMessage?: string;
}

export function trackWorkflowExecution(
  props: WorkflowExecutionEventProps
): void {
  analytics.track('workflow_execution', {
    flow_id: props.flowId,
    flow_name: props.flowName,
    bubble_count: props.bubbleCount,
    has_input_schema: props.hasInputSchema,
    execution_duration_ms: props.executionDuration,
    success: props.success,
    error_message: props.errorMessage,
  });
}

export interface WorkflowGenerationEventProps {
  prompt: string;
  templateId?: string;
  templateName?: string;
  generatedBubbleCount: number;
  generatedCodeLength: number;
  generationDuration?: number;
  success: boolean;
  errorMessage?: string;
}

export function trackWorkflowGeneration(
  props: WorkflowGenerationEventProps
): void {
  analytics.track('workflow_generation', {
    prompt_length: props.prompt.length,
    template_id: props.templateId,
    template_name: props.templateName,
    generated_bubble_count: props.generatedBubbleCount,
    generated_code_length: props.generatedCodeLength,
    generation_duration_ms: props.generationDuration,
    success: props.success,
    error_message: props.errorMessage,
  });
}

export interface AIAssistantEventProps {
  action:
    | 'open'
    | 'close'
    | 'send_message'
    | 'receive_response'
    | 'accept_response';
  messageLength?: number;
  responseLength?: number;
  conversationTurn?: number;
  errorMessage?: string;
}

export function trackAIAssistant(props: AIAssistantEventProps): void {
  analytics.track('ai_assistant', {
    action: props.action,
    message_length: props.messageLength,
    response_length: props.responseLength,
    conversation_turn: props.conversationTurn,
    error_message: props.errorMessage,
  });
}

export interface TemplateEventProps {
  action: 'click' | 'select' | 'generate';
  templateId: string;
  templateName: string;
  templateCategory: string;
}

export function trackTemplate(props: TemplateEventProps): void {
  analytics.track('template_interaction', {
    action: props.action,
    template_id: props.templateId,
    template_name: props.templateName,
    template_category: props.templateCategory,
  });
}

export interface CodeEditEventProps {
  action: 'validate' | 'edit' | 'save';
  flowId?: number;
  codeLength?: number;
  bubbleCount?: number;
  validationSuccess?: boolean;
  errorCount?: number;
}

export function trackCodeEdit(props: CodeEditEventProps): void {
  analytics.track('code_edit', {
    action: props.action,
    flow_id: props.flowId,
    code_length: props.codeLength,
    bubble_count: props.bubbleCount,
    validation_success: props.validationSuccess,
    error_count: props.errorCount,
  });
}

export interface CredentialEventProps {
  action: 'create' | 'update' | 'delete' | 'select';
  credentialType: string;
  bubbleCount?: number;
}

export function trackCredential(props: CredentialEventProps): void {
  analytics.track('credential_action', {
    action: props.action,
    credential_type: props.credentialType,
    bubble_count: props.bubbleCount,
  });
}
