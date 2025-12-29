# Account Stage Mapping & Journey Assignment Guide

## Overview

Aro-Desk uses a **journey-history based approach** for tracking customer lifecycle stages. Instead of storing stage directly on the account record, the current stage is dynamically derived from the journey_history table, which maintains a complete audit trail of all stage transitions.

## Core Concepts

### 1. Journey History Model

Each stage transition creates an entry in the `journey_history` table:

```sql
-- Structure
journey_history (
  id UUID PRIMARY KEY,
  account_id UUID,
  from_stage TEXT,        -- Previous stage (NULL for initialization)
  to_stage TEXT,          -- Current/destination stage
  entered_at TIMESTAMP,   -- When entered this stage
  exited_at TIMESTAMP,    -- When left this stage (NULL if current)
  changed_by UUID,        -- User ID who made the change
  notes TEXT              -- Optional reason/context
)
```

### 2. Deriving Current Stage

The **current stage** for any account is always the **latest (most recent) entry** in journey_history:

```sql
SELECT to_stage 
FROM journey_history 
WHERE account_id = 'account-123'
ORDER BY entered_at DESC 
LIMIT 1;  -- Returns the current stage
```

This approach ensures:
- ✅ Single source of truth (journey_history)
- ✅ Complete audit trail (all transitions preserved)
- ✅ Eliminates stage sync issues (no dual state)

## Stage Assignment Flow

### Creating a New Account with Initial Stage

**Step 1:** Create the account record

```typescript
INSERT INTO accounts (name, status, arr)
VALUES ('Acme Corp', 'Active', 250000)
RETURNING id;
```

**Step 2:** Seed initial journey_history entry

```typescript
INSERT INTO journey_history (account_id, from_stage, to_stage, entered_at, changed_by, notes)
VALUES (
  'account-123',           -- account_id
  NULL,                    -- from_stage (NULL = initialization)
  'Discovery',             -- to_stage (initial stage)
  NOW(),                   -- entered_at
  'user-456',              -- changed_by
  'Initialized via CS Handbook'
);
```

**Implementation in Code:**

```typescript
// app/actions/dashboard.ts - createAccount()

export async function createAccount(formData: FormData) {
  const name = formData.get('name')?.toString().trim()
  const stage = formData.get('stage')?.toString()  // Selected initial stage
  const arr = Number(formData.get('arr')?.toString())
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    
    // Step 1: Create account
    const accountResult = await client.query(
      `INSERT INTO accounts (name, status, arr)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, 'Active', arr]
    )
    const accountId = accountResult.rows[0].id
    
    // Step 2: Seed journey_history with initial stage
    await client.query(
      `INSERT INTO journey_history (account_id, from_stage, to_stage, entered_at, changed_by, notes)
       VALUES ($1, NULL, $2, NOW(), $3, $4)`,
      [accountId, stage, session.userId, 'Initialized via CS Handbook']
    )
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/accounts')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
```

### Moving an Account Between Stages

**Step 1:** Get the account's current stage

```sql
SELECT to_stage FROM journey_history 
WHERE account_id = 'account-123'
ORDER BY entered_at DESC LIMIT 1;  -- Returns 'Discovery'
```

**Step 2:** Mark the old entry as exited

```sql
UPDATE journey_history
SET exited_at = NOW()
WHERE account_id = 'account-123' 
  AND exited_at IS NULL;  -- Only update current stage entry
```

**Step 3:** Create new journey_history entry

```sql
INSERT INTO journey_history (account_id, from_stage, to_stage, entered_at, changed_by, notes)
VALUES (
  'account-123',
  'Discovery',        -- from_stage (old current)
  'Scoping',          -- to_stage (new stage)
  NOW(),
  'user-456',
  'Moved from Discovery'
);
```

**Implementation in Code:**

```typescript
// app/actions/dashboard.ts - updateAccountStage()

