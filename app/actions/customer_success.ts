'use server'

import { query, getClient, setUserContext } from '@/lib/db'
import { analyzeSentiment, generateFollowUpEmail } from '@/lib/ai'
import { getSession } from './auth-local'
import { revalidatePath } from 'next/cache'

export type Stage = 'onboarding' | 'adoption' | 'maturity' | 'renewal'

export async function upsertLifecycleStageWeights(stage: Stage, weights: Record<string, number>) {
  const sql = `
    INSERT INTO lifecycle_stages (tenant_id, name, weights)
    VALUES (current_tenant_id(), $1, $2::jsonb)
    ON CONFLICT (tenant_id, name)
    DO UPDATE SET weights = EXCLUDED.weights, updated_at = NOW()
    RETURNING id, name, weights
  `
  const result = await query(sql, [stage, JSON.stringify(weights)])
  return result.rows[0]
}

export async function recordHealthScore(accountId: string, stage: Stage, metrics: Record<string, number>, windowStart: string, windowEnd: string, notes?: string) {
  const weightsRes = await query('SELECT weights FROM lifecycle_stages WHERE tenant_id = current_tenant_id() AND name = $1 AND is_active = true', [stage])
  const weights = weightsRes.rows[0]?.weights || { usage_frequency: 0.4, breadth: 0.3, depth: 0.3 }

  const uf = Number(metrics.usage_frequency || 0)
  const br = Number(metrics.breadth || 0)
  const dp = Number(metrics.depth || 0)
  const score = uf * Number(weights.usage_frequency || 0) + br * Number(weights.breadth || 0) + dp * Number(weights.depth || 0)

  const prev = await query(
    'SELECT overall_score FROM health_scores WHERE tenant_id = current_tenant_id() AND account_id = $1 ORDER BY calculated_at DESC LIMIT 1',
    [accountId]
  )
  const trend = prev.rows[0] ? Number(score) - Number(prev.rows[0].overall_score || 0) : null

  const sql = `
    INSERT INTO health_scores (tenant_id, account_id, stage, score, metrics, window_start, window_end, trend, notes)
    VALUES (current_tenant_id(), $1, $2, $3, $4::jsonb, $5, $6, $7, $8)
    RETURNING id, score, trend
  `
  const result = await query(sql, [accountId, stage, score, JSON.stringify(metrics), windowStart, windowEnd, trend, notes || null])

  if (trend !== null && trend < -0.1) {
    await query(
      'INSERT INTO alerts (tenant_id, account_id, alert_type, severity, message, context) VALUES (current_tenant_id(), $1, $2, $3, $4, $5::jsonb)',
      [accountId, 'health_dip', 'warning', 'Health score decreased', JSON.stringify({ stage, score, trend })]
    )
  }

  return result.rows[0]
}

export async function getHealthTrend(accountId: string, limit = 12) {
  const res = await query(
    `SELECT 
       calculated_at AS window_end,
       overall_score AS score,
       score_change AS trend,
       risk_level AS stage
     FROM health_scores
     WHERE tenant_id = current_tenant_id() AND account_id = $1
     ORDER BY calculated_at DESC
     LIMIT $2`,
    [accountId, limit]
  )
  return res.rows
}

// Component-level health trends for mini sparklines
export async function getComponentTrends(accountId: string, limit = 12) {
  const res = await query(
    `SELECT
       calculated_at AS window_end,
       usage_score,
       engagement_score,
       support_sentiment_score,
       adoption_score
     FROM health_scores
     WHERE tenant_id = current_tenant_id() AND account_id = $1
     ORDER BY calculated_at DESC
     LIMIT $2`,
    [accountId, limit]
  )
  return res.rows
}

