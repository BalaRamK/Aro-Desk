require('dotenv').config({path:'.env.local'});
const {Client} = require('pg');
const client = new Client({connectionString: process.env.DATABASE_URL});

async function checkTable() {
  await client.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name='stage_milestones' 
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('Table stage_milestones does not exist');
    } else {
      console.log('stage_milestones table columns:');
      result.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkTable();
