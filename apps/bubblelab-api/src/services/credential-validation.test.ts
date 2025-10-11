// @ts-expect-error - Bun test types
import { describe, it, expect } from 'bun:test';
import { TestApp } from '../test/test-app.js';

describe('Credential Type Validation', () => {
  it('should reject invalid credential types', async () => {
    const response = await TestApp.post('/credentials', {
      credentialType: 'DATABASE_CREDsfasfds', // Invalid credential type
      value: 'some-value',
      name: 'Test Invalid Credential',
    });

    // Server should reject this with 400 Bad Request
    expect(response.status).toBe(400);

    const errorData = (await response.json()) as { error: string };
    console.log('Error response:', errorData);

    // Should have validation error about invalid credential type
    expect(errorData).toHaveProperty('error');
    expect(errorData.error).toContain('Validation'); // or similar validation message
  });
});
