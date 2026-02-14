declare module '@sendsafely/sendsafely' {
  class SendSafely {
    constructor(host: string, apiKey: string, apiSecret: string);

    on(event: string, callback: (...args: unknown[]) => void): void;

    verifyCredentials(callback: (email: string) => void): void;

    createPackage(
      callback: (
        packageId: string,
        serverSecret: string,
        packageCode: string,
        keyCode: string
      ) => void
    ): void;

    addRecipient(
      packageId: string,
      email: string,
      keyCode: string | undefined,
      callback: (recipientId: string) => void
    ): void;

    addRecipients(
      packageId: string,
      emails: string[],
      keyCode: string | undefined,
      callback: (response: {
        recipients: Array<{
          recipientId: string;
          email: string;
          approvalRequired: boolean;
        }>;
        approvalRequired: boolean;
      }) => void
    ): void;

    encryptAndUploadFiles(
      packageId: string,
      keyCode: string,
      serverSecret: string,
      files: Array<{
        name: string;
        size: number;
        slice: (start?: number, end?: number) => Buffer;
      }>,
      uploadType: string,
      callback: (fileId: string) => void
    ): void;

    encryptMessage(
      packageId: string,
      keyCode: string,
      serverSecret: string,
      message: string,
      callback: (encryptedMessage: string) => void
    ): void;

    finalizePackage(
      packageId: string,
      packageCode: string,
      keyCode: string | undefined,
      callback: (secureLink: string) => void
    ): void;

    finalizeUndisclosedPackage(
      packageId: string,
      packageCode: string,
      keyCode: string,
      password: string | undefined,
      callback: (secureLink: string) => void
    ): void;

    saveMessage(packageId: string, message: string, callback: () => void): void;

    updatePackage(
      packageId: string,
      data: { life: number },
      callback: (info: Record<string, unknown>) => void
    ): void;

    packageInformation(
      packageId: string,
      callback: (info: Record<string, unknown>) => void
    ): void;
  }

  export default SendSafely;
}
