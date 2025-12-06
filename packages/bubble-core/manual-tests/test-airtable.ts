import { AirtableBubble } from '../src/bubbles/service-bubble/airtable.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from bubblelab-api
dotenv.config({ path: resolve(__dirname, '../../../apps/bubblelab-api/.env') });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || '';

/**
 * Manual test file for Airtable bubble - tests all operations
 * Run with: tsx manual-tests/test-airtable.ts
 */

async function testAirtableOperations() {
  if (!AIRTABLE_API_KEY || AIRTABLE_API_KEY.startsWith('test-')) {
    console.error('❌ AIRTABLE_API_KEY not found in environment');
    console.log('Please add to your .env file:');
    console.log('AIRTABLE_API_KEY=your_pat_token');
    console.log('AIRTABLE_BASE_ID=appYourBaseId');
    console.log('AIRTABLE_TABLE_NAME=Your Table Name');
    return;
  }

  const credentials = {
    [CredentialType.AIRTABLE_CRED]: AIRTABLE_API_KEY,
  };

  console.log('🧪 Testing Airtable Bubble Operations\n');
  console.log(`📋 Using Base: ${AIRTABLE_BASE_ID || '(not set)'}`);
  console.log(`📋 Using Table: ${AIRTABLE_TABLE_NAME || '(not set)'}`);
  console.log(
    `🔑 Token format: ${AIRTABLE_API_KEY.substring(0, 10)}... (length: ${AIRTABLE_API_KEY.length})\n`
  );

  try {
    // Test 1: List all bases
    console.log('1️⃣ Testing list_bases...');
    const listBasesResult = await new AirtableBubble({
      operation: 'list_bases',
      credentials,
    }).action();

    if (listBasesResult.data.success) {
      console.log('✅ list_bases succeeded');
      console.log(`   Found ${listBasesResult.data.bases?.length || 0} bases`);
      if (listBasesResult.data.bases && listBasesResult.data.bases.length > 0) {
        listBasesResult.data.bases.forEach((base) => {
          console.log(
            `   - ${base.name} (${base.id}) - ${base.permissionLevel}`
          );
        });
      }
    } else {
      console.log('❌ list_bases failed:', listBasesResult.data.error);
    }
    console.log('');

    if (!AIRTABLE_BASE_ID) {
      console.log('⚠️  Skipping remaining tests - AIRTABLE_BASE_ID not set');
      return;
    }

    // Test 2: Get base schema
    console.log('2️⃣  Testing get_base_schema...');
    const schemaResult = await new AirtableBubble({
      operation: 'get_base_schema',
      baseId: AIRTABLE_BASE_ID,
      credentials,
    }).action();

    if (schemaResult.data.success) {
      console.log('✅ get_base_schema succeeded');
      console.log(
        `   Found ${schemaResult.data.tables?.length || 0} tables in base`
      );
      if (schemaResult.data.tables && schemaResult.data.tables.length > 0) {
        schemaResult.data.tables.forEach((table) => {
          console.log(`   - ${table.name} (${table.id})`);
          console.log(`     Fields: ${table.fields.length}`);
          table.fields.slice(0, 3).forEach((field) => {
            console.log(`       • ${field.name} (${field.type})`);
          });
          if (table.fields.length > 3) {
            console.log(`       ... and ${table.fields.length - 3} more`);
          }
        });
      }
    } else {
      console.log('❌ get_base_schema failed:', schemaResult.data.error);
    }
    console.log('');

    if (!AIRTABLE_TABLE_NAME) {
      console.log('⚠️  Skipping record tests - AIRTABLE_TABLE_NAME not set');
      return;
    }

    // Test 3: List records
    console.log('3️⃣  Testing list_records...');
    const listResult = await new AirtableBubble({
      operation: 'list_records',
      baseId: AIRTABLE_BASE_ID,
      tableIdOrName: AIRTABLE_TABLE_NAME,
      maxRecords: 5,
      credentials,
    }).action();

    if (listResult.data.success) {
      console.log('✅ list_records succeeded');
      console.log(`   Found ${listResult.data.records?.length || 0} records`);
      if (listResult.data.records && listResult.data.records.length > 0) {
        const firstRecord = listResult.data.records[0];
        console.log(`   First record ID: ${firstRecord.id}`);
        console.log(`   Fields: ${Object.keys(firstRecord.fields).join(', ')}`);
      }
    } else {
      console.log('❌ list_records failed:', listResult.data.error);
    }
    console.log('');

    // Test 4: Create a test record
    console.log('4️⃣  Testing create_records...');
    const createResult = await new AirtableBubble({
      operation: 'create_records',
      baseId: AIRTABLE_BASE_ID,
      tableIdOrName: AIRTABLE_TABLE_NAME,
      records: [
        {
          fields: {
            Location: `Test Location ${new Date().toISOString()}`,
            'High (F)': 75,
            'Low (F)': 55,
          },
        },
      ],
      credentials,
    }).action();

    let testRecordId: string | undefined;

    if (createResult.data.success && createResult.data.records) {
      console.log('✅ create_records succeeded');
      testRecordId = createResult.data.records[0].id;
      console.log(`   Created record: ${testRecordId}`);
    } else {
      console.log('❌ create_records failed:', createResult.data.error);
      console.log(
        '   Note: Make sure your table has "Name" and "Notes" fields'
      );
    }
    console.log('');

    // Test 5: Get specific record
    if (testRecordId) {
      console.log('5️⃣  Testing get_record...');
      const getResult = await new AirtableBubble({
        operation: 'get_record',
        baseId: AIRTABLE_BASE_ID,
        tableIdOrName: AIRTABLE_TABLE_NAME,
        recordId: testRecordId,
        credentials,
      }).action();

      if (getResult.data.success) {
        console.log('✅ get_record succeeded');
        console.log(`   Record ID: ${getResult.data.record?.id}`);
        console.log(
          `   Fields: ${JSON.stringify(getResult.data.record?.fields, null, 2)}`
        );
      } else {
        console.log('❌ get_record failed:', getResult.data.error);
      }
      console.log('');

      // Test 6: Update record
      console.log('6️⃣  Testing update_records...');
      const updateResult = await new AirtableBubble({
        operation: 'update_records',
        baseId: AIRTABLE_BASE_ID,
        tableIdOrName: AIRTABLE_TABLE_NAME,
        records: [
          {
            id: testRecordId,
            fields: {
              'High (F)': 80,
              'Low (F)': 60,
            },
          },
        ],
        credentials,
      }).action();

      if (updateResult.data.success) {
        console.log('✅ update_records succeeded');
        console.log(`   Updated record: ${testRecordId}`);
      } else {
        console.log('❌ update_records failed:', updateResult.data.error);
      }
      console.log('');

      // Test 7: Delete record
      console.log('7️⃣  Testing delete_records...');
      const deleteResult = await new AirtableBubble({
        operation: 'delete_records',
        baseId: AIRTABLE_BASE_ID,
        tableIdOrName: AIRTABLE_TABLE_NAME,
        recordIds: [testRecordId],
        credentials,
      }).action();

      if (deleteResult.data.success) {
        console.log('✅ delete_records succeeded');
        console.log(`   Deleted record: ${testRecordId}`);
      } else {
        console.log('❌ delete_records failed:', deleteResult.data.error);
      }
      console.log('');
    }

    // Test 8: Create a test table (commented out by default as it modifies the base)
    console.log('8️⃣  Testing create_table (skipped by default)');
    console.log('   Uncomment in code to test table creation');
    /*
    const createTableResult = await new AirtableBubble({
      operation: 'create_table',
      baseId: AIRTABLE_BASE_ID,
      name: 'Test Table ' + Date.now(),
      description: 'Created by Airtable bubble test',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: 'Notes', type: 'multilineText' },
        { name: 'Status', type: 'singleSelect', options: { choices: [{ name: 'Todo' }, { name: 'Done' }] } },
      ],
      credentials,
    }).action();

    if (createTableResult.data.success) {
      console.log('✅ create_table succeeded');
      console.log(`   Created table: ${createTableResult.data.table?.name} (${createTableResult.data.table?.id})`);
    } else {
      console.log('❌ create_table failed:', createTableResult.data.error);
    }
    */
    console.log('');

    // Test 9: Create a test field (commented out by default)
    console.log('9️⃣  Testing create_field (skipped by default)');
    console.log('   Uncomment in code to test field creation');
    /*
    const createFieldResult = await new AirtableBubble({
      operation: 'create_field',
      baseId: AIRTABLE_BASE_ID,
      tableIdOrName: AIRTABLE_TABLE_NAME,
      name: 'TestField_' + Date.now(),
      type: 'singleLineText',
      description: 'Created by Airtable bubble test',
      credentials,
    }).action();

    if (createFieldResult.data.success) {
      console.log('✅ create_field succeeded');
      console.log(`   Created field: ${createFieldResult.data.field?.name} (${createFieldResult.data.field?.id})`);
    } else {
      console.log('❌ create_field failed:', createFieldResult.data.error);
    }
    */
    console.log('');

    console.log('🎉 All tests completed!\n');
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run tests
testAirtableOperations();