export async function analyzeTextsForSentiment(accountId: string, items: Array<{ source_type: string; source_id: string; text: string; language?: string }>) {
  const results: any[] = []
  for (const item of items) {
    const s = await analyzeSentiment(item.text)
    const label = s.label || (s.score < -0.2 ? 'negative' : s.score > 0.2 ? 'positive' : 'neutral')
    const sql = `
      INSERT INTO sentiment_analyses (tenant_id, account_id, source_type, source_id, sentiment_score, magnitude, label, summary, language)
      VALUES (current_tenant_id(), $1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, source_type, source_id)
      DO UPDATE SET sentiment_score = EXCLUDED.sentiment_score, magnitude = EXCLUDED.magnitude, label = EXCLUDED.label, summary = EXCLUDED.summary
      RETURNING id
    `
    const res = await query(sql, [accountId, item.source_type, item.source_id, s.score, s.magnitude || null, label, s.summary || null, item.language || s.language || 'en'])
    results.push({ id: res.rows[0].id, label, score: s.score })

    if (s.score < -0.4) {
      await query(
        'INSERT INTO alerts (tenant_id, account_id, alert_type, severity, message, context) VALUES (current_tenant_id(), $1, $2, $3, $4, $5::jsonb)',
        [accountId, 'sentiment_negative', 'warning', 'Negative sentiment detected', JSON.stringify({ source_type: item.source_type, source_id: item.source_id, score: s.score })]
      )
    }
  }
  return results
}

export async function createSuccessPlan(accountId: string, name: string, targetDate?: string, attributes?: Record<string, any>) {
  const res = await query(
    'INSERT INTO success_plans (tenant_id, account_id, name, target_date, attributes) VALUES (current_tenant_id(), $1, $2, $3, $4::jsonb) RETURNING id',
    [accountId, name, targetDate || null, JSON.stringify(attributes || {})]
  )
  return res.rows[0]
}

export async function addPlanStep(planId: string, title: string, dueDate?: string, assigneeUserId?: string) {
  const res = await query(
    'INSERT INTO success_plan_steps (tenant_id, plan_id, title, due_date, assignee_user_id) VALUES (current_tenant_id(), $1, $2, $3, $4) RETURNING id',
    [planId, title, dueDate || null, assigneeUserId || null]
  )
  return res.rows[0]
}

export async function updatePlanStepStatus(stepId: string, status: 'pending'|'in_progress'|'blocked'|'done') {
  await query('UPDATE success_plan_steps SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = current_tenant_id()', [status, stepId])
  return { ok: true }
}

