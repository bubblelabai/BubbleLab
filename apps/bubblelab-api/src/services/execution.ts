import * as bubbleCore from '@bubblelab/bubble-core';
import type { BubbleTriggerEvent } from '@bubblelab/bubble-core';
import type { ParsedBubble, ExecutionResult } from '@bubblelab/shared-schemas';
import { injectCredentials } from './credential-injector.js';
import { BubbleInjector } from '@bubblelab/bubble-runtime';
import { processUserCode } from './code-processor.js';
import { BubbleOperationResult } from '@bubblelab/bubble-core';
import { CredentialHelper } from './credential-helper.js';
import {
  BubbleRunner,
  BubbleScript,
  UserCredentialWithId,
} from '@bubblelab/bubble-runtime';
import { UserCredential } from './credential-injector.js';
import { getBubbleFactory } from './bubble-factory-instance.js';
import type { StreamCallback } from '@bubblelab/shared-schemas';
import { AppType } from '../config/clerk-apps.js';
import {
  CredentialType,
  CREDENTIAL_ENV_MAP,
  ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';
import { trackTokenUsage } from './token-tracking.js';
import { getSafeErrorMessage } from '../utils/error-sanitizer.js';

export interface ExecutionOptions {
  userId: string; // Add userId for new credential system
  systemCredentials?: Record<string, string>;
  appType?: AppType;
}

export interface StreamingExecutionOptions extends ExecutionOptions {
  streamCallback?: StreamCallback;
  useWebhookLogger?: boolean;
}

async function runBubbleFlowCommon(
  bubbleScript: string,
  bubbleParameters: Record<string, ParsedBubbleWithInfo>,
  payload: BubbleTriggerEvent,
  options: ExecutionOptions & {
    streamCallback?: StreamCallback;
    useWebhookLogger?: boolean;
  }
): Promise<ExecutionResult> {
  const bubbleFactory = await getBubbleFactory();

  // Initialize script and runner (runner gives us a single injector path for both modes)
  const bubbleScriptInstance = new BubbleScript(bubbleScript, bubbleFactory);
  const runner = new BubbleRunner(bubbleScriptInstance, bubbleFactory, {
    enableLogging: Boolean(options.streamCallback),
    enableLineByLineLogging: Boolean(options.streamCallback),
    enableBubbleLogging: Boolean(options.streamCallback),
    streamCallback: options.streamCallback,
    useWebhookLogger: options.useWebhookLogger,
  });

  // Parse & find credentials - always use fresh script-generated bubbles for credential finding and injection

  const injector: BubbleInjector = runner.injector;
  const requiredCredentials = injector.findCredentials();

  console.log(
    '[runBubbleFlowCommon] Required credentials:',
    requiredCredentials
  );

  // Get user credentials when needed
  const userCredentials: UserCredentialWithId[] = [];

  if (Object.keys(bubbleParameters).length > 0) {
    //Find user credentials from database
    const userCredentialMappings = await CredentialHelper.getUserCredentials(
      options.userId,
      bubbleParameters
    );
    userCredentials.push(
      ...userCredentialMappings.map((mapping) => ({
        bubbleVarId: parseInt(mapping.varName),
        secret: mapping.secret,
        credentialType: mapping.credentialType as CredentialType,
        credentialId: mapping.credentialId,
        metadata: mapping.metadata,
      }))
    );
  }

  // System credentials from env
  const systemCredentials: Partial<Record<CredentialType, string>> = {};
  for (const [credType, envName] of Object.entries(CREDENTIAL_ENV_MAP)) {
    const envValue = process.env[envName];
    if (envValue) {
      systemCredentials[credType as CredentialType] = envValue;
    }
  }

  // Inject when needed
  if (Object.keys(requiredCredentials).length > 0) {
    const injectionResult = injector.injectCredentials(
      userCredentials.map((uc) => ({
        bubbleVarId: uc.bubbleVarId,
        secret: uc.secret,
        credentialType: uc.credentialType as CredentialType,
        credentialId: uc.credentialId,
        metadata: uc.metadata,
      })),
      systemCredentials
    );

    if (!injectionResult.success) {
      console.error(
        '[runBubbleFlowCommon] Credential injection failed:',
        injectionResult.errors
      );
      return {
        executionId: 0,
        success: false,
        summary: runner.getLogger()?.getExecutionSummary(),
        error: `Credential injection failed: ${injectionResult.errors?.join(', ')}`,
        data: undefined,
      };
    }
  }

  // Run
  const enhancedPayload = { ...payload, userId: options.userId };
  const result = await runner.runAll(enhancedPayload);
  // Track token usage if available
  if (result.summary?.tokenUsageByModel) {
    await trackTokenUsage(options.userId, result.summary.tokenUsageByModel);
  }

  return result;
}

/**
 * Run a bubble flow with observability and credential injection
 * @param bubbleScript - The bubble script to execute
 * @param payload - The payload to execute the flow with
 * @param options - The execution options
 */
export async function runBubbleFlow(
  bubbleScript: string,
  bubbleParameters: Record<string, ParsedBubbleWithInfo>,
  payload: BubbleTriggerEvent,
  options: ExecutionOptions
): Promise<ExecutionResult> {
  try {
    return await runBubbleFlowCommon(
      bubbleScript,
      bubbleParameters,
      payload,
      options
    );
  } catch (error) {
    console.error('[runBubbleFlow] Execution failed:', error);
    return {
      executionId: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: undefined,
    };
  }
}

/**
 * Run a bubble flow with live streaming, observability and credential injection
 * @param bubbleScript - The bubble script to execute
 * @param payload - The payload to execute the flow with
 * @param options - The execution options including stream callback
 */
export async function runBubbleFlowWithStreaming(
  bubbleScript: string,
  bubbleParameters: Record<string, ParsedBubbleWithInfo>,
  payload: BubbleTriggerEvent,
  options: StreamingExecutionOptions
): Promise<ExecutionResult> {
  try {
    return await runBubbleFlowCommon(
      bubbleScript,
      bubbleParameters,
      payload,
      options
    );
  } catch (error) {
    console.error('[runBubbleFlowWithStreaming] Execution failed:', error);
    return {
      executionId: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: undefined,
    };
  }
}

/**
 * Deprecated, use runBubbleFlow instead
 * Execute a bubble flow
 * @param processedCode - The processed code to execute
 * @param payload - The payload to execute the flow with
 * @param options - The execution options
 * @param originalCode - The original code to execute the flow with
 * @param bubbleParameters - The bubble parameters to execute the flow with
 */
export async function executeBubbleFlow(
  processedCode: string,
  payload: BubbleTriggerEvent,
  options: ExecutionOptions,
  originalCode?: string,
  bubbleParameters?: Record<string, ParsedBubble>
): Promise<ExecutionResult> {
  try {
    let finalCode = processedCode;
    // let injectedCredentials: Record<string, string> = {};

    // Inject credentials if we have original code and bubble parameters
    if (originalCode && bubbleParameters) {
      let userCreds: UserCredential[] = [];

      // Use new credential system if userId is provided
      if (options.userId) {
        try {
          const userCredentialMappings =
            await CredentialHelper.getUserCredentials(
              options.userId,
              bubbleParameters
            );

          // Convert UserCredentialMapping[] to UserCredential[] format
          userCreds = userCredentialMappings.map((mapping) => ({
            bubbleVarName: mapping.varName,
            secret: mapping.secret,
            credentialType: mapping.credentialType,
            credentialId: mapping.credentialId,
            metadata: mapping.metadata,
          }));
        } catch (error) {
          console.error(
            '[Execution] Failed to retrieve user credentials:',
            error
          );
          return {
            executionId: 0,
            success: false,
            error: `Failed to retrieve user credentials: ${error instanceof Error ? error.message : String(error)}`,
            data: undefined,
          };
        }
      }

      // Inject credentials into the original code (this handles both system and user credentials)
      const injectionResult = await injectCredentials(
        originalCode,
        bubbleParameters,
        userCreds
      );

      if (!injectionResult.success) {
        console.error(
          '[Execution] Credential injection failed:',
          injectionResult.errors
        );
        return {
          executionId: 0,
          success: false,
          error: `Credential injection failed: ${injectionResult.errors?.join(', ')}`,
          data: undefined,
        };
      }

      // Check if any credentials were actually injected
      if (
        injectionResult.injectedCredentials &&
        Object.keys(injectionResult.injectedCredentials).length > 0
      ) {
        // Now we need to process the credential-injected code
        finalCode = processUserCode(injectionResult.code!);
      } else {
        console.log(
          '[DEBUG] No credentials injected, using original processed code'
        );
      }
    }

    // Create a safe context
    const sandbox = {
      console: {
        log: (...args: unknown[]) => console.log('[BubbleFlow]', ...args),
        error: (...args: unknown[]) => console.error('[BubbleFlow]', ...args),
        warn: (...args: unknown[]) => console.warn('[BubbleFlow]', ...args),
      },
      Buffer, // Make Buffer available in the sandbox
    };

    // Extract the class name from the final code using regex
    const classMatch = finalCode.match(/class\s+(\w+)\s+extends\s+BubbleFlow/);
    if (!classMatch || !classMatch[1]) {
      throw new Error('No class extending BubbleFlow found in code');
    }
    const className = classMatch[1];

    // Execute the final code (with credentials injected) with bubbleCore available as global
    const func = new Function(
      '__bubbleCore',
      'payload',
      'console',
      'Buffer',
      `
      ${finalCode}
      
      // Return the instantiated class
      return new ${className}();
    `
    );
    // Wrap bubble core to automatically throw on bubble action failures
    const wrappedBubbleCore: Record<string, unknown> = { ...bubbleCore };
    Object.entries(bubbleCore).forEach(([key, BubbleClass]) => {
      if (
        BubbleClass &&
        typeof BubbleClass === 'function' &&
        BubbleClass.prototype?.action
      ) {
        // Create a wrapper that extends the bubble class with proper typing
        interface BubbleInstance {
          action(
            ...args: unknown[]
          ): Promise<{ success: boolean; error?: string }>;
        }
        const BubbleConstructor = BubbleClass as new (
          ...args: unknown[]
        ) => BubbleInstance;

        class WrappedBubble extends BubbleConstructor {
          async action(...args: unknown[]) {
            const result = await super.action(...args);
            if (!result.success) {
              throw new Error(
                `${BubbleConstructor.name} failed: ${result.error || 'Unknown error'}`
              );
            }
            return result;
          }
        }

        wrappedBubbleCore[key] = WrappedBubble;
      }
    });

    // Auto-inject userId into payload
    const enhancedPayload = {
      ...payload,
      userId: options.userId, // Always include userId in the payload
    };

    const flowInstance = func.call(
      {},
      wrappedBubbleCore,
      enhancedPayload,
      sandbox.console,
      sandbox.Buffer
    );

    try {
      // Now call the handle method
      const result: BubbleOperationResult =
        await flowInstance.handle(enhancedPayload);

      // If the result doesn't have a success property, assume success
      // This handles cases where BubbleFlow returns plain objects
      const isSuccess = result.success !== undefined ? result.success : true;

      return {
        executionId: 0,
        success: isSuccess,
        error: result.error || '',
        data: result,
      };
    } catch (error) {
      const safeError = getSafeErrorMessage(error);
      console.error('Execution error:', safeError);
      return {
        executionId: 0,
        success: false,
        error: safeError,
        data: undefined,
      };
    }
  } catch (error) {
    const safeError = getSafeErrorMessage(error);
    console.error('Execution error:', safeError);
    return {
      executionId: 0,
      success: false,
      error: safeError,
      data: undefined,
    };
  }
}
