const { Pool } = require('pg');

async function getEnumValues() {
  const connectionString = 'postgresql://neondb_owner:npg_5bu7pCTXRlvB@ep-gentle-snow-a4p3pvoe-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  const pool = new Pool({ connectionString });

  try {
    console.log('=== ENUM VALUES FOR playbook_trigger_type ===\n');
    
    // Get enum values
    const result = await pool.query(`
      SELECT e.enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'playbook_trigger_type'
      ORDER BY e.enumsortorder
    `);

    if (result.rows.length > 0) {
      console.log('Valid enum values:');
      result.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. "${row.enumlabel}"`);
      });
    } else {
      console.log('No enum type found or enum has no values');
    }

    console.log('\n=== SAMPLE PLAYBOOK TRIGGER VALUES ===\n');
    
    // Get actual trigger_type values from existing playbooks
    const sampleResult = await pool.query(`
      SELECT DISTINCT trigger_type 
      FROM playbooks 
      LIMIT 10
    `);

    console.log('Actual values in use:');
    sampleResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. "${row.trigger_type}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

getEnumValues();
