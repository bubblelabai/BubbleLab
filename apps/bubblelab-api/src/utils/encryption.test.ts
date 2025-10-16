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

  it('should decrypt actual encrypted credential from database (shows URL encoding issue)', async () => {
    // Test decrypting an actual encrypted value from the database
    const encryptedValue =
      'UieNwEEC2VhksgAk57npKXKu2NgCLx7DTRpLs+2/o6ARZAccYB4yDEmcR5JKLL/Pdacd4xxJ+REeaVtJWh7vMdpxAifWgQDEiel13eUZvVSf/YPISJcH0Ru3kSmi5T0afOZ509ilRB2u/C+QS36HxncDWu0tOpjCtCvL5bszxrKYxRMVmxn5PWk72gkm+Avu1jL6BAfQZb6hCPTR1p3v440JX8T33g0LuxTthKm1';

    const decrypted = await CredentialEncryption.decrypt(encryptedValue);

    console.log('Decrypted value (URL encoded):', decrypted);

    // This demonstrates the issue - the stored credential was URL encoded before encryption
    expect(decrypted).toContain('%23'); // Contains URL encoded #
    expect(decrypted).toContain('%40'); // Contains URL encoded @

    // Show what it should look like after URL decoding
    const urlDecoded = decodeURIComponent(decrypted);
    console.log('After URL decoding:', urlDecoded);

    // The URL decoded version should have the original special characters
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
