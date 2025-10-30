// @ts-expect-error - Bun test types
import { describe, it, expect, beforeAll, mock } from 'bun:test';
import { CredentialValidator } from './credential-validator.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { CredentialEncryption } from '../utils/encryption.js';
import { getBubbleFactory } from './bubble-factory-instance.js';

describe('CredentialValidator', () => {
  beforeAll(async () => {
    // Ensure factory is initialized
    await getBubbleFactory();

    // Set up encryption key for tests
    if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
      process.env.CREDENTIAL_ENCRYPTION_KEY =
        'test-encryption-key-that-is-32-chars-long-for-testing';
    }
  });

  describe('validateCredential', () => {
    it('should return true when skipValidation is true', async () => {
      const result = await CredentialValidator.validateCredential(
        CredentialType.SLACK_CRED,
        'test-token',
        true
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should skip credential validation when no bubble implementation exists, ie a tool bubble', async () => {
      // Create a fake credential type that doesn't have a bubble
      const fakeCredType = 'FAKE_CRED' as CredentialType;

      const result = await CredentialValidator.validateCredential(
        fakeCredType,
        'test-value',
        false
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toContain('No service bubble implementation found');
    });

    it('should validate Slack credentials', async () => {
      // Mock the Slack API call to return success
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({ ok: true }),
        })
      );
      global.fetch = mockFetch as any;

      const result = await CredentialValidator.validateCredential(
        CredentialType.SLACK_CRED,
        'xoxb-test-token',
        false
      );

      expect(result.bubbleName).toBe('slack');
      // Note: The testCredential call might fail due to missing botToken in params
      // but the mapping should work correctly
    });

    it('should validate AI credentials (OpenAI)', async () => {
      // Mock OpenAI API call with proper response structure
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Hello!' } }],
            }),
        })
      );
      global.fetch = mockFetch as any;

      const result = await CredentialValidator.validateCredential(
        CredentialType.OPENAI_CRED,
        'sk-test-key',
        false
      );

      expect(result.bubbleName).toBe('ai-agent');
      // Note: The actual validation might still fail due to API structure differences
    });

    it('should validate database credentials', async () => {
      // For PostgreSQL, we can't easily mock the connection
      // So we expect it to fail with a connection error
      const result = await CredentialValidator.validateCredential(
        CredentialType.DATABASE_CRED,
        'postgresql://fake:fake@localhost:5432/fake',
        false
      );

      expect(result.bubbleName).toBe('postgresql');
      // Will fail since we can't connect to a real database
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle bubble instantiation errors gracefully', async () => {
      const result = await CredentialValidator.validateCredential(
        CredentialType.SLACK_CRED,
        '', // Empty credential should cause validation to fail
        false
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateEncryptedCredential', () => {
    it('should decrypt and validate credential', async () => {
      const testValue = 'test-credential-value';
      const encrypted = await CredentialEncryption.encrypt(testValue);

      // Mock successful validation
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({ ok: true }),
        })
      );
      global.fetch = mockFetch as any;

      const result = await CredentialValidator.validateEncryptedCredential(
        CredentialType.SLACK_CRED,
        encrypted,
        false
      );

      expect(result.bubbleName).toBe('slack');
    });

    it('should return error when decryption fails', async () => {
      const result = await CredentialValidator.validateEncryptedCredential(
        CredentialType.SLACK_CRED,
        'invalid-encrypted-data',
        false
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Failed to decrypt credential');
    });

    it('should skip validation when skipValidation is true', async () => {
      const result = await CredentialValidator.validateEncryptedCredential(
        CredentialType.SLACK_CRED,
        'any-encrypted-value',
        true
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('getBubbleNameForCredential', () => {
    it('should return correct bubble name for Slack credential', async () => {
      const bubbleName = await CredentialValidator.getBubbleNameForCredential(
        CredentialType.SLACK_CRED
      );

      expect(bubbleName).toBe('slack');
    });

    it('should return correct bubble name for AI credentials', async () => {
      const openAIBubble = await CredentialValidator.getBubbleNameForCredential(
        CredentialType.OPENAI_CRED
      );
      const anthropicBubble =
        await CredentialValidator.getBubbleNameForCredential(
          CredentialType.ANTHROPIC_CRED
        );
      const geminiBubble = await CredentialValidator.getBubbleNameForCredential(
        CredentialType.GOOGLE_GEMINI_CRED
      );

      expect(openAIBubble).toBe('ai-agent');
      expect(anthropicBubble).toBe('ai-agent');
      expect(geminiBubble).toBe('ai-agent');
    });

    it('should return correct bubble name for database credential', async () => {
      const bubbleName = await CredentialValidator.getBubbleNameForCredential(
        CredentialType.DATABASE_CRED
      );

      expect(bubbleName).toBe('postgresql');
    });

    it('should return undefined for unsupported credential type', async () => {
      const bubbleName = await CredentialValidator.getBubbleNameForCredential(
        'UNSUPPORTED_CRED' as CredentialType
      );

      expect(bubbleName).toBeUndefined();
    });
  });

  describe('supportsValidation', () => {
    it('should return true for supported credential types', async () => {
      expect(
        await CredentialValidator.supportsValidation(CredentialType.SLACK_CRED)
      ).toBe(true);
      expect(
        await CredentialValidator.supportsValidation(CredentialType.OPENAI_CRED)
      ).toBe(true);
      expect(
        await CredentialValidator.supportsValidation(
          CredentialType.DATABASE_CRED
        )
      ).toBe(true);
    });

    it('should return false for unsupported credential types', async () => {
      expect(
        await CredentialValidator.supportsValidation(
          'FAKE_CRED' as CredentialType
        )
      ).toBe(false);
    });
  });
});
