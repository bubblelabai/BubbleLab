// @ts-expect-error - Bun test types
import { describe, it, expect, afterEach } from 'bun:test';
import { db } from '../db/index.js';
import { userCredentials } from '../db/schema.js';
import { inArray } from 'drizzle-orm';
import '../config/env.js';
import { CredentialEncryption } from '../utils/encryption.js';
import { TestApp } from '../test/test-app.js';

describe('Credential Creation URL Encoding Debug', () => {
  const createdCredentialIds: number[] = [];

  afterEach(async () => {
    // Cleanup
    if (createdCredentialIds.length > 0) {
      // Filter out any undefined values before trying to delete
      const validIds = createdCredentialIds.filter(
        (id) => id !== undefined && id !== null
      );
      if (validIds.length > 0) {
        await db
          .delete(userCredentials)
          .where(inArray(userCredentials.id, validIds));
      }
      createdCredentialIds.length = 0; // Clear the array
    }
  });

  it('should trace URL encoding through the entire credential creation pipeline', async () => {
    const originalValue = 'postgresql://user:Kx9#mP2$vL8@nQ5!wR7&@host:5432/db';
    console.log('🔍 Step 1 - Original value:', originalValue);

    // Step 2: Make API request
    const createCredResponse = await TestApp.post('/credentials', {
      credentialType: 'DATABASE_CRED',
      value: originalValue,
      name: 'Debug Credential',
      skipValidation: true,
    });

    console.log(
      '🔍 Step 2 - API request body sent:',
      JSON.stringify({
        credentialType: 'DATABASE_CRED',
        value: originalValue,
        name: 'Debug Credential',
        skipValidation: true,
      })
    );

    expect(createCredResponse.status).toBe(201);
    const credData = (await createCredResponse.json()) as { id: number };
    createdCredentialIds.push(credData.id);

    console.log('🔍 Step 3 - API response:', credData);

    // Step 4: Check what's actually stored in the database
    const dbRecord = await db
      .select()
      .from(userCredentials)
      .where(inArray(userCredentials.id, [credData.id]));

    console.log(
      '🔍 Step 4 - Database record (encrypted):',
      dbRecord[0]?.encryptedValue?.substring(0, 50) + '...' || 'No record found'
    );

    // Step 5: Decrypt what's stored
    if (!dbRecord[0]?.encryptedValue) {
      throw new Error('No encrypted value found in database record');
    }
    const decryptedFromDb = await CredentialEncryption.decrypt(
      dbRecord[0].encryptedValue
    );
    console.log('🔍 Step 5 - Decrypted from database:', decryptedFromDb);

    // Step 6: Check for URL encoding
    const hasUrlEncoding =
      decryptedFromDb.includes('%23') || decryptedFromDb.includes('%40');
    console.log('🔍 Step 6 - Contains URL encoding?', hasUrlEncoding);

    if (hasUrlEncoding) {
      const urlDecoded = decodeURIComponent(decryptedFromDb);
      console.log('🔍 Step 6b - After URL decoding:', urlDecoded);
      expect(urlDecoded).toBe(originalValue);
    } else {
      expect(decryptedFromDb).toBe(originalValue);
    }
  });

  it('should test direct encryption without API to isolate the issue', async () => {
    const originalValue = 'postgresql://user:Kx9#mP2$vL8@nQ5!wR7&@host:5432/db';
    console.log('🔍 Direct encryption test - Original value:', originalValue);

    // Direct encryption/decryption without API
    const encrypted = await CredentialEncryption.encrypt(originalValue);
    console.log(
      '🔍 Direct encryption test - Encrypted:',
      encrypted.substring(0, 50) + '...'
    );

    const decrypted = await CredentialEncryption.decrypt(encrypted);
    console.log('🔍 Direct encryption test - Decrypted:', decrypted);

    const hasUrlEncoding =
      decrypted.includes('%23') || decrypted.includes('%40');
    console.log(
      '🔍 Direct encryption test - Contains URL encoding?',
      hasUrlEncoding
    );

    expect(decrypted).toBe(originalValue);
    expect(hasUrlEncoding).toBe(false);
  });
});
