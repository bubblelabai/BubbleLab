import { describe, it, expect } from 'vitest';
import {
  detectSchemaFieldReferences,
  bubbleReferencesSchemaFields,
} from './inputSchemaParser';

describe('detectSchemaFieldReferences', () => {
  it('should detect field in template literal', () => {
    const paramValue = 'Go to Yahoo Finance for the ticker symbol "${ticker}"';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    expect(result).toContain('ticker');
    expect(result).not.toContain('email');
  });

  it('should detect multiple fields in template literals', () => {
    const paramValue = 'Send ${ticker} analysis to ${email}';
    const schemaFields = ['ticker', 'email', 'name'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    expect(result).toContain('ticker');
    expect(result).toContain('email');
    expect(result).not.toContain('name');
  });

  it('should detect field with property access', () => {
    const paramValue = 'payload.ticker.toUpperCase()';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    expect(result).toContain('ticker');
  });

  it('should detect field as standalone word', () => {
    const paramValue = 'ticker';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    expect(result).toContain('ticker');
  });

  it('should detect field in complex template literal', () => {
    const paramValue =
      'Your Automated Financial Analysis for ${ticker.toUpperCase()}';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    expect(result).toContain('ticker');
  });

  it('should not detect field as part of another word', () => {
    const paramValue = 'This is a sticker, not a ticker';
    const schemaFields = ['ticker'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    // Should still detect because of word boundary
    expect(result).toContain('ticker');
  });

  it('should handle non-string values', () => {
    const paramValue = 123;
    const schemaFields = ['ticker'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    expect(result).toHaveLength(0);
  });

  it('should handle array values with template literals', () => {
    const paramValue = '[email]';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(paramValue, schemaFields);

    expect(result).toContain('email');
  });

  it('should detect field in actual Yahoo Finance example', () => {
    const taskValue =
      'Go to Yahoo Finance for the ticker symbol "${ticker}". Scrape the latest news headlines and identify key upcoming events that could impact the stock\'s price.';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(taskValue, schemaFields);

    expect(result).toContain('ticker');
  });

  it('should detect email in to parameter', () => {
    const toValue = '[email]';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(toValue, schemaFields);

    expect(result).toContain('email');
  });

  it('should detect ticker in subject line', () => {
    const subjectValue =
      'Your Automated Financial Analysis for ${ticker.toUpperCase()}';
    const schemaFields = ['ticker', 'email'];

    const result = detectSchemaFieldReferences(subjectValue, schemaFields);

    expect(result).toContain('ticker');
  });
});

describe('bubbleReferencesSchemaFields', () => {
  it('should detect schema field in parameter value', () => {
    const bubbleParams = [
      {
        name: 'task',
        value: 'Go to Yahoo Finance for the ticker symbol "${ticker}"',
      },
    ];
    const schemaFields = ['ticker', 'email'];

    const result = bubbleReferencesSchemaFields(bubbleParams, schemaFields);

    expect(result).toBe(true);
  });

  it('should detect schema field by parameter name match', () => {
    const bubbleParams = [{ name: 'ticker', value: 'AAPL' }];
    const schemaFields = ['ticker', 'email'];

    const result = bubbleReferencesSchemaFields(bubbleParams, schemaFields);

    expect(result).toBe(true);
  });

  it('should return false when no schema fields are referenced', () => {
    const bubbleParams = [
      { name: 'operation', value: 'send_email' },
      { name: 'subject', value: 'Daily Report' },
    ];
    const schemaFields = ['ticker', 'email'];

    const result = bubbleReferencesSchemaFields(bubbleParams, schemaFields);

    expect(result).toBe(false);
  });

  it('should handle real-world ResearchAgentTool parameters', () => {
    const bubbleParams = [
      {
        name: 'task',
        value:
          'Go to Yahoo Finance for the ticker symbol "${ticker}". Scrape the latest news headlines.',
      },
      {
        name: 'expectedResultSchema',
        value: '{"type":"object","properties":{"headlines":{"type":"array"}}}',
      },
    ];
    const schemaFields = ['ticker', 'email'];

    const result = bubbleReferencesSchemaFields(bubbleParams, schemaFields);

    expect(result).toBe(true);
  });

  it('should handle real-world ResendBubble parameters', () => {
    const bubbleParams = [
      { name: 'operation', value: 'send_email' },
      { name: 'to', value: '[email]' },
      {
        name: 'subject',
        value: 'Your Automated Financial Analysis for ${ticker.toUpperCase()}',
      },
    ];
    const schemaFields = ['ticker', 'email'];

    const result = bubbleReferencesSchemaFields(bubbleParams, schemaFields);

    expect(result).toBe(true);
  });
});