export async function updateAccountStage(accountId: string, newStage: string) {
  const session = await getSession()
  
  try {
    // Step 1: Get current stage
    const current = await query(
      `SELECT to_stage FROM journey_history 
       WHERE account_id = $1 
       ORDER BY entered_at DESC LIMIT 1`,
      [accountId]
    )
    const oldStage = current.rows[0]?.to_stage
    
    // Step 2: Mark old entry as exited
    await query(
      `UPDATE journey_history 
       SET exited_at = NOW() 
       WHERE account_id = $1 AND exited_at IS NULL`,
      [accountId]
    )
    
    // Step 3: Create new entry
    await query(
      `INSERT INTO journey_history 
       (account_id, from_stage, to_stage, entered_at, changed_by, notes)
       VALUES ($1, $2, $3, NOW(), $4, $5)`,
      [accountId, oldStage, newStage, session.userId, `Moved from ${oldStage}`]
    )
    
    revalidatePath('/dashboard/accounts')
    revalidatePath(`/dashboard/accounts/${accountId}`)
  } catch (error) {
    console.error('Error updating stage:', error)
    throw error
  }
}
```

## Available Server Actions

### Account Lifecycle

| Action | Purpose | Inputs | Outputs |
|--------|---------|--------|---------|
| `createAccount()` | Create account with initial stage | FormData: name, stage, arr, status | Redirects to accounts list |
| `updateAccountStage()` | Move account to new stage | accountId, newStage | Updates journey_history, revalidates |
| `getAccount()` | Fetch single account details | accountId | account object with current_stage |
| `getAccountJourneyHistory()` | Get all stage transitions | accountId | Array of journey_history entries |
| `updateAccount()` | Update account fields (name, ARR, status) | accountId, data | Updates account record |
| `deleteAccount()` | Delete account and all related data | accountId | Deletes cascading (journey_history, health_scores) |

### Stage Management

| Action | Purpose |
|--------|---------|
| `getJourneyStages()` | List all available stages with display info |
| `createJourneyStage()` | Create/upsert new stage definition |
| `updateJourneyStage()` | Update stage display name, target duration, color |

### Reporting

| Action | Purpose |
|--------|---------|
| `getAccounts()` | Get filtered list with current stage, health score |
| `getAccountsByStage()` | Group accounts by current stage |

## Stage Mapping Rules

### 1. Sequential Stages

Define your stage progression in `journey_stages` table:

```sql
INSERT INTO journey_stages (stage, display_name, display_order, target_duration_days, color_hex)
VALUES 
  ('Discovery', 'Discovery', 1, 30, '#3B82F6'),
  ('Scoping', 'Scoping', 2, 30, '#8B5CF6'),
  ('Implementation', 'Implementation', 3, 90, '#EC4899'),
  ('Launch', 'Launch', 4, 14, '#10B981'),
  ('Growth', 'Growth', 5, NULL, '#F59E0B');
```

### 2. Allowed Transitions

You can optionally restrict stage transitions by validating against a transitions table:

```sql
-- Example: Only allow certain transitions
CREATE TABLE stage_transitions (
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  allowed BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (from_stage, to_stage)
);

INSERT INTO stage_transitions (from_stage, to_stage) VALUES
  ('Discovery', 'Scoping'),
  ('Scoping', 'Implementation'),
  ('Implementation', 'Launch'),
  ('Launch', 'Growth'),
  -- Allow any stage to regress
  ('Scoping', 'Discovery'),
  ('Implementation', 'Scoping'),
  ('Launch', 'Implementation'),
  ('Growth', 'Launch');
