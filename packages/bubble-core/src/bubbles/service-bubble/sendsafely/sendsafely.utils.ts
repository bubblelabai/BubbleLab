/**
 * SendSafely Bubble Utility Functions
 *
 * Promise wrappers around the callback-based @sendsafely/sendsafely SDK
 * and credential parsing helpers.
 */

import SendSafely from '@sendsafely/sendsafely';
import { decodeCredentialPayload } from '@bubblelab/shared-schemas';

/** Default timeout for SDK operations (30 seconds) */
const SDK_TIMEOUT_MS = 30_000;

export interface SendSafelyCredentials {
  host: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Parse a multi-field credential value into typed SendSafely fields.
 * Uses the shared decodeMultiFieldCredential() which handles both
 * base64 (injection path) and raw JSON (validator path).
 */
export function parseSendSafelyCredential(
  value: string
): SendSafelyCredentials {
  const parsed = decodeCredentialPayload<Record<string, string>>(value);
  if (!parsed.host || !parsed.apiKey || !parsed.apiSecret) {
    throw new Error(
      'SendSafely credential is missing required fields: host, apiKey, apiSecret'
    );
  }
  return {
    host: parsed.host,
    apiKey: parsed.apiKey,
    apiSecret: parsed.apiSecret,
  };
}

/**
 * Create a SendSafely client instance from credentials
 */
export function createClient(creds: SendSafelyCredentials): SendSafely {
  return new SendSafely(creds.host, creds.apiKey, creds.apiSecret);
}

/**
 * Wrap a callback-based SDK call in a Promise with timeout and one-shot error handling.
 * Prevents: (1) infinite hangs when callbacks never fire, (2) stacking error handlers.
 */
function withTimeout<T>(
  client: SendSafely,
  executor: (
    resolve: (value: T) => void,
    reject: (reason: Error) => void
  ) => void,
  operationName: string,
  timeoutMs: number = SDK_TIMEOUT_MS,
  additionalErrorEvents: string[] = []
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    // One-shot error handler — listens on general + operation-specific events
    const errorHandler = (...args: unknown[]) => {
      const msg = args
        .map((a) =>
          typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)
        )
        .join(', ');
      settle(() =>
        reject(new Error(`SendSafely ${operationName} error: ${msg}`))
      );
    };
    const errorEvents = ['sendsafely.error', ...additionalErrorEvents];
    for (const evt of errorEvents) {
      client.on(evt, errorHandler);
    }

    // Timeout guard
    const timer = setTimeout(() => {
      settle(() =>
        reject(
          new Error(
            `SendSafely ${operationName} timed out after ${timeoutMs}ms`
          )
        )
      );
    }, timeoutMs);

    executor(
      (value: T) => {
        clearTimeout(timer);
        settle(() => resolve(value));
      },
      (reason: Error) => {
        clearTimeout(timer);
        settle(() => reject(reason));
      }
    );
  });
}

/**
 * Verify credentials by requesting the authenticated user email
 */
export function verifyCredentials(client: SendSafely): Promise<string> {
  return withTimeout(
    client,
    (resolve) => {
      client.verifyCredentials((email: string) => resolve(email));
    },
    'verifyCredentials'
  );
}

/**
 * Create a new empty package
 */
export function createPackage(client: SendSafely): Promise<{
  packageId: string;
  serverSecret: string;
  packageCode: string;
  keyCode: string;
}> {
  return withTimeout(
    client,
    (resolve) => {
      // Callback: (packageId, serverSecret, packageCode, keyCode)
      client.createPackage(
        (
          packageId: string,
          serverSecret: string,
          packageCode: string,
          keyCode: string
        ) => resolve({ packageId, serverSecret, packageCode, keyCode })
      );
    },
    'createPackage'
  );
}

/**
 * Add a recipient to a package
 */
export function addRecipient(
  client: SendSafely,
  packageId: string,
  email: string
): Promise<string> {
  return withTimeout(
    client,
    (resolve) => {
      client.addRecipient(packageId, email, undefined, (recipientId: string) =>
        resolve(recipientId)
      );
    },
    'addRecipient'
  );
}

/**
 * Add multiple recipients to a package in a single API call.
 * Also accepts a single email string for convenience.
 */
