'use server'

import { query } from '@/lib/db'
import { analyzeSentiment, generateFollowUpEmail } from '@/lib/ai'

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
    'SELECT score FROM health_scores WHERE tenant_id = current_tenant_id() AND account_id = $1 ORDER BY window_end DESC LIMIT 1',
    [accountId]
  )
  const trend = prev.rows[0] ? Number(score) - Number(prev.rows[0].score) : null

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
       COALESCE(window_end, calculated_at, created_at) AS window_end,
       COALESCE(score, overall_score) AS score,
       trend,
       stage
     FROM health_scores
     WHERE tenant_id = current_tenant_id() AND account_id = $1
     ORDER BY COALESCE(window_end, calculated_at, created_at) DESC
     LIMIT $2`,
    [accountId, limit]
  )
  return res.rows
}

// Component-level health trends for mini sparklines
export async function getComponentTrends(accountId: string, limit = 12) {
  const res = await query(
    `SELECT
       COALESCE(window_end, calculated_at, created_at) AS window_end,
       usage_score,
       engagement_score,
       support_sentiment_score,
       adoption_score
     FROM health_scores
     WHERE tenant_id = current_tenant_id() AND account_id = $1
     ORDER BY COALESCE(window_end, calculated_at, created_at) DESC
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

export async function createPlaybook(name: string, scenarioKey: string, triggers: any, actions: any) {
  const res = await query(
    'INSERT INTO playbooks (tenant_id, name, scenario_key, triggers, actions) VALUES (current_tenant_id(), $1, $2, $3::jsonb, $4::jsonb) RETURNING id',
    [name, scenarioKey, JSON.stringify(triggers), JSON.stringify(actions)]
  )
  return res.rows[0]
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
