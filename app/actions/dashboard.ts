'use server'

import { query, getClient, setUserContext } from '@/lib/db'
import { getSession } from './auth-local'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function normalizeDateRange(params?: { startDate?: string; endDate?: string }) {
  if (!params) return { startDate: undefined, endDate: undefined }
  const isValid = (value?: string) => !!value && DATE_RE.test(value) && !Number.isNaN(new Date(value).getTime())
  let startDate = isValid(params.startDate) ? params.startDate : undefined
  let endDate = isValid(params.endDate) ? params.endDate : undefined
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    startDate = undefined
    endDate = undefined
  }
  return { startDate, endDate }
}

// Get global health distribution for Executive Dashboard
export async function getHealthDistribution(params?: { startDate?: string; endDate?: string }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { startDate, endDate } = normalizeDateRange(params)
  const dateFilters: string[] = []
  const sqlParams: any[] = []
  if (startDate) {
    sqlParams.push(startDate)
    dateFilters.push(`calculated_at::date >= $${sqlParams.length}::date`)
  }
  if (endDate) {
    sqlParams.push(endDate)
    dateFilters.push(`calculated_at::date <= $${sqlParams.length}::date`)
  }
  const dateClause = dateFilters.length ? `WHERE ${dateFilters.join(' AND ')}` : ''

  const client = await getClient()

  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)

    const result = await client.query(
      `
        WITH latest_health AS (
          SELECT DISTINCT ON (account_id)
            account_id, overall_score, calculated_at
          FROM health_scores
          ${dateClause}
          ORDER BY account_id, calculated_at DESC
        ),
        filtered_accounts AS (
          SELECT lh.account_id, lh.overall_score
          FROM latest_health lh
          JOIN accounts a ON lh.account_id = a.id
          WHERE a.parent_id IS NULL
        ),
        totals AS (
          SELECT COUNT(*) AS total FROM filtered_accounts
        )
        SELECT 
          CASE 
            WHEN lh.overall_score >= 70 THEN 'Healthy'
            WHEN lh.overall_score >= 40 THEN 'At Risk'
            ELSE 'Critical'
          END as health_category,
          COUNT(*) as count,
          ROUND(100.0 * COUNT(*) / NULLIF((SELECT total FROM totals), 0), 1) as percentage
        FROM filtered_accounts lh
        CROSS JOIN totals
        GROUP BY health_category, totals.total
        ORDER BY health_category DESC
      `,
      sqlParams
    )

    await client.query('COMMIT')
    return result.rows
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Get accounts at risk with high revenue
export async function getRevenueAtRisk(params?: { startDate?: string; endDate?: string }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const client = await getClient()

  const { startDate, endDate } = normalizeDateRange(params)
  const dateFilters: string[] = []
  const sqlParams: any[] = []
  if (startDate) {
    sqlParams.push(startDate)
    dateFilters.push(`calculated_at::date >= $${sqlParams.length}::date`)
  }
  if (endDate) {
    sqlParams.push(endDate)
    dateFilters.push(`calculated_at::date <= $${sqlParams.length}::date`)
  }
  const dateClause = dateFilters.length ? `WHERE ${dateFilters.join(' AND ')}` : ''

  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)

    const result = await client.query(
      `
        WITH latest_health AS (
          SELECT DISTINCT ON (account_id)
            account_id, overall_score, risk_level, calculated_at
          FROM health_scores
          ${dateClause}
          ORDER BY account_id, calculated_at DESC
        )
        SELECT 
          a.id,
          a.name,
          a.arr,
          lh.overall_score,
          lh.risk_level,
          p.full_name as csm_name
        FROM accounts a
        JOIN latest_health lh ON a.id = lh.account_id
        LEFT JOIN profiles p ON a.csm_id = p.id
        WHERE a.arr > 100000
          AND lh.overall_score < 50
          AND a.parent_id IS NULL
        ORDER BY a.arr DESC, lh.overall_score ASC
        LIMIT 10
      `,
      sqlParams
    )

    await client.query('COMMIT')
    return result.rows
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Get portfolio growth trend (accounts moving through stages)
export async function getPortfolioGrowth(days: number = 90, params?: { startDate?: string; endDate?: string }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const client = await getClient()

  const { startDate, endDate } = normalizeDateRange(params)
  const dateFilters: string[] = []
  const sqlParams: any[] = []
  if (startDate) {
    sqlParams.push(startDate)
    dateFilters.push(`jh.entered_at::date >= $${sqlParams.length}::date`)
  } else {
    dateFilters.push(`jh.entered_at >= NOW() - INTERVAL '${days} days'`)
  }
  if (endDate) {
    sqlParams.push(endDate)
    dateFilters.push(`jh.entered_at::date <= $${sqlParams.length}::date`)
  }
  const dateClause = dateFilters.length ? `WHERE ${dateFilters.join(' AND ')}` : ''

  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)

    const result = await client.query(
      `
        WITH stage_counts AS (
          SELECT 
            DATE(jh.entered_at) as date,
            jh.to_stage as stage,
            COUNT(DISTINCT jh.account_id) as account_count
          FROM journey_history jh
          ${dateClause}
          GROUP BY DATE(jh.entered_at), jh.to_stage
        )
        SELECT 
          date,
          stage::text,
          account_count,
          SUM(account_count) OVER (ORDER BY date) as cumulative_count
        FROM stage_counts
        ORDER BY date DESC
        LIMIT 100
      `,
      sqlParams
    )

    await client.query('COMMIT')
    return result.rows
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Get all accounts with hierarchy info
export async function getAccounts(filters?: {
  searchTerm?: string
  healthFilter?: string
  stageFilter?: string
  startDate?: string
  endDate?: string
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  await setUserContext(session.userId)
  
  const { startDate, endDate } = normalizeDateRange(filters)
  let whereConditions = []
  let params: any[] = []

  const healthDateConditions: string[] = []
  if (startDate) {
    params.push(startDate)
    healthDateConditions.push(`calculated_at::date >= $${params.length}::date`)
  }
  if (endDate) {
    params.push(endDate)
    healthDateConditions.push(`calculated_at::date <= $${params.length}::date`)
  }
  const healthDateClause = healthDateConditions.length ? `WHERE ${healthDateConditions.join(' AND ')}` : ''
  
  if (filters?.searchTerm) {
    params.push(`%${filters.searchTerm}%`)
    whereConditions.push(`a.name ILIKE $${params.length}`)
  }
  
  if (filters?.healthFilter) {
    if (filters.healthFilter === 'Healthy') {
      whereConditions.push(`lh.overall_score >= 70`)
    } else if (filters.healthFilter === 'At Risk') {
      whereConditions.push(`lh.overall_score >= 40 AND lh.overall_score < 70`)
    } else if (filters.healthFilter === 'Critical') {
      whereConditions.push(`lh.overall_score < 40`)
    }
  }
  
  if (filters?.stageFilter) {
    params.push(filters.stageFilter)
    whereConditions.push(`ls.to_stage = $${params.length}`)
  }
  
  const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''
  
  const result = await query(`
    WITH latest_health AS (
      SELECT DISTINCT ON (account_id)
        account_id, overall_score, risk_level, usage_score, engagement_score, support_sentiment_score, adoption_score
      FROM health_scores
      ${healthDateClause}
      ORDER BY account_id, calculated_at DESC
    ),
    latest_stage AS (
      SELECT DISTINCT ON (account_id)
        account_id, to_stage
      FROM journey_history
      ORDER BY account_id, entered_at DESC
    )
    SELECT 
      a.id,
      a.name,
      a.parent_id,
      a.hierarchy_level,
      a.hierarchy_path,
      ls.to_stage as current_stage,
      a.crm_attributes,
      a.status,
      lh.overall_score,
      lh.risk_level,
      lh.usage_score,
      lh.engagement_score,
      lh.support_sentiment_score,
      lh.adoption_score,
      pa.name as parent_name,
      u.email as csm_email,
      p.full_name as csm_name
    FROM accounts a
    LEFT JOIN latest_health lh ON a.id = lh.account_id
    LEFT JOIN latest_stage ls ON a.id = ls.account_id
    LEFT JOIN accounts pa ON a.parent_id = pa.id
    LEFT JOIN users u ON a.csm_id = u.id
    LEFT JOIN profiles p ON u.id = p.id
    WHERE 1=1 ${whereClause}
    ORDER BY a.hierarchy_level, a.name
  `, params)
  
  return result.rows
}

// Get single account details with full context
export async function getAccountDetails(accountId: string) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  await setUserContext(session.userId)
  
  const accountResult = await query(`
    WITH latest_health AS (
      SELECT DISTINCT ON (account_id)
        account_id, overall_score, risk_level, usage_score, engagement_score, support_sentiment_score, adoption_score, created_at
      FROM health_scores
      ORDER BY account_id, calculated_at DESC
    ),
    latest_stage AS (
      SELECT DISTINCT ON (account_id)
        account_id, to_stage
      FROM journey_history
      ORDER BY account_id, entered_at DESC
    )
    SELECT 
      a.*,
      lh.overall_score,
      lh.risk_level,
      lh.usage_score,
      lh.engagement_score,
      lh.support_sentiment_score,
      lh.adoption_score,
      lh.created_at as health_updated_at,
      ls.to_stage as current_stage,
      pa.name as parent_name,
      u.email as csm_email,
      p.full_name as csm_name
    FROM accounts a
    LEFT JOIN latest_health lh ON a.id = lh.account_id
    LEFT JOIN latest_stage ls ON a.id = ls.account_id
    LEFT JOIN accounts pa ON a.parent_id = pa.id
    LEFT JOIN users u ON a.csm_id = u.id
    LEFT JOIN profiles p ON u.id = p.id
    WHERE a.id = $1
  `, [accountId])
  
  if (accountResult.rows.length === 0) {
    return null
  }
  
  // Get subsidiaries
  const subsidiariesResult = await query(`
    WITH latest_stage AS (
      SELECT DISTINCT ON (account_id)
        account_id, to_stage
      FROM journey_history
      ORDER BY account_id, entered_at DESC
    )
    SELECT a.id, a.name, ls.to_stage as current_stage, a.hierarchy_level
    FROM accounts a
    LEFT JOIN latest_stage ls ON a.id = ls.account_id
    WHERE a.parent_id = $1
    ORDER BY a.name
  `, [accountId])
  
  // Get recent journey history
  const journeyResult = await query(`
    SELECT 
      jh.*,
      u.email as changed_by_email
    FROM journey_history jh
    LEFT JOIN users u ON jh.changed_by = u.id
    WHERE jh.account_id = $1
    ORDER BY jh.entered_at DESC
    LIMIT 10
  `, [accountId])
  
  // Get recent usage metrics
  const metricsResult = await query(`
    SELECT *
    FROM usage_metrics
    WHERE account_id = $1
    ORDER BY recorded_at DESC
    LIMIT 30
  `, [accountId])
  
  return {
    account: accountResult.rows[0],
    subsidiaries: subsidiariesResult.rows,
    journey: journeyResult.rows,
    metrics: metricsResult.rows
  }
}

