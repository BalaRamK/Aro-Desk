-- ============================================================================
-- Core Customer Success Data Model
-- Customer Success Platform - Core Tables
-- ============================================================================
-- Purpose: Replicate Totango-style structure with hierarchies, journeys,
--          metrics, health scores, and n8n automation integration
-- ============================================================================

-- ============================================================================
-- STEP 1: Accounts with Hierarchical Structure (Adjacency List)
-- ============================================================================

-- Account status enumeration
CREATE TYPE account_status AS ENUM (
    'Active',
    'Onboarding',
    'At Risk',
    'Churned',
    'Paused'
);

-- Accounts table with hierarchical parent-child relationships
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Core account information
    name TEXT NOT NULL,
    external_id TEXT, -- CRM ID (Salesforce, HubSpot, etc.)
    status account_status DEFAULT 'Active',
    
    -- Relationship management
    csm_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Business metrics
    arr DECIMAL(15,2), -- Annual Recurring Revenue
    contract_start_date DATE,
    contract_end_date DATE,
    renewal_date DATE,
    
    -- Custom CRM attributes (flexible JSONB storage)
    crm_attributes JSONB DEFAULT '{}'::jsonb,
    
    -- Hierarchy metadata
    hierarchy_level INTEGER DEFAULT 0,
    hierarchy_path TEXT, -- Materialized path for faster queries
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT accounts_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT accounts_arr_positive CHECK (arr IS NULL OR arr >= 0),
    CONSTRAINT accounts_hierarchy_level_positive CHECK (hierarchy_level >= 0)
);

CREATE INDEX idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_csm_id ON accounts(csm_id);
CREATE INDEX idx_accounts_renewal_date ON accounts(renewal_date);
CREATE INDEX idx_accounts_hierarchy_path ON accounts USING gin(hierarchy_path gin_trgm_ops);
CREATE INDEX idx_accounts_crm_attributes ON accounts USING gin(crm_attributes);
CREATE INDEX idx_accounts_external_id ON accounts(external_id);

COMMENT ON TABLE accounts IS 'Customer accounts with hierarchical structure using adjacency list model';
COMMENT ON COLUMN accounts.parent_id IS 'Self-referencing FK for account hierarchy (parent company)';
COMMENT ON COLUMN accounts.crm_attributes IS 'Flexible JSON storage for custom CRM fields';
COMMENT ON COLUMN accounts.hierarchy_path IS 'Materialized path for efficient hierarchy queries';

-- ============================================================================
-- STEP 2: Journey Stages and History
-- ============================================================================

-- Journey stage enumeration
CREATE TYPE journey_stage AS ENUM (
    'Onboarding',
    'Adoption',
    'Value Realization',
    'Expansion',
    'Renewal',
    'At Risk',
    'Churn'
);

-- Journey stages configuration (reference data)
CREATE TABLE IF NOT EXISTS journey_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stage journey_stage NOT NULL,
    display_name TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    description TEXT,
    target_duration_days INTEGER, -- Expected time in this stage
    color_hex TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT journey_stages_unique_stage_per_tenant UNIQUE(tenant_id, stage),
    CONSTRAINT journey_stages_display_order_positive CHECK (display_order > 0)
);

CREATE INDEX idx_journey_stages_tenant_id ON journey_stages(tenant_id);
CREATE INDEX idx_journey_stages_stage ON journey_stages(stage);
CREATE INDEX idx_journey_stages_display_order ON journey_stages(display_order);

COMMENT ON TABLE journey_stages IS 'Journey stage configuration and metadata per tenant';
COMMENT ON COLUMN journey_stages.target_duration_days IS 'Expected duration for accounts in this stage';

-- Journey history (tracks stage transitions and time-in-stage)
CREATE TABLE IF NOT EXISTS journey_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Stage information
    from_stage journey_stage,
    to_stage journey_stage NOT NULL,
    
    -- Timing
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    exited_at TIMESTAMPTZ,
    duration_days INTEGER GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (COALESCE(exited_at, NOW()) - entered_at))
    ) STORED,
    
    -- Metadata
    changed_by UUID REFERENCES profiles(id),
    reason TEXT,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT journey_history_valid_dates CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

CREATE INDEX idx_journey_history_account_id ON journey_history(account_id);
CREATE INDEX idx_journey_history_tenant_id ON journey_history(tenant_id);
CREATE INDEX idx_journey_history_to_stage ON journey_history(to_stage);
CREATE INDEX idx_journey_history_entered_at ON journey_history(entered_at DESC);
CREATE INDEX idx_journey_history_active ON journey_history(account_id) WHERE exited_at IS NULL;

COMMENT ON TABLE journey_history IS 'Historical record of account journey stage transitions with time-in-stage tracking';
COMMENT ON COLUMN journey_history.duration_days IS 'Computed duration in current/completed stage';

-- ============================================================================
-- STEP 3: Usage Metrics (Product Telemetry)
-- ============================================================================

-- Metric type enumeration
CREATE TYPE metric_type AS ENUM (
    'Login',
    'Feature Usage',
    'API Call',
    'Data Volume',
    'Active Users',
    'Session Duration',
    'Custom'
);

