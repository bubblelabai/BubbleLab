import type {
  BubbleOperationResult,
  ServiceBubbleParams,
  BubbleContext,
} from './bubble.js';
import { BaseBubble } from './base-bubble-class.js';
import type { DatabaseMetadata } from '@bubblelab/shared-schemas';

export abstract class ServiceBubble<
  TParams extends ServiceBubbleParams = ServiceBubbleParams,
  TResult extends BubbleOperationResult = BubbleOperationResult,
> extends BaseBubble<TParams, TResult> {
  public readonly type = 'service' as const;
  public authType?: 'oauth' | 'apikey' | 'none' | 'connection-string';

  constructor(params: unknown, context?: BubbleContext) {
    super(params, context);
  }

  public abstract testCredential(): Promise<boolean>;

  /**
   * Abstract method to choose the appropriate credential based on bubble parameters
   * Should examine this.params to determine which credential to use from the injected credentials
   * Must be implemented by all service bubbles
   */
  protected abstract chooseCredential(): string | undefined;

  /**
   * Abstract method to get the metadata of the credential
   * Must be implemented by all service bubbles
   */
  // Optional method, only used for database bubbles
  async getCredentialMetadata(): Promise<DatabaseMetadata | undefined> {
    return undefined;
  }

  /**
   * Get the current parameters
   */
  get currentParams(): TParams {
    return this.params;
  }

  setCredentials(credentials: Record<string, string>) {
    this.params.credentials = credentials;
  }

  setParam(paramName: string, paramValue: unknown): void {
    this.params[paramName as keyof TParams] =
      paramValue as TParams[keyof TParams];
  }

  /**
   * Get the current context
   */
  get currentContext(): BubbleContext | undefined {
    return this.context;
  }
}
