-- ============================================================================
-- Multi-Tenant Security Foundation Migration
-- Customer Success Platform
-- ============================================================================
-- Purpose: Establish RLS-based multi-tenant architecture with automatic
--          data isolation based on authenticated user's tenant affiliation
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

-- Profiles table: Extends auth.users with tenant and role information
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
COMMENT ON COLUMN profiles.id IS 'References auth.users(id) - one-to-one relationship';
COMMENT ON COLUMN profiles.tenant_id IS 'Tenant affiliation for multi-tenant isolation';
COMMENT ON COLUMN profiles.role IS 'User role for role-based access control';

-- ============================================================================
-- STEP 3: Security Helper Functions
-- ============================================================================

-- Function: Extract current authenticated user's UUID from JWT
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
        (nullif(current_setting('request.jwt.claim.sub', true), ''))
    )::uuid;
$$;

COMMENT ON FUNCTION requesting_user_id() IS 
    'Extracts authenticated user UUID from JWT claims for RLS policies';

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

-- ============================================================================
-- STEP 4: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own tenant
CREATE POLICY "tenants_isolation_policy" 
    ON tenants
    FOR SELECT
    USING (id = current_tenant_id());

COMMENT ON POLICY "tenants_isolation_policy" ON tenants IS
    'Restricts tenant visibility to authenticated user''s own organization';

-- Policy: Allow tenant admins to update their own tenant
CREATE POLICY "tenants_update_policy"
    ON tenants
    FOR UPDATE
    USING (
        id = current_tenant_id() 
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = requesting_user_id() 
            AND tenant_id = current_tenant_id()
            AND role = 'Tenant Admin'
        )
    );

COMMENT ON POLICY "tenants_update_policy" ON tenants IS
    'Allows Tenant Admins to update their own tenant settings';

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see profiles within their tenant
CREATE POLICY "profiles_tenant_isolation_policy"
    ON profiles
    FOR SELECT
    USING (tenant_id = current_tenant_id());

COMMENT ON POLICY "profiles_tenant_isolation_policy" ON profiles IS
    'Restricts profile visibility to users within the same tenant';

-- Policy: Users can update their own profile
CREATE POLICY "profiles_self_update_policy"
    ON profiles
    FOR UPDATE
    USING (id = requesting_user_id())
    WITH CHECK (
        -- Prevent users from changing their tenant_id
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = requesting_user_id())
    );

COMMENT ON POLICY "profiles_self_update_policy" ON profiles IS
    'Allows users to update their own profile, but not change tenant affiliation';

-- Policy: Tenant Admins can update profiles within their tenant
CREATE POLICY "profiles_admin_update_policy"
    ON profiles
    FOR UPDATE
    USING (
        tenant_id = current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = requesting_user_id() 
            AND tenant_id = current_tenant_id()
            AND role = 'Tenant Admin'
        )
    );

COMMENT ON POLICY "profiles_admin_update_policy" ON profiles IS
    'Allows Tenant Admins to manage user profiles within their tenant';

-- Policy: Tenant Admins can insert new profiles within their tenant
CREATE POLICY "profiles_admin_insert_policy"
    ON profiles
    FOR INSERT
    WITH CHECK (
        tenant_id = current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = requesting_user_id() 
            AND tenant_id = current_tenant_id()
            AND role = 'Tenant Admin'
        )
    );

COMMENT ON POLICY "profiles_admin_insert_policy" ON profiles IS
    'Allows Tenant Admins to add new users to their tenant';

-- ============================================================================
-- STEP 5: Automatic Profile Creation Trigger
-- ============================================================================

-- Function: Automatically create profile when new user is added to auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID;
BEGIN
    -- Get the first active tenant (or create logic to assign tenant)
    -- In production, you might want to extract tenant from JWT claims
    -- or use a different assignment strategy
    SELECT id INTO default_tenant_id
    FROM tenants
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no tenant exists, raise an error
    IF default_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No active tenant available for user assignment';
    END IF;

    -- Insert profile for new user
    INSERT INTO profiles (id, tenant_id, full_name, role)
    VALUES (
        NEW.id,
        default_tenant_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'Viewer'  -- Default role for new users
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS
    'Trigger function to automatically create profile when user signs up';

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
    'Automatically creates profile entry when new user is authenticated';

-- ============================================================================
-- STEP 6: Utility Functions for Tenant Management
-- ============================================================================

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

-- ============================================================================
-- STEP 7: Updated_at Timestamp Triggers
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

-- ============================================================================
-- STEP 8: Grant Permissions
-- ============================================================================

-- Grant usage on custom types
GRANT USAGE ON TYPE user_role TO authenticated, service_role;

-- Grant table permissions to authenticated users (RLS will filter data)
GRANT SELECT, INSERT, UPDATE ON tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- Grant full access to service role (bypasses RLS)
GRANT ALL ON tenants TO service_role;
GRANT ALL ON profiles TO service_role;

-- Grant sequence usage if needed
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ============================================================================
-- STEP 9: Sample Data (Optional - for development/testing)
-- ============================================================================

-- Insert sample tenant (uncomment for development)
/*
INSERT INTO tenants (name, slug, settings) VALUES
    ('Acme Corporation', 'acme-corp', '{"feature_flags": {"analytics": true}}'),
    ('TechStart Inc', 'techstart', '{"feature_flags": {"analytics": false}}')
ON CONFLICT (slug) DO NOTHING;
*/

-- ============================================================================
-- End of Migration
-- ============================================================================

-- Verification Queries (run these to test the setup):
/*
-- 1. Verify tables and RLS are enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('tenants', 'profiles');

-- 2. View all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('tenants', 'profiles');

-- 3. Test security functions (as authenticated user)
SELECT requesting_user_id();
SELECT current_tenant_id();
SELECT current_user_role();
SELECT is_tenant_admin();
*/
