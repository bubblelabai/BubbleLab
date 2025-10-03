import { StorageBubble } from './storage.js';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('StorageBubble', () => {
  const mockCredentials = {
    [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: 'test-access-key-id',
    [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: 'test-secret-access-key',
  };

  const baseParams = {
    bucketName: 'test-bucket',
    fileName: 'test-file.txt',
    accountId: 'test-account-id',
    credentials: mockCredentials,
  };

  describe('Constructor and Schema Validation', () => {
    test('should create instance with valid parameters', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getUploadUrl',
      });

      expect(bubble).toBeInstanceOf(StorageBubble);
      expect(bubble.currentParams.operation).toBe('getUploadUrl');
      expect(bubble.currentParams.bucketName).toBe('test-bucket');
      expect(bubble.currentParams.fileName).toBe('test-file.txt');
    });

    test('should validate required fields', () => {
      expect(() => {
        new StorageBubble({
          operation: 'getUploadUrl',
          // Missing required fields
        } as never);
      }).toThrow();
    });

    test('should validate operation enum', () => {
      expect(() => {
        new StorageBubble({
          ...baseParams,
          operation: 'invalidOperation',
        } as never);
      }).toThrow();
    });
  });

  describe('Credential Management', () => {
    test('should choose correct credential', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getUploadUrl',
      });

      const credential = bubble['chooseCredential']();
      expect(credential).toBe('test-access-key-id');
    });

    test('should return undefined when no credentials', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getUploadUrl',
        credentials: undefined,
      });

      const credential = bubble['chooseCredential']();
      expect(credential).toBeUndefined();
    });

    test('should handle missing API_KEY credential', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getUploadUrl',
        credentials: {
          [CredentialType.CLOUDFLARE_R2_SECRET_KEY]: 'test-secret',
        },
      });

      const credential = bubble['chooseCredential']();
      expect(credential).toBeUndefined();
    });
  });

  describe('Static Properties', () => {
    test('should have correct static properties', () => {
      expect(StorageBubble.service).toBe('cloudflare-r2');
      expect(StorageBubble.authType).toBe('apikey');
      expect(StorageBubble.bubbleName).toBe('storage');
      expect(StorageBubble.type).toBe('service');
      expect(StorageBubble.alias).toBe('r2');
    });

    test('should have descriptive text', () => {
      expect(StorageBubble.shortDescription).toContain('Cloudflare R2');
      expect(StorageBubble.longDescription).toContain('presigned upload URLs');
    });
  });

  describe('Parameter Access', () => {
    test('should access parameters correctly', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getFile',
        expirationMinutes: 120,
      });
      console.log(bubble.currentParams);
      expect(bubble.currentParams.operation).toBe('getFile');
      expect(bubble.currentParams.expirationMinutes).toBe(120);
    });

    test('should handle optional parameters', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'deleteFile',
      });

      //@ts-expect-error for testing
      expect(bubble.currentParams.contentType).toBeUndefined();
      //@ts-expect-error for testing
      expect(bubble.currentParams.fileContent).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing credentials gracefully', async () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getUploadUrl',
        credentials: undefined,
      });

      const result = await bubble.action();
      expect(result.success).toBe(false);
      expect(result.error).toContain('credentials not found');
    });

    test('should handle missing secret key', async () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getUploadUrl',
        credentials: {
          [CredentialType.CLOUDFLARE_R2_ACCESS_KEY]: 'test-key',
          // Missing SECRET_KEY
        },
      });

      const result = await bubble.action();
      expect(result.success).toBe(false);
      expect(result.error).toContain('credentials not found');
    });
  });

  describe('Operation Types', () => {
    test('should support getUploadUrl operation', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getUploadUrl',
        contentType: 'image/png',
      });

      expect(bubble.currentParams.operation).toBe('getUploadUrl');
      expect(bubble.currentParams.contentType).toBe('image/png');
    });

    test('should support getFile operation', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'getFile',
        expirationMinutes: 30,
      });

      expect(bubble.currentParams.operation).toBe('getFile');
      expect(bubble.currentParams.expirationMinutes).toBe(30);
    });

    test('should support deleteFile operation', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'deleteFile',
      });

      expect(bubble.currentParams.operation).toBe('deleteFile');
    });

    test('should support updateFile operation', () => {
      const bubble = new StorageBubble({
        ...baseParams,
        operation: 'updateFile',
        fileContent: 'Updated content',
        contentType: 'text/plain',
      });

      expect(bubble.currentParams.operation).toBe('updateFile');
      expect(bubble.currentParams.fileContent).toBe('Updated content');
    });
  });

  describe('Result Schema', () => {
    test('should validate result schema structure', () => {
      const validResult = {
        success: true,
        error: '',
        operation: 'getUploadUrl',
        uploadUrl: 'https://example.com/upload',
        fileName: 'test.txt',
      };

      const parseResult = StorageBubble.resultSchema.safeParse(validResult);

      expect(parseResult.success).toBe(true);
    });

    test('should handle optional result fields', () => {
      const minimalResult = {
        success: false,
        operation: 'deleteFile',
        error: 'File not found',
      };

      const parseResult = StorageBubble.resultSchema.safeParse(minimalResult);
      expect(parseResult.success).toBe(true);
    });
  });
});
