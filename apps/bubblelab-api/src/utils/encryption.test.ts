// @ts-expect-error - Bun test
import { describe, it, expect } from 'bun:test';
import '../config/env.js';
import { CredentialEncryption } from './encryption.js';

describe('CredentialEncryption', () => {
  it('should encrypt and decrypt a secret correctly', async () => {
    const testSecret = 'my-super-secret-api-key-12345';

    // Encrypt
    const encrypted = await CredentialEncryption.encrypt(testSecret);

    // Decrypt
    const decrypted = await CredentialEncryption.decrypt(encrypted);

    // Verify
    expect(decrypted).toBe(testSecret);
  });

  it('should handle empty string', async () => {
    const testSecret = '';

    const encrypted = await CredentialEncryption.encrypt(testSecret);
    const decrypted = await CredentialEncryption.decrypt(encrypted);

    expect(decrypted).toBe(testSecret);
  });

  it('should handle strings with special characters', async () => {
    const testSecret = 'key-with-"quotes"-and-\n-newlines-\t-tabs-🔑-unicode';

    const encrypted = await CredentialEncryption.encrypt(testSecret);
    const decrypted = await CredentialEncryption.decrypt(encrypted);

    expect(decrypted).toBe(testSecret);
  });

  it('should handle database passwords with URL-unsafe characters', async () => {
    // Test common URL-unsafe characters in passwords
    const testSecret = 'pass#word$with@special&chars!';

    const encrypted = await CredentialEncryption.encrypt(testSecret);
    const decrypted = await CredentialEncryption.decrypt(encrypted);

    expect(decrypted).toBe(testSecret);
    // Verify it's not URL encoded
    expect(decrypted).not.toBe('pass%23word%24with%40special%26chars!');
  });

  it('should preserve URL-encoded credentials through encrypt/decrypt', async () => {
    const urlEncodedSecret = encodeURIComponent(
      'postgresql://user:pass#word$with@special&chars!'
    );

    const encrypted = await CredentialEncryption.encrypt(urlEncodedSecret);
    const decrypted = await CredentialEncryption.decrypt(encrypted);

    expect(decrypted).toBe(urlEncodedSecret);
    expect(decrypted).toContain('%23');
    expect(decrypted).toContain('%40');

    const urlDecoded = decodeURIComponent(decrypted);
    expect(urlDecoded).toContain('#');
    expect(urlDecoded).toContain('@');
  });

  it('should handle connection strings with special characters', async () => {
    const testSecret = 'postgresql://user:pass#word$@host:5432/db';

    const encrypted = await CredentialEncryption.encrypt(testSecret);
    const decrypted = await CredentialEncryption.decrypt(encrypted);

    expect(decrypted).toBe(testSecret);
  });

  it('should handle very long strings', async () => {
    const testSecret = 'a'.repeat(10000);

    const encrypted = await CredentialEncryption.encrypt(testSecret);
    const decrypted = await CredentialEncryption.decrypt(encrypted);

    expect(decrypted).toBe(testSecret);
  });

  it('should fail with invalid base64 data', async () => {
    expect(async () => {
      await CredentialEncryption.decrypt('invalid-base64-data!!!');
    }).toThrow();
  });

  it('should fail with too short encrypted data', async () => {
    // Create data that's too short to contain all required components
    const tooShort = Buffer.from('short').toString('base64');

    expect(async () => {
      await CredentialEncryption.decrypt(tooShort);
    }).toThrow();
  });
});