// Get all journey stages
export async function getJourneyStages() {
  const session = await getSession()
  if (!session) redirect('/login')
  
  await setUserContext(session.userId)
  
  const result = await query(`
    SELECT 
      id,
      stage,
      display_name,
      display_name as name,
      display_order,
      target_duration_days,
      color_hex,
      tenant_id,
      is_active,
      created_at
    FROM journey_stages
    ORDER BY display_order
  `)
  
  return result.rows
}

// Get all accounts for parent selection dropdown
export async function getAllAccountsForParentSelect() {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    const result = await client.query(`
      SELECT 
        id,
        name,
        arr,
        parent_id
      FROM accounts
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = $1)
      ORDER BY name ASC
    `, [session.userId])
    
    await client.query('COMMIT')
    return result.rows
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Get accounts grouped by journey stage (for Kanban)
export async function getAccountsByStage() {
  const session = await getSession()
  if (!session) redirect('/login')
  
  await setUserContext(session.userId)
  
  const stagesResult = await query(`
    SELECT DISTINCT ON (id)
      id,
      stage,
      display_name,
      display_name as name,
      display_order,
      target_duration_days,
      color_hex
    FROM journey_stages
    ORDER BY id, display_order
  `)
  
  const accountsResult = await query(`
    WITH latest_stage AS (
      SELECT DISTINCT ON (account_id)
        account_id, to_stage, entered_at
      FROM journey_history
      ORDER BY account_id, entered_at DESC
    ),
    latest_health AS (
      SELECT DISTINCT ON (account_id)
        account_id, overall_score, risk_level, calculated_at
      FROM health_scores
      ORDER BY account_id, calculated_at DESC
    )
    SELECT 
      a.id,
      a.name,
      ls.to_stage as current_stage,
      a.arr,
      lh.overall_score,
      lh.risk_level,
      p.full_name as csm_name
    FROM accounts a
    LEFT JOIN latest_stage ls ON a.id = ls.account_id
    LEFT JOIN latest_health lh ON a.id = lh.account_id
    LEFT JOIN profiles p ON a.csm_id = p.id
    WHERE a.parent_id IS NULL
    ORDER BY ls.to_stage, a.name
  `)
  
  return {
    stages: stagesResult.rows,
    accounts: accountsResult.rows
  }
}

// Update account stage (for Kanban drag-and-drop)
export async function updateAccountStage(accountId: string, newStage: string, notes?: string) {
  const session = await getSession()
  if (!session) redirect('/login')
  
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
    
    // Get current stage from latest journey history
    const currentResult = await client.query(
      `SELECT to_stage FROM journey_history 
       WHERE account_id = $1 
       ORDER BY entered_at DESC 
       LIMIT 1`,
      [accountId]
    )
    
    const oldStage = currentResult.rows.length > 0 ? currentResult.rows[0].to_stage : null
    
    // Exit old stage if exists
    if (oldStage) {
      await client.query(`
        UPDATE journey_history
        SET exited_at = NOW()
        WHERE account_id = $1 AND to_stage = $2 AND exited_at IS NULL
      `, [accountId, oldStage])
    }
    
    // Create new journey history entry
    await client.query(`
      INSERT INTO journey_history (account_id, from_stage, to_stage, changed_by, reason, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [accountId, oldStage, newStage, session.userId, notes || 'Stage updated via Kanban board', tenantId])
    
    await client.query('COMMIT')
    
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating account stage:', error)
    throw error
  } finally {
    client.release()
  }
}

// Create a new customer account and seed initial journey history
export async function createAccount(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const name = formData.get('name')?.toString().trim()
  const stage = formData.get('stage')?.toString()
  const arrRaw = formData.get('arr')?.toString()
  const status = formData.get('status')?.toString() || 'Active'
  const parentIdRaw = formData.get('parent_id')?.toString()

  if (!name || !stage) {
    throw new Error('Name and stage are required')
  }

  const arr = arrRaw ? Number(arrRaw) : null
  if (arrRaw && Number.isNaN(arr)) {
    throw new Error('ARR must be a number')
  }

  const parentId = parentIdRaw && parentIdRaw !== '' ? parentIdRaw : null

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

    const accountResult = await client.query(
      `INSERT INTO accounts (name, status, arr, parent_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, status, arr, parentId, tenantId]
    )

    const accountId = accountResult.rows[0].id

    await client.query(
      `INSERT INTO journey_history (account_id, from_stage, to_stage, entered_at, changed_by, notes, tenant_id)
       VALUES ($1, NULL, $2, NOW(), $3, $4, $5)`,
      [accountId, stage, session.userId, 'Initialized via CS Handbook', tenantId]
    )

    await client.query('COMMIT')

    revalidatePath('/dashboard/accounts')
    revalidatePath('/dashboard/journey')
    redirect('/dashboard/accounts')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating account:', error)
    throw error
  } finally {
    client.release()
  }
}

