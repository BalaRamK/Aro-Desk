# IMMEDIATE ACTION REQUIRED - Deploy Account CRUD Fix

## THE PROBLEM
You're testing on **production** (https://aro-desk.vercel.app) which still has the OLD BUGGY code.  
The fixes are ONLY on your local machine - NOT deployed yet!

## WHAT WAS FIXED (Locally)
✅ Account CRUD operations now use proper RLS context pattern
- `createAccount()` ← **THIS IS THE 500 ERROR YOU'RE SEEING**
- `updateAccount()`
- `deleteAccount()`  
- `getAccount()`
- `getAccountJourneyHistory()`

✅ Local build passes successfully

## DEPLOY NOW - 3 Commands

```bash
# 1. Add all changes
git add .

# 2. Commit with message
git commit -m "Fix: RLS context for account CRUD operations - use client-bound pattern for transactions"

# 3. Push to trigger Vercel deployment
git push origin main
```

## WAIT 2-3 MINUTES
- Vercel will automatically build and deploy
- Watch the Vercel dashboard or check your email for deployment notification

## THEN TEST AGAIN
After deployment completes:
1. Go to https://aro-desk.vercel.app/dashboard/accounts/new
2. Fill in account details
3. Submit form
4. ✅ Should work WITHOUT 500 error

## WHY THE ERROR HAPPENED
❌ **Before (causes 500):**
```typescript
await setUserContext(session.userId)  // Sets RLS on Connection A
const client = await getClient()       // Gets Connection B  
await client.query('INSERT...')        // Runs on Connection B (no RLS!)
```

✅ **After (works):**
```typescript
const client = await getClient()             // Get connection
await client.query('BEGIN')
await setUserContext(session.userId, client) // Set RLS on SAME connection
await client.query('INSERT...')              // Runs on same connection (has RLS!)
await client.query('COMMIT')
```

## KNOWN REMAINING ISSUES (For Next Iteration)
⚠️ Many read-only functions still use the old pattern but MAY work because:
- They use the `query()` helper directly
- No transactions involved
- But inconsistent and potentially buggy

These need fixing in next iteration:
- `getHealthDistribution()`
- `getRevenueAtRisk()`
- `getPortfolioGrowth()`
- `getAccounts()`
- `getAccountDetails()`
- `getAccountsByStage()`
- `getJourneyStages()`
- `updateAccountStage()` ← Write operation, should be fixed!
- And others in `app/actions/admin.ts` and `integrations.ts`

## FOR NEXT SESSION - COMPLETE FIX PLAN
1. ✅ Deploy current fixes (account CRUD)
2. ❌ Fix `updateAccountStage()` - it's a WRITE operation with wrong pattern
3. ❌ Fix all remaining functions for consistency
4. ❌ Test all operations end-to-end
5. ❌ Update tests and documentation

## DEPLOYMENT VERIFICATION CHECKLIST
After pushing to main:
- [ ] Vercel deployment starts
- [ ] Build completes successfully  
- [ ] Production URL updates
- [ ] Test: Create new account - no 500 error
- [ ] Test: Account appears in list
- [ ] Test: Can view account details
- [ ] Test: Can edit account
- [ ] Test: Can delete account

## IF DEPLOYMENT FAILS
```bash
# Revert the commit
git revert HEAD
git push origin main
```

Then investigate build errors in Vercel dashboard.

## CRITICAL NOTE FOR DEVELOPER
The root cause is PostgreSQL connection pooling + RLS variables:
- `SET LOCAL` variables are connection-scoped
- Using `pool.query()` gets random connections
- Must use SAME client for: BEGIN → SET LOCAL → queries → COMMIT
- This is why transactions with dedicated clients work

---

## TL;DR - DO THIS NOW:
```bash
git add .
git commit -m "Fix RLS context for account CRUD"
git push origin main
```

Then wait 3 minutes and test again on production URL.
