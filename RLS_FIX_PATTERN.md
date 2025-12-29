# RLS Context Fix - Critical Pattern

## The Problem

When using Row Level Security (RLS) with PostgreSQL, the `setUserContext()` function must be called **on the same client instance** that executes the queries, and this must happen **within the transaction**.

### ❌ Incorrect Pattern (Causes 500 Errors)

```typescript
export async function createAccount(formData: FormData) {
  const session = await getSession()
  
  await setUserContext(session.userId)  // ❌ Wrong: No client passed
  
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    // Queries will fail with RLS errors
    await client.query('INSERT INTO accounts ...')
    await client.query('COMMIT')
  } finally {
    client.release()
  }
}
```

**Why this fails:**
- `setUserContext(session.userId)` uses a different database connection
- The RLS context (user_id, tenant_id) is NOT set on the client used for queries
- Database rejects operations due to missing RLS context

## ✅ Correct Pattern

```typescript
export async function createAccount(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()  // ✅ Get client FIRST
  
  try {
    await client.query('BEGIN')                    // ✅ Start transaction
    await setUserContext(session.userId, client)   // ✅ Set context on SAME client
    
    // Now all queries on this client have proper RLS context
    await client.query('INSERT INTO accounts ...')
    await client.query('INSERT INTO journey_history ...')
    
    await client.query('COMMIT')
    revalidatePath('/dashboard/accounts')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()  // ✅ Always release
  }
}
```

## Key Rules

1. **Get client first** → `const client = await getClient()`
2. **Begin transaction** → `await client.query('BEGIN')`
3. **Set RLS context with client** → `await setUserContext(userId, client)`
4. **Run all queries on same client** → `await client.query(...)`
5. **Commit or rollback** → `await client.query('COMMIT')`
6. **Always release** → `client.release()` in finally block

## Read-Only Operations

For SELECT queries that don't need transactions:

```typescript
export async function getAccount(accountId: string) {
  const session = await getSession()
  if (!session) redirect('/login')
  
  const client = await getClient()
  
  try {
    await setUserContext(session.userId, client)  // ✅ Still need client
    
    const result = await client.query(
      'SELECT * FROM accounts WHERE id = $1',
      [accountId]
    )
    
    return result.rows[0] || null
  } finally {
    client.release()
  }
}
```

## Applied Fixes

All account CRUD operations fixed:
- ✅ `createAccount()` - Transaction with client-bound RLS
- ✅ `updateAccount()` - Transaction with client-bound RLS
- ✅ `deleteAccount()` - Transaction with client-bound RLS
- ✅ `getAccount()` - Client-bound RLS
- ✅ `getAccountJourneyHistory()` - Client-bound RLS

All stage/milestone operations (already fixed):
- ✅ `createJourneyStage()` - Transaction with client-bound RLS
- ✅ `updateJourneyStage()` - Transaction with client-bound RLS
- ✅ `deleteJourneyStage()` - Transaction with client-bound RLS
- ✅ `createMilestone()` - Transaction with client-bound RLS
- ✅ `updateMilestone()` - Transaction with client-bound RLS
- ✅ `deleteMilestone()` - Transaction with client-bound RLS

## How setUserContext Works

```typescript
// lib/db.ts
export async function setUserContext(userId: string, client?: any) {
  const conn = client || await getClient()
  
  try {
    // Get user's tenant_id
    const result = await conn.query(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [userId]
    )
    
    // Set session variables for RLS policies
    await conn.query('SET LOCAL app.user_id = $1', [userId])
    await conn.query('SET LOCAL app.tenant_id = $1', [result.rows[0].tenant_id])
  } finally {
    if (!client) conn.release()
  }
}
```

When you pass the client:
- RLS variables are set **on that specific connection**
- All subsequent queries on that client respect tenant isolation
- Variables persist for the transaction lifetime

## Testing Checklist

After deploying these fixes:
- [ ] Create new account → should work without 500 error
- [ ] Edit account details → should persist changes
- [ ] Delete account → should remove with cascade
- [ ] View account details → should load with journey history
- [ ] Create journey stage → should work without RLS errors
- [ ] Add milestone to stage → should persist to database
- [ ] All operations respect tenant boundaries (no cross-tenant data leaks)

## Deployment

```bash
# Commit changes
git add app/actions/dashboard.ts
git commit -m "Fix RLS context for account CRUD operations"

# Push to deploy
git push origin main

# Vercel will auto-deploy
# Test on production URL after deployment completes
```
