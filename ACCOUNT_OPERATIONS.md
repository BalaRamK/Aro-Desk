# Account CRUD Operations - Implementation Summary

## ✅ Completed Components

### 1. Server Actions (app/actions/dashboard.ts)

All account lifecycle operations implemented with proper RLS and transaction handling:

#### **createAccount(formData)**
- Creates account with initial ARR, status
- Seeds journey_history with initial stage
- Redirects to accounts list
- **Pattern:** Transaction with client-bound RLS context

```typescript
await client.query('BEGIN')
await setUserContext(session.userId, client)
// Insert account
// Insert initial journey_history
await client.query('COMMIT')
```

#### **updateAccount(accountId, data)**
- Updates name, ARR, status fields
- Validates and updates only provided fields
- Revalidates accounts list
- Returns success status

#### **deleteAccount(accountId)**
- Cascading deletes:
  - journey_history entries
  - health_scores entries
  - Sub-accounts (contacts)
  - Main account
- Uses transaction for consistency
- Revalidates accounts list

#### **getAccount(accountId)**
- Fetches single account with:
  - All account fields
  - current_stage (from latest journey_history)
  - stage_changes count
  - health_score (latest)

#### **getAccountJourneyHistory(accountId)**
- Lists all stage transitions ordered by date DESC
- Includes changed_by_name (joined from profiles)
- Shows full transition audit trail

### 2. Account Manager Component (components/account-manager.tsx)

Client component with dual modals for account operations:

- **Edit Modal:**
  - Form for name, ARR, status
  - Validation before submission
  - Loading state handling
  - Auto-refresh on success

- **Delete Modal:**
  - Confirmation dialog with account name
  - Warning about cascade deletes
  - Loading state during deletion

### 3. Accounts List Page Enhancement

Added `AccountActions` component to table:
- Edit button → opens edit modal
- Delete button → opens delete confirmation
- Integrated into account row without layout shift
- Full responsive design

## Stage Assignment & Mapping

### How Stages Work

**Key Principle:** Accounts don't have a stage column. Stage is **derived from journey_history**.

```sql
-- To get current stage for an account:
SELECT to_stage 
FROM journey_history 
WHERE account_id = 'account-id'
ORDER BY entered_at DESC 
LIMIT 1;
```

### Account Initialization Flow

```
1. User submits new account form (name, ARR, stage selection)
                    ↓
2. createAccount() called with FormData
                    ↓
3. Transaction begins (BEGIN)
                    ↓
4. INSERT accounts (name, status, arr) → returns account.id
                    ↓
5. INSERT journey_history (account_id, NULL, selected_stage, NOW(), user_id, notes)
                    ↓
6. Transaction commits (COMMIT)
                    ↓
7. Redirect to /dashboard/accounts (shows new account in list)
```

**Key Points:**
- from_stage = NULL (indicates initialization)
- to_stage = user's selected initial stage
- created in same transaction for consistency
- journey_history entry is the source of truth for stage

### Stage Transition Flow

```
User clicks "Move to Stage" on account detail page
                    ↓
updateAccountStage(accountId, newStage) called
                    ↓
Transaction begins (BEGIN)
                    ↓
SELECT to_stage FROM journey_history WHERE account_id = X ... LIMIT 1
                    ↓
UPDATE journey_history SET exited_at = NOW() WHERE account_id = X AND exited_at IS NULL
        (Mark old stage entry as exited)
                    ↓
INSERT journey_history (account_id, from_stage, to_stage, entered_at, changed_by)
        (Create new entry with transition info)
                    ↓
Transaction commits (COMMIT)
                    ↓
Revalidate /dashboard/accounts and account detail page
```

**Complete Audit Trail:**
Each transition is a new row, never deleted. When viewing history:
```sql
SELECT * FROM journey_history 
WHERE account_id = 'X'
ORDER BY entered_at DESC;

-- Results show:
-- Latest row:       from_stage='Scoping', to_stage='Implementation', exited_at=NULL (current)
-- Previous rows:    from_stage='Discovery', to_stage='Scoping', exited_at=2024-01-15 10:00:00 (exited)
-- Previous rows:    from_stage=NULL, to_stage='Discovery', exited_at=2024-01-10 09:00:00 (initialized)
```

## Available Operations Summary

| Operation | Type | Input | Output | Used For |
|-----------|------|-------|--------|----------|
| createAccount | Server Action | FormData (name, stage, arr) | Redirect to list | New account creation with initial stage |
| updateAccount | Server Action | accountId, {name?, arr?, status?} | {success: true} | Editing account details |
| deleteAccount | Server Action | accountId | {success: true} | Removing accounts with cascade |
| getAccount | Server Action | accountId | account + current_stage + health | Account detail page fetch |
| getAccountJourneyHistory | Server Action | accountId | Array<JourneyEntry> | Timeline display on detail page |
| updateAccountStage | Server Action | accountId, newStage | Updates journey_history | Moving account between stages |
| getAccounts | Server Action | filters | Array<account> | List page with current stages |
| getJourneyStages | Server Action | none | Array<stage> | Dropdown options for stage selection |