-- Usage metrics for product telemetry
CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Metric identification
    metric_type metric_type NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    
    -- Context
    user_id UUID REFERENCES profiles(id),
    feature_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Time
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT usage_metrics_value_not_negative CHECK (metric_value >= 0)
);

CREATE INDEX idx_usage_metrics_account_id ON usage_metrics(account_id);
CREATE INDEX idx_usage_metrics_tenant_id ON usage_metrics(tenant_id);
CREATE INDEX idx_usage_metrics_type ON usage_metrics(metric_type);
CREATE INDEX idx_usage_metrics_recorded_at ON usage_metrics(recorded_at DESC);
CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_metadata ON usage_metrics USING gin(metadata);

COMMENT ON TABLE usage_metrics IS 'Product usage telemetry and engagement metrics';
COMMENT ON COLUMN usage_metrics.metadata IS 'Flexible JSON storage for custom metric attributes';

-- ============================================================================
-- STEP 4: Health Scores
-- ============================================================================

-- Health score table (weighted averages from usage and sentiment)
CREATE TABLE IF NOT EXISTS health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Overall health score (0-100)
    overall_score INTEGER NOT NULL,
    
    -- Component scores (0-100 each)
    usage_score INTEGER,
    engagement_score INTEGER,
    support_sentiment_score INTEGER,
    adoption_score INTEGER,
    
    -- Weighting factors (sum should equal 1.0)
    usage_weight DECIMAL(3,2) DEFAULT 0.35,
    engagement_weight DECIMAL(3,2) DEFAULT 0.25,
    support_weight DECIMAL(3,2) DEFAULT 0.20,
    adoption_weight DECIMAL(3,2) DEFAULT 0.20,
    
    -- Risk indicators
    risk_level TEXT GENERATED ALWAYS AS (
        CASE
            WHEN overall_score >= 80 THEN 'Healthy'
            WHEN overall_score >= 60 THEN 'Moderate'
            WHEN overall_score >= 40 THEN 'At Risk'
            ELSE 'Critical'
        END
    ) STORED,
    
    -- Trend analysis
    previous_score INTEGER,
    score_change INTEGER GENERATED ALWAYS AS (overall_score - COALESCE(previous_score, overall_score)) STORED,
    
    -- Metadata
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    calculation_method TEXT DEFAULT 'weighted_average',
    notes JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT health_scores_overall_valid CHECK (overall_score >= 0 AND overall_score <= 100),
    CONSTRAINT health_scores_usage_valid CHECK (usage_score IS NULL OR (usage_score >= 0 AND usage_score <= 100)),
    CONSTRAINT health_scores_engagement_valid CHECK (engagement_score IS NULL OR (engagement_score >= 0 AND engagement_score <= 100)),
    CONSTRAINT health_scores_support_valid CHECK (support_sentiment_score IS NULL OR (support_sentiment_score >= 0 AND support_sentiment_score <= 100)),
    CONSTRAINT health_scores_adoption_valid CHECK (adoption_score IS NULL OR (adoption_score >= 0 AND adoption_score <= 100)),
    CONSTRAINT health_scores_weights_valid CHECK (
        usage_weight + engagement_weight + support_weight + adoption_weight = 1.0
    )
);

CREATE INDEX idx_health_scores_account_id ON health_scores(account_id);
CREATE INDEX idx_health_scores_tenant_id ON health_scores(tenant_id);
CREATE INDEX idx_health_scores_overall_score ON health_scores(overall_score);
CREATE INDEX idx_health_scores_risk_level ON health_scores(risk_level);
CREATE INDEX idx_health_scores_calculated_at ON health_scores(calculated_at DESC);
CREATE UNIQUE INDEX idx_health_scores_account_latest ON health_scores(account_id, calculated_at DESC);

COMMENT ON TABLE health_scores IS 'Customer health scores calculated from weighted component metrics';
COMMENT ON COLUMN health_scores.overall_score IS 'Composite health score (0-100) calculated from weighted components';
COMMENT ON COLUMN health_scores.risk_level IS 'Computed risk category based on overall score';

-- ============================================================================
-- STEP 5: Playbooks for n8n Integration
-- ============================================================================

-- Playbook trigger type enumeration
CREATE TYPE playbook_trigger_type AS ENUM (
    'Health Score Drop',
    'Stage Transition',
    'Usage Decline',
    'Contract Expiration',
    'Support Ticket',
    'Manual',
    'Scheduled'
);

-- Playbooks table for automation workflows
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Playbook configuration
    name TEXT NOT NULL,
    description TEXT,
    trigger_type playbook_trigger_type NOT NULL,
    trigger_criteria JSONB NOT NULL, -- Flexible conditions for triggering
    
    -- n8n webhook integration
    webhook_url TEXT NOT NULL,
    webhook_method TEXT DEFAULT 'POST',
    webhook_headers JSONB DEFAULT '{}'::jsonb,
    
    -- Execution settings
    is_active BOOLEAN DEFAULT true,
    cooldown_minutes INTEGER DEFAULT 60, -- Prevent spam
    max_executions_per_day INTEGER DEFAULT 100,
    
    -- Metadata
    created_by UUID REFERENCES profiles(id),
    last_triggered_at TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT playbooks_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT playbooks_webhook_url_valid CHECK (webhook_url ~* '^https?://'),
    CONSTRAINT playbooks_cooldown_positive CHECK (cooldown_minutes > 0)
);

