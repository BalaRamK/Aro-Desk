# Customer Success Platform - Multi-Tenant Authentication

A secure, multi-tenant Customer Success Platform built with Next.js 15, Supabase, and Row Level Security (RLS).

## Features

- 🔐 **Secure Authentication**: Email/password authentication with Supabase Auth
- 🏢 **Multi-Tenant Isolation**: Automatic data isolation using PostgreSQL RLS
- 🎭 **Role-Based Access**: Practitioner, Contributor, Viewer, and Tenant Admin roles
- 🍪 **Cross-Domain Sessions**: Share sessions across subdomains (app.local.test, cs.local.test)
- 🎨 **Modern UI**: Built with shadcn/ui and Tailwind CSS
- ⚡ **Server Actions**: Next.js 15 server actions for secure backend operations

## Prerequisites

- Node.js 18+ 
- PostgreSQL database (via Supabase)
- pnpm/npm/yarn

## Setup Instructions

### 1. Database Migration

Run the SQL migration to set up the database schema:

```bash
# Connect to your Supabase project and run:
psql -h your-db-host -U postgres -d your-database -f migrations/001_multi_tenant_foundation.sql
```

Or use Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `migrations/001_multi_tenant_foundation.sql`
3. Execute

### 2. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://app.local.test:3000
COOKIE_DOMAIN=.local.test
```

### 3. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 4. Local Development Setup (Multi-Domain)

To test cross-domain sessions, add to `/etc/hosts`:

```
127.0.0.1 app.local.test
127.0.0.1 cs.local.test
```

### 5. Run Development Server

```bash
npm run dev
```

Visit:
- Main app: http://app.local.test:3000
- CS dashboard: http://cs.local.test:3000

## Project Structure

```
├── app/
│   ├── actions/
│   │   └── auth.ts              # Server actions for authentication
│   ├── dashboard/
│   │   └── page.tsx             # Protected dashboard page
│   ├── login/
│   │   └── page.tsx             # Login page with React Hook Form
│   └── signup/
│       └── page.tsx             # Signup page with tenant creation
├── components/
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Client-side Supabase client
│   │   └── server.ts            # Server-side Supabase client
│   └── utils.ts                 # Utility functions
├── migrations/
│   └── 001_multi_tenant_foundation.sql  # Database schema
├── types/
│   └── database.ts              # TypeScript types for database
└── middleware.ts                # Route protection & tenant validation
```

## Authentication Flow

### Sign Up

1. User enters email, password, full name, and organization name
2. Server action creates:
   - User account in `auth.users`
   - New tenant in `tenants` table
   - Profile in `profiles` table with Tenant Admin role
3. User is automatically signed in and redirected to dashboard

### Sign Up (with Invite)

1. User clicks invite link with token (`/signup?invite=token`)
2. Organization name is hidden (pre-filled from invite)
3. Server action validates invite token
4. User is added to existing tenant with specified role

### Sign In

1. User enters email and password
2. Server action authenticates via Supabase Auth
3. Middleware validates profile and tenant membership
4. Session cookie is set with `.local.test` domain
5. User is redirected to dashboard

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that:
- Automatically filter by `current_tenant_id()`
- Prevent cross-tenant data access
- Allow users to view only their organization's data

### Middleware Protection

- Validates JWT tokens
- Checks tenant membership
- Enforces active account status
- Adds tenant context to request headers

### Server Actions

All mutations happen via server actions:
- Run on the server (never exposed to client)
- Have access to validated session
- Return structured error/success responses

## Database Functions

```sql
-- Get current user ID from JWT
requesting_user_id() -> UUID

-- Get current user's tenant ID
current_tenant_id() -> UUID

-- Get current user's role
current_user_role() -> user_role

-- Check if user is tenant admin
is_tenant_admin() -> BOOLEAN
```

## API Examples

### Check User's Tenant

```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data } = await supabase.rpc('current_tenant_id')
console.log('Tenant ID:', data)
```

### Query with Automatic Filtering

```typescript
// RLS automatically filters by tenant_id
const { data: customers } = await supabase
  .from('customers')
  .select('*')
  
// Only returns customers for current user's tenant
```

## Deployment

### Environment Variables (Production)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
NODE_ENV=production
```

### Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Configure custom domains:
   - app.yourdomain.com
   - cs.yourdomain.com
5. Deploy

## Testing

### Test RLS Policies

```sql
-- Set test user context
SELECT set_config('request.jwt.claims', '{"sub": "user-uuid"}', false);

-- Test tenant isolation
SELECT * FROM profiles;  -- Should only show current user's tenant

-- Test as different user
SELECT set_config('request.jwt.claims', '{"sub": "other-user-uuid"}', false);
SELECT * FROM profiles;  -- Should show different tenant's data
```

## Troubleshooting

### "No active tenant available"

Ensure at least one tenant exists in the database:

```sql
INSERT INTO tenants (name, slug) VALUES ('Default Org', 'default-org');
```

### Cookies not working across domains

1. Verify `COOKIE_DOMAIN` is set to `.local.test`
2. Check `/etc/hosts` entries
3. Clear browser cookies and try again

### RLS policies blocking queries

Check user has a profile:

```sql
SELECT * FROM profiles WHERE id = 'user-uuid';
```

## Next Steps

- [ ] Implement user invitations system
- [ ] Add email verification
- [ ] Create role-based UI restrictions
- [ ] Add tenant settings management
- [ ] Implement audit logging
- [ ] Add two-factor authentication

## License

MIT
