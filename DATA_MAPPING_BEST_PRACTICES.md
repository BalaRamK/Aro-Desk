# Data Mapping Best Practices

## Issue: Stage Name Not Reflecting After Save

### Root Cause
When a server action returns data from a database `RETURNING *` clause, the response contains the actual **database column names**, not arbitrary aliases. Client components must map these DB columns to their component interface.

**Example:**
- Database columns: `id`, `display_name`, `display_order`, `target_duration_days`, `color_hex`
- Component interface: `{ id, name, display_order, target_duration_days, color_hex }`
- The component must map `display_name` → `name` when constructing the local state

### Example - Stage Designer Fix
**Before (broken):**
```tsx
const newStage = await createJourneyStage({...})
setStages([...stages, {
  id: newStage.id,
  name: (newStage as any).display_name ?? (newStage as any).stage ?? formData.name,  // ❌ Unclear fallback logic
  display_order: (newStage as any).display_order,
  ...
}])
```

**After (fixed):**
```tsx
const newStage = await createJourneyStage({...})
const returnedStage = newStage as any
setStages([...stages, {
  id: returnedStage.id,
  name: returnedStage.display_name || formData.name,  // ✅ Clear mapping
  display_order: returnedStage.display_order,
  target_duration_days: returnedStage.target_duration_days,
  color_hex: returnedStage.color_hex,
  account_count: 0
}])
```

## Prevention Strategies

### 1. Document Expected Return Values
When writing server actions, add a comment showing what columns will be returned:

```typescript
export async function createJourneyStage(data: {...}) {
  // Returns: { id, tenant_id, stage, display_name, display_order, target_duration_days, color_hex, created_at, is_active }
  const result = await query(
    `INSERT INTO journey_stages (stage, display_name, ...)
     VALUES (...) 
     RETURNING *`,
    [...]
  )
  return result.rows[0]
}
```

### 2. Use Explicit Column Selection Instead of `RETURNING *`
This makes the return value contract clearer:

```typescript
// ✅ Explicit - clear what's returned
const result = await query(
  `INSERT INTO journey_stages (stage, display_name, display_order, target_duration_days, color_hex)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, display_name, display_order, target_duration_days, color_hex`,
  [...]
)

// ❌ Implicit - unclear what's returned
const result = await query(`INSERT INTO journey_stages ... RETURNING *`, [...])
```

### 3. Use Type Safety in Components
Create an interface for the return value and enforce mapping:

```typescript
interface JourneyStage {
  id: string
  stage: string  // DB column
  display_name: string  // DB column
  display_order: number
  target_duration_days: number
  color_hex: string
}

interface StageUI {
  id: string
  name: string  // Component uses 'name' not 'display_name'
  display_order: number
  target_duration_days: number
  color_hex: string
}

// Explicit mapping function
function mapDbStageToUI(dbStage: JourneyStage): StageUI {
  return {
    id: dbStage.id,
    name: dbStage.display_name,
    display_order: dbStage.display_order,
    target_duration_days: dbStage.target_duration_days,
    color_hex: dbStage.color_hex
  }
}
```

### 4. Avoid Local State Management for Create Operations
When possible, use data refresh patterns instead:

**Avoid (prone to mapping errors):**
```tsx
const newItem = await createItem({...})
setItems([...items, {id: newItem.id, ...}])  // ❌ Manual mapping required
```

**Prefer (cleaner):**
```tsx
await createItem({...})
loadData()  // ✅ Fetch fresh data from server
```

This is why `integrations-content.tsx` calls `onSuccess()` rather than trying to map returned data.

## Affected Tables

After audit, the mapping issue primarily affects:

1. **journey_stages** (✅ FIXED)
   - DB columns: `stage`, `display_name`, `display_order`, `target_duration_days`, `color_hex`
   - Component: uses `name` field instead of `display_name`

2. **stage_milestones** (✅ NOT AFFECTED)
   - Uses `name` column directly in both DB and component
   - Return value can be used directly without mapping

3. **integration_sources** (✅ NOT AFFECTED)
   - Uses `onSuccess()` callback to reload data instead of mapping returned values

4. **accounts** (✅ NOT AFFECTED)
   - Uses server action with redirect, no local state mapping needed

## Going Forward

1. **Always explicitly name columns in RETURNING** instead of using `*`
2. **Create mapping functions** for DB → UI conversions
3. **Prefer data refresh patterns** over local state mutations when possible
4. **Document column names** in server action comments
5. **Test create/update operations** to ensure data appears correctly without page reload
