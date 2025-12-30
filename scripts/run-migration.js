const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Use the connection string from .env.local
  const connectionString = 'postgresql://neondb_owner:npg_5bu7pCTXRlvB@ep-gentle-snow-a4p3pvoe-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString,
  });

  try {
    const migrationPath = path.join(__dirname, '../database/migrations/09_cs_intelligence_enhancements.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration: 09_cs_intelligence_enhancements.sql');
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
