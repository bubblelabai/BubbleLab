import { describe, it, expect } from 'vitest';

/**
 * Standalone copy of encodeRFC2047 for unit testing.
 * The real version lives in gmail.ts as a module-level function.
 */
function encodeRFC2047(str: string): string {
  // eslint-disable-next-line no-control-regex -- intentionally matching full ASCII range (0x00-0x7F)
  if (!str || /^[\x00-\x7f]*$/.test(str)) return str;
  const encoded = Buffer.from(str, 'utf-8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

describe('encodeRFC2047', () => {
  it('encodes emoji subject correctly', () => {
    const result = encodeRFC2047('🎉 We added $10 more in free credit');
    expect(result).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    // Decode it back to verify round-trip
    const base64Part = result.replace('=?UTF-8?B?', '').replace('?=', '');
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
    expect(decoded).toBe('🎉 We added $10 more in free credit');
  });

  it('encodes 🚨 emoji correctly', () => {
    const result = encodeRFC2047('🚨 Urgent: Your Bubble Has Been Evaluated');
    const base64Part = result.replace('=?UTF-8?B?', '').replace('?=', '');
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
    expect(decoded).toBe('🚨 Urgent: Your Bubble Has Been Evaluated');
  });

  it('leaves pure ASCII subjects untouched', () => {
    expect(encodeRFC2047('Hello World')).toBe('Hello World');
    expect(encodeRFC2047('Re: Meeting tomorrow')).toBe('Re: Meeting tomorrow');
  });

  it('encodes accented characters', () => {
    const result = encodeRFC2047('Résumé received');
    expect(result).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    const base64Part = result.replace('=?UTF-8?B?', '').replace('?=', '');
    expect(Buffer.from(base64Part, 'base64').toString('utf-8')).toBe(
      'Résumé received'
    );
  });

  it('handles empty string', () => {
    expect(encodeRFC2047('')).toBe('');
  });

  it('handles multiple emojis', () => {
    const subject = '🔥 Hot deal! 🎁 Free gift inside 🚀';
    const result = encodeRFC2047(subject);
    const base64Part = result.replace('=?UTF-8?B?', '').replace('?=', '');
    expect(Buffer.from(base64Part, 'base64').toString('utf-8')).toBe(subject);
  });
});
