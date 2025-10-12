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
   * Get the current parameters (credentials are excluded for security)
   * Use chooseCredential() method to access credentials in a controlled way
   */
  get currentParams(): Omit<TParams, 'credentials'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credentials, ...sanitized } = this.params as ServiceBubbleParams;
    return sanitized as Omit<TParams, 'credentials'>;
  }

  setParam<K extends keyof TParams>(
    paramName: K,
    paramValue: TParams[K]
  ): void {
    this.params[paramName] = paramValue;
  }

  /**
   * Get the current context
   */
  get currentContext(): BubbleContext | undefined {
    return this.context;
  }
}
