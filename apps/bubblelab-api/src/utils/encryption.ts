import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import type { CipherGCMTypes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Encryption utility for securing user credentials
 * Uses AES-256-GCM for authenticated encryption
 */
export class CredentialEncryption {
  private static algorithm: CipherGCMTypes = 'aes-256-gcm';
  private static keyLength = 32; // 256 bits
  private static ivLength = 16; // 128 bits
  private static tagLength = 16; // 128 bits
  private static saltLength = 32; // 256 bits

  private static getEncryptionKey(): string {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!key) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY environment variable is required'
      );
    }
    if (key.length < 32) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY must be at least 32 characters long'
      );
    }
    return key;
  }

  /**
   * Derives a key from the master key and salt using PBKDF2
   */
  private static async deriveKey(salt: Buffer): Promise<Buffer> {
    const masterKey = this.getEncryptionKey();
    return (await scryptAsync(masterKey, salt, this.keyLength)) as Buffer;
  }

  /**
   * Encrypts a credential value
   * Returns base64-encoded string containing salt, iv, tag, and ciphertext
   */
  static async encrypt(plaintext: string): Promise<string> {
    try {
      // Generate random salt for key derivation
      const salt = randomBytes(this.saltLength);

      // Derive key from master key and salt
      const key = await this.deriveKey(salt);

      // Generate random IV
      const iv = randomBytes(this.ivLength);

      // Create cipher
      const cipher = createCipheriv(this.algorithm, key, iv);

      // Encrypt the plaintext
      let ciphertext = cipher.update(plaintext, 'utf8');
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine salt, iv, tag, and ciphertext
      const result = Buffer.concat([salt, iv, tag, ciphertext]);

      // Return as base64 string
      return result.toString('base64');
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Decrypts a credential value
   * Takes base64-encoded string and returns plaintext
   */
  static async decrypt(encryptedData: string): Promise<string> {
    try {
      // Decode from base64
      const data = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = data.subarray(0, this.saltLength);
      const iv = data.subarray(
        this.saltLength,
        this.saltLength + this.ivLength
      );
      const tag = data.subarray(
        this.saltLength + this.ivLength,
        this.saltLength + this.ivLength + this.tagLength
      );
      const ciphertext = data.subarray(
        this.saltLength + this.ivLength + this.tagLength
      );

      // Derive key from master key and salt
      const key = await this.deriveKey(salt);

      // Create decipher
      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      // Decrypt the ciphertext
      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      return plaintext.toString('utf8');
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validates that the encryption key is properly configured
   */
  static validateConfiguration(): void {
    try {
      this.getEncryptionKey();
    } catch (error) {
      throw new Error(
        `Credential encryption configuration invalid: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
