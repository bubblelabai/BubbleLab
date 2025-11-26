import {
  CredentialType,
  type DatabaseMetadata,
} from '@bubblelab/shared-schemas';
import { getBubbleFactory } from './bubble-factory-instance.js';
import { CredentialEncryption } from '../utils/encryption.js';
import type { IServiceBubble } from '@bubblelab/bubble-core';

export interface CredentialValidationResult {
  isValid: boolean;
  error?: string;
  bubbleName?: string;
}

export class CredentialValidator {
  /**
   * Validates a credential by instantiating the appropriate bubble and calling testCredential()
   */
  static async validateCredential(
    credentialType: CredentialType,
    credentialValue: string,
    skipValidation = false,
    configurations?: Record<string, unknown>
  ): Promise<CredentialValidationResult> {
    // Skip validation if explicitly requested
    if (skipValidation || credentialType === CredentialType.FIRECRAWL_API_KEY) {
      return { isValid: true };
    }

    // Get the bubble name for this credential type
    const factory = await getBubbleFactory();
    const bubbleName = factory.getBubbleNameForCredential(credentialType);
    if (!bubbleName) {
      return {
        isValid: true,
        error: `No service bubble implementation found for credential type: ${credentialType}, skipping validation`,
      };
    }

    try {
      // Check if bubble is registered
      const bubbleMetadata = factory.getMetadata(bubbleName);
      if (!bubbleMetadata) {
        return {
          isValid: false,
          error: `Bubble '${bubbleName}' is not registered`,
          bubbleName,
        };
      }

      // Create bubble instance with minimal parameters for testing
      const testParams = this.createTestParameters(credentialType);

      // Pass undefined to let the bubble use its default constructor parameters
      const bubbleInstance = factory.createBubble(
        bubbleName,
        Object.keys(testParams).length > 0 ? testParams : undefined
      );

      const serviceBubble = bubbleInstance as IServiceBubble;
      // Apply configurations if provided
      if (configurations) {
        for (const [paramName, paramValue] of Object.entries(configurations)) {
          serviceBubble.setParam(paramName, paramValue);
        }
      }
      serviceBubble.setParam('credentials', {
        [credentialType]: credentialValue,
      });
      const isValid = await serviceBubble.testCredential();

      return {
        isValid,
        error: isValid
          ? undefined
          : `Credential validation failed - please check your credentials`,
        bubbleName,
      };
    } catch (error) {
      console.error('Error validating credential', error);

      // Check for SSL-related errors and provide helpful guidance
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isSSLError =
        errorMessage.toLowerCase().includes('ssl') ||
        errorMessage.toLowerCase().includes('certificate') ||
        errorMessage.toLowerCase().includes('encryption') ||
        errorMessage.toLowerCase().includes('pg_hba.conf');

      let userFriendlyError = `We couldn't validate your credentials with the service - please check your credentials, error: ${errorMessage}`;

      if (isSSLError) {
        userFriendlyError =
          'SSL is enabled but the server\'s certificate could not be verified. If you are using a self-signed or custom certificate, enable the "Skip certificate verification (SSL stays enabled)" option in the connection settings. This disables certificate verification only; SSL encryption remains active. Also verify your host, port, and network allowlist settings. Original error: ' +
          errorMessage;
      }

      return {
        isValid: false,
        error: userFriendlyError,
        bubbleName,
      };
    }
  }