// Update account details (name, ARR, status)
export async function updateAccount(accountId: string, data: {
  name?: string
  arr?: number | null
  status?: string
  parent_id?: string | null
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const updates: string[] = []
  const params: any[] = [accountId]
  let paramCount = 1
  
  if (data.name?.trim()) {
    updates.push(`name = $${++paramCount}`)
    params.push(data.name)
  }
  if (data.arr !== undefined) {
    updates.push(`arr = $${++paramCount}`)
    params.push(data.arr)
  }
  if (data.status) {
    updates.push(`status = $${++paramCount}`)
    params.push(data.status)
  }
  if (data.parent_id !== undefined) {
    updates.push(`parent_id = $${++paramCount}`)
    params.push(data.parent_id || null)
  }
  
  if (updates.length === 0) return { success: true }
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    await client.query(
      `UPDATE accounts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
      params
    )
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/accounts')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating account:', error)
    throw error
  } finally {
    client.release()
  }
}

// Delete an account and its related data
export async function deleteAccount(accountId: string) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    // Delete journey history
    await client.query(`DELETE FROM journey_history WHERE account_id = $1`, [accountId])
    
    // Delete health scores
    await client.query(`DELETE FROM health_scores WHERE account_id = $1`, [accountId])
    
    // Delete contacts/sub-accounts if any
    await client.query(`DELETE FROM accounts WHERE parent_id = $1`, [accountId])
    
    // Delete main account
    await client.query(`DELETE FROM accounts WHERE id = $1`, [accountId])
    
    await client.query('COMMIT')
    
    revalidatePath('/dashboard/accounts')
    return { success: true }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error deleting account:', error)
    throw error
  } finally {
    client.release()
  }
}

// Get a single account with journey and health info
export async function getAccount(accountId: string) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()
  
  try {
    await setUserContext(session.userId, client)
    
    const result = await client.query(`
      SELECT 
        a.*,
        (SELECT to_stage FROM journey_history WHERE account_id = $1 ORDER BY entered_at DESC LIMIT 1) as current_stage,
        (SELECT COUNT(*) FROM journey_history WHERE account_id = $1) as stage_changes,
        (SELECT overall_score FROM health_scores WHERE account_id = $1 ORDER BY calculated_at DESC LIMIT 1) as health_score
      FROM accounts a
      WHERE a.id = $1
    `, [accountId])
    
    return result.rows[0] || null
  } finally {
    client.release()
  }
}

// Get journey history for an account
export async function getAccountJourneyHistory(accountId: string) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()
  
  try {
    await setUserContext(session.userId, client)
    
    const result = await client.query(`
      SELECT 
        jh.*,
        p.full_name as changed_by_name
      FROM journey_history jh
      LEFT JOIN profiles p ON jh.changed_by = p.id
      WHERE jh.account_id = $1
      ORDER BY jh.entered_at DESC
    `, [accountId])
    
    return result.rows
  } finally {
    client.release()
  }
}

// Get playbooks with execution stats
export async function getPlaybooks() {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)
    
    const result = await client.query(`
      SELECT 
        p.*,
        COUNT(pe.id) as total_executions,
        COUNT(CASE WHEN pe.executed_at >= NOW() - INTERVAL '7 days' THEN 1 END) as executions_last_7_days,
        MAX(pe.executed_at) as last_executed_at
      FROM playbooks p
      LEFT JOIN playbook_executions pe ON p.id = pe.playbook_id
      WHERE p.tenant_id = (SELECT tenant_id FROM profiles WHERE id = $1)
      GROUP BY p.id
      ORDER BY p.name
    `, [session.userId])
    
    await client.query('COMMIT')
    return result.rows
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Get webhook queue status
export async function getWebhookQueue(limit: number = 50) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  await setUserContext(session.userId)
  
  const result = await query(`
    SELECT 
      wq.*,
      p.name as playbook_name,
      a.name as account_name
    FROM webhook_queue wq
    LEFT JOIN playbooks p ON wq.playbook_id = p.id
    LEFT JOIN accounts a ON (wq.payload->>'account_id')::uuid = a.id
    ORDER BY wq.created_at DESC
    LIMIT $1
  `, [limit])
  
  return result.rows
}

// Get recent account activity for sidebar search
export async function getRecentAccounts(limit: number = 5) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  await setUserContext(session.userId)
  
  const result = await query(`
    WITH latest_health AS (
      SELECT DISTINCT ON (account_id) 
        account_id, overall_score, calculated_at
      FROM health_scores
      ORDER BY account_id, calculated_at DESC
    ),
    latest_stage AS (
      SELECT DISTINCT ON (account_id)
        account_id, to_stage, entered_at
      FROM journey_history
      ORDER BY account_id, entered_at DESC
    )
    SELECT
      a.id,
      a.name,
      ls.to_stage as current_stage,
      lh.overall_score,
      ls.entered_at as last_activity
    FROM accounts a
    LEFT JOIN latest_health lh ON a.id = lh.account_id
    LEFT JOIN latest_stage ls ON a.id = ls.account_id
    WHERE a.parent_id IS NULL
    ORDER BY ls.entered_at DESC NULLS LAST
    LIMIT $1
  `, [limit])
  
  return result.rows
}

// Get meetings and emails for account timeline
export async function getAccountMeetingsAndEmails(accountId: string) {
  const session = await getSession()
  if (!session) redirect('/login')

  const client = await getClient()

  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)

    // Get support tickets (converted to timeline events)
    const ticketsResult = await client.query(`
      SELECT 
        id, subject, status, severity, 
        created_at, updated_at, resolved_at,
        assigned_to
      FROM support_tickets
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [accountId])

    // Get meetings from account_profile.meeting_notes (stored as JSONB)
    const meetingsResult = await client.query(`
      SELECT 
        id, last_meeting_date, meeting_notes
      FROM account_profile
      WHERE account_id = $1
    `, [accountId])

    // Get usage events (converted to timeline)
    const usageResult = await client.query(`
      SELECT 
        id, event_type, event_value, created_at
      FROM usage_events
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [accountId])

    await client.query('COMMIT')

    // Transform to timeline event format
    const events = []

    // Add support tickets as timeline events
    ticketsResult.rows.forEach((ticket: any) => {
      events.push({
        id: ticket.id,
        type: 'Ticket',
        timestamp: ticket.created_at,
        summary: ticket.subject,
        description: `${ticket.status} • ${ticket.severity}`,
        actor: {
          name: 'Support Team',
          role: 'Support',
        },
        metadata: {
          ticketId: ticket.id,
          severity: ticket.severity,
          status: ticket.status,
        },
      })
    })

    // Add meetings from account_profile
    if (meetingsResult.rows.length > 0) {
      const profile = meetingsResult.rows[0]
      if (profile.meeting_notes && typeof profile.meeting_notes === 'object') {
        const notes = profile.meeting_notes
        events.push({
          id: `meeting-${profile.id}`,
          type: 'Meeting',
          timestamp: profile.last_meeting_date || new Date(),
          summary: notes.subject || 'Meeting Synced from Outlook',
          description: notes.notes || '',
          actor: {
            name: notes.organizer || 'Calendar',
            email: notes.organizer,
            role: 'Organizer',
          },
          metadata: {
            duration: notes.duration_minutes,
            attendees: notes.attendees || [],
          },
        })
      }
    }

    // Add usage events
    usageResult.rows.forEach((usage: any) => {
      events.push({
        id: usage.id,
        type: 'Custom',
        timestamp: usage.created_at,
        summary: `${usage.event_type.charAt(0).toUpperCase() + usage.event_type.slice(1)} Activity`,
        actor: {
          name: 'System',
          role: 'Telemetry',
        },
        metadata: {
          eventType: usage.event_type,
          value: usage.event_value,
        },
      })
    })

    // Sort by timestamp descending
    events.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return events
  } catch (error) {
    console.error('Error fetching meetings and emails:', error)
    await client.query('ROLLBACK')
    return []
  }
}

// Get last sync status for Outlook integration
export async function getLastSyncStatus(accountId: string) {
  const session = await getSession()
  if (!session) redirect('/login')

  const client = await getClient()

  try {
    await client.query('BEGIN')
    await setUserContext(session.userId, client)

    const result = await client.query(`
      SELECT 
        last_meeting_date,
        updated_at,
        meeting_notes
      FROM account_profile
      WHERE account_id = $1
    `, [accountId])

    await client.query('COMMIT')

    if (result.rows.length === 0) {
      return {
        lastSync: null,
        lastMeeting: null,
        hasData: false,
      }
    }

    const profile = result.rows[0]
    return {
      lastSync: profile.updated_at,
      lastMeeting: profile.last_meeting_date,
      hasData: !!profile.meeting_notes,
    }
  } catch (error) {
    console.error('Error fetching sync status:', error)
    await client.query('ROLLBACK')
    return {
      lastSync: null,
      lastMeeting: null,
      hasData: false,
    }
  }
}


