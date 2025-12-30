'use server'

import { query, getClient, setUserContext } from '@/lib/db'
import { getSession } from './auth-local'
import { redirect } from 'next/navigation'

/**
 * Diagnostic function to check database state
 */
export async function diagnoseDatabaseState() {
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
      return { error: 'User profile not found' }
    }
    
    const tenantId = tenantResult.rows[0].tenant_id
    
    // Check accounts
    const accountsResult = await client.query(
      'SELECT id, name, arr, status, parent_id FROM accounts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10',
      [tenantId]
    )
    
    // Check journey stages
    const stagesResult = await client.query(
      'SELECT id, stage, display_name FROM journey_stages WHERE tenant_id = $1 LIMIT 10',
      [tenantId]
    )
    
    // Check health scores
    const healthResult = await client.query(
      'SELECT account_id, overall_score, calculated_at FROM health_scores WHERE tenant_id = $1 ORDER BY calculated_at DESC LIMIT 10',
      [tenantId]
    )
    
    // Check journey history
    const historyResult = await client.query(
      'SELECT account_id, stage_id, entered_at FROM journey_history WHERE tenant_id = $1 ORDER BY entered_at DESC LIMIT 10',
      [tenantId]
    )
    
    await client.query('COMMIT')
    
    return {
      tenantId,
      accountsCount: accountsResult.rows.length,
      accounts: accountsResult.rows,
      stagesCount: stagesResult.rows.length,
      stages: stagesResult.rows,
      healthScoresCount: healthResult.rows.length,
      healthScores: healthResult.rows,
      journeyHistoryCount: historyResult.rows.length,
      journeyHistory: historyResult.rows,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Diagnostic error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  } finally {
    client.release()
  }
}