CREATE INDEX idx_playbooks_tenant_id ON playbooks(tenant_id);
CREATE INDEX idx_playbooks_trigger_type ON playbooks(trigger_type);
CREATE INDEX idx_playbooks_is_active ON playbooks(is_active);
CREATE INDEX idx_playbooks_trigger_criteria ON playbooks USING gin(trigger_criteria);

COMMENT ON TABLE playbooks IS 'Automation playbook configurations with n8n webhook integration';
COMMENT ON COLUMN playbooks.trigger_criteria IS 'JSONB conditions for when playbook should execute';
COMMENT ON COLUMN playbooks.webhook_url IS 'n8n webhook endpoint for workflow execution';
COMMENT ON COLUMN playbooks.cooldown_minutes IS 'Minimum time between executions for same account';

-- Playbook execution log
CREATE TABLE IF NOT EXISTS playbook_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Execution details
    triggered_by TEXT NOT NULL, -- e.g., 'health_score_trigger', 'manual', 'scheduled'
    trigger_data JSONB,
    
    -- Webhook response
    webhook_status INTEGER, -- HTTP status code
    webhook_response JSONB,
    webhook_error TEXT,
    
    -- Timing
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER,
    
    success BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playbook_executions_playbook_id ON playbook_executions(playbook_id);
CREATE INDEX idx_playbook_executions_account_id ON playbook_executions(account_id);
CREATE INDEX idx_playbook_executions_executed_at ON playbook_executions(executed_at DESC);
CREATE INDEX idx_playbook_executions_success ON playbook_executions(success);

COMMENT ON TABLE playbook_executions IS 'Audit log of playbook executions and webhook calls';

-- ============================================================================
-- STEP 6: Enable RLS on New Tables
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;

-- Accounts policies
CREATE POLICY "accounts_tenant_isolation_policy" ON accounts
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "accounts_insert_policy" ON accounts
    AS RESTRICTIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "accounts_update_policy" ON accounts
    AS RESTRICTIVE FOR UPDATE
    USING (tenant_id = current_tenant_id());

-- Journey stages policies
CREATE POLICY "journey_stages_tenant_isolation_policy" ON journey_stages
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

-- Journey history policies
CREATE POLICY "journey_history_tenant_isolation_policy" ON journey_history
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "journey_history_insert_policy" ON journey_history
    AS RESTRICTIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

-- Usage metrics policies
CREATE POLICY "usage_metrics_tenant_isolation_policy" ON usage_metrics
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "usage_metrics_insert_policy" ON usage_metrics
    AS RESTRICTIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

-- Health scores policies
CREATE POLICY "health_scores_tenant_isolation_policy" ON health_scores
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "health_scores_insert_policy" ON health_scores
    AS RESTRICTIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "health_scores_update_policy" ON health_scores
    AS RESTRICTIVE FOR UPDATE
    USING (tenant_id = current_tenant_id());

-- Playbooks policies
CREATE POLICY "playbooks_tenant_isolation_policy" ON playbooks
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

CREATE POLICY "playbooks_insert_policy" ON playbooks
    AS RESTRICTIVE FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id() AND is_tenant_admin());

CREATE POLICY "playbooks_update_policy" ON playbooks
    AS RESTRICTIVE FOR UPDATE
    USING (tenant_id = current_tenant_id() AND is_tenant_admin());

-- Playbook executions policies
CREATE POLICY "playbook_executions_tenant_isolation_policy" ON playbook_executions
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

-- ============================================================================
-- STEP 7: Update Timestamp Triggers
-- ============================================================================

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_scores_updated_at
    BEFORE UPDATE ON health_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbooks_updated_at
    BEFORE UPDATE ON playbooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 8: Grant Permissions
-- ============================================================================

-- Grant usage on custom types
GRANT USAGE ON TYPE account_status TO PUBLIC;
GRANT USAGE ON TYPE journey_stage TO PUBLIC;
GRANT USAGE ON TYPE metric_type TO PUBLIC;
GRANT USAGE ON TYPE playbook_trigger_type TO PUBLIC;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON accounts TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON journey_stages TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON journey_history TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON usage_metrics TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON health_scores TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON playbooks TO PUBLIC;
GRANT SELECT, INSERT ON playbook_executions TO PUBLIC;

-- ============================================================================
-- End of Migration
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✓ Core Customer Success data model created successfully!';
    RAISE NOTICE '✓ Accounts with hierarchical structure (adjacency list)';
    RAISE NOTICE '✓ Journey stages and history with time-in-stage tracking';
    RAISE NOTICE '✓ Usage metrics for product telemetry';
    RAISE NOTICE '✓ Health scores with weighted components';
    RAISE NOTICE '✓ Playbooks configured for n8n webhook integration';
    RAISE NOTICE '✓ All tables protected with RLS policies';
END $$;
