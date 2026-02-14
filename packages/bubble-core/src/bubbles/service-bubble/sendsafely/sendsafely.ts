import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  SendSafelyParamsSchema,
  SendSafelyResultSchema,
  type SendSafelyParams,
  type SendSafelyParamsInput,
  type SendSafelyResult,
} from './sendsafely.schema.js';
import {
  parseSendSafelyCredential,
  createClient,
  verifyCredentials,
  createPackage,
  addRecipient,
  encryptAndUploadFile,
  encryptMessage,
  saveMessage,
  finalizePackage,
  updatePackage,
  getPackageInfo,
} from './sendsafely.utils.js';

/**
 * SendSafely Service Bubble
 *
 * Encrypted file transfer and secure messaging via SendSafely.
 * Uses the official @sendsafely/sendsafely SDK (v3).
 *
 * Features:
 * - Send encrypted files to recipients via secure links
 * - Send encrypted messages via secure links
 * - Retrieve package information
 *
 * Use cases:
 * - Share sensitive documents securely with external parties
 * - Send encrypted messages through automated workflows
 * - Integrate encrypted file transfer into BubbleFlow pipelines
 *
 * Security Features:
 * - End-to-end encryption via SendSafely SDK
 * - Multi-field credential storage (host + apiKey + apiSecret)
 * - Input validation with Zod schemas
 */
export class SendSafelyBubble<
  T extends SendSafelyParamsInput = SendSafelyParamsInput,
> extends ServiceBubble<
  T,
  Extract<SendSafelyResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'sendsafely';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'sendsafely';
  static readonly schema = SendSafelyParamsSchema;
  static readonly resultSchema = SendSafelyResultSchema;
  static readonly shortDescription =
    'Encrypted file transfer and secure messaging via SendSafely';
  static readonly longDescription = `
    SendSafely integration for encrypted file transfer and secure messaging.
    Uses the official SendSafely SDK with end-to-end encryption.

    Features:
    - Send encrypted files to recipients via secure links
    - Send encrypted messages via secure links
    - Retrieve package information

    Use cases:
    - Share sensitive documents securely with external parties
    - Send encrypted messages through automated workflows
    - Integrate encrypted file transfer into BubbleFlow pipelines

    Security Features:
    - End-to-end encryption via SendSafely SDK
    - Multi-field credential (host + API key + API secret)
    - Input validation with Zod schemas
  `;
  static readonly alias = 'encrypted-transfer';

  constructor(
    params: T = {
      operation: 'get_package',
      package_id: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      return false;
    }

    try {
      const creds = parseSendSafelyCredential(credential);
      const client = createClient(creds);
      await verifyCredentials(client);
      return true;
    } catch {
      return false;
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<SendSafelyResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<SendSafelyResult> => {
        const parsedParams = this.params as SendSafelyParams;
        switch (operation) {
          case 'send_file':
            return await this.sendFile(
              parsedParams as Extract<
                SendSafelyParams,
                { operation: 'send_file' }
              >
            );
          case 'send_message':
            return await this.sendMessage(
              parsedParams as Extract<
                SendSafelyParams,
                { operation: 'send_message' }
              >
            );
          case 'get_package':
            return await this.getPackage(
              parsedParams as Extract<
                SendSafelyParams,
                { operation: 'get_package' }
              >
            );
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<SendSafelyResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<SendSafelyResult, { operation: T['operation'] }>;
    }
  }

  // ============================================================================
  // SEND FILE
  // ============================================================================

  private async sendFile(
    params: Extract<SendSafelyParams, { operation: 'send_file' }>
  ): Promise<Extract<SendSafelyResult, { operation: 'send_file' }>> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('SendSafely credentials are required');
    }

    const creds = parseSendSafelyCredential(credential);
    const client = createClient(creds);

    // 1. Verify credentials
    await verifyCredentials(client);

    // 2. Create a package
    const pkg = await createPackage(client);

    // 3. Set expiration if specified
    if (params.lifeDays !== undefined) {
      await updatePackage(client, pkg.packageId, { life: params.lifeDays });
    }

    // 4. Add recipient
    await addRecipient(client, pkg.packageId, params.recipientEmail);

    // 5. Encrypt and upload file
    const fileBuffer = Buffer.from(params.fileData, 'base64');
    await encryptAndUploadFile(
      client,
      pkg.packageId,
      pkg.keyCode,
      pkg.serverSecret,
      params.fileName,
      fileBuffer
    );

    // 6. Optionally add a message
    if (params.message) {
      const encrypted = await encryptMessage(
        client,
        pkg.packageId,
        pkg.keyCode,
        pkg.serverSecret,
        params.message
      );
      await saveMessage(client, pkg.packageId, encrypted);
    }

    // 7. Finalize (encrypts keycodes for recipients and triggers notification)
    const secureLink = await finalizePackage(
      client,
      pkg.packageId,
      pkg.packageCode,
      pkg.keyCode
    );

    return {
      operation: 'send_file',
      success: true,
      packageId: pkg.packageId,
      secureLink,
      error: '',
    };
  }

  // ============================================================================
  // SEND MESSAGE
  // ============================================================================

  private async sendMessage(
    params: Extract<SendSafelyParams, { operation: 'send_message' }>
  ): Promise<Extract<SendSafelyResult, { operation: 'send_message' }>> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('SendSafely credentials are required');
    }

    const creds = parseSendSafelyCredential(credential);
    const client = createClient(creds);

    // 1. Verify credentials
    await verifyCredentials(client);

    // 2. Create a package
    const pkg = await createPackage(client);

    // 3. Set expiration if specified
    if (params.lifeDays !== undefined) {
      await updatePackage(client, pkg.packageId, { life: params.lifeDays });
    }

    // 4. Add recipient
    await addRecipient(client, pkg.packageId, params.recipientEmail);

    // 5. Encrypt message and save to server
    const encrypted = await encryptMessage(
      client,
      pkg.packageId,
      pkg.keyCode,
      pkg.serverSecret,
      params.message
    );
    await saveMessage(client, pkg.packageId, encrypted);

    // 6. Finalize (encrypts keycodes for recipients and triggers notification)
    const secureLink = await finalizePackage(
      client,
      pkg.packageId,
      pkg.packageCode,
      pkg.keyCode
    );

    return {
      operation: 'send_message',
      success: true,
      packageId: pkg.packageId,
      secureLink,
      error: '',
    };
  }

  // ============================================================================
  // GET PACKAGE
  // ============================================================================

  private async getPackage(
    params: Extract<SendSafelyParams, { operation: 'get_package' }>
  ): Promise<Extract<SendSafelyResult, { operation: 'get_package' }>> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('SendSafely credentials are required');
    }

    const creds = parseSendSafelyCredential(credential);
    const client = createClient(creds);

    await verifyCredentials(client);

    const info = await getPackageInfo(client, params.package_id);

    return {
      operation: 'get_package',
      success: true,
      package: {
        packageId: (info.packageId as string) || params.package_id,
        packageCode: info.packageCode as string | undefined,
        serverSecret: info.serverSecret as string | undefined,
        recipients: info.recipients as
          | Array<{ recipientId: string; email: string }>
          | undefined,
        files: info.files as
          | Array<{ fileId: string; fileName: string; fileSize?: number }>
          | undefined,
        state: info.state as string | undefined,
        life: info.life as number | undefined,
        secureLink: info.secureLink as string | undefined,
      },
      error: '',
    };
  }

  // ============================================================================
  // CREDENTIAL MANAGEMENT
  // ============================================================================

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    return credentials[CredentialType.SENDSAFELY_CRED];
  }
}
