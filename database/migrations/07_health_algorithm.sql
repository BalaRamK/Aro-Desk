-- ============================================================================
-- Health Scoring Algorithm & Intelligence Layer
-- ============================================================================
-- Purpose: Implement multidimensional health scoring with behavioral signals
-- and automated calculation functions
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Usage Events Tracking
-- ============================================================================
-- Normalized table for tracking feature adoption and usage patterns

CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Event metadata
    event_type TEXT NOT NULL, -- e.g., 'login', 'feature_usage', 'api_call'
    event_value DECIMAL(10, 2), -- Optional quantitative measure
    
    -- Frequency tracking (for rolling window calculations)
    event_count INTEGER DEFAULT 1,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT usage_events_valid_type CHECK (event_type IN ('login', 'feature_usage', 'api_call', 'export', 'report_view'))
);

CREATE INDEX idx_usage_events_account_created ON usage_events(account_id, created_at DESC);
CREATE INDEX idx_usage_events_tenant_created ON usage_events(tenant_id, created_at DESC);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);

-- ============================================================================
-- STEP 2: Support Ticket Integration
-- ============================================================================
-- Normalized table for support interactions and severity tracking

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    external_id TEXT, -- CRM or ticket system ID
    
    -- Ticket metadata
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Open', -- 'Open', 'In Progress', 'Resolved', 'Closed'
    severity TEXT DEFAULT 'Medium', -- 'Critical', 'Urgent', 'High', 'Medium', 'Low'
    
    -- Severity flags for override logic
    days_at_severity INTEGER DEFAULT 0, -- Tracks how long ticket has been at current severity
    
    -- Assignment
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT support_tickets_valid_status CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    CONSTRAINT support_tickets_valid_severity CHECK (severity IN ('Critical', 'Urgent', 'High', 'Medium', 'Low'))
);

CREATE INDEX idx_support_tickets_account_status ON support_tickets(account_id, status);
CREATE INDEX idx_support_tickets_severity ON support_tickets(account_id, severity);
CREATE INDEX idx_support_tickets_created ON support_tickets(account_id, created_at DESC);

-- ============================================================================
-- STEP 3: Subscription & Renewal Data
-- ============================================================================
-- Already exists in accounts table (contract_end_date, renewal_date)
-- This table supplements with detailed renewal metrics

CREATE TABLE IF NOT EXISTS renewal_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Renewal timeline
    renewal_date DATE NOT NULL,
    days_to_renewal INTEGER GENERATED ALWAYS AS (EXTRACT(DAY FROM (renewal_date::timestamp - NOW()))) STORED,
    
    -- Renewal prediction
    renewal_probability DECIMAL(3, 2), -- 0.0 to 1.0 (from ML model or manual input)
    churn_risk_flag BOOLEAN DEFAULT false,
    
    -- Notes and comments
    renewal_notes JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_renewal_data_days_to_renewal ON renewal_data(account_id, days_to_renewal);

-- ============================================================================
-- STEP 4: Calculate Account Health Function
-- ============================================================================
-- Multidimensional scoring: usage (40%), support (30%), renewal (30%)
-- With Urgent ticket override: if Urgent ticket > 48 hours, cap score at 40

CREATE OR REPLACE FUNCTION calculate_account_health(
    p_account_id UUID,
    p_tenant_id UUID DEFAULT NULL
) RETURNS TABLE (
    overall_score INTEGER,
    usage_score INTEGER,
    support_score INTEGER,
    renewal_score INTEGER,
    urgent_override BOOLEAN,
    calculation_details JSONB
) LANGUAGE plpgsql AS $$
DECLARE
    v_usage_score INTEGER := 0;
    v_support_score INTEGER := 0;
    v_renewal_score INTEGER := 0;
    v_overall_score INTEGER := 0;
    v_urgent_override BOOLEAN := FALSE;
    v_login_frequency DECIMAL;
    v_feature_usage_count INTEGER;
    v_rolling_days CONSTANT INTEGER := 30;
    v_urgent_ticket_hours INTEGER;
    v_details JSONB := '{}'::jsonb;