```

### 3. Validation in Server Actions

Before updating stage, validate the transition:

```typescript
export async function updateAccountStage(accountId: string, newStage: string) {
  const session = await getSession()
  
  // Get current stage
  const current = await query(
    `SELECT to_stage FROM journey_history 
     WHERE account_id = $1 ORDER BY entered_at DESC LIMIT 1`,
    [accountId]
  )
  const oldStage = current.rows[0]?.to_stage
  
  // Validate transition is allowed
  const isAllowed = await query(
    `SELECT 1 FROM stage_transitions 
     WHERE from_stage = $1 AND to_stage = $2 AND allowed = true`,
    [oldStage, newStage]
  )
  
  if (isAllowed.rowCount === 0) {
    throw new Error(`Cannot transition from ${oldStage} to ${newStage}`)
  }
  
  // Proceed with update...
}
```

## Automatic Stage Assignment

### Health Score-Based Auto-Promotion

Move accounts to "Growth" stage automatically when health reaches threshold:

```typescript
export async function autoPromoteHealthyAccounts() {
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    
    // Find accounts in Launch with high health
    const toPromote = await client.query(`
      SELECT DISTINCT a.id, a.name
      FROM accounts a
      JOIN journey_history jh ON a.id = jh.account_id
      JOIN health_scores hs ON a.id = hs.account_id
      WHERE jh.to_stage = 'Launch' 
        AND jh.exited_at IS NULL
        AND hs.overall_score >= 80
        AND NOT EXISTS (
          SELECT 1 FROM journey_history 
          WHERE account_id = a.id 
            AND to_stage = 'Growth'
            AND entered_at > NOW() - interval '30 days'
        )
    `)
    
    for (const row of toPromote.rows) {
      // Mark current as exited
      await client.query(
        `UPDATE journey_history SET exited_at = NOW()
         WHERE account_id = $1 AND exited_at IS NULL`,
        [row.id]
      )
      
      // Create Growth entry
      await client.query(
        `INSERT INTO journey_history 
         (account_id, from_stage, to_stage, entered_at, changed_by, notes)
         VALUES ($1, 'Launch', 'Growth', NOW(), $2, $3)`,
        [row.id, 'system', `Auto-promoted: health ${80}%`]
      )
      
      console.log(`Promoted ${row.name} to Growth`)
    }
    
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
```

### Time-Based Auto-Progression

Move accounts after spending required time in stage:

```typescript
export async function autoProgressByDuration() {
  const client = await getClient()
  
  const config = {
    'Discovery': 30,        // Must spend 30 days in Discovery
    'Scoping': 30,
    'Implementation': 90,
    'Launch': 14
  }
  
  try {
    await client.query('BEGIN')
    
    // Find accounts ready to progress
    const ready = await client.query(`
      SELECT a.id, a.name, jh.to_stage, jh.entered_at
      FROM accounts a
      JOIN journey_history jh ON a.id = jh.account_id
      WHERE jh.exited_at IS NULL
        AND (NOW() - jh.entered_at) >= $1::interval
    `, ['60 days']) // Adjust based on max target_duration
    
    for (const row of ready.rows) {
      const duration = config[row.to_stage]
      if (!duration) continue // No rule for this stage
      
      const daysInStage = Math.floor(
        (new Date() - new Date(row.entered_at)) / (1000 * 60 * 60 * 24)
      )
      
      if (daysInStage >= duration) {
        console.log(`${row.name} ready to progress from ${row.to_stage}`)
        // Send notification or trigger recommendation
      }
    }
    
    await client.query('COMMIT')
  } finally {
    client.release()
  }
}
```

## Journey Tracking UI

The [Account Details Page](../../app/dashboard/accounts/[id]/page.tsx) shows:

1. **Journey Timeline** - All stage transitions with timestamps, who made the change, and duration in each stage
2. **Current Stage** - Read from latest journey_history entry
3. **Stage Count** - Total number of stage transitions (captures engagement activity)
4. **Metrics by Stage** - Health trends during each stage

Example query to get stage-specific metrics:

```sql
SELECT 
  jh.to_stage,
  COUNT(*) as account_count,
  AVG(hs.overall_score) as avg_health,
  AVG(EXTRACT(DAY FROM (COALESCE(jh.exited_at, NOW()) - jh.entered_at))) as avg_days_in_stage
FROM journey_history jh
LEFT JOIN health_scores hs ON jh.account_id = hs.account_id 
  AND hs.calculated_at >= jh.entered_at
WHERE jh.exited_at IS NULL  -- Current stage
GROUP BY jh.to_stage
ORDER BY jh.to_stage;
```

## Best Practices

1. **Always use transactions** when creating/updating stages (BEGIN/COMMIT/ROLLBACK)
2. **Log changes with notes** - Use the notes field to explain why stage changed
3. **Track changed_by user** - Maintain audit trail of who made the change
4. **Validate stage exists** - Check stage is in journey_stages before creating entry
5. **Never update journey_history directly** - Always insert new entries, never UPDATE existing ones (except exited_at)
6. **Use journey_history as source of truth** - Never read stage from accounts table
7. **Batch process auto-assignments** - Run in background jobs (e.g., N8N workflows)
8. **Archive old stages** - Keep is_active flag updated to filter current stages

## Troubleshooting

### Issue: Account showing wrong stage

**Cause:** Multiple journey_history entries not ordered correctly

**Fix:** 
```sql
-- Check all entries for account
SELECT * FROM journey_history 
WHERE account_id = 'account-123'
ORDER BY entered_at DESC;

-- Verify latest one has NULL exited_at
-- All others should have exited_at set
```

### Issue: Stage update failed with constraint error

**Cause:** journey_stages table doesn't have the stage value

**Fix:**
```typescript
// Validate stage exists before updating
const stageExists = await query(
  `SELECT id FROM journey_stages WHERE stage = $1`,
  [newStage]
)

if (stageExists.rowCount === 0) {
  throw new Error(`Stage "${newStage}" not found. Create it in CS Handbook first.`)
}
```

### Issue: Duplicate stage transitions

**Cause:** Race condition with multiple simultaneous updates

**Fix:** Add unique constraint on current entries:
```sql
CREATE UNIQUE INDEX idx_current_journey 
ON journey_history (account_id) 
WHERE exited_at IS NULL;
```

## Summary

- **Accounts don't have a stage column** - Stage lives in journey_history
- **Current stage = latest journey_history entry** for an account
- **Creating account = INSERT account + INSERT initial journey_history**
- **Changing stage = UPDATE old journey_history exited_at + INSERT new entry**
- **Complete audit trail** preserved automatically
- **Enable auto-progression** via background jobs (N8N) using the patterns shown
