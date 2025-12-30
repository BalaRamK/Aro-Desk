const { Pool } = require('pg');

async function checkAutomationTables() {
  const connectionString = 'postgresql://neondb_owner:npg_5bu7pCTXRlvB@ep-gentle-snow-a4p3pvoe-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  const pool = new Pool({ connectionString });

  try {
    console.log('=== CHECKING AUTOMATION-RELATED TABLES ===\n');
    
    // Check which tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%playbook%' OR table_name LIKE '%webhook%'
      ORDER BY table_name
    `);

    console.log('Existing tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

    // Check playbook_executions table
    console.log('\n=== playbook_executions table ===');
    const peCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'playbook_executions'
      ORDER BY ordinal_position
    `);
    
    if (peCheck.rows.length > 0) {
      console.log('Columns:');
      peCheck.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
      });
    } else {
      console.log('❌ Table does not exist');
    }

    // Check playbook_runs table
    console.log('\n=== playbook_runs table ===');
    const prCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'playbook_runs'
      ORDER BY ordinal_position
    `);
    
    if (prCheck.rows.length > 0) {
      console.log('Columns:');
      prCheck.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
      });
    } else {
      console.log('❌ Table does not exist');
    }

    // Check webhook_queue table
    console.log('\n=== webhook_queue table ===');
    const wqCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'webhook_queue'
      ORDER BY ordinal_position
    `);
    
    if (wqCheck.rows.length > 0) {
      console.log('Columns:');
      wqCheck.rows.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
      });
    } else {
      console.log('❌ Table does not exist');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAutomationTables();
