-- ============================================================================
-- Multi-Tenant Security Foundation - Local Development Migration
-- Customer Success Platform
-- ============================================================================
-- Purpose: Initialize PostgreSQL database with RLS-based multi-tenant isolation
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Custom Types
-- ============================================================================

-- User role enumeration for RBAC
CREATE TYPE user_role AS ENUM (
    'Practitioner',
    'Contributor', 
    'Viewer',
    'Tenant Admin'
);

COMMENT ON TYPE user_role IS 'Role-based access control levels for multi-tenant platform';

-- ============================================================================
-- STEP 2: Create Core Tables
-- ============================================================================

-- Tenants table: Stores organization/tenant information
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT tenants_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT tenants_slug_not_empty CHECK (length(trim(slug)) > 0),
    CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

COMMENT ON TABLE tenants IS 'Organization/tenant master table for multi-tenant isolation';
COMMENT ON COLUMN tenants.slug IS 'URL-friendly unique identifier for tenant';
COMMENT ON COLUMN tenants.settings IS 'Flexible JSON storage for tenant-specific configuration';

-- Users table: Simplified user authentication (replaces auth.users for local dev)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    email_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'User authentication table (local development)';

-- Profiles table: Extends users with tenant and role information
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'Viewer',
    full_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT profiles_full_name_not_empty CHECK (
        full_name IS NULL OR length(trim(full_name)) > 0
    )
);

CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_tenant_role ON profiles(tenant_id, role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

COMMENT ON TABLE profiles IS 'User profiles with tenant affiliation and role assignment';
COMMENT ON COLUMN profiles.id IS 'References users(id) - one-to-one relationship';
COMMENT ON COLUMN profiles.tenant_id IS 'Tenant affiliation for multi-tenant isolation';
COMMENT ON COLUMN profiles.role IS 'User role for role-based access control';

-- ============================================================================
-- STEP 3: Security Helper Functions
-- ============================================================================

-- Function: Extract current authenticated user's UUID from session
-- For local dev, we'll use current_setting instead of JWT
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    -- In production with Supabase, use JWT claims
    -- For local dev, we set this via application session variable
    SELECT COALESCE(
        NULLIF(current_setting('app.current_user_id', true), '')::uuid,
        NULL
    );
$$;

COMMENT ON FUNCTION requesting_user_id() IS 
    'Extracts authenticated user UUID from session variable for RLS policies';

-- Function: Get current user's tenant ID for multi-tenant isolation
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT tenant_id 
    FROM profiles 
    WHERE id = requesting_user_id();
$$;

COMMENT ON FUNCTION current_tenant_id() IS 
    'Returns tenant_id of currently authenticated user for RLS enforcement';

-- Function: Get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT role
    FROM profiles
    WHERE id = requesting_user_id();
$$;

COMMENT ON FUNCTION current_user_role() IS
    'Returns the role of the currently authenticated user';

-- Function: Check if current user is a Tenant Admin
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = requesting_user_id()
        AND role = 'Tenant Admin'
    );
$$;

COMMENT ON FUNCTION is_tenant_admin() IS
    'Returns true if the current user has Tenant Admin role';

-- ============================================================================
-- STEP 4: Row Level Security (RLS) Policies - RESTRICTIVE
-- ============================================================================

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- RESTRICTIVE Policy: Users can only view their own tenant
CREATE POLICY "tenants_isolation_policy" 
    ON tenants
    AS RESTRICTIVE
    FOR SELECT
    USING (id = current_tenant_id());

COMMENT ON POLICY "tenants_isolation_policy" ON tenants IS
    'RESTRICTIVE: Restricts tenant visibility to authenticated user''s own organization';

-- RESTRICTIVE Policy: Allow tenant admins to update their own tenant
CREATE POLICY "tenants_update_policy"
    ON tenants
    AS RESTRICTIVE
    FOR UPDATE
    USING (
        id = current_tenant_id() 
        AND is_tenant_admin()
    );

COMMENT ON POLICY "tenants_update_policy" ON tenants IS
    'RESTRICTIVE: Allows Tenant Admins to update their own tenant settings';

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RESTRICTIVE Policy: Users can only see profiles within their tenant
CREATE POLICY "profiles_tenant_isolation_policy"
    ON profiles
    AS RESTRICTIVE
    FOR SELECT
    USING (tenant_id = current_tenant_id());

COMMENT ON POLICY "profiles_tenant_isolation_policy" ON profiles IS
    'RESTRICTIVE: Restricts profile visibility to users within the same tenant';

-- RESTRICTIVE Policy: Users can update their own profile
CREATE POLICY "profiles_self_update_policy"
    ON profiles
    AS RESTRICTIVE
    FOR UPDATE
    USING (id = requesting_user_id())
    WITH CHECK (
        -- Prevent users from changing their tenant_id
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = requesting_user_id())
    );

COMMENT ON POLICY "profiles_self_update_policy" ON profiles IS
    'RESTRICTIVE: Allows users to update their own profile, but not change tenant affiliation';

-- RESTRICTIVE Policy: Tenant Admins can update profiles within their tenant
CREATE POLICY "profiles_admin_update_policy"
    ON profiles
    AS RESTRICTIVE
    FOR UPDATE
    USING (
        tenant_id = current_tenant_id()
        AND is_tenant_admin()
    );

COMMENT ON POLICY "profiles_admin_update_policy" ON profiles IS
    'RESTRICTIVE: Allows Tenant Admins to manage user profiles within their tenant';