BEGIN
    -- Get tenant if not provided
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO p_tenant_id FROM accounts WHERE id = p_account_id LIMIT 1;
    END IF;
    
    -- ========================================================================
    -- USAGE SCORE (0-100): Based on login frequency and feature adoption
    -- ========================================================================
    -- Count login events in the last 30 days
    SELECT COUNT(*)::INTEGER INTO v_feature_usage_count
    FROM usage_events
    WHERE account_id = p_account_id
      AND tenant_id = p_tenant_id
      AND event_type IN ('login', 'feature_usage')
      AND created_at > NOW() - INTERVAL '30 days';
    
    -- Score calculation: 0 logins = 0, 30+ logins = 100 (linear)
    v_usage_score := LEAST(100, GREATEST(0, (v_feature_usage_count::DECIMAL / 30.0 * 100)::INTEGER));
    
    v_details := jsonb_set(v_details, '{usage_events_30d}', to_jsonb(v_feature_usage_count));
    
    -- ========================================================================
    -- SUPPORT SCORE (0-100): Based on ticket severity and resolution time
    -- ========================================================================
    -- Count open/in-progress tickets by severity (higher severity = lower score)
    WITH ticket_analysis AS (
        SELECT
            SUM(CASE WHEN severity = 'Critical' THEN 30 ELSE 0 END) +
            SUM(CASE WHEN severity = 'Urgent' THEN 20 ELSE 0 END) +
            SUM(CASE WHEN severity = 'High' THEN 10 ELSE 0 END) +
            SUM(CASE WHEN severity = 'Medium' THEN 5 ELSE 0 END) as severity_impact
        FROM support_tickets
        WHERE account_id = p_account_id
          AND tenant_id = p_tenant_id
          AND status IN ('Open', 'In Progress')
    )
    SELECT 100 - LEAST(100, COALESCE(severity_impact, 0))::INTEGER INTO v_support_score
    FROM ticket_analysis;
    
    v_details := jsonb_set(v_details, '{support_score_calculation}', to_jsonb(v_support_score));
    
    -- ========================================================================
    -- URGENT TICKET OVERRIDE: Any Urgent ticket > 48 hours forces cap at 40
    -- ========================================================================
    SELECT EXTRACT(HOUR FROM (NOW() - updated_at))::INTEGER INTO v_urgent_ticket_hours
    FROM support_tickets
    WHERE account_id = p_account_id
      AND tenant_id = p_tenant_id
      AND severity = 'Urgent'
      AND status IN ('Open', 'In Progress')
      AND updated_at < NOW() - INTERVAL '48 hours'
    LIMIT 1;
    
    IF v_urgent_ticket_hours IS NOT NULL THEN
        v_urgent_override := TRUE;
        v_details := jsonb_set(v_details, '{urgent_override}', 'true'::jsonb);
        v_details := jsonb_set(v_details, '{urgent_hours_duration}', to_jsonb(v_urgent_ticket_hours));
    END IF;
    
    -- ========================================================================
    -- RENEWAL SCORE (0-100): Based on proximity to renewal and churn risk
    -- ========================================================================
    -- Score decreases as renewal date approaches; lower if churn_risk_flag set
    WITH renewal_calc AS (
        SELECT
            CASE
                WHEN days_to_renewal < 0 THEN 10  -- Overdue
                WHEN days_to_renewal < 30 THEN 40  -- Critical window
                WHEN days_to_renewal < 90 THEN 70  -- Warning window
                ELSE 100  -- Safe zone
            END - CASE WHEN churn_risk_flag THEN 20 ELSE 0 END as renewal_score_calc
        FROM renewal_data
        WHERE account_id = p_account_id
          AND tenant_id = p_tenant_id
        ORDER BY created_at DESC
        LIMIT 1
    )
    SELECT GREATEST(0, LEAST(100, renewal_score_calc))::INTEGER INTO v_renewal_score
    FROM renewal_calc;
    
    -- Default if no renewal data
    v_renewal_score := COALESCE(v_renewal_score, 75);
    
    v_details := jsonb_set(v_details, '{renewal_score}', to_jsonb(v_renewal_score));
    
    -- ========================================================================
    -- WEIGHTED AVERAGE (40% usage, 30% support, 30% renewal)
    -- ========================================================================
    v_overall_score := (
        (v_usage_score * 0.40) +
        (v_support_score * 0.30) +
        (v_renewal_score * 0.30)
    )::INTEGER;
    
    -- Apply urgent override cap
    IF v_urgent_override THEN
        v_overall_score := LEAST(v_overall_score, 40);
    END IF;
    
    -- Clamp to 0-100
    v_overall_score := GREATEST(0, LEAST(100, v_overall_score));
    
    -- Return results
    RETURN QUERY
    SELECT
        v_overall_score as overall_score,
        v_usage_score as usage_score,
        v_support_score as support_score,
        v_renewal_score as renewal_score,
        v_urgent_override as urgent_override,
        v_details as calculation_details;
