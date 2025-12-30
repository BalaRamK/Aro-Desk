# Debugging & Test Data Guide

## Quick Diagnostics

If data isn't showing up on the dashboard, use these steps:

### Step 1: Check Database State
1. Go to `/dashboard/diagnostics`
2. Click "Check Database State"
3. Review the results:
   - ✅ If accounts show up → Data exists, dashboard query might be wrong
   - ❌ If no accounts show up → Data wasn't created, go to Step 2

### Step 2: Generate Test Data
1. Go to `/dashboard/admin` (CS Handbook)
2. Click "Generate Test Data" button (top right)
3. Wait for page to reload
4. Go back to `/dashboard/diagnostics` to verify data was created

### Step 3: Verify Dashboard Updates
1. Go to `/dashboard/executive` 
2. Should see:
   - Total Accounts: 5
   - Health metrics populated
   - Accounts list with data

### Step 4: View Account Details
1. Go to `/dashboard/accounts`
2. Should see 5 accounts:
   - Enterprise Corp (Parent) - $500k
   - Enterprise Corp - North Region - $200k
   - Enterprise Corp - South Region - $150k (At Risk)
   - Startup Inc - $50k
   - TechCo Solutions - $120k

## Understanding Test Data

The test data includes:

### Accounts
- **Parent Account**: Enterprise Corp (Parent) - $500k ARR
  - Child 1: North Region - $200k ARR (Good health)
  - Child 2: South Region - $150k ARR (At Risk)
- **Standalone**: Startup Inc - $50k ARR (Excellent health)
- **Standalone**: TechCo Solutions - $120k ARR (At Risk status)

### Health Scores
Each account has multi-dimensional scores:
- Product Usage (0-100)
- Engagement (0-100)
- Support Health (0-100)
- Adoption (0-100)
- Relationship (0-100)

### Journey History
All accounts have entry dates showing when they joined each stage

## If Data Still Doesn't Show

1. **Check Error Logs**
   - Look at browser console for errors
   - Check server logs for database errors

2. **Verify Prerequisites**
   - Journey stages must exist
   - If not, test data will auto-create one
   - Check diagnostics page to verify stages exist

3. **RLS Issues**
   - Ensure you're logged in as correct user
   - Check that tenant_id matches
   - Verify profiles table has correct tenant_id

4. **Manual Database Check**
   - Run: `SELECT COUNT(*) FROM accounts;`
   - Run: `SELECT COUNT(*) FROM health_scores;`
   - Run: `SELECT COUNT(*) FROM journey_stages;`

## URLs for Testing

- **Diagnostics**: `/dashboard/diagnostics`
- **Admin Panel**: `/dashboard/admin`
- **Accounts List**: `/dashboard/accounts`
- **Executive Dashboard**: `/dashboard/executive`
- **Create Account**: `/dashboard/accounts/new`