-- RESTRICTIVE Policy: Tenant Admins can insert new profiles within their tenant
CREATE POLICY "profiles_admin_insert_policy"
    ON profiles
    AS RESTRICTIVE
    FOR INSERT
    WITH CHECK (
        tenant_id = current_tenant_id()
        AND is_tenant_admin()
    );

COMMENT ON POLICY "profiles_admin_insert_policy" ON profiles IS
    'RESTRICTIVE: Allows Tenant Admins to add new users to their tenant';

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RESTRICTIVE Policy: Users can only view their own user record
CREATE POLICY "users_self_read_policy"
    ON users
    AS RESTRICTIVE
    FOR SELECT
    USING (id = requesting_user_id());

COMMENT ON POLICY "users_self_read_policy" ON users IS
    'RESTRICTIVE: Users can only view their own authentication record';

-- ============================================================================
-- STEP 5: Automatic Profile Creation Trigger
-- ============================================================================

-- Function: Automatically create profile when new user is added
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID;
BEGIN
    -- Get the first active tenant
    -- In production, tenant assignment would be based on invite tokens
    SELECT id INTO default_tenant_id
    FROM tenants
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no tenant exists, create a default one
    IF default_tenant_id IS NULL THEN
        INSERT INTO tenants (name, slug)
        VALUES ('Default Organization', 'default-org')
        RETURNING id INTO default_tenant_id;
    END IF;

    -- Insert profile for new user
    INSERT INTO profiles (id, tenant_id, full_name, role)
    VALUES (
        NEW.id,
        default_tenant_id,
        NEW.email, -- Use email as default name
        'Viewer'   -- Default role for new users
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS
    'Trigger function to automatically create profile when user signs up';

-- Create trigger on users table
DROP TRIGGER IF EXISTS on_user_created ON users;
CREATE TRIGGER on_user_created
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

COMMENT ON TRIGGER on_user_created ON users IS
    'Automatically creates profile entry when new user is created';

-- ============================================================================
-- STEP 6: Updated_at Timestamp Triggers
-- ============================================================================

-- Generic function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column() IS
    'Generic trigger function to maintain updated_at timestamps';

-- Apply updated_at trigger to tenants
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Sample Data for Development/Testing
-- ============================================================================

-- Insert sample tenants
INSERT INTO tenants (name, slug, settings) VALUES
    ('Acme Corporation', 'acme-corp', '{"feature_flags": {"analytics": true, "reporting": true}}'),
    ('TechStart Inc', 'techstart', '{"feature_flags": {"analytics": false, "reporting": true}}'),
    ('Global Solutions', 'global-solutions', '{"feature_flags": {"analytics": true, "reporting": false}}')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample users (passwords are bcrypt hashed 'password123')
INSERT INTO users (id, email, encrypted_password, email_confirmed_at) VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@acme.com', '$2a$10$GYxjH39yCaCzbZ4NNawvw.3UwG7Jo12lYMZ8GhHvusAudOTCQMmBa', NOW()),
    ('22222222-2222-2222-2222-222222222222', 'user@acme.com', '$2a$10$GYxjH39yCaCzbZ4NNawvw.3UwG7Jo12lYMZ8GhHvusAudOTCQMmBa', NOW()),
    ('33333333-3333-3333-3333-333333333333', 'admin@techstart.com', '$2a$10$GYxjH39yCaCzbZ4NNawvw.3UwG7Jo12lYMZ8GhHvusAudOTCQMmBa', NOW()),
    ('44444444-4444-4444-4444-444444444444', 'viewer@techstart.com', '$2a$10$GYxjH39yCaCzbZ4NNawvw.3UwG7Jo12lYMZ8GhHvusAudOTCQMmBa', NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert sample profiles (manually to override trigger defaults)
INSERT INTO profiles (id, tenant_id, role, full_name) 
SELECT 
    '11111111-1111-1111-1111-111111111111',
    t.id,
    'Tenant Admin',
    'Alice Administrator'
FROM tenants t WHERE t.slug = 'acme-corp'
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

INSERT INTO profiles (id, tenant_id, role, full_name) 
SELECT 
    '22222222-2222-2222-2222-222222222222',
    t.id,
    'Practitioner',
    'Bob Practitioner'
FROM tenants t WHERE t.slug = 'acme-corp'
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

INSERT INTO profiles (id, tenant_id, role, full_name) 
SELECT 
    '33333333-3333-3333-3333-333333333333',
    t.id,
    'Tenant Admin',
    'Charlie Admin'
FROM tenants t WHERE t.slug = 'techstart'
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

INSERT INTO profiles (id, tenant_id, role, full_name) 
SELECT 
    '44444444-4444-4444-4444-444444444444',
    t.id,
    'Viewer',
    'Diana Viewer'
FROM tenants t WHERE t.slug = 'techstart'
ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

-- ============================================================================
-- STEP 8: Grant Permissions
-- ============================================================================

-- Note: For local development, we'll use the default 'postgres' user
-- In production with Supabase, these would be granted to 'authenticated' role

-- Grant usage on custom types
GRANT USAGE ON TYPE user_role TO PUBLIC;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON tenants TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON profiles TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON users TO PUBLIC;

-- Grant sequence usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;

-- ============================================================================
-- End of Migration
-- ============================================================================

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Multi-tenant security foundation initialized successfully!';
    RAISE NOTICE '✓ RLS policies are ACTIVE and RESTRICTIVE';
    RAISE NOTICE '✓ Sample data loaded: 3 tenants, 4 users with profiles';
    RAISE NOTICE '✓ Test credentials: admin@acme.com / password123';
END $$;