END;
$$;

-- ========================================================================
-- STEP 5: Auto-update Trigger for Health Scores
-- ========================================================================
-- Trigger fires when:
-- 1. New usage event is logged
-- 2. Support ticket is updated
-- 3. Renewal data is modified

CREATE OR REPLACE FUNCTION update_health_score_on_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_account_id UUID;
    v_tenant_id UUID;
    v_health_result RECORD;
BEGIN
    -- Determine account_id based on which table triggered this
    IF TG_TABLE_NAME = 'usage_events' THEN
        v_account_id := NEW.account_id;
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'support_tickets' THEN
        v_account_id := NEW.account_id;
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'renewal_data' THEN
        v_account_id := NEW.account_id;
        v_tenant_id := NEW.tenant_id;
    ELSE
        RETURN NEW;
    END IF;
    
    -- Calculate new health score
    SELECT * INTO v_health_result FROM calculate_account_health(v_account_id, v_tenant_id);
    
    -- Update health_scores table
    INSERT INTO health_scores (
        account_id, tenant_id, overall_score, usage_score, 
        support_sentiment_score, adoption_score, calculated_at, 
        calculation_method, notes
    ) VALUES (
        v_account_id, v_tenant_id, v_health_result.overall_score,
        v_health_result.usage_score, v_health_result.support_score,
        v_health_result.renewal_score, NOW(), 'algorithm_multidimensional',
        v_health_result.calculation_details
    )
    ON CONFLICT (account_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        usage_score = EXCLUDED.usage_score,
        calculated_at = NOW()
    WHERE health_scores.account_id = v_account_id;
    
    RETURN NEW;
END;
$$;

-- Create triggers for health score auto-calculation
CREATE TRIGGER trg_usage_events_update_health
AFTER INSERT ON usage_events
FOR EACH ROW
EXECUTE FUNCTION update_health_score_on_event();

CREATE TRIGGER trg_support_tickets_update_health
AFTER INSERT OR UPDATE ON support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_health_score_on_event();

CREATE TRIGGER trg_renewal_data_update_health
AFTER INSERT OR UPDATE ON renewal_data
FOR EACH ROW
EXECUTE FUNCTION update_health_score_on_event();

-- ========================================================================
-- STEP 6: Webhook Trigger for n8n Automation
-- ========================================================================
-- When health score falls below 40, fire webhook to n8n for automation

CREATE OR REPLACE FUNCTION trigger_health_alert_webhook()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_webhook_url TEXT;
    v_payload JSONB;
BEGIN
    -- Only trigger if score drops below 40 (At Risk)
    IF NEW.overall_score < 40 AND (OLD.overall_score IS NULL OR OLD.overall_score >= 40) THEN
        -- In production, N8N_WEBHOOK_URL would be an env var or config table
        -- For now, we'll log the intent (actual webhook call would be in app code)
        v_payload := jsonb_build_object(
            'event_type', 'health_score_alert',
            'account_id', NEW.account_id,
            'tenant_id', NEW.tenant_id,
            'overall_score', NEW.overall_score,
            'previous_score', OLD.overall_score,
            'timestamp', NOW(),
            'trigger_reason', 'Score crossed At Risk threshold'
        );
        
        -- Log to webhook_queue table (to be processed by app)
        INSERT INTO webhook_queue (
            tenant_id, account_id, event_type, payload, status
        ) VALUES (
            NEW.tenant_id, NEW.account_id, 'health_score_alert', v_payload, 'pending'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_health_score_alert
AFTER INSERT OR UPDATE OF overall_score ON health_scores
FOR EACH ROW
EXECUTE FUNCTION trigger_health_alert_webhook();

-- ========================================================================
-- STEP 7: Grant Permissions for RLS Compliance
-- ========================================================================

GRANT SELECT, INSERT, UPDATE ON usage_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON support_tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON renewal_data TO authenticated;
GRANT SELECT ON health_scores TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_account_health TO authenticated;

COMMIT;
