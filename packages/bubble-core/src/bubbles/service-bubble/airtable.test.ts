import { describe, it, expect, beforeAll } from 'vitest';
import { AirtableBubble, type AirtableParamsInput } from './airtable.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { BubbleFactory } from '../../bubble-factory.js';

const factory = new BubbleFactory();

beforeAll(async () => {
  await factory.registerDefaults();
});

/**
 * Unit tests for Airtable Service Bubble
 *
 * Tests the Airtable API integration for managing records in bases and tables
 * For manual/integration tests with real credentials, see manual-tests/test-airtable.ts
 */
describe('AirtableBubble', () => {
  describe('Metadata', () => {
    it('should have correct static metadata', () => {
      expect(AirtableBubble.bubbleName).toBe('airtable');
      expect(AirtableBubble.service).toBe('airtable');
      expect(AirtableBubble.authType).toBe('apikey');
      expect(AirtableBubble.type).toBe('service');
      expect(AirtableBubble.alias).toBe('airtable');
    });

    it('should have schemas defined', () => {
      expect(AirtableBubble.schema).toBeDefined();
      expect(AirtableBubble.resultSchema).toBeDefined();
    });

    it('should have descriptions', () => {
      expect(AirtableBubble.shortDescription).toContain('Airtable');
      expect(AirtableBubble.longDescription).toContain('Use cases:');
      expect(AirtableBubble.longDescription).toContain('records');
    });
  });

  describe('Schema Validation - list_records', () => {
    it('should validate list_records with minimal parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.operation).toBe('list_records');
      expect((bubble as any).params.baseId).toBe('appTestBase123');
      expect((bubble as any).params.tableIdOrName).toBe('My Table');
    });

    it('should apply default values for list_records', () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.pageSize).toBe(100);
      expect((bubble as any).params.cellFormat).toBe('json');
    });

    it('should accept all list_records optional parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'tblTable456',
        fields: ['Name', 'Email', 'Status'],
        filterByFormula: "{Status} = 'Active'",
        maxRecords: 50,
        pageSize: 25,
        sort: [
          { field: 'Created', direction: 'desc' },
          { field: 'Name', direction: 'asc' },
        ],
        view: 'Grid view',
        cellFormat: 'string',
        timeZone: 'America/Los_Angeles',
        userLocale: 'en-US',
        offset: 'offset123',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.fields).toHaveLength(3);
      expect((bubble as any).params.filterByFormula).toBe(
        "{Status} = 'Active'"
      );
      expect((bubble as any).params.maxRecords).toBe(50);
      expect((bubble as any).params.sort).toHaveLength(2);
    });

    it('should validate sort direction defaults to asc', () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        sort: [{ field: 'Name' }],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.sort[0].direction).toBe('asc');
    });
  });

  describe('Schema Validation - get_record', () => {
    it('should validate get_record parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'get_record',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        recordId: 'recABC123',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.operation).toBe('get_record');
      expect((bubble as any).params.recordId).toBe('recABC123');
    });

    it('should require recordId for get_record', () => {
      expect(() => {
        new AirtableBubble({
          operation: 'get_record',
          baseId: 'appTestBase123',
          tableIdOrName: 'My Table',
          // @ts-expect-error - testing missing recordId
          recordId: '',
        });
      }).toThrow();
    });
  });

  describe('Schema Validation - create_records', () => {
    it('should validate create_records with single record', () => {
      const params: AirtableParamsInput = {
        operation: 'create_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        records: [
          {
            fields: {
              Name: 'John Doe',
              Email: 'john@example.com',
              Age: 30,
              Active: true,
            },
          },
        ],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.records).toHaveLength(1);
      expect((bubble as any).params.records[0].fields.Name).toBe('John Doe');
    });

    it('should validate create_records with multiple records', () => {
      const params: AirtableParamsInput = {
        operation: 'create_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        records: [
          { fields: { Name: 'Alice', Email: 'alice@example.com' } },
          { fields: { Name: 'Bob', Email: 'bob@example.com' } },
          { fields: { Name: 'Charlie', Email: 'charlie@example.com' } },
        ],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.records).toHaveLength(3);
    });

    it('should apply default typecast value', () => {
      const params: AirtableParamsInput = {
        operation: 'create_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        records: [{ fields: { Name: 'Test' } }],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.typecast).toBe(false);
    });

    it('should accept complex field values', () => {
      const params: AirtableParamsInput = {
        operation: 'create_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        records: [
          {
            fields: {
              Text: 'Hello',
              Number: 42,
              Boolean: true,
              Array: ['item1', 'item2'],
              Object: { nested: 'value' },
              Null: null,
            },
          },
        ],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.records[0].fields.Array).toHaveLength(2);
      expect((bubble as any).params.records[0].fields.Object.nested).toBe(
        'value'
      );
      expect((bubble as any).params.records[0].fields.Null).toBeNull();
    });

    it('should enforce max 10 records limit', () => {
      const records = Array.from({ length: 11 }, (_, i) => ({
        fields: { Name: `Record ${i}` },
      }));

      expect(() => {
        new AirtableBubble({
          operation: 'create_records',
          baseId: 'appTestBase123',
          tableIdOrName: 'My Table',
          records,
        });
      }).toThrow();
    });

    it('should require at least one record', () => {
      expect(() => {
        new AirtableBubble({
          operation: 'create_records',
          baseId: 'appTestBase123',
          tableIdOrName: 'My Table',
          records: [],
        });
      }).toThrow();
    });
  });

  describe('Schema Validation - update_records', () => {
    it('should validate update_records parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'update_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        records: [
          {
            id: 'recABC123',
            fields: { Name: 'Updated Name', Status: 'Active' },
          },
        ],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.records[0].id).toBe('recABC123');
      expect((bubble as any).params.records[0].fields.Name).toBe(
        'Updated Name'
      );
    });

    it('should validate multiple record updates', () => {
      const params: AirtableParamsInput = {
        operation: 'update_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        records: [
          { id: 'rec1', fields: { Status: 'Complete' } },
          { id: 'rec2', fields: { Status: 'Pending' } },
          { id: 'rec3', fields: { Status: 'In Progress' } },
        ],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.records).toHaveLength(3);
    });

    it('should require record id for updates', () => {
      expect(() => {
        new AirtableBubble({
          operation: 'update_records',
          baseId: 'appTestBase123',
          tableIdOrName: 'My Table',
          records: [
            {
              // @ts-expect-error - testing missing id
              id: '',
              fields: { Name: 'Test' },
            },
          ],
        });
      }).toThrow();
    });

    it('should enforce max 10 records limit for updates', () => {
      const records = Array.from({ length: 11 }, (_, i) => ({
        id: `rec${i}`,
        fields: { Name: `Record ${i}` },
      }));

      expect(() => {
        new AirtableBubble({
          operation: 'update_records',
          baseId: 'appTestBase123',
          tableIdOrName: 'My Table',
          records,
        });
      }).toThrow();
    });
  });

  describe('Schema Validation - delete_records', () => {
    it('should validate delete_records parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'delete_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        recordIds: ['recABC123', 'recDEF456'],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.recordIds).toHaveLength(2);
      expect((bubble as any).params.recordIds[0]).toBe('recABC123');
    });

    it('should require at least one record ID', () => {
      expect(() => {
        new AirtableBubble({
          operation: 'delete_records',
          baseId: 'appTestBase123',
          tableIdOrName: 'My Table',
          recordIds: [],
        });
      }).toThrow();
    });

    it('should enforce max 10 records limit for deletion', () => {
      const recordIds = Array.from({ length: 11 }, (_, i) => `rec${i}`);

      expect(() => {
        new AirtableBubble({
          operation: 'delete_records',
          baseId: 'appTestBase123',
          tableIdOrName: 'My Table',
          recordIds,
        });
      }).toThrow();
    });
  });

  describe('Schema Validation - list_bases', () => {
    it('should validate list_bases parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'list_bases',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.operation).toBe('list_bases');
    });
  });

  describe('Schema Validation - get_base_schema', () => {
    it('should validate get_base_schema parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'get_base_schema',
        baseId: 'appTestBase123',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.operation).toBe('get_base_schema');
      expect((bubble as any).params.baseId).toBe('appTestBase123');
    });

    it('should require baseId for get_base_schema', () => {
      expect(() => {
        new AirtableBubble({
          operation: 'get_base_schema',
          // @ts-expect-error - testing missing baseId
          baseId: '',
        });
      }).toThrow();
    });
  });

  describe('Schema Validation - create_table', () => {
    it('should validate create_table parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'create_table',
        baseId: 'appTestBase123',
        name: 'New Table',
        fields: [
          { name: 'Name', type: 'singleLineText' },
          {
            name: 'Status',
            type: 'singleSelect',
            options: { choices: [{ name: 'Active' }] },
          },
        ],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.name).toBe('New Table');
      expect((bubble as any).params.fields).toHaveLength(2);
    });

    it('should accept optional description', () => {
      const params: AirtableParamsInput = {
        operation: 'create_table',
        baseId: 'appTestBase123',
        name: 'New Table',
        description: 'Test table description',
        fields: [{ name: 'Name', type: 'singleLineText' }],
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.description).toBe('Test table description');
    });
  });

  describe('Schema Validation - update_table', () => {
    it('should validate update_table parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'update_table',
        baseId: 'appTestBase123',
        tableIdOrName: 'tblTest456',
        name: 'Updated Table Name',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.operation).toBe('update_table');
      expect((bubble as any).params.name).toBe('Updated Table Name');
    });

    it('should accept optional name and description', () => {
      const params: AirtableParamsInput = {
        operation: 'update_table',
        baseId: 'appTestBase123',
        tableIdOrName: 'tblTest456',
        description: 'Updated description',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.description).toBe('Updated description');
    });
  });

  describe('Schema Validation - create_field', () => {
    it('should validate create_field parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'create_field',
        baseId: 'appTestBase123',
        tableIdOrName: 'tblTest456',
        name: 'New Field',
        type: 'singleLineText',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.name).toBe('New Field');
      expect((bubble as any).params.type).toBe('singleLineText');
    });

    it('should accept optional description and options', () => {
      const params: AirtableParamsInput = {
        operation: 'create_field',
        baseId: 'appTestBase123',
        tableIdOrName: 'tblTest456',
        name: 'Status',
        type: 'singleSelect',
        description: 'Record status field',
        options: { choices: [{ name: 'Active' }, { name: 'Inactive' }] },
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.description).toBe('Record status field');
      expect((bubble as any).params.options).toBeDefined();
    });
  });

  describe('Schema Validation - update_field', () => {
    it('should validate update_field parameters', () => {
      const params: AirtableParamsInput = {
        operation: 'update_field',
        baseId: 'appTestBase123',
        tableIdOrName: 'tblTest456',
        fieldIdOrName: 'fldTest789',
        name: 'Updated Field Name',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.operation).toBe('update_field');
      expect((bubble as any).params.fieldIdOrName).toBe('fldTest789');
      expect((bubble as any).params.name).toBe('Updated Field Name');
    });

    it('should accept optional name and description', () => {
      const params: AirtableParamsInput = {
        operation: 'update_field',
        baseId: 'appTestBase123',
        tableIdOrName: 'tblTest456',
        fieldIdOrName: 'fldTest789',
        description: 'Updated field description',
      };

      const bubble = new AirtableBubble(params);
      expect((bubble as any).params.description).toBe(
        'Updated field description'
      );
    });
  });

  describe('Credential Selection', () => {
    it('should throw error when no credentials provided', () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
      };

      const bubble = new AirtableBubble(params);
      expect(() => {
        (bubble as any).chooseCredential();
      }).toThrow('No Airtable credentials provided');
    });

    it('should select AIRTABLE_CRED when provided', () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        credentials: {
          [CredentialType.AIRTABLE_CRED]: 'patTestToken123',
        },
      };

      const bubble = new AirtableBubble(params);
      const credential = (bubble as any).chooseCredential();
      expect(credential).toBe('patTestToken123');
    });
  });

  describe('Credential Format Validation', () => {
    it('should validate token format starts with pat', async () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        credentials: {
          [CredentialType.AIRTABLE_CRED]:
            'patValidTokenFormat1234567890123456789012345678901234567890',
        },
      };

      const bubble = new AirtableBubble(params);
      const isValid = await bubble.testCredential();
      expect(isValid).toBe(true);
    });

    it('should reject invalid token format', async () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        credentials: {
          [CredentialType.AIRTABLE_CRED]: 'invalid-token',
        },
      };

      const bubble = new AirtableBubble(params);
      const isValid = await bubble.testCredential();
      expect(isValid).toBe(false);
    });

    it('should reject token that is too short', async () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
        credentials: {
          [CredentialType.AIRTABLE_CRED]: 'patShort',
        },
      };

      const bubble = new AirtableBubble(params);
      const isValid = await bubble.testCredential();
      expect(isValid).toBe(false);
    });

    it('should return false when no credentials provided', async () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
      };

      const bubble = new AirtableBubble(params);
      const isValid = await bubble.testCredential();
      expect(isValid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return error when no credentials provided', async () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
      };

      const bubble = new AirtableBubble(params);
      const result = await bubble.action();

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('Airtable credentials');
    });

    it('should return proper error structure', async () => {
      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId: 'appTestBase123',
        tableIdOrName: 'My Table',
      };

      const bubble = new AirtableBubble(params);
      const result = await bubble.action();

      expect(result.data).toHaveProperty('success');
      expect(result.data).toHaveProperty('error');
      expect(result.data).toHaveProperty('ok');
      expect(result.data).toHaveProperty('operation');
      expect(result.data.operation).toBe('list_records');
    });
  });

  describe('Constructor Defaults', () => {
    it('should accept minimal valid parameters', () => {
      const bubble = new AirtableBubble({
        operation: 'list_records',
        baseId: 'appTestBase',
        tableIdOrName: 'Test Table',
      });
      expect((bubble as any).params.operation).toBe('list_records');
      expect((bubble as any).params.baseId).toBe('appTestBase');
      expect((bubble as any).params.tableIdOrName).toBe('Test Table');
    });

    it('should accept custom operation in constructor', () => {
      const bubble = new AirtableBubble({
        operation: 'create_records',
        baseId: 'appTest',
        tableIdOrName: 'Test',
        records: [{ fields: { Name: 'Test' } }],
      });
      expect((bubble as any).params.operation).toBe('create_records');
    });
  });

  describe('Integration Tests', () => {
    // These tests require a real AIRTABLE_API_KEY in environment
    // Skip them if no token is available
    it.skip('should list records with real credentials', async () => {
      const apiKey = process.env.AIRTABLE_API_KEY;
      const baseId = process.env.AIRTABLE_BASE_ID || 'appYourBaseId';
      const tableIdOrName = process.env.AIRTABLE_TABLE_NAME || 'Your Table';

      if (!apiKey || apiKey.startsWith('test-')) {
        console.log('⚠️  Skipping integration test - no real Airtable token');
        return;
      }

      const params: AirtableParamsInput = {
        operation: 'list_records',
        baseId,
        tableIdOrName,
        maxRecords: 5,
        credentials: {
          [CredentialType.AIRTABLE_CRED]: apiKey,
        },
      };

      const bubble = new AirtableBubble(params);
      const result = await bubble.action();

      expect(result.data.success).toBe(true);
      expect(result.data.ok).toBe(true);
      if (result.data.operation === 'list_records') {
        expect(result.data.records).toBeDefined();
      }
    });

    it.skip('should create and delete a record with real credentials', async () => {
      const apiKey = process.env.AIRTABLE_API_KEY;
      const baseId = process.env.AIRTABLE_BASE_ID || 'appYourBaseId';
      const tableIdOrName = process.env.AIRTABLE_TABLE_NAME || 'Your Table';

      if (!apiKey || apiKey.startsWith('test-')) {
        console.log('⚠️  Skipping integration test - no real Airtable token');
        return;
      }

      // Create a test record
      const createParams: AirtableParamsInput = {
        operation: 'create_records',
        baseId,
        tableIdOrName,
        records: [
          {
            fields: {
              Name: 'Test Record from Unit Test',
              Status: 'Test',
            },
          },
        ],
        credentials: {
          [CredentialType.AIRTABLE_CRED]: apiKey,
        },
      };

      const createBubble = new AirtableBubble(createParams);
      const createResult = await createBubble.action();

      expect(createResult.data.success).toBe(true);
      if (
        createResult.data.operation === 'create_records' &&
        createResult.data.records
      ) {
        const recordId = createResult.data.records[0].id;
        expect(recordId).toBeTruthy();

        // Delete the test record
        const deleteParams: AirtableParamsInput = {
          operation: 'delete_records',
          baseId,
          tableIdOrName,
          recordIds: [recordId],
          credentials: {
            [CredentialType.AIRTABLE_CRED]: apiKey,
          },
        };

        const deleteBubble = new AirtableBubble(deleteParams);
        const deleteResult = await deleteBubble.action();

        expect(deleteResult.data.success).toBe(true);
        if (
          deleteResult.data.operation === 'delete_records' &&
          deleteResult.data.records
        ) {
          expect(deleteResult.data.records[0].deleted).toBe(true);
        }
      }
    }, 30000); // 30 second timeout
  });
});