  /**
   * Validates an encrypted credential by decrypting it first
   */
  static async validateEncryptedCredential(
    credentialType: CredentialType,
    encryptedValue: string,
    skipValidation = false,
    configurations?: Record<string, unknown>
  ): Promise<CredentialValidationResult> {
    if (skipValidation) {
      return { isValid: true };
    }

    try {
      const decryptedValue = await CredentialEncryption.decrypt(encryptedValue);
      return this.validateCredential(
        credentialType,
        decryptedValue,
        skipValidation,
        configurations
      );
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to decrypt credential: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Creates minimal test parameters for bubble instantiation
   */
  private static createTestParameters(
    credentialType: CredentialType
  ): Record<string, unknown> {
    const baseParams: Record<string, unknown> = {};
    // Map credential types to their expected parameter names
    switch (credentialType) {
      case CredentialType.SLACK_CRED:
        break;
      case CredentialType.OPENAI_CRED:
        baseParams.message = 'Hello, how are you?';
        baseParams.model = {
          model: 'openai/gpt-5',
        };
        break;
      case CredentialType.ANTHROPIC_CRED:
        baseParams.message = 'Hello, how are you?';
        baseParams.model = {
          model: 'anthropic/claude-sonnet-4-5',
        };
        break;
      case CredentialType.GOOGLE_GEMINI_CRED:
        baseParams.message = 'Hello, how are you?';
        baseParams.model = {
          model: 'google/gemini-2.5-flash',
        };
        break;
      case CredentialType.GITHUB_TOKEN:
        baseParams.operation = 'get_repository';
        baseParams.owner = 'octocat';
        baseParams.repo = 'Hello-World';
        break;

      case CredentialType.OPENROUTER_CRED:
        baseParams.message = 'Hello, how are you?';
        baseParams.model = {
          model: 'openrouter/openai/gpt-oss-120b',
        };
        break;
      case CredentialType.ELEVENLABS_API_KEY:
        baseParams.operation = 'get_signed_url';
        baseParams.agentId = 'test-agent-id';
        break;
      case CredentialType.APIFY_CRED:
        baseParams.actorId = 'test-actor-id';
        baseParams.input = {
          message: 'Hello, how are you?',
        };
        break;
      default:
        break;
    }

    return baseParams;
  }

  /**
   * Gets the bubble name associated with a credential type
   */
  static async getBubbleNameForCredential(credentialType: CredentialType) {
    const factory = await getBubbleFactory();
    return factory.getBubbleNameForCredential(credentialType);
  }

  /**
   * Checks if a credential type supports validation
   */
  static async supportsValidation(
    credentialType: CredentialType
  ): Promise<boolean> {
    const factory = await getBubbleFactory();
    return factory.isCredentialSupported(credentialType);
  }

  /**
   * Gets metadata for a credential by instantiating the appropriate bubble and calling getCredentialMetadata()
   */
  static async getCredentialMetadata(
    credentialType: CredentialType,
    credentialValue: string,
    configurations?: Record<string, unknown>
  ): Promise<DatabaseMetadata | undefined> {
    // Get the bubble name for this credential type
    const factory = await getBubbleFactory();
    const bubbleName = factory.getBubbleNameForCredential(credentialType);
    if (!bubbleName) {
      return undefined;
    }

    try {
      // Check if bubble is registered
      const bubbleMetadata = factory.getMetadata(bubbleName);
      if (!bubbleMetadata) {
        return undefined;
      }

      // Create bubble instance with minimal parameters for testing
      const testParams = this.createTestParameters(credentialType);

      // Pass undefined to let the bubble use its default constructor parameters
      const bubbleInstance = factory.createBubble(
        bubbleName,
        Object.keys(testParams).length > 0 ? testParams : undefined
      );

      const serviceBubble = bubbleInstance as IServiceBubble;

      // Apply configurations if provided
      if (configurations) {
        for (const [paramName, paramValue] of Object.entries(configurations)) {
          serviceBubble.setParam(paramName, paramValue);
        }
      }
      serviceBubble.setParam('credentials', {
        [credentialType]: credentialValue,
      });

      // Get metadata using reflection to access protected method
      const metadata = await (
        serviceBubble as IServiceBubble
      ).getCredentialMetadata();

      return metadata;
    } catch (error) {
      console.error('Error getting credential metadata', error);
      return undefined;
    }
  }

  /**
   * Gets metadata for an encrypted credential by decrypting it first
   */
  static async getEncryptedCredentialMetadata(
    credentialType: CredentialType,
    encryptedValue: string,
    configurations?: Record<string, unknown>
  ): Promise<DatabaseMetadata | undefined> {
    try {
      const decryptedValue = await CredentialEncryption.decrypt(encryptedValue);
      return this.getCredentialMetadata(
        credentialType,
        decryptedValue,
        configurations
      );
    } catch (error) {
      console.error('Error decrypting credential for metadata', error);
      return undefined;
    }
  }
}
