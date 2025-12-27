-- ============================================================================
-- Integration Management System
-- Manages external data sources and syncs (Jira, Zoho CRM, Zoho Desk, etc.)
-- ============================================================================

-- Integration Sources Configuration
CREATE TABLE IF NOT EXISTS integration_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Source details
    source_type TEXT NOT NULL CHECK (source_type IN ('jira', 'zoho_crm', 'zoho_desk', 'salesforce', 'hubspot', 'zendesk', 'intercom', 'slack', 'custom')),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example config structure:
    -- {
    --   "api_url": "https://api.zoho.com/crm/v2",
    --   "api_key": "encrypted_key",
    --   "webhook_url": "http://localhost:5678/webhook/zoho-crm",
    --   "sync_frequency": "hourly",
    --   "field_mappings": {...}
    -- }
    
    -- n8n Integration
    n8n_workflow_id TEXT,
    n8n_webhook_url TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'failed', 'partial', 'pending')),
    last_sync_error TEXT,
    sync_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(tenant_id, source_type, name)
);

CREATE INDEX idx_integration_sources_tenant ON integration_sources(tenant_id);
CREATE INDEX idx_integration_sources_type ON integration_sources(source_type);
CREATE INDEX idx_integration_sources_active ON integration_sources(is_active) WHERE is_active = true;

-- Integration Field Mappings
CREATE TABLE IF NOT EXISTS integration_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_source_id UUID NOT NULL REFERENCES integration_sources(id) ON DELETE CASCADE,
    
    -- Mapping details
    source_field TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_field TEXT NOT NULL,
    
    -- Transformation
    transformation_rule JSONB DEFAULT '{}'::jsonb,
    -- Example: {"type": "date_format", "from": "DD/MM/YYYY", "to": "YYYY-MM-DD"}
    -- Example: {"type": "enum_map", "map": {"Open": "active", "Closed": "resolved"}}
    
    is_required BOOLEAN DEFAULT false,
    default_value TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(integration_source_id, source_field, target_table, target_field)
);

CREATE INDEX idx_field_mappings_source ON integration_field_mappings(integration_source_id);

-- Synced Records (tracks what's been synced)
CREATE TABLE IF NOT EXISTS integration_synced_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_source_id UUID NOT NULL REFERENCES integration_sources(id) ON DELETE CASCADE,
    
    -- External record reference
    external_id TEXT NOT NULL,
    external_type TEXT NOT NULL, -- 'ticket', 'deal', 'contact', 'issue', etc.
    
    -- Internal record reference
    internal_table TEXT NOT NULL,
    internal_id UUID NOT NULL,
    
    -- Sync metadata
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ,
    sync_status TEXT CHECK (sync_status IN ('synced', 'pending', 'failed', 'deleted')),
    
    -- Raw data for reference
    raw_data JSONB,
    
    UNIQUE(integration_source_id, external_id, external_type)
);

CREATE INDEX idx_synced_records_source ON integration_synced_records(integration_source_id);
CREATE INDEX idx_synced_records_external ON integration_synced_records(external_id, external_type);
CREATE INDEX idx_synced_records_internal ON integration_synced_records(internal_table, internal_id);

-- Integration Sync Logs
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_source_id UUID NOT NULL REFERENCES integration_sources(id) ON DELETE CASCADE,
    
    -- Sync details
    sync_started_at TIMESTAMPTZ DEFAULT NOW(),
    sync_completed_at TIMESTAMPTZ,
    
    status TEXT CHECK (status IN ('running', 'success', 'failed', 'partial')),
    
    -- Statistics
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    triggered_by TEXT, -- 'manual', 'scheduled', 'webhook', 'n8n'
    duration_ms INTEGER
);

CREATE INDEX idx_sync_logs_source ON integration_sync_logs(integration_source_id);
CREATE INDEX idx_sync_logs_status ON integration_sync_logs(status);
CREATE INDEX idx_sync_logs_date ON integration_sync_logs(sync_started_at DESC);

-- External Contacts (synced from CRM)
CREATE TABLE IF NOT EXISTS external_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Contact details
    external_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    title TEXT,
    
    -- Additional data
    properties JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, external_id, source_type)
);

CREATE INDEX idx_external_contacts_tenant ON external_contacts(tenant_id);
CREATE INDEX idx_external_contacts_account ON external_contacts(account_id);
CREATE INDEX idx_external_contacts_email ON external_contacts(email);

-- External Tickets (synced from support systems)
CREATE TABLE IF NOT EXISTS external_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Ticket details
    external_id TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'zoho_desk', 'zendesk', 'jira', etc.
    
    title TEXT NOT NULL,
    description TEXT,
    status TEXT,
    priority TEXT,
    ticket_type TEXT,
    
    -- People
    reporter_email TEXT,
    assignee_email TEXT,
    
    -- Dates
    created_date TIMESTAMPTZ,
    updated_date TIMESTAMPTZ,
    resolved_date TIMESTAMPTZ,
    
    -- Additional data
    properties JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, external_id, source_type)
);

CREATE INDEX idx_external_tickets_tenant ON external_tickets(tenant_id);
CREATE INDEX idx_external_tickets_account ON external_tickets(account_id);
CREATE INDEX idx_external_tickets_status ON external_tickets(status);

-- External Deals (synced from CRM)
CREATE TABLE IF NOT EXISTS external_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Deal details
    external_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    
    name TEXT NOT NULL,
    amount DECIMAL(15, 2),
    stage TEXT,
    probability INTEGER,
    
    -- Dates
    close_date DATE,
    created_date TIMESTAMPTZ,
    
    -- Owner
    owner_email TEXT,
    
    -- Additional data
    properties JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, external_id, source_type)
);

CREATE INDEX idx_external_deals_tenant ON external_deals(tenant_id);
CREATE INDEX idx_external_deals_account ON external_deals(account_id);
CREATE INDEX idx_external_deals_stage ON external_deals(stage);

-- Integration sources policies
CREATE POLICY integration_sources_tenant_isolation ON integration_sources
    FOR ALL
    USING (tenant_id = current_tenant_id());

CREATE POLICY field_mappings_tenant_isolation ON integration_field_mappings
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM integration_sources 
        WHERE id = integration_field_mappings.integration_source_id 
        AND tenant_id = current_tenant_id()
    ));

CREATE POLICY synced_records_tenant_isolation ON integration_synced_records
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM integration_sources 
        WHERE id = integration_synced_records.integration_source_id 
        AND tenant_id = current_tenant_id()
    ));

CREATE POLICY sync_logs_tenant_isolation ON integration_sync_logs
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM integration_sources 
        WHERE id = integration_sync_logs.integration_source_id 
        AND tenant_id = current_tenant_id()
    ));

-- External data policies
CREATE POLICY external_contacts_tenant_isolation ON external_contacts
    FOR ALL
    USING (tenant_id = current_tenant_id());

CREATE POLICY external_tickets_tenant_isolation ON external_tickets
    FOR ALL
    USING (tenant_id = current_tenant_id());

CREATE POLICY external_deals_tenant_isolation ON external_deals
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integration_sources_updated_at
    BEFORE UPDATE ON integration_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER update_external_contacts_updated_at
    BEFORE UPDATE ON external_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER update_external_tickets_updated_at
    BEFORE UPDATE ON external_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER update_external_deals_updated_at
    BEFORE UPDATE ON external_deals
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_updated_at();

-- Enable RLS on all integration tables
ALTER TABLE integration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_synced_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_deals ENABLE ROW LEVEL SECURITY;
