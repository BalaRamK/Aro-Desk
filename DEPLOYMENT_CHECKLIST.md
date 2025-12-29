# DEPLOYMENT CHECKLIST - Account CRUD Fix

## Current Status
⚠️ **Changes made locally but NOT YET DEPLOYED to production**

## Problem
- Production (https://aro-desk.vercel.app) is returning 500 errors on account creation
- Local build passes ✅
- Fixes applied locally but not pushed/deployed to Vercel

## Root Cause
RLS context not properly set on database client for write operations. Must use:
```typescript
const client = await getClient()
await client.query('BEGIN')
await setUserContext(session.userId, client)  // Must pass client!
```

## Fixed Functions (Local Only)
✅ `createAccount()` - Transaction with client-bound RLS
✅ `updateAccount()` - Transaction with client-bound RLS
✅ `deleteAccount()` - Transaction with client-bound RLS
✅ `getAccount()` - Client-bound RLS
✅ `getAccountJourneyHistory()` - Client-bound RLS

## Files Modified (Ready to Deploy)
- `app/actions/dashboard.ts` - Account CRUD operations fixed
- `app/dashboard/accounts/[id]/layout.tsx` - Params type fixed for Next.js 15
- `app/dashboard/accounts/page.tsx` - Added "Add Account" button + AccountActions
- `components/account-manager.tsx` - NEW: Edit/Delete modals
- `ACCOUNT_CRUD_GUIDE.md` - NEW: Stage mapping documentation
- `ACCOUNT_OPERATIONS.md` - NEW: Implementation summary
- `RLS_FIX_PATTERN.md` - NEW: Critical pattern reference

## Additional Issues Found (NEED TO FIX BEFORE DEPLOY)
❌ **Multiple read-only functions still use old pattern:**

In `app/actions/dashboard.ts`:
- Line 27: `getHealthDistribution()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 81: `getRevenueAtRisk()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 129: `getPortfolioGrowth()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 180: `getAccounts()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 269: `getAccountDetails()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 359: `getAccountsByStage()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 385: `getJourneyStages()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 440: `updateAccountStage()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 683: `getHealthScores()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 706: `getLatestHealthScore()` - Uses `await setUserContext(session.userId)` then `query()`
- Line 728: `calculateHealthScore()` - Uses `await setUserContext(session.userId)` then `query()`

In `app/actions/admin.ts`:
- Line 437: `getHealthWeights()` - Needs fixing
- Line 472: `saveHealthWeights()` - Needs fixing

In `app/actions/integrations.ts`:
- Line 123: Needs checking

## CRITICAL: Deploy Steps

### Step 1: Fix Remaining Functions (MUST DO FIRST)
The `query()` helper function likely has its own client management, so these READ functions might work. However, for consistency and safety, we should verify OR fix them all to use client-bound pattern.

**Quick check needed:** Does `query()` in `lib/db.ts` call `setUserContext` internally?

### Step 2: Commit Changes
```bash
cd "c:\Users\Bala Karumanchi\OneDrive - QuNulabs Private Limited\Desktop\Aro-Desk"
git add .
git status  # Verify files to be committed
git commit -m "Fix RLS context for account CRUD operations - client-bound pattern"
```

### Step 3: Push to Deploy
```bash
git push origin main
```

### Step 4: Wait for Vercel Deployment
- Check Vercel dashboard for deployment status
- Wait for build to complete (usually 2-3 minutes)
- Verify deployment URL updates

### Step 5: Test on Production
After deployment completes, test these operations:

1. **Create Account**
   - Go to https://aro-desk.vercel.app/dashboard/accounts/new
   - Fill in: Name, ARR, select stage
   - Submit form
   - ✅ Should redirect to accounts list without 500 error
   - ✅ New account should appear in list

2. **Edit Account**
   - Click "Edit" on any account
   - Change name or ARR
   - Submit
   - ✅ Changes should persist

3. **Delete Account**
   - Click "Delete" on test account
   - Confirm deletion
   - ✅ Account should be removed

4. **View Account Details**
   - Click on account name
   - ✅ Should show journey history

5. **Create Stage**
   - Go to CS Handbook (Admin)
   - Add new stage
   - ✅ Should persist without error

6. **Add Milestone**
   - Select a stage
   - Add milestone
   - ✅ Should persist and reload

## Alternative: Quick Verification of query() Helper

Before fixing all functions, check if `query()` helper already handles RLS:

```bash
# Check lib/db.ts implementation
cat lib/db.ts | grep -A 20 "export async function query"
```

If `query()` internally calls `setUserContext()` on its client, then read-only functions are fine and only write operations with explicit transactions need the fix.

## Next Iteration Actions

1. **IMMEDIATE**: Check `lib/db.ts` query() implementation
2. **IF query() doesn't handle RLS**: Fix all remaining functions
3. **THEN**: Commit and push changes
4. **VERIFY**: Test all CRUD operations on production
5. **DOCUMENT**: Update this checklist with test results

## Success Criteria
- [ ] All account CRUD operations work without 500 errors
- [ ] Stage and milestone operations work (already fixed)
- [ ] No RLS policy violations in logs
- [ ] Multi-tenant isolation maintained
- [ ] Build passes on Vercel
- [ ] Production tests pass

## Emergency Rollback
If deployment causes issues:
```bash
git revert HEAD
git push origin main
```

## Notes for Developer
- This is a PostgreSQL RLS + connection pooling issue
- The pattern MUST be: get client → BEGIN → setUserContext(userId, client) → queries → COMMIT → release
- Never call setUserContext without passing the client when using transactions
- Read operations can use query() helper IF it handles RLS internally
- Write operations in transactions MUST use client-bound pattern

## Current Blocker
**⚠️ Code is fixed locally but NOT deployed to production ⚠️**

User is testing against https://aro-desk.vercel.app which still has the old buggy code.
