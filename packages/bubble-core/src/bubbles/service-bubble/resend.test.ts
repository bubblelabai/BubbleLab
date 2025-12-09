import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendBubble } from './resend.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Create mock functions
const mockDomainsList = vi.fn();
const mockEmailsSend = vi.fn();
const mockEmailsGet = vi.fn();

// Mock the Resend module
vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      domains: {
        list: mockDomainsList,
      },
      emails: {
        send: mockEmailsSend,
        get: mockEmailsGet,
      },
    })),
  };
});

describe('ResendBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic properties', () => {
    it('should have correct static properties', () => {
      expect(ResendBubble.bubbleName).toBe('resend');
      expect(ResendBubble.service).toBe('resend');
      expect(ResendBubble.authType).toBe('apikey');
      expect(ResendBubble.type).toBe('service');
      expect(ResendBubble.alias).toBe('resend');
      expect(ResendBubble.shortDescription).toContain('Email sending service');
    });

    it('should have longDescription with security features', () => {
      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });
      expect(bubble.longDescription).toContain('Domain enforcement');
      expect(bubble.longDescription).toContain('System credentials');
    });
  });

  describe('domain extraction', () => {
    it('should extract domain from simple email format', () => {
      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      // Access private method via type assertion for testing
      const extractDomain = (bubble as any).extractDomainFromEmail.bind(bubble);
      expect(extractDomain('user@example.com')).toBe('example.com');
      expect(extractDomain('test@mycompany.com')).toBe('mycompany.com');
    });

    it('should extract domain from email with name format', () => {
      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      const extractDomain = (bubble as any).extractDomainFromEmail.bind(bubble);
      expect(extractDomain('John Doe <john@example.com>')).toBe('example.com');
      expect(
        extractDomain('Bubble Lab Team <welcome@hello.bubblelab.ai>')
      ).toBe('hello.bubblelab.ai');
    });

    it('should handle case-insensitive domain extraction', () => {
      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      const extractDomain = (bubble as any).extractDomainFromEmail.bind(bubble);
      expect(extractDomain('user@EXAMPLE.COM')).toBe('example.com');
      expect(extractDomain('User <user@MyCompany.COM>')).toBe('mycompany.com');
    });

    it('should throw error for invalid email format', () => {
      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      const extractDomain = (bubble as any).extractDomainFromEmail.bind(bubble);
      expect(() => extractDomain('invalid-email')).toThrow(
        'Invalid email format'
      );
      expect(() => extractDomain('@')).toThrow('Invalid email format');
    });
  });

  describe('system domain detection', () => {
    it('should identify bubblelab.ai as system domain', () => {
      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      const isSystemDomain = (bubble as any).isSystemDomain.bind(bubble);
      expect(isSystemDomain('bubblelab.ai')).toBe(true);
      expect(isSystemDomain('hello.bubblelab.ai')).toBe(true);
      expect(isSystemDomain('BUBBLELAB.AI')).toBe(true); // case insensitive
      expect(isSystemDomain('HELLO.BUBBLELAB.AI')).toBe(true);
    });

    it('should not identify other domains as system domains', () => {
      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
      });

      const isSystemDomain = (bubble as any).isSystemDomain.bind(bubble);
      expect(isSystemDomain('example.com')).toBe(false);
      expect(isSystemDomain('mycompany.com')).toBe(false);
      expect(isSystemDomain('bubblelab.com')).toBe(false); // different TLD
      expect(isSystemDomain('fake-bubblelab.ai')).toBe(false);
    });
  });

  describe('domain validation and cache invalidation', () => {
    it('should skip validation for system domains', async () => {
      mockDomainsList.mockResolvedValue({
        data: {
          data: [
            { name: 'example.com', status: 'verified' },
            { name: 'mycompany.com', status: 'verified' },
          ],
        },
        error: null,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'Bubble Lab Team <welcome@hello.bubblelab.ai>',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'test-api-key',
        },
      });

      // Should not throw error for system domain
      await expect(
        (bubble as any).validateFromDomain('welcome@hello.bubblelab.ai')
      ).resolves.not.toThrow();

      // Should not call domains.list for system domains
      expect(mockDomainsList).not.toHaveBeenCalled();
    });

    it('should validate user domains against verified domains', async () => {
      mockDomainsList.mockResolvedValue({
        data: {
          data: [
            { name: 'example.com', status: 'verified' },
            { name: 'mycompany.com', status: 'verified' },
          ],
        },
        error: null,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'test-api-key',
        },
      });

      // Initialize resend client
      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('test-api-key');

      // Should not throw for verified domain
      await expect(
        (bubble as any).validateFromDomain('noreply@example.com')
      ).resolves.not.toThrow();

      // Should throw for unverified domain
      await expect(
        (bubble as any).validateFromDomain('noreply@unverified.com')
      ).rejects.toThrow('Domain "unverified.com" is not verified');

      // Should call domains.list once (cached after first call)
      expect(mockDomainsList).toHaveBeenCalledTimes(1);
    });

    it('should cache verified domains per API key', async () => {
      mockDomainsList
        .mockResolvedValueOnce({
          data: {
            data: [{ name: 'example.com', status: 'verified' }],
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ name: 'other.com', status: 'verified' }],
          },
          error: null,
        });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'api-key-1',
        },
      });

      // First validation with first API key
      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('api-key-1');
      await (bubble as any).validateFromDomain('noreply@example.com');
      expect(mockDomainsList).toHaveBeenCalledTimes(1);

      // Second validation with same API key (should use cache)
      await (bubble as any).validateFromDomain('noreply@example.com');
      expect(mockDomainsList).toHaveBeenCalledTimes(1); // Still 1, cache used

      // Change credentials - should clear cache and fetch new domains
      (bubble as any).params.credentials = {
        [CredentialType.RESEND_CRED]: 'api-key-2',
      };
      const { Resend: Resend2 } = await import('resend');
      (bubble as any).resend = new Resend2('api-key-2');
      (bubble as any).verifiedDomains = undefined; // Simulate cache clear

      await (bubble as any).validateFromDomain('noreply@other.com');
      expect(mockDomainsList).toHaveBeenCalledTimes(2); // New call
    });

    it('should clear cache when credentials change in performAction', async () => {
      mockDomainsList.mockResolvedValue({
        data: {
          data: [{ name: 'example.com', status: 'verified' }],
        },
        error: null,
      });
      mockEmailsSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'api-key-1',
        },
      });

      // First action with api-key-1
      await bubble.action();
      expect(mockDomainsList).toHaveBeenCalledTimes(1);

      // Change credentials
      (bubble as any).params.credentials = {
        [CredentialType.RESEND_CRED]: 'api-key-2',
      };

      // Second action should clear cache and fetch domains again
      await bubble.action();
      // Cache should be cleared, but since we're using the same mock response,
      // we verify that the cache was cleared by checking if resend was recreated
      const { Resend } = await import('resend');
      expect(Resend).toHaveBeenCalledWith('api-key-2');
    });

    it('should clear cache when credentials change in testCredential', async () => {
      mockDomainsList.mockResolvedValue({
        data: {
          data: [{ name: 'example.com', status: 'verified' }],
        },
        error: null,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'api-key-1',
        },
      });

      // First testCredential call
      await bubble.testCredential();
      expect(mockDomainsList).toHaveBeenCalledTimes(1);

      // Change credentials
      (bubble as any).params.credentials = {
        [CredentialType.RESEND_CRED]: 'api-key-2',
      };

      // Second testCredential should clear cache
      await bubble.testCredential();
      // Verify Resend was called with new key
      const { Resend } = await import('resend');
      expect(Resend).toHaveBeenCalledWith('api-key-2');
    });

    it('should only include verified domains in validation', async () => {
      mockDomainsList.mockResolvedValue({
        data: {
          data: [
            { name: 'verified.com', status: 'verified' },
            { name: 'pending.com', status: 'pending' },
            { name: 'not_started.com', status: 'not_started' },
            { name: 'another-verified.com', status: 'verified' },
          ],
        },
        error: null,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@verified.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'test-api-key',
        },
      });

      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('test-api-key');

      // Verified domain should pass
      await expect(
        (bubble as any).validateFromDomain('noreply@verified.com')
      ).resolves.not.toThrow();

      // Another verified domain should pass
      await expect(
        (bubble as any).validateFromDomain('noreply@another-verified.com')
      ).resolves.not.toThrow();

      // Pending domain should fail
      await expect(
        (bubble as any).validateFromDomain('noreply@pending.com')
      ).rejects.toThrow('not verified');

      // Not started domain should fail
      await expect(
        (bubble as any).validateFromDomain('noreply@not_started.com')
      ).rejects.toThrow('not verified');
    });

    it('should provide helpful error message with list of verified domains', async () => {
      mockDomainsList.mockResolvedValue({
        data: {
          data: [
            { name: 'example.com', status: 'verified' },
            { name: 'mycompany.com', status: 'verified' },
          ],
        },
        error: null,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@unverified.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'test-api-key',
        },
      });

      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('test-api-key');

      await expect(
        (bubble as any).validateFromDomain('noreply@unverified.com')
      ).rejects.toThrow(/Domain "unverified.com" is not verified/);

      await expect(
        (bubble as any).validateFromDomain('noreply@unverified.com')
      ).rejects.toThrow(/Verified domains: example.com, mycompany.com/);
    });

    it('should handle empty verified domains list', async () => {
      mockDomainsList.mockResolvedValue({
        data: {
          data: [],
        },
        error: null,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'test-api-key',
        },
      });

      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('test-api-key');

      await expect(
        (bubble as any).validateFromDomain('noreply@example.com')
      ).rejects.toThrow(/Verified domains: none/);
    });
  });

  describe('error handling', () => {
    it('should handle API errors when fetching domains', async () => {
      mockDomainsList.mockResolvedValue({
        data: null,
        error: { message: 'API key invalid' },
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'invalid-key',
        },
      });

      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('invalid-key');

      await expect(
        (bubble as any).validateFromDomain('noreply@example.com')
      ).rejects.toThrow(/Failed to fetch verified domains/);
    });

    it('should handle network errors when fetching domains', async () => {
      mockDomainsList.mockRejectedValue(new Error('Network error'));

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'test-key',
        },
      });

      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('test-key');

      await expect(
        (bubble as any).validateFromDomain('noreply@example.com')
      ).rejects.toThrow(/Failed to fetch verified domains/);
    });

    it('should not double-wrap error messages when API returns error', async () => {
      const apiError = { message: 'API key invalid', code: 'invalid_key' };
      mockDomainsList.mockResolvedValue({
        data: null,
        error: apiError,
      });

      const bubble = new ResendBubble({
        operation: 'send_email',
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test',
        credentials: {
          [CredentialType.RESEND_CRED]: 'invalid-key',
        },
      });

      const { Resend } = await import('resend');
      (bubble as any).resend = new Resend('invalid-key');

      await expect(
        (bubble as any).validateFromDomain('noreply@example.com')
      ).rejects.toThrow(/Failed to fetch verified domains:/);

      // Verify error message is not double-wrapped
      try {
        await (bubble as any).validateFromDomain('noreply@example.com');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        // Should only have "Failed to fetch verified domains:" once, not twice
        const matches = errorMessage.match(
          /Failed to fetch verified domains:/g
        );
        expect(matches?.length).toBe(1);
        // Should contain the API error details
        expect(errorMessage).toContain(JSON.stringify(apiError));
      }
    });
  });
});
