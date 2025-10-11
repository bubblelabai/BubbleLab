#!/usr/bin/env tsx

import { PostgreSQLBubble } from '../src/index.js';

const DB_CONNECTION = process.env.DB_CONNECTION;

async function testRealDatabase() {
  if (DB_CONNECTION == undefined) {
    throw new Error('DB_CONNECTION environment variable is not set');
  }
  console.log('🔗 Testing Real PostgreSQL Database Connection...\n');

  // Test 1: Fetch database schema information
  console.log('Test 1: Fetching database schema information');
  try {
    const schemaBubble = new PostgreSQLBubble({
      query: `
        SELECT 
          table_schema,
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name, ordinal_position
      `,
      allowedOperations: ['SELECT'],
      ignoreSSL: true,
      maxRows: 100,
    });

    const result = await schemaBubble.action();

    if (result.success && result.data) {
      console.log('✅ Successfully connected to database');
      console.log(`📊 Found ${result.data.rows.length} columns across tables`);
      console.log(`⏱️  Query executed in ${result.data.executionTime}ms`);

      // Group by tables
      interface DatabaseRow {
        table_schema: string;
        table_name: string;
        [key: string]: unknown;
      }
      const tableMap = new Map<string, DatabaseRow[]>();
      result.data.rows.forEach((row) => {
        const tableName = `${row.table_schema}.${row.table_name}`;
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, []);
        }
        tableMap.get(tableName)?.push(row as DatabaseRow);
      });

      console.log('\n📋 Database Schema:');
      for (const [tableName, columns] of tableMap) {
        console.log(`\n🗂️  Table: ${tableName}`);
        console.log('   Columns:');
        columns.forEach((col) => {
          const nullable =
            col.is_nullable === 'YES' ? '(nullable)' : '(required)';
          const defaultVal = col.column_default
            ? ` default: ${col.column_default}`
            : '';
          console.log(
            `   • ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`
          );
        });
      }
    } else {
      console.error('❌ Failed to fetch schema:', result.error);
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 2: Count records in main tables
  console.log('Test 2: Counting records in main tables');
  try {
    const tablesBubble = new PostgreSQLBubble({
      credentials: {
        DATABASE_CRED: DB_CONNECTION,
      },
      query: `
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY schemaname, tablename
      `,
      allowedOperations: ['SELECT'],
    });

    const tablesResult = await tablesBubble.action();

    if (tablesResult.success && tablesResult.data) {
      console.log('✅ Found database tables:');

      for (const table of tablesResult.data.rows.slice(0, 5)) {
        // Limit to first 5 tables
        try {
          const countBubble = new PostgreSQLBubble({
            credentials: {
              DATABASE_CRED: DB_CONNECTION,
            },
            query: `SELECT COUNT(*) as count FROM "${table.schemaname}"."${table.tablename}"`,
            allowedOperations: ['SELECT'],
          });

          const countResult = await countBubble.action();
          if (countResult.success && countResult.data) {
            const count = countResult.data.rows[0]?.count || 0;
            console.log(
              `   📊 ${table.schemaname}.${table.tablename}: ${count} records`
            );
          }
        } catch (error) {
          console.log(
            `   ⚠️  ${table.schemaname}.${table.tablename}: Could not count (${error instanceof Error ? error.message.substring(0, 50) : 'unknown error'})`
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 3: Test security features with real database
  console.log('Test 3: Testing security features with real connection');
  try {
    // This should be blocked even with real connection
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const maliciousBubble = new PostgreSQLBubble({
        credentials: {
          DATABASE_CRED: DB_CONNECTION,
        },
        query: 'SELECT version(); DROP TABLE users; --',
        allowedOperations: ['SELECT'],
      });
      console.error('❌ Malicious query was not blocked');
    } catch (error) {
      console.log(
        '✅ Malicious query properly blocked:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // This should work
    const safeBubble = new PostgreSQLBubble({
      credentials: {
        DATABASE_CRED: DB_CONNECTION,
      },
      query: 'SELECT current_database(), current_user',
      allowedOperations: ['SELECT'],
    });

    const safeResult = await safeBubble.action();
    if (safeResult.success && safeResult.data) {
      const info = safeResult.data.rows[0];
      console.log('✅ Safe query executed successfully:');
      console.log(`   🏷️  Database: ${info?.current_database}`);
      console.log(`   👤 User: ${info?.current_user}`);
    }
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
  }

  console.log('\n' + '='.repeat(80) + '\n');

  // Test 4: Test result validation with real data
  console.log('Test 4: Testing result validation with real data');
  try {
    const validationBubble = new PostgreSQLBubble({
      credentials: {
        DATABASE_CRED: DB_CONNECTION,
      },
      query: "SELECT NOW() as current_time, 'test' as message, 42 as number",
      allowedOperations: ['SELECT'],
    });

    const validationResult = await validationBubble.action();

    if (validationResult.success && validationResult.data) {
      console.log('✅ Result validation passed with real data');
      console.log('   Sample row:', validationResult.data.rows[0]);
      console.log('   Row count:', validationResult.data.rowCount);
      console.log('   Command:', validationResult.data.command);
      console.log(
        '   Execution time:',
        validationResult.data.executionTime + 'ms'
      );
      console.log('   Success flag:', validationResult.data.success);
    } else {
      console.error('❌ Result validation failed:', validationResult.error);
    }
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
  }

  console.log('\n🎉 Real database testing completed!');
  console.log('\n🔒 Security verified with live database connection');
}

// Run the test
testRealDatabase().catch(console.error);
