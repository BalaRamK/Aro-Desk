#!/bin/bash
# Migration runner - runs all migrations against the database

set -e

cd "$(dirname "$0")"

echo "Running integrations migration..."

node << 'EOF'
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  try {
    // Read and execute the integration schema migration
    const sql = fs.readFileSync('database/migrations/04_integrations.sql', 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Integration tables created successfully');
    console.log('Tables created:');
    console.log('  ✓ integration_sources');
    console.log('  ✓ integration_field_mappings');
    console.log('  ✓ integration_synced_records');
    console.log('  ✓ integration_sync_logs');
    console.log('  ✓ external_contacts');
    console.log('  ✓ external_tickets');
    console.log('  ✓ external_deals');
  } finally {
    client.release();
    pool.end();
  }
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
EOF
