-- ============================================================================
-- Customer Success Extensions
-- Dynamic Lifecycle Health Scoring, Sentiment, Success Plans, Playbooks, CDI, AI
-- ============================================================================

-- Lifecycle Stages with metric weighting
CREATE TABLE IF NOT EXISTS lifecycle_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name IN ('onboarding','adoption','maturity','renewal')),
    weights JSONB NOT NULL DEFAULT '{}'::jsonb, -- { usage_frequency: 0.4, breadth: 0.3, depth: 0.3 }
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_tenant ON lifecycle_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_stages_active ON lifecycle_stages(is_active) WHERE is_active = true;

-- Health scores time-series per account
CREATE TABLE IF NOT EXISTS health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('onboarding','adoption','maturity','renewal')),
    score NUMERIC(5,2) NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- { usage_frequency, breadth, depth }
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    trend NUMERIC(6,3), -- delta from previous window
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: health_scores may already exist with a different schema.
-- Only add a generic index that is safe across schemas.
CREATE INDEX IF NOT EXISTS idx_health_scores_tenant_account ON health_scores(tenant_id, account_id);

-- Sentiment analyses for notes, activities, emails
CREATE TABLE IF NOT EXISTS sentiment_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('note','activity','email','ticket','conversation')),
    source_id TEXT NOT NULL,
    sentiment_score NUMERIC(4,3) NOT NULL, -- -1..1
    magnitude NUMERIC(6,3),
    label TEXT, -- negative/neutral/positive
    summary TEXT,
    language TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_tenant_account ON sentiment_analyses(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_created ON sentiment_analyses(created_at DESC);

-- Success Plans
CREATE TABLE IF NOT EXISTS success_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft','active','completed','archived')) DEFAULT 'active',
    owner_user_id UUID REFERENCES users(id),
    target_date DATE,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_success_plans_tenant_account ON success_plans(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_success_plans_status ON success_plans(status);

CREATE TABLE IF NOT EXISTS success_plan_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES success_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','in_progress','blocked','done')) DEFAULT 'pending',
    due_date DATE,
    assignee_user_id UUID REFERENCES users(id),
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_success_plan_steps_plan ON success_plan_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_success_plan_steps_status ON success_plan_steps(status);

-- Playbooks for common scenarios
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    scenario_key TEXT NOT NULL, -- e.g., onboarding_stall, low_engagement, upsell_opportunity
    triggers JSONB NOT NULL DEFAULT '{}'::jsonb, -- conditions
    actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- list of actions
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, scenario_key)
);

CREATE INDEX IF NOT EXISTS idx_playbooks_tenant ON playbooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_active ON playbooks(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS playbook_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('triggered','running','completed','failed')) DEFAULT 'triggered',
    triggered_by TEXT, -- system|user_id
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_runs_playbook ON playbook_runs(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_runs_account ON playbook_runs(account_id);

-- Customer Data Integration unified events
CREATE TABLE IF NOT EXISTS cdi_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('support','analytics','crm','custom')),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdi_events_tenant ON cdi_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cdi_events_account ON cdi_events(account_id);
CREATE INDEX IF NOT EXISTS idx_cdi_events_time ON cdi_events(occurred_at DESC);

-- AI Workflows and runs
CREATE TABLE IF NOT EXISTS ai_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('webhook','event','schedule','manual')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- prompt, template, recipients, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_workflows_tenant ON ai_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflows_active ON ai_workflows(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS ai_workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES ai_workflows(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    input JSONB NOT NULL DEFAULT '{}'::jsonb,
    output JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed')) DEFAULT 'queued',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_workflow ON ai_workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_workflow_runs(status);

-- Alerts for health dips/trends
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('health_dip','sentiment_negative','playbook_trigger','cdi_signal','ai_output')),
    severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')) DEFAULT 'info',
    message TEXT NOT NULL,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_account ON alerts(tenant_id, account_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

-- Update triggers helper function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lifecycle_stages_updated_at
BEFORE UPDATE ON lifecycle_stages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER success_plans_updated_at
BEFORE UPDATE ON success_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER success_plan_steps_updated_at
BEFORE UPDATE ON success_plan_steps
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER playbooks_updated_at
BEFORE UPDATE ON playbooks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ai_workflows_updated_at
BEFORE UPDATE ON ai_workflows
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS Policies
ALTER TABLE lifecycle_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE success_plan_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY lifecycle_stages_tenant_isolation ON lifecycle_stages
    USING (tenant_id = current_tenant_id());

CREATE POLICY health_scores_tenant_isolation ON health_scores
    USING (tenant_id = current_tenant_id());

CREATE POLICY sentiment_tenant_isolation ON sentiment_analyses
    USING (tenant_id = current_tenant_id());

CREATE POLICY success_plans_tenant_isolation ON success_plans
    USING (tenant_id = current_tenant_id());

CREATE POLICY success_plan_steps_tenant_isolation ON success_plan_steps
    USING (tenant_id = current_tenant_id());

CREATE POLICY playbooks_tenant_isolation ON playbooks
    USING (tenant_id = current_tenant_id());

CREATE POLICY playbook_runs_tenant_isolation ON playbook_runs
    USING (tenant_id = current_tenant_id());

CREATE POLICY cdi_events_tenant_isolation ON cdi_events
    USING (tenant_id = current_tenant_id());

CREATE POLICY ai_workflows_tenant_isolation ON ai_workflows
    USING (tenant_id = current_tenant_id());

CREATE POLICY ai_workflow_runs_tenant_isolation ON ai_workflow_runs
    USING (tenant_id = current_tenant_id());

CREATE POLICY alerts_tenant_isolation ON alerts
    USING (tenant_id = current_tenant_id());