export function addRecipients(
  client: SendSafely,
  packageId: string,
  emails: string | string[]
): Promise<string[]> {
  const emailList = Array.isArray(emails) ? emails : [emails];
  return withTimeout(
    client,
    (resolve) => {
      client.addRecipients(packageId, emailList, undefined, (response) =>
        resolve(response.recipients.map((r) => r.recipientId))
      );
    },
    'addRecipients'
  );
}

/**
 * Encrypt and upload a file to a package
 */
export function encryptAndUploadFile(
  client: SendSafely,
  packageId: string,
  packageCode: string,
  serverSecret: string,
  fileName: string,
  fileData: Buffer
): Promise<{ fileId: string }> {
  return withTimeout(
    client,
    (resolve) => {
      // The SDK's upload code calls _slice(currentFile.file.data, start, end)
      // which expects a blob-like object with .slice(). Buffer has .slice()
      // so we expose the raw buffer as `data`.
      const file = {
        name: fileName,
        size: fileData.length,
        data: fileData,
        slice: (start?: number, end?: number) => fileData.subarray(start, end),
      };
      // SDK method is plural: encryptAndUploadFiles
      // Signature: (packageId, keyCode, serverSecret, files[], uploadType, callback)
      client.encryptAndUploadFiles(
        packageId,
        packageCode,
        serverSecret,
        [file],
        'JavaScript',
        (fileId: string) => resolve({ fileId })
      );
    },
    'encryptAndUploadFile',
    120_000, // 2 minutes for file uploads
    ['FILES_ENCRYPT_ERROR']
  );
}

/**
 * Encrypt a message client-side. Returns the encrypted text which must
 * then be saved to the server via saveMessage().
 */
export function encryptMessage(
  client: SendSafely,
  packageId: string,
  packageCode: string,
  serverSecret: string,
  message: string
): Promise<string> {
  return withTimeout(
    client,
    (resolve) => {
      client.encryptMessage(
        packageId,
        packageCode,
        serverSecret,
        message,
        (encryptedMessage: string) => resolve(encryptedMessage)
      );
    },
    'encryptMessage',
    SDK_TIMEOUT_MS,
    ['MESSAGE_ENCRYPT_ERROR']
  );
}

/**
 * Finalize a package (triggers notification to recipients).
 *
 * Uses the standard `finalizePackage` SDK method which:
 * 1. Gets public keys for all recipients
 * 2. Encrypts the keyCode with each recipient's public key
 * 3. Uploads encrypted keycodes to the server
 * 4. Calls the finalize HTTP endpoint
 *
 * Note: Requires a patched `keyGeneratorWorker.js` that exposes
 * `self.send = send;` — otherwise the keycode encryption callback
 * never fires because `self.send` is undefined in eval'd context.
 */
export function finalizePackage(
  client: SendSafely,
  packageId: string,
  packageCode: string,
  keyCode: string
): Promise<string> {
  return withTimeout(
    client,
    (resolve) => {
      client.finalizePackage(
        packageId,
        packageCode,
        keyCode,
        (secureLink: string) => resolve(secureLink)
      );
    },
    'finalizePackage',
    60_000, // 60 seconds — keycode encryption + upload can be slow
    ['finalization.error']
  );
}

/**
 * Save an encrypted message to a package on the server.
 * Must be called after encryptMessage() to persist the encrypted text.
 */
export function saveMessage(
  client: SendSafely,
  packageId: string,
  encryptedMessage: string
): Promise<void> {
  return withTimeout(
    client,
    (resolve) => {
      client.saveMessage(packageId, encryptedMessage, () => resolve());
    },
    'saveMessage'
  );
}

/**
 * Update a package (e.g. set expiration via { life: N })
 */
export function updatePackage(
  client: SendSafely,
  packageId: string,
  data: { life: number }
): Promise<Record<string, unknown>> {
  return withTimeout(
    client,
    (resolve) => {
      client.updatePackage(packageId, data, (info: Record<string, unknown>) =>
        resolve(info)
      );
    },
    'updatePackage'
  );
}

/**
 * Get package information by package ID
 */
export function getPackageInfo(
  client: SendSafely,
  packageId: string
): Promise<Record<string, unknown>> {
  return withTimeout(
    client,
    (resolve) => {
      client.packageInformation(packageId, (info: Record<string, unknown>) =>
        resolve(info)
      );
    },
    'getPackageInfo'
  );
}
