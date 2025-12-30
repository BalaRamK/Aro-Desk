// Script to generate test data for account hierarchy and health metrics
import { query } from '@/lib/db'
import fs from 'fs'
import path from 'path'

async function runTestDataMigration() {
  console.log('📊 Creating test data for account hierarchy and health metrics...')
  
  try {
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', '10_test_data_hierarchy.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    
    await query(sql)
    
    console.log('✅ Test data created successfully!')
    console.log('\nTest Accounts Created:')
    console.log('1. Enterprise Corp (Parent) - $500k ARR, Health: 85')
    console.log('   ├─ North Region - $200k ARR, Health: 75')
    console.log('   └─ South Region - $150k ARR, Health: 45 (At Risk)')
    console.log('2. Startup Inc - $50k ARR, Health: 92')
    console.log('3. TechCo Solutions - $120k ARR, Status: At Risk')
    console.log('\nTotal Hierarchy ARR: $850k')
    
  } catch (error) {
    console.error('❌ Error creating test data:', error)
    throw error
  }
}

runTestDataMigration()
