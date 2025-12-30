#!/usr/bin/env node
/**
 * Check if health algorithm tables exist
 */

const { Client } = require('pg');

async function checkTables() {
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
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check for intelligence layer tables
    const tables = ['usage_events', 'support_tickets', 'renewal_data', 'account_profile'];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '❌'} Table "${table}" ${exists ? 'exists' : 'does not exist'}`);
    }
    
    // Check for calculate_account_health function
    const funcResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc 
        JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
        WHERE pg_namespace.nspname = 'public' 
        AND pg_proc.proname = 'calculate_account_health'
      );
    `);
    
    const funcExists = funcResult.rows[0].exists;
    console.log(`\n${funcExists ? '✅' : '❌'} Function "calculate_account_health" ${funcExists ? 'exists' : 'does not exist'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTables();
