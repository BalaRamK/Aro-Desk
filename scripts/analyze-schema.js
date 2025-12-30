const { Pool } = require('pg');

async function analyzeSchema() {
  const connectionString = 'postgresql://neondb_owner:npg_5bu7pCTXRlvB@ep-gentle-snow-a4p3pvoe-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  
  const pool = new Pool({ connectionString });

  try {
    console.log('=== EXISTING TABLES ===\n');
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    for (const row of tablesResult.rows) {
      console.log(`\n📊 ${row.table_name}`);
      
      // Get column info
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
        LIMIT 10
      `, [row.table_name]);
      
      columnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }

    console.log('\n\n=== CHECKING KEY FEATURES ===\n');
    
    // Check accounts hierarchy
    const accountsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'accounts' AND column_name = 'parent_id'
    `);
    console.log(`✓ Account Hierarchy: ${accountsCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    
    // Check journey tables
    const journeyStagesCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'journey_stages'
    `);
    console.log(`✓ Journey Stages: ${journeyStagesCheck.rows[0].count > 0 ? 'EXISTS' : 'MISSING'}`);
    
    const journeyHistoryCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'journey_history'
    `);
    console.log(`✓ Journey History: ${journeyHistoryCheck.rows[0].count > 0 ? 'EXISTS' : 'MISSING'}`);
    
    // Check metrics tables
    const usageMetricsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'usage_metrics'
    `);
    console.log(`✓ Usage Metrics: ${usageMetricsCheck.rows[0].count > 0 ? 'EXISTS' : 'MISSING'}`);
    
    const healthScoresCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'health_scores'
    `);
    console.log(`✓ Health Scores: ${healthScoresCheck.rows[0].count > 0 ? 'EXISTS' : 'MISSING'}`);
    
    // Check if health_scores has dimension support
    const healthDimensionsCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'health_scores' AND column_name IN ('dimensions', 'component_scores')
    `);
    console.log(`✓ Multi-dimensional Health: ${healthDimensionsCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    
    // Check playbooks
    const playbooksCheck = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = 'playbooks'
    `);
    console.log(`✓ Playbooks: ${playbooksCheck.rows[0].count > 0 ? 'EXISTS' : 'MISSING'}`);
    
    // Check roles support
    const rolesCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'role'
    `);
    console.log(`✓ Role-Based Access: ${rolesCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeSchema();
