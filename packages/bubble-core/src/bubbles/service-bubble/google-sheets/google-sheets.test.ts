import { describe, it, expect } from 'vitest';
import { GoogleSheetsBubble } from './google-sheets';
import { GoogleSheetsParamsSchema } from './google-sheets.schema';

describe('GoogleSheetsBubble', () => {
  it('should be defined', () => {
    new GoogleSheetsBubble({
      operation: 'batch_read_values',
      spreadsheet_id: '1234567890',
      ranges: ['Sheet1!A1:B10', 'Sheet2!A1:B10'],
    });
    expect(GoogleSheetsBubble).toBeDefined();
  });

  describe('Range Normalization', () => {
    it('should automatically quote sheet names with spaces', () => {
      const params = {
        operation: 'read_values' as const,
        spreadsheet_id: '1234567890',
        range: 'Kaus Mode Landing zone!A:G', // No quotes, has spaces
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'read_values') {
        expect(result.range).toBe("'Kaus Mode Landing zone'!A:G");
      }
    });

    it('should not modify already quoted sheet names', () => {
      const params = {
        operation: 'read_values' as const,
        spreadsheet_id: '1234567890',
        range: "'Sheet Name'!A1:B10", // Already quoted
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'read_values') {
        expect(result.range).toBe("'Sheet Name'!A1:B10");
      }
    });

    it('should not modify sheet names without spaces', () => {
      const params = {
        operation: 'read_values' as const,
        spreadsheet_id: '1234567890',
        range: 'Sheet1!A1:B10', // No spaces, no quotes needed
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'read_values') {
        expect(result.range).toBe('Sheet1!A1:B10');
      }
    });

    it('should normalize ranges in batch operations', () => {
      const params = {
        operation: 'batch_read_values' as const,
        spreadsheet_id: '1234567890',
        ranges: [
          'Sheet1!A1:B10', // No spaces
          'My Data Sheet!A:G', // Has spaces - should be quoted
          "'Already Quoted'!C1:D5", // Already quoted
        ],
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'batch_read_values') {
        expect(result.ranges[0]).toBe('Sheet1!A1:B10');
        expect(result.ranges[1]).toBe("'My Data Sheet'!A:G");
        expect(result.ranges[2]).toBe("'Already Quoted'!C1:D5");
      }
    });
  });

  describe('Value Sanitization', () => {
    it('should convert null values to empty strings', () => {
      const params = {
        operation: 'update_values' as const,
        spreadsheet_id: '1234567890',
        range: 'Sheet1!A1',
        values: [
          ['Vendor', 'Date', 'Amount', 'Description'],
          ['Vercel', null, '100', null], // null values
        ],
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'update_values') {
        expect(result.values[0]).toEqual([
          'Vendor',
          'Date',
          'Amount',
          'Description',
        ]);
        expect(result.values[1]).toEqual(['Vercel', '', '100', '']); // null converted to ''
      }
    });

    it('should convert undefined values to empty strings', () => {
      const params = {
        operation: 'write_values' as const,
        spreadsheet_id: '1234567890',
        range: 'Sheet1!A1',
        values: [
          ['Name', 'Email'],
          ['John', undefined], // undefined value
        ],
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'write_values') {
        expect(result.values[1]).toEqual(['John', '']); // undefined converted to ''
      }
    });

    it('should handle mixed null/undefined/valid values', () => {
      const params = {
        operation: 'append_values' as const,
        spreadsheet_id: '1234567890',
        range: 'Sheet1!A:A',
        values: [
          ['Vendor', null, 'Amount', undefined, 'Status'],
          ['AWS', '2024-01-01', null, true, undefined],
        ],
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'append_values') {
        expect(result.values[0]).toEqual([
          'Vendor',
          '',
          'Amount',
          '',
          'Status',
        ]);
        expect(result.values[1]).toEqual(['AWS', '2024-01-01', '', true, '']);
      }
    });

    it('should convert Date objects to ISO strings', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const params = {
        operation: 'update_values' as const,
        spreadsheet_id: '1234567890',
        range: 'Sheet1!A1',
        values: [
          ['Name', 'Created'],
          ['Test', date], // Date object
        ],
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'update_values') {
        expect(result.values[1][0]).toBe('Test');
        expect(result.values[1][1]).toBe(date.toISOString());
      }
    });

    it('should preserve valid string, number, and boolean values', () => {
      const params = {
        operation: 'write_values' as const,
        spreadsheet_id: '1234567890',
        range: 'Sheet1!A1',
        values: [['Text', 123, true, 'More Text']],
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'write_values') {
        expect(result.values[0]).toEqual(['Text', 123, true, 'More Text']);
      }
    });
  });

  describe('Combined Edge Cases', () => {
    it('should handle range normalization and value sanitization together', () => {
      const params = {
        operation: 'update_values' as const,
        spreadsheet_id: '1234567890',
        range: 'My Data Sheet!A1', // Sheet name with spaces
        values: [
          ['Vendor', 'Date', 'Amount'],
          ['Vercel', null, 100],
          ['AWS', undefined, 200],
        ],
      };

      const result = GoogleSheetsParamsSchema.parse(params);
      if (result.operation === 'update_values') {
        expect(result.range).toBe("'My Data Sheet'!A1");
        expect(result.values[0]).toEqual(['Vendor', 'Date', 'Amount']);
        expect(result.values[1]).toEqual(['Vercel', '', 100]);
        expect(result.values[2]).toEqual(['AWS', '', 200]);
      }
    });
  });
});
