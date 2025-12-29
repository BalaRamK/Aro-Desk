-- Migration 07: Add stage_milestones table for milestone tracking
-- Run this migration: npm run db:migrate:07

BEGIN;

-- Create stage_milestones table
CREATE TABLE IF NOT EXISTS stage_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    "order" INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT stage_milestones_unique_name_per_stage UNIQUE(stage_id, name),
    CONSTRAINT stage_milestones_order_positive CHECK ("order" > 0)
);

-- Indexes
CREATE INDEX idx_stage_milestones_stage_id ON stage_milestones(stage_id);
CREATE INDEX idx_stage_milestones_tenant_id ON stage_milestones(tenant_id);
CREATE INDEX idx_stage_milestones_order ON stage_milestones(stage_id, "order");

-- Comments
COMMENT ON TABLE stage_milestones IS 'Milestones that must be completed within each journey stage';
COMMENT ON COLUMN stage_milestones."order" IS 'Display order of milestone within the stage';

-- RLS
ALTER TABLE stage_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_milestones_tenant_isolation_policy" ON stage_milestones
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = current_setting('app.current_user_id', true)::uuid
        )
    );

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON stage_milestones TO PUBLIC;

COMMIT;
