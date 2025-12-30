-- Migration 09: CS Intelligence Engine Enhancements
-- Adds multi-dimensional health, hierarchy rollups, and role-based RLS

-- ============================================================================
-- 1. MULTI-DIMENSIONAL HEALTH SCORING
-- ============================================================================

-- Add component_scores JSONB column to store dimension breakdowns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'health_scores' AND column_name = 'component_scores'
    ) THEN
        ALTER TABLE health_scores ADD COLUMN component_scores JSONB DEFAULT '{}'::jsonb;
        
        COMMENT ON COLUMN health_scores.component_scores IS 
        'Stores dimensional health scores like {"product_usage": 85, "relationship": 70, "support": 90}';
    END IF;
END $$;

-- Add calculated_at timestamp for better time-series tracking
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'health_scores' AND column_name = 'calculated_at'
    ) THEN
        ALTER TABLE health_scores ADD COLUMN calculated_at TIMESTAMPTZ DEFAULT NOW();
        CREATE INDEX IF NOT EXISTS idx_health_scores_calculated_at ON health_scores(calculated_at);
    END IF;
END $$;

-- ============================================================================
-- 2. HIERARCHY ROLLUP FUNCTIONS
-- ============================================================================

-- Function to get all child accounts (recursive)
CREATE OR REPLACE FUNCTION get_child_accounts(parent_account_id UUID)
RETURNS TABLE (
    account_id UUID,
    account_name TEXT,
    level INTEGER,
    path TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE account_tree AS (
        -- Base case: direct children
        SELECT 
            a.id as account_id,
            a.name as account_name,
            1 as level,
            a.name::TEXT as path
        FROM accounts a
        WHERE a.parent_id = parent_account_id
          AND a.tenant_id = current_tenant_id()
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT 
            a.id,
            a.name,
            at.level + 1,
            at.path || ' > ' || a.name
        FROM accounts a
        INNER JOIN account_tree at ON a.parent_id = at.account_id
        WHERE a.tenant_id = current_tenant_id()
    )
    SELECT * FROM account_tree
    ORDER BY level, account_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total ARR across account hierarchy
CREATE OR REPLACE FUNCTION get_hierarchy_arr(parent_account_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_arr NUMERIC;
BEGIN
    WITH RECURSIVE account_tree AS (
        -- Include the parent itself
        SELECT 
            id,
            COALESCE(arr, 0) as arr
        FROM accounts
        WHERE id = parent_account_id
          AND tenant_id = current_tenant_id()
        
        UNION ALL
        
        -- Add all descendants
        SELECT 
            a.id,
            COALESCE(a.arr, 0)
        FROM accounts a
        INNER JOIN account_tree at ON a.parent_id = at.id
        WHERE a.tenant_id = current_tenant_id()
    )
    SELECT SUM(arr) INTO total_arr
    FROM account_tree;
    
    RETURN COALESCE(total_arr, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get account hierarchy path (breadcrumbs)
CREATE OR REPLACE FUNCTION get_account_path(account_id_param UUID)
RETURNS TEXT AS $$
DECLARE
    path_result TEXT;
BEGIN
    WITH RECURSIVE account_path AS (
        -- Start with the account itself
        SELECT 
            id,
            parent_id,
            name,
            1 as level
        FROM accounts
        WHERE id = account_id_param
          AND tenant_id = current_tenant_id()
        
        UNION ALL
        
        -- Walk up to parents
        SELECT 
            a.id,
            a.parent_id,
            a.name,
            ap.level + 1
        FROM accounts a
        INNER JOIN account_path ap ON a.id = ap.parent_id
        WHERE a.tenant_id = current_tenant_id()
    )
    SELECT string_agg(name, ' > ' ORDER BY level DESC) INTO path_result
    FROM account_path;
    
    RETURN path_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. ENHANCED ROLE-BASED RLS POLICIES
-- ============================================================================

-- Add helper function to check user role
DROP FUNCTION IF EXISTS current_user_role();
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role::TEXT
        FROM profiles
        WHERE id = current_user_id()
          AND tenant_id = current_tenant_id()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is practitioner or admin
DROP FUNCTION IF EXISTS is_practitioner();
CREATE OR REPLACE FUNCTION is_practitioner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() IN ('admin', 'csm', 'practitioner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user has write access
DROP FUNCTION IF EXISTS can_write();
CREATE OR REPLACE FUNCTION can_write()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() IN ('admin', 'csm');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update playbook_executions policy to restrict execution to practitioners
DROP POLICY IF EXISTS playbook_executions_tenant_isolation ON playbook_executions;
CREATE POLICY playbook_executions_tenant_isolation ON playbook_executions
    USING (tenant_id = current_tenant_id())
    WITH CHECK (
        tenant_id = current_tenant_id() 
        AND is_practitioner()
    );

-- Update playbooks policy to allow viewers to read, practitioners to write
DROP POLICY IF EXISTS playbooks_tenant_isolation ON playbooks;
CREATE POLICY playbooks_tenant_isolation ON playbooks
    USING (tenant_id = current_tenant_id())
    WITH CHECK (
        tenant_id = current_tenant_id() 
        AND can_write()
    );

-- ============================================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================================

-- Index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_accounts_parent_id ON accounts(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_parent ON accounts(tenant_id, parent_id);

-- Indexes for health score queries
CREATE INDEX IF NOT EXISTS idx_health_scores_account_calculated ON health_scores(account_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_scores_tenant_score ON health_scores(tenant_id, overall_score);

-- Indexes for journey tracking
CREATE INDEX IF NOT EXISTS idx_journey_history_account_entered ON journey_history(account_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_history_stages ON journey_history(from_stage, to_stage);

-- ============================================================================
-- 5. MATERIALIZED VIEW FOR HIERARCHY SUMMARY (Optional Performance Boost)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS account_hierarchy_summary AS
WITH RECURSIVE account_tree AS (
    -- Root accounts (no parent)
    SELECT 
        a.id,
        a.tenant_id,
        a.name,
        a.parent_id,
        a.arr,
        0 as depth,
        ARRAY[a.id] as path,
        COALESCE(a.arr, 0::numeric) as total_arr,
        1::bigint as child_count
    FROM accounts a
    WHERE a.parent_id IS NULL
    
    UNION ALL
    
    -- Child accounts
    SELECT 
        a.id,
        a.tenant_id,
        a.name,
        a.parent_id,
        a.arr,
        at.depth + 1,
        at.path || a.id,
        COALESCE(a.arr, 0::numeric),
        1::bigint
    FROM accounts a
    INNER JOIN account_tree at ON a.parent_id = at.id
)
SELECT 
    id as account_id,
    tenant_id,
    name,
    parent_id,
    depth,
    path,
    arr,
    SUM(total_arr) OVER (PARTITION BY path[1]) as hierarchy_total_arr,
    COUNT(*) OVER (PARTITION BY path[1])::integer as hierarchy_account_count
FROM account_tree;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_hierarchy_summary_account 
    ON account_hierarchy_summary(account_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_account_hierarchy_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY account_hierarchy_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. SAMPLE DATA FOR COMPONENT SCORES
-- ============================================================================

-- Update existing health_scores with component breakdown
UPDATE health_scores
SET component_scores = jsonb_build_object(
    'product_usage', COALESCE(usage_score, 50),
    'engagement', COALESCE(engagement_score, 50),
    'support_health', COALESCE(support_sentiment_score, 50),
    'adoption', COALESCE(adoption_score, 50)
)
WHERE component_scores = '{}'::jsonb OR component_scores IS NULL;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Functions are SECURITY DEFINER so they execute with creator's privileges
-- No additional grants needed - RLS policies handle access control

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_child_accounts IS 'Returns all descendant accounts in a hierarchy tree';
COMMENT ON FUNCTION get_hierarchy_arr IS 'Calculates total ARR across entire account hierarchy';
COMMENT ON FUNCTION get_account_path IS 'Returns breadcrumb path from root to account';
COMMENT ON FUNCTION current_user_role IS 'Returns the role of the currently authenticated user';
COMMENT ON FUNCTION is_practitioner IS 'Checks if user can execute playbooks';
COMMENT ON FUNCTION can_write IS 'Checks if user has write permissions';

-- Migration complete
DO $$ 
BEGIN
    RAISE NOTICE 'Migration 09 completed successfully';
    RAISE NOTICE 'Added: Multi-dimensional health scoring';
    RAISE NOTICE 'Added: Hierarchy rollup functions';
    RAISE NOTICE 'Added: Role-based RLS policies';
    RAISE NOTICE 'Added: Performance indexes';
END $$;