## UI Components

### Account Manager (components/account-manager.tsx)
- **Props:** `{ account: any }`
- **Features:**
  - Edit modal with form validation
  - Delete confirmation with cascade warning
  - Loading states and error handling
  - Auto-refresh on success

### Accounts List Page Updates
- Added Actions column with AccountManager
- Maintains sort order and filtering
- Responsive table layout
- Quick access to edit/delete per row

### Account Detail Page (existing)
- Shows current stage read-only
- Timeline of all transitions
- Journey history with user info

## Database Table Reference

### journey_history
```sql
- id UUID PRIMARY KEY
- account_id UUID (FK to accounts.id)
- from_stage TEXT (NULL for initialization)
- to_stage TEXT (NOT NULL, FK to journey_stages.stage)
- entered_at TIMESTAMP (when moved to to_stage)
- exited_at TIMESTAMP (when left this stage, NULL if current)
- changed_by UUID (FK to profiles.id, who made the change)
- notes TEXT (reason for transition)
```

### accounts
```sql
- id UUID PRIMARY KEY
- name TEXT (account name)
- status TEXT (Active, AtRisk, Churned, Prospect, Inactive)
- arr DECIMAL (annual recurring revenue)
- parent_id UUID (FK to accounts.id, for hierarchy)
- created_at TIMESTAMP
- updated_at TIMESTAMP
-- Note: NO stage column - stage is always in journey_history
```

### journey_stages
```sql
- id UUID PRIMARY KEY
- tenant_id UUID (FK to tenants.id)
- stage TEXT UNIQUE (Canonical stage name)
- display_name TEXT (User-friendly display)
- display_order INTEGER (Sort order in UI)
- target_duration_days INTEGER (Expected time in stage)
- color_hex TEXT (UI color)
- is_active BOOLEAN (Include in dropdowns)
```

## Security & RLS

All operations:
1. Check session exists → redirect to login if not
2. Call setUserContext(session.userId) → RLS filters data by tenant
3. Use parameterized queries → prevent SQL injection
4. Use transactions → ensure consistency
5. Revalidate paths → fresh data in UI

Example pattern:
```typescript
export async function updateAccount(accountId: string, data: {name?: string}) {
  const session = await getSession()          // ← Check auth
  if (!session) redirect('/login')            // ← Require login
  
  await setUserContext(session.userId)        // ← Apply tenant filter
  
  await query(
    `UPDATE accounts SET name = $1, updated_at = NOW() WHERE id = $2`,
    [data.name, accountId]                   // ← Parameterized
  )
  
  revalidatePath('/dashboard/accounts')       // ← Fresh cache
}
```

## Testing Checklist

- [ ] Create new account → appears in list with initial stage
- [ ] View account detail → shows all journey history
- [ ] Edit account name → updates and refreshes list
- [ ] Edit account ARR → persists to database
- [ ] Move account stage → creates new journey_history entry, marks old as exited
- [ ] Delete account → removes account + journey_history + health_scores
- [ ] View journey timeline → shows all transitions with dates and users
- [ ] Filter accounts by stage → shows only accounts in that stage
- [ ] Search accounts → finds by name
- [ ] Health score display → shows latest calculated score

## Next Steps

### Optional Enhancements

1. **Bulk Operations**
   ```typescript
   export async function bulkUpdateStage(accountIds: string[], newStage: string)
   export async function bulkDeleteAccounts(accountIds: string[])
   ```

2. **Auto-Progression Rules**
   - Time-based: Move to next stage after X days
   - Health-based: Promote to Growth when health > 80%
   - Activity-based: Advance based on engagement metrics

3. **Stage Validation**
   - Define allowed transitions (Discovery → Scoping → Implementation, etc.)
   - Prevent backward/invalid moves
   - Add transition reason field

4. **Export/Reporting**
   ```typescript
   export async function exportAccountsByStage()
   export async function getStageMetrics(stage: string)
   ```

5. **Webhooks**
   - Notify external systems on stage change
   - Trigger Zapier/Make.com workflows
   - Send to N8N for automation

6. **Integrations**
   - Sync stage changes to Salesforce, HubSpot
   - Read stage from CRM for auto-sync
   - Create two-way sync with conflict resolution

## Documentation Reference

- **Stage Mapping Guide:** [ACCOUNT_CRUD_GUIDE.md](./ACCOUNT_CRUD_GUIDE.md)
- **Integration Setup:** [INTEGRATION_SETUP.md](./INTEGRATION_SETUP.md)
- **N8N Workflows:** [N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md)
- **Platform Setup:** [PLATFORM_SETUP_GUIDE.md](./PLATFORM_SETUP_GUIDE.md)