export async function createPlaybook(name: string, description: string, triggers: any, actions: any) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    // Resolve tenant_id from current user's profile
    const tenantRes = await client.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [session.userId]
    )
    const tenantId = tenantRes.rows[0]?.tenant_id
    if (!tenantId) {
      throw new Error('Unable to resolve tenant for current user')
    }
    
    // Generate a unique scenario_key from name
    const scenarioKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now()
    
    // Map UI trigger types to database enum values
    const triggerTypeMap: Record<string, string> = {
      'health_score_drop': 'Health Score Drop',
      'stage_change': 'Stage Transition',
      'usage_decline': 'Usage Decline',
      'support_spike': 'Support Ticket',
      'contract_approaching': 'Contract Expiration',
      'manual': 'Manual',
      'scheduled': 'Scheduled'
    }
    
    // Extract trigger type and criteria from triggers object
    // triggers has format: { type: 'health_score_drop', params: {...} }
    const uiTriggerType = triggers?.type || 'manual'
    const triggerType = triggerTypeMap[uiTriggerType] || 'Manual'
    const triggerCriteria = triggers?.params || {}
    
    // For webhook, use a placeholder URL (can be updated via UI)
    const webhookUrl = triggers?.webhook_url || 'https://example.com/webhook/placeholder'
    
    const res = await client.query(
      `INSERT INTO playbooks (
        tenant_id, name, description, 
        trigger_type, trigger_criteria, webhook_url, 
        scenario_key, triggers, actions
      ) 
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb) 
       RETURNING id`,
      [
        tenantId, 
        name, 
        description, 
        triggerType, 
        JSON.stringify(triggerCriteria), 
        webhookUrl,
        scenarioKey, 
        JSON.stringify(triggers), 
        JSON.stringify(actions)
      ]
    )
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/automation')
    return { success: true, id: res.rows[0].id }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating playbook:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getPlaybook(playbookId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    const result = await client.query(
      `SELECT * FROM playbooks WHERE id = $1 AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = $2)`,
      [playbookId, session.userId]
    )
    
    await client.query('COMMIT')
    return result.rows[0] || null
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error fetching playbook:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function updatePlaybook(
  playbookId: string, 
  updates: {
    name?: string
    description?: string
    triggers?: any
    actions?: any
    is_active?: boolean
    webhook_url?: string
  }
) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    // Resolve tenant_id
    const tenantRes = await client.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [session.userId]
    )
    const tenantId = tenantRes.rows[0]?.tenant_id
    if (!tenantId) {
      throw new Error('Unable to resolve tenant for current user')
    }
    
    // Build dynamic UPDATE query
    const updateFields: string[] = []
    const values: any[] = []
    let paramCount = 1
    
    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`)
      values.push(updates.name)
    }
    
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramCount++}`)
      values.push(updates.description)
    }
    
    if (updates.triggers !== undefined) {
      // Map trigger type to enum
      const triggerTypeMap: Record<string, string> = {
        'health_score_drop': 'Health Score Drop',
        'stage_change': 'Stage Transition',
        'usage_decline': 'Usage Decline',
        'support_spike': 'Support Ticket',
        'contract_approaching': 'Contract Expiration',
        'manual': 'Manual',
        'scheduled': 'Scheduled'
      }
      
      const uiTriggerType = updates.triggers?.type || 'manual'
      const triggerType = triggerTypeMap[uiTriggerType] || 'Manual'
      const triggerCriteria = updates.triggers?.params || {}
      
      updateFields.push(`trigger_type = $${paramCount++}`)
      values.push(triggerType)
      
      updateFields.push(`trigger_criteria = $${paramCount++}`)
      values.push(JSON.stringify(triggerCriteria))
      
      updateFields.push(`triggers = $${paramCount++}`)
      values.push(JSON.stringify(updates.triggers))
    }
    
    if (updates.actions !== undefined) {
      updateFields.push(`actions = $${paramCount++}`)
      values.push(JSON.stringify(updates.actions))
    }
    
    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`)
      values.push(updates.is_active)
    }
    
    if (updates.webhook_url !== undefined) {
      updateFields.push(`webhook_url = $${paramCount++}`)
      values.push(updates.webhook_url)
    }
    
    updateFields.push(`updated_at = NOW()`)
    
    if (updateFields.length === 1) { // Only updated_at
      await client.query('COMMIT')
      return { success: true }
    }
    
    // Add WHERE clause parameters
    values.push(playbookId)
    values.push(tenantId)
    
    const query = `
      UPDATE playbooks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
      RETURNING id
    `
    
    const result = await client.query(query, values)
    
    if (result.rowCount === 0) {
      throw new Error('Playbook not found or unauthorized')
    }
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/automation')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating playbook:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function deletePlaybook(playbookId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    // Resolve tenant_id
    const tenantRes = await client.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [session.userId]
    )
    const tenantId = tenantRes.rows[0]?.tenant_id
    if (!tenantId) {
      throw new Error('Unable to resolve tenant for current user')
    }
    
    // Delete playbook (cascades to playbook_runs, playbook_executions, webhook_queue)
    const result = await client.query(
      'DELETE FROM playbooks WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [playbookId, tenantId]
    )
    
    if (result.rowCount === 0) {
      throw new Error('Playbook not found or unauthorized')
    }
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/automation')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error deleting playbook:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function togglePlaybookActive(playbookId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    // Resolve tenant_id
    const tenantRes = await client.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [session.userId]
    )
    const tenantId = tenantRes.rows[0]?.tenant_id
    if (!tenantId) {
      throw new Error('Unable to resolve tenant for current user')
    }
    
    // Toggle is_active
    const result = await client.query(
      `UPDATE playbooks 
       SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 
       RETURNING id, is_active`,
      [playbookId, tenantId]
    )
    
    if (result.rowCount === 0) {
      throw new Error('Playbook not found or unauthorized')
    }
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/automation')
    return { success: true, is_active: result.rows[0].is_active }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error toggling playbook:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function runPlaybook(playbookId: string, accountId: string, triggeredBy: string = 'system') {
  const pb = await query('SELECT actions FROM playbooks WHERE id = $1 AND tenant_id = current_tenant_id() AND is_active = true', [playbookId])
  if (!pb.rows[0]) return { error: 'Playbook not found or inactive' }
  const actions = pb.rows[0].actions
  const res = await query(
    'INSERT INTO playbook_runs (tenant_id, playbook_id, account_id, status, triggered_by, result) VALUES (current_tenant_id(), $1, $2, $3, $4, $5::jsonb) RETURNING id',
    [playbookId, accountId, 'completed', triggeredBy, JSON.stringify({ actions_executed: actions })]
  )
  return { id: res.rows[0].id, actions }
}

export async function ingestCdiEvent(accountId: string | null, sourceType: 'support'|'analytics'|'crm'|'custom', eventType: string, payload: any, occurredAt: string) {
  await query(
    'INSERT INTO cdi_events (tenant_id, account_id, source_type, event_type, payload, occurred_at) VALUES (current_tenant_id(), $1, $2, $3, $4::jsonb, $5)',
    [accountId, sourceType, eventType, JSON.stringify(payload), occurredAt]
  )
  return { ok: true }
}

export async function triggerAiFollowUp(workflowId: string, accountId: string, context: Record<string, any>) {
  const body = await generateFollowUpEmail(context)
  const res = await query(
    'INSERT INTO ai_workflow_runs (tenant_id, workflow_id, account_id, input, output, status, started_at, completed_at) VALUES (current_tenant_id(), $1, $2, $3::jsonb, $4::jsonb, $5, NOW(), NOW()) RETURNING id',
    [workflowId, accountId, JSON.stringify(context), JSON.stringify({ email_body: body }), 'completed']
  )
  return { id: res.rows[0].id, email_body: body }
}

// Lists for UI rendering
export async function listSuccessPlans(accountId: string) {
  const res = await query(
    'SELECT * FROM success_plans WHERE tenant_id = current_tenant_id() AND account_id = $1 ORDER BY created_at DESC',
    [accountId]
  )
  return res.rows
}

export async function listPlanSteps(planId: string) {
  const res = await query(
    'SELECT * FROM success_plan_steps WHERE tenant_id = current_tenant_id() AND plan_id = $1 ORDER BY sort_order, created_at',
    [planId]
  )
  return res.rows
}

export async function listAlerts(accountId: string, limit = 20) {
  const res = await query(
    'SELECT * FROM alerts WHERE tenant_id = current_tenant_id() AND account_id = $1 ORDER BY created_at DESC LIMIT $2',
    [accountId, limit]
  )
  return res.rows
}

export async function listSentiment(accountId: string, limit = 50) {
  const res = await query(
    'SELECT * FROM sentiment_analyses WHERE tenant_id = current_tenant_id() AND account_id = $1 ORDER BY created_at DESC LIMIT $2',
    [accountId, limit]
  )
  return res.rows
}

export async function listCdiEvents(accountId: string, limit = 50) {
  const res = await query(
    'SELECT * FROM cdi_events WHERE tenant_id = current_tenant_id() AND account_id = $1 ORDER BY occurred_at DESC LIMIT $2',
    [accountId, limit]
  )
  return res.rows
}

export async function listPlaybookRuns(accountId: string, limit = 20) {
  const res = await query(
    'SELECT pr.*, pb.name AS playbook_name FROM playbook_runs pr LEFT JOIN playbooks pb ON pr.playbook_id = pb.id WHERE pr.tenant_id = current_tenant_id() AND pr.account_id = $1 ORDER BY pr.created_at DESC LIMIT $2',
    [accountId, limit]
  )
  return res.rows
}

export async function listRecentCdiEvents(limit = 20) {
  const res = await query(
    'SELECT e.*, a.name AS account_name FROM cdi_events e LEFT JOIN accounts a ON e.account_id = a.id WHERE e.tenant_id = current_tenant_id() ORDER BY e.occurred_at DESC LIMIT $1',
    [limit]
  )
  return res.rows
}

export async function getDefaultAiWorkflowId() {
  const res = await query(
    "SELECT id FROM ai_workflows WHERE tenant_id = current_tenant_id() AND is_active = true ORDER BY updated_at DESC LIMIT 1"
  )
  return res.rows[0]?.id || null
}

export async function triggerAiFollowUpAction(accountId: string, context: Record<string, any>) {
  const wf = await getDefaultAiWorkflowId()
  if (!wf) {
    return { error: 'No active AI workflow configured' }
  }
  return triggerAiFollowUp(wf, accountId, context)
}

// ============================================================================
// MULTI-DIMENSIONAL HEALTH SCORING
// ============================================================================

export async function updateHealthScoreDimensions(
  accountId: string,
  dimensions: {
    product_usage?: number
    engagement?: number
    support_health?: number
    adoption?: number
    relationship?: number
  }
) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    // Calculate overall score as weighted average
    const scores = Object.values(dimensions).filter(v => v !== undefined)
    const overallScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 50
    
    // Insert or update health score with component breakdown
    const result = await client.query(
      `INSERT INTO health_scores (
        tenant_id, account_id, overall_score, 
        usage_score, engagement_score, support_sentiment_score, adoption_score,
        component_scores, calculated_at
      ) 
      VALUES (
        (SELECT tenant_id FROM profiles WHERE id = $1), 
        $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
      )
      RETURNING id, overall_score, component_scores`,
      [
        session.userId,
        accountId,
        overallScore,
        dimensions.product_usage || null,
        dimensions.engagement || null,
        dimensions.support_health || null,
        dimensions.adoption || null,
        JSON.stringify(dimensions)
      ]
    )
    
    await client.query('COMMIT')
    revalidatePath(`/dashboard/accounts/${accountId}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating health dimensions:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function getHealthDimensions(accountId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const result = await query(
    `SELECT 
      overall_score,
      component_scores,
      calculated_at,
      usage_score,
      engagement_score,
      support_sentiment_score,
      adoption_score
    FROM health_scores
    WHERE account_id = $1 
      AND tenant_id = current_tenant_id()
    ORDER BY calculated_at DESC
    LIMIT 1`,
    [accountId]
  )
  
  return result.rows[0] || null
}

