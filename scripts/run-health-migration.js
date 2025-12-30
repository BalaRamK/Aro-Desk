#!/usr/bin/env node
/**
 * Run Health Algorithm Migration
 */

const { Client } = require('pg');
const fs = require('fs');

async function runHealthMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');
    
    console.log('📖 Reading migration file...');
    const sql = fs.readFileSync('database/migrations/07_health_algorithm.sql', 'utf8');
    console.log('✅ Migration file loaded\n');
    
    console.log('⚙️  Executing migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tables = ['usage_events', 'support_tickets', 'renewal_data'];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      const exists = result.rows[0].exists;
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    }
    
    // Verify function
    const funcResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc 
        JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
        WHERE pg_namespace.nspname = 'public' 
        AND pg_proc.proname = 'calculate_account_health'
      );
    `);
    
    const funcExists = funcResult.rows[0].exists;
    console.log(`  ${funcExists ? '✅' : '❌'} calculate_account_health function\n`);
    
    console.log('🎉 Health algorithm migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runHealthMigration();
