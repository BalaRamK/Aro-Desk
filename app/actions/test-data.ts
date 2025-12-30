'use server'

import { getClient, setUserContext } from '@/lib/db'
import { getSession } from './auth-local'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/**
 * Create test data for account hierarchy and health metrics
 * This is a one-time setup to populate the database with sample accounts
 */
export async function createTestHierarchyData() {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    // Get tenant_id
    const tenantResult = await client.query(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [session.userId]
    )
    
    if (tenantResult.rows.length === 0) {
      throw new Error('User profile not found')
    }
    
    const tenantId = tenantResult.rows[0].tenant_id
    console.log('Creating test data for tenant:', tenantId)
    
    // Get a journey stage (use first available)
    const stageResult = await client.query(
      `SELECT stage FROM journey_stages WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    )
    
    let stageName = null
    if (stageResult.rows.length === 0) {
      console.log('No journey stages found, creating default stage...')
      // Create a default stage if none exists
      const newStageResult = await client.query(
        `INSERT INTO journey_stages (tenant_id, stage, display_name, display_order)
         VALUES ($1, $2, $3, $4)
         RETURNING stage`,
        [tenantId, 'Onboarding', 'Onboarding', 1]
      )
      stageName = newStageResult.rows[0].stage
    } else {
      stageName = stageResult.rows[0].stage
    }
    
    console.log('Using stage:', stageName)

    // Backfill any legacy journey_history rows that stored the stage UUID instead of the stage name
    await client.query(
      `UPDATE journey_history jh
       SET to_stage = js.stage
       FROM journey_stages js
       WHERE jh.tenant_id = $1
         AND jh.to_stage = js.id::text`,
      [tenantId]
    )

    await client.query(
      `UPDATE journey_history jh
       SET from_stage = js.stage
       FROM journey_stages js
       WHERE jh.tenant_id = $1
         AND jh.from_stage = js.id::text`,
      [tenantId]
    )
    
    // Check if test data already exists
    const existingResult = await client.query(
      `SELECT id FROM accounts WHERE name = $1 AND tenant_id = $2`,
      ['Enterprise Corp (Parent)', tenantId]
    )
    
    if (existingResult.rows.length > 0) {
      await client.query('COMMIT')
      console.log('Test data already exists')
      return { success: true, message: 'Test data already exists' }
    }
    
    // Create Parent Account
    const parentResult = await client.query(
      `INSERT INTO accounts (name, arr, status, parent_id, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      ['Enterprise Corp (Parent)', 500000, 'Active', null, tenantId]
    )
    const parentId = parentResult.rows[0].id
    
    // Create Child Account 1
    const child1Result = await client.query(
      `INSERT INTO accounts (name, arr, status, parent_id, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      ['Enterprise Corp - North Region', 200000, 'Active', parentId, tenantId]
    )
    const child1Id = child1Result.rows[0].id
    
    // Create Child Account 2
    const child2Result = await client.query(
      `INSERT INTO accounts (name, arr, status, parent_id, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      ['Enterprise Corp - South Region', 150000, 'Active', parentId, tenantId]
    )
    const child2Id = child2Result.rows[0].id
    
    // Create Standalone Account 1
    const standalone1Result = await client.query(
      `INSERT INTO accounts (name, arr, status, parent_id, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      ['Startup Inc', 50000, 'Active', null, tenantId]
    )
    const standalone1Id = standalone1Result.rows[0].id
    
    // Create Standalone Account 2
    await client.query(
      `INSERT INTO accounts (name, arr, status, parent_id, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      ['TechCo Solutions', 120000, 'At Risk', null, tenantId]
    )
    
    // Insert Health Scores for Parent Account
    await client.query(
      `INSERT INTO health_scores (
        account_id, tenant_id, overall_score, usage_score, engagement_score,
        support_sentiment_score, adoption_score, component_scores, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        parentId, tenantId, 85, 88, 82, 90, 85,
        JSON.stringify({
          product_usage: 88,
          engagement: 82,
          support_health: 90,
          adoption: 85,
          relationship: 87
        })
      ]
    )
    
    // Insert Health Scores for Child Account 1
    await client.query(
      `INSERT INTO health_scores (
        account_id, tenant_id, overall_score, usage_score, engagement_score,
        support_sentiment_score, adoption_score, component_scores, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        child1Id, tenantId, 75, 78, 72, 80, 73,
        JSON.stringify({
          product_usage: 78,
          engagement: 72,
          support_health: 80,
          adoption: 73,
          relationship: 72
        })
      ]
    )
    
    // Insert Health Scores for Child Account 2
    await client.query(
      `INSERT INTO health_scores (
        account_id, tenant_id, overall_score, usage_score, engagement_score,
        support_sentiment_score, adoption_score, component_scores, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        child2Id, tenantId, 45, 50, 42, 48, 43,
        JSON.stringify({
          product_usage: 50,
          engagement: 42,
          support_health: 48,
          adoption: 43,
          relationship: 42
        })
      ]
    )
    
    // Insert Health Scores for Standalone Account
    await client.query(
      `INSERT INTO health_scores (
        account_id, tenant_id, overall_score, usage_score, engagement_score,
        support_sentiment_score, adoption_score, component_scores, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        standalone1Id, tenantId, 92, 95, 90, 93, 92,
        JSON.stringify({
          product_usage: 95,
          engagement: 90,
          support_health: 93,
          adoption: 92,
          relationship: 90
        })
      ]
    )
    
    // Insert journey history
    await client.query(
      `INSERT INTO journey_history (account_id, to_stage, tenant_id, entered_at, notes)
       VALUES 
         ($1, $2, $3, NOW() - INTERVAL '90 days', 'Parent account onboarded'),
         ($4, $2, $3, NOW() - INTERVAL '60 days', 'North region division started'),
         ($5, $2, $3, NOW() - INTERVAL '60 days', 'South region division started'),
         ($6, $2, $3, NOW() - INTERVAL '30 days', 'New startup customer')`,
      [parentId, stageName, tenantId, child1Id, child2Id, standalone1Id]
    )
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/accounts')
    
    console.log('Test data created successfully')
    
    return {
      success: true,
      message: 'Test data created successfully',
      summary: {
        parent: 'Enterprise Corp (Parent) - $500k ARR, Health: 85',
        children: [
          'Enterprise Corp - North Region - $200k ARR, Health: 75',
          'Enterprise Corp - South Region - $150k ARR, Health: 45 (At Risk)'
        ],
        standalone: [
          'Startup Inc - $50k ARR, Health: 92',
          'TechCo Solutions - $120k ARR, Status: At Risk'
        ],
        totalHierarchyARR: '$850k'
      }
    }
  } catch (error) {
    await client.query('ROLLBACK')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error creating test data:', errorMessage, error)
    throw new Error(`Failed to create test data: ${errorMessage}`)
  } finally {
    client.release()
  }
}