// ============================================================================
// ACCOUNT HIERARCHY FUNCTIONS
// ============================================================================

export async function getAccountChildren(parentAccountId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const result = await query(
    'SELECT * FROM get_child_accounts($1)',
    [parentAccountId]
  )
  
  return result.rows
}

export async function getAccountHierarchyArr(parentAccountId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const result = await query(
    'SELECT get_hierarchy_arr($1) as total_arr',
    [parentAccountId]
  )
  
  return result.rows[0]?.total_arr || 0
}

export async function getAccountBreadcrumb(accountId: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const result = await query(
    'SELECT get_account_path($1) as path',
    [accountId]
  )
  
  return result.rows[0]?.path || ''
}

export async function refreshAccountHierarchy() {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  await query('SELECT refresh_account_hierarchy_summary()')
  revalidatePath('/dashboard/accounts')
  return { success: true }
}

// ============================================================================
// ROLE-BASED ACCESS CHECKS
// ============================================================================

export async function getCurrentUserRole() {
  const session = await getSession()
  if (!session) return null
  
  const result = await query('SELECT current_user_role() as role')
  return result.rows[0]?.role || null
}

export async function canExecutePlaybooks() {
  const session = await getSession()
  if (!session) return false
  
  const result = await query('SELECT is_practitioner() as can_execute')
  return result.rows[0]?.can_execute || false
}

export async function canWriteData() {
  const session = await getSession()
  if (!session) return false
  
  const result = await query('SELECT can_write() as can_write')
  return result.rows[0]?.can_write || false
}
