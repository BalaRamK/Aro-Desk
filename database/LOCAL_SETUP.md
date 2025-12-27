# Local Database Setup - Complete ✓

## Infrastructure Overview

- **Container**: `cs-platform-db` (PostgreSQL 16)
- **Port**: 5432
- **Database**: `cs_platform`
- **Volume**: `cs-platform-data` (persistent)

## Connection Details

```bash
Host: localhost
Port: 5432
Database: cs_platform
User: postgres
Password: secure_pass
```

**Connection String**:
```
postgresql://postgres:secure_pass@localhost:5432/cs_platform
```

## Database Schema

### Tables Created
1. **tenants** - Organization/tenant master table
2. **users** - User authentication (local dev replacement for auth.users)
3. **profiles** - User profiles with tenant affiliation and roles

### Security Functions
- `requesting_user_id()` - Extract current user from session
- `current_tenant_id()` - Get current user's tenant ID
- `current_user_role()` - Get current user's role
- `is_tenant_admin()` - Check if user is tenant admin

### RLS Policies (All RESTRICTIVE)
✓ **tenants**:
  - `tenants_isolation_policy` (SELECT) - Users see only their tenant
  - `tenants_update_policy` (UPDATE) - Admins can update their tenant

✓ **profiles**:
  - `profiles_tenant_isolation_policy` (SELECT) - See only same-tenant profiles
  - `profiles_self_update_policy` (UPDATE) - Users update own profile
  - `profiles_admin_update_policy` (UPDATE) - Admins manage tenant profiles
  - `profiles_admin_insert_policy` (INSERT) - Admins add new users

✓ **users**:
  - `users_self_read_policy` (SELECT) - Users see only their own record

## Sample Data Loaded

### Tenants (3)
1. Acme Corporation (`acme-corp`)
2. TechStart Inc (`techstart`)
3. Global Solutions (`global-solutions`)

### Users (4)
| Email | Role | Tenant | Password |
|-------|------|--------|----------|
| admin@acme.com | Tenant Admin | Acme Corporation | password123 |
| user@acme.com | Practitioner | Acme Corporation | password123 |
| admin@techstart.com | Tenant Admin | TechStart Inc | password123 |
| viewer@techstart.com | Viewer | TechStart Inc | password123 |

## Quick Test Commands

### Connect to Database
```bash
docker exec -it cs-platform-db psql -U postgres -d cs_platform
```

### Test RLS Isolation
```sql
-- Set session as Acme admin
SET app.current_user_id = '11111111-1111-1111-1111-111111111111';

-- Query should only show Acme Corporation
SELECT * FROM tenants;

-- Query should only show Acme users
SELECT * FROM profiles;

-- Switch to TechStart admin
SET app.current_user_id = '33333333-3333-3333-3333-333333333333';

-- Now should see TechStart data
SELECT * FROM tenants;
SELECT * FROM profiles;
```

### View Security Status
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- View all policies
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
ORDER BY tablename;
```

## Container Management

### Stop Container
```bash
docker stop cs-platform-db
```

### Start Container
```bash
docker start cs-platform-db
```

### Remove Container (keeps volume)
```bash
docker rm cs-platform-db
```

### Remove Container + Volume (full cleanup)
```bash
docker rm cs-platform-db
docker volume rm cs-platform-data
```

## Next Steps

1. ✓ Database infrastructure ready
2. ✓ RLS policies active and restrictive
3. ✓ Sample data loaded for testing
4. → Connect Next.js app to local database
5. → Update .env.local with connection string
6. → Test authentication flow with sample users
