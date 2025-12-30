# Parent Account Hierarchy - Implementation Guide

## Overview
This feature allows you to create hierarchical account relationships where accounts can have parent-child structures. This is useful for enterprise customers with multiple divisions, regions, or subsidiaries.

## Features Implemented

### 1. Parent Account Selection in Forms

#### Create New Account
- Location: `/dashboard/accounts/new`
- Features:
  - Dropdown to select parent account
  - Shows account name with ARR for context
  - Option to create root account (no parent)
  - Automatically calculates hierarchy ARR rollup

#### Edit Existing Account
- Location: Account list page → Edit button
- Features:
  - Change parent account for existing accounts
  - Remove parent (convert to root account)
  - Cannot select self as parent (filtered out)

### 2. Database Functions

The following PostgreSQL functions are available (from migration 09):

```sql
-- Get all child accounts recursively
SELECT * FROM get_child_accounts(parent_account_id);

-- Get total ARR including all children
SELECT get_hierarchy_arr(parent_account_id);

-- Get breadcrumb path for account
SELECT get_account_path(account_id);
```

### 3. Server Actions

**app/actions/dashboard.ts:**
- `getAllAccountsForParentSelect()` - Fetch all accounts for dropdown
- `createAccount()` - Now accepts parent_id
- `updateAccount()` - Now accepts parent_id for editing

**app/actions/customer_success.ts:**
- `getAccountChildren(parentAccountId)` - Get child accounts
- `getAccountHierarchyArr(parentAccountId)` - Get total hierarchy ARR
- `getAccountBreadcrumb(accountId)` - Get hierarchy path

## Test Data

### Creating Test Data
Visit `/dashboard/test-data` to generate sample accounts with hierarchy:

**Test Accounts Created:**
1. **Enterprise Corp (Parent)** - $500k ARR, Health: 85
   - Enterprise Corp - North Region - $200k ARR, Health: 75
   - Enterprise Corp - South Region - $150k ARR, Health: 45 (At Risk)
2. **Startup Inc** - $50k ARR, Health: 92 (Standalone)
3. **TechCo Solutions** - $120k ARR, Status: At Risk (Standalone)

**Total Hierarchy ARR:** $850k (Parent + Children)

### Health Metrics Components
Each test account includes multi-dimensional health scores:
- Product Usage Score
- Engagement Score
- Support Health Score
- Adoption Score
- Relationship Score

## Usage Examples

### Creating a Child Account
1. Navigate to `/dashboard/accounts/new`
2. Fill in account details (name, ARR, status, stage)
3. Select a parent account from dropdown (or leave as "None" for root)
4. Click "Create Account"

### Changing Parent Account
1. Go to account list page
2. Click "Edit" on any account
3. Select new parent from dropdown
4. Click "Update Account"

### Viewing Hierarchy
- Accounts with parent relationships show "Parent" in the Hierarchy column
- Use breadcrumb functions to display full path
- Calculate total ARR including all children

## Database Schema

### accounts table
```sql
parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL
```

### health_scores table
```sql
component_scores JSONB DEFAULT '{}'::jsonb
calculated_at TIMESTAMPTZ DEFAULT NOW()
```

## API Reference

### Get All Accounts for Parent Selection
```typescript
const accounts = await getAllAccountsForParentSelect()
// Returns: [{ id, name, arr, parent_id }]
```

### Create Account with Parent
```typescript
const formData = new FormData()
formData.append('name', 'New Division')
formData.append('arr', '100000')
formData.append('parent_id', parentAccountId)
await createAccount(formData)
```

### Update Account Parent
```typescript
await updateAccount(accountId, {
  parent_id: newParentId // or null to remove parent
})
```

### Get Hierarchy Information
```typescript
// Get all children
const children = await getAccountChildren(parentId)

// Get total hierarchy ARR
const totalArr = await getAccountHierarchyArr(parentId)

// Get breadcrumb path
const path = await getAccountBreadcrumb(accountId)
// Returns: "Enterprise Corp > North Region > Account Name"
```

## Files Modified

1. **app/actions/dashboard.ts**
   - Added `getAllAccountsForParentSelect()`
   - Updated `createAccount()` to handle parent_id
   - Updated `updateAccount()` to handle parent_id

2. **app/dashboard/accounts/new/page.tsx**
   - Added parent account selector dropdown

3. **app/dashboard/accounts/page.tsx**
   - Fetch all accounts for parent selection
   - Pass to AccountActions component

4. **components/account-manager.tsx**
   - Added parent_id to formData state
   - Added parent account selector to edit form
   - Updated handleUpdate to include parent_id

5. **database/migrations/09_cs_intelligence_enhancements.sql**
   - Added hierarchy functions (already deployed)

## Next Steps

1. Visit `/dashboard/test-data` to create sample data
2. Test creating new accounts with parent relationships
3. Test editing accounts to change parent
4. View hierarchy in account list
5. Test ARR rollup calculations

## Notes

- Accounts can only have one direct parent
- Circular references are not prevented at database level (implement if needed)
- Deleting a parent account sets child parent_id to NULL
- Health scores are calculated independently per account
- Hierarchy ARR rollup is recursive (includes all descendants)
