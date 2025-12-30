const { Pool } = require('pg');

async function inspectSchema() {
  const connectionString = 'postgresql://neondb_owner:npg_5bu7pCTXRlvB@ep-gentle-snow-a4p3pvoe-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  const pool = new Pool({ connectionString });

  try {
    console.log('=== PLAYBOOKS TABLE SCHEMA ===\n');
    
    // Get all columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'playbooks'
      ORDER BY ordinal_position
    `);

    console.log('Columns:');
    columnsResult.rows.forEach((col, idx) => {
      console.log(`${idx + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}, Default: ${col.column_default}`);
    });

    // Get constraints
    console.log('\n\nConstraints:');
    const constraintsResult = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'playbooks'
    `);

    constraintsResult.rows.forEach(con => {
      console.log(`- ${con.constraint_name} (${con.constraint_type})`);
    });

    // Get NOT NULL columns
    console.log('\n\nNOT NULL Columns:');
    const notNullResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'playbooks' AND is_nullable = 'NO'
      ORDER BY ordinal_position
    `);

    notNullResult.rows.forEach(col => {
      console.log(`- ${col.column_name}`);
    });

    console.log('\n=== SAMPLE EXISTING PLAYBOOK ===\n');
    
    // Get sample row
    const sampleResult = await pool.query('SELECT * FROM playbooks LIMIT 1');
    if (sampleResult.rows.length > 0) {
      console.log('Sample row keys:');
      Object.keys(sampleResult.rows[0]).forEach((key, idx) => {
        console.log(`${idx + 1}. ${key}: ${sampleResult.rows[0][key]}`);
      });
    } else {
      console.log('No existing playbooks found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

inspectSchema();
