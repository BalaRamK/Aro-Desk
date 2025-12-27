-- ============================================================================
-- SuccessPlay Automation Engine
-- Customer Success Platform - Automated Workflows
-- ============================================================================
-- Purpose: Automated triggers for health score drops and other events
--          that send webhooks to n8n for CSM notifications
-- ============================================================================

-- ============================================================================
-- STEP 1: HTTP Request Extension (for PostgreSQL)
-- ============================================================================

-- Note: PostgreSQL doesn't have built-in HTTP client
-- We'll use pg_net extension if available, or create a workaround

-- Check if pg_net is available (Supabase has this)
-- If not available locally, we'll use a notification system that app can poll

-- Create a notification queue for async processing
CREATE TABLE IF NOT EXISTS webhook_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Webhook details
    webhook_url TEXT NOT NULL,
    webhook_method TEXT DEFAULT 'POST',
    webhook_headers JSONB DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL,
    
    -- Processing status
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    
    -- Response
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    CONSTRAINT webhook_queue_status_valid CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_webhook_queue_status ON webhook_queue(status);
CREATE INDEX idx_webhook_queue_created_at ON webhook_queue(created_at);
CREATE INDEX idx_webhook_queue_playbook_id ON webhook_queue(playbook_id);
CREATE INDEX idx_webhook_queue_pending ON webhook_queue(status, created_at) WHERE status = 'pending';

COMMENT ON TABLE webhook_queue IS 'Queue for async webhook processing to n8n workflows';

-- Enable RLS on webhook queue
ALTER TABLE webhook_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_queue_tenant_isolation_policy" ON webhook_queue
    AS RESTRICTIVE FOR SELECT
    USING (tenant_id = current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON webhook_queue TO PUBLIC;

-- ============================================================================
-- STEP 2: SuccessPlay Trigger Function - Health Score Drop
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_health_score_playbook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_playbook RECORD;
    v_account RECORD;
    v_csm RECORD;
    v_threshold INTEGER;
    v_cooldown_exceeded BOOLEAN;
    v_payload JSONB;
BEGIN
    -- Only trigger on UPDATE when score actually changes and drops below threshold
    IF TG_OP = 'UPDATE' AND NEW.overall_score < 40 AND 
       (OLD.overall_score IS NULL OR OLD.overall_score >= 40) THEN
        
        -- Get account details
        SELECT a.*, p.email as csm_email, p.full_name as csm_name
        INTO v_account
        FROM accounts a
        LEFT JOIN profiles p ON a.csm_id = p.id
        WHERE a.id = NEW.account_id;
        
        -- Find active playbooks for this trigger type
        FOR v_playbook IN 
            SELECT * FROM playbooks 
            WHERE tenant_id = NEW.tenant_id
            AND is_active = true
            AND trigger_type = 'Health Score Drop'
            AND (trigger_criteria->>'threshold')::integer >= NEW.overall_score
        LOOP
            -- Check cooldown period
            SELECT 
                COALESCE(
                    EXTRACT(EPOCH FROM (NOW() - MAX(executed_at)))/60 > v_playbook.cooldown_minutes,
                    true
                ) INTO v_cooldown_exceeded
            FROM playbook_executions
            WHERE playbook_id = v_playbook.id
            AND account_id = NEW.account_id;
            
            -- Check daily execution limit
            IF v_cooldown_exceeded AND v_playbook.execution_count < v_playbook.max_executions_per_day THEN
                -- Build webhook payload
                v_payload := jsonb_build_object(
                    'event_type', 'health_score_drop',
                    'triggered_at', NOW(),
                    'account', jsonb_build_object(
                        'id', v_account.id,
                        'name', v_account.name,
                        'external_id', v_account.external_id,
                        'status', v_account.status,
                        'arr', v_account.arr,
                        'renewal_date', v_account.renewal_date
                    ),
                    'health_score', jsonb_build_object(
                        'current_score', NEW.overall_score,
                        'previous_score', OLD.overall_score,
                        'change', NEW.score_change,
                        'risk_level', NEW.risk_level,
                        'usage_score', NEW.usage_score,
                        'engagement_score', NEW.engagement_score,
                        'support_sentiment_score', NEW.support_sentiment_score,
                        'adoption_score', NEW.adoption_score
                    ),
                    'csm', jsonb_build_object(
                        'id', v_account.csm_id,
                        'email', v_account.csm_email,
                        'name', v_account.csm_name
                    ),
                    'playbook', jsonb_build_object(
                        'id', v_playbook.id,
                        'name', v_playbook.name
                    ),
                    'tenant_id', NEW.tenant_id
                );
                
                -- Queue webhook for async processing
                INSERT INTO webhook_queue (
                    playbook_id,
                    account_id,
                    tenant_id,
                    webhook_url,
                    webhook_method,
                    webhook_headers,
                    payload
                ) VALUES (
                    v_playbook.id,
                    NEW.account_id,
                    NEW.tenant_id,
                    v_playbook.webhook_url,
                    v_playbook.webhook_method,
                    v_playbook.webhook_headers,
                    v_payload
                );
                
                -- Log execution attempt
                INSERT INTO playbook_executions (
                    playbook_id,
                    account_id,
                    tenant_id,
                    triggered_by,
                    trigger_data,
                    success
                ) VALUES (
                    v_playbook.id,
                    NEW.account_id,
                    NEW.tenant_id,
                    'health_score_trigger',
                    v_payload,
                    null -- Will be updated by webhook processor
                );
                
                -- Update playbook stats
                UPDATE playbooks 
                SET 
                    last_triggered_at = NOW(),
                    execution_count = execution_count + 1
                WHERE id = v_playbook.id;
                
                RAISE NOTICE 'Queued playbook % for account % (score: %)', 
                    v_playbook.name, v_account.name, NEW.overall_score;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_health_score_playbook() IS 
    'SuccessPlay engine: Triggers n8n webhooks when health score drops below threshold';

-- Create trigger on health_scores table
DROP TRIGGER IF EXISTS health_score_playbook_trigger ON health_scores;
CREATE TRIGGER health_score_playbook_trigger
    AFTER INSERT OR UPDATE OF overall_score ON health_scores
    FOR EACH ROW
    EXECUTE FUNCTION trigger_health_score_playbook();

-- ============================================================================
-- STEP 3: Additional Triggers - Stage Transition
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_stage_transition_playbook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_playbook RECORD;
    v_account RECORD;
    v_payload JSONB;
BEGIN
    -- Only trigger on INSERT (new stage entered)
    IF TG_OP = 'INSERT' AND NEW.to_stage = 'At Risk' THEN
        
        -- Get account details
        SELECT a.*, p.email as csm_email, p.full_name as csm_name
        INTO v_account
        FROM accounts a
        LEFT JOIN profiles p ON a.csm_id = p.id
        WHERE a.id = NEW.account_id;
        
        -- Find active playbooks for stage transitions
        FOR v_playbook IN 
            SELECT * FROM playbooks 
            WHERE tenant_id = NEW.tenant_id
            AND is_active = true
            AND trigger_type = 'Stage Transition'
            AND trigger_criteria->>'to_stage' = NEW.to_stage::text
        LOOP
            -- Build payload
            v_payload := jsonb_build_object(
                'event_type', 'stage_transition',
                'triggered_at', NOW(),
                'account', jsonb_build_object(
                    'id', v_account.id,
                    'name', v_account.name,
                    'external_id', v_account.external_id
                ),
                'journey', jsonb_build_object(
                    'from_stage', NEW.from_stage,
                    'to_stage', NEW.to_stage,
                    'reason', NEW.reason
                ),
                'csm', jsonb_build_object(
                    'email', v_account.csm_email,
                    'name', v_account.csm_name
                )
            );
            
            -- Queue webhook
            INSERT INTO webhook_queue (
                playbook_id,
                account_id,
                tenant_id,
                webhook_url,
                webhook_method,
                webhook_headers,
                payload
            ) VALUES (
                v_playbook.id,
                NEW.account_id,
                NEW.tenant_id,
                v_playbook.webhook_url,
                v_playbook.webhook_method,
                v_playbook.webhook_headers,
                v_payload
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_stage_transition_playbook() IS 
    'Triggers n8n webhooks when account transitions to At Risk stage';

-- Create trigger on journey_history table
DROP TRIGGER IF EXISTS stage_transition_playbook_trigger ON journey_history;
CREATE TRIGGER stage_transition_playbook_trigger
    AFTER INSERT ON journey_history
    FOR EACH ROW
    EXECUTE FUNCTION trigger_stage_transition_playbook();

-- ============================================================================
-- STEP 4: Helper Functions for Playbook Management
-- ============================================================================

-- Function to manually trigger a playbook
CREATE OR REPLACE FUNCTION trigger_playbook_manually(
    p_playbook_id UUID,
    p_account_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_playbook RECORD;
    v_account RECORD;
    v_payload JSONB;
    v_queue_id UUID;
BEGIN
    -- Verify tenant access
    SELECT * INTO v_playbook FROM playbooks 
    WHERE id = p_playbook_id 
    AND tenant_id = current_tenant_id();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Playbook not found or access denied');
    END IF;
    
    SELECT a.*, p.email as csm_email, p.full_name as csm_name
    INTO v_account
    FROM accounts a
    LEFT JOIN profiles p ON a.csm_id = p.id
    WHERE a.id = p_account_id
    AND a.tenant_id = current_tenant_id();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Account not found or access denied');
    END IF;
    
    -- Build payload
    v_payload := jsonb_build_object(
        'event_type', 'manual_trigger',
        'triggered_at', NOW(),
        'triggered_by', requesting_user_id(),
        'reason', p_reason,
        'account', jsonb_build_object(
            'id', v_account.id,
            'name', v_account.name,
            'external_id', v_account.external_id,
            'status', v_account.status
        ),
        'csm', jsonb_build_object(
            'email', v_account.csm_email,
            'name', v_account.csm_name
        )
    );
    
    -- Queue webhook
    INSERT INTO webhook_queue (
        playbook_id,
        account_id,
        tenant_id,
        webhook_url,
        webhook_method,
        webhook_headers,
        payload
    ) VALUES (
        v_playbook.id,
        p_account_id,
        current_tenant_id(),
        v_playbook.webhook_url,
        v_playbook.webhook_method,
        v_playbook.webhook_headers,
        v_payload
    ) RETURNING id INTO v_queue_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'queue_id', v_queue_id,
        'message', 'Playbook queued for execution'
    );
END;
$$;

COMMENT ON FUNCTION trigger_playbook_manually IS 
    'Manually trigger a playbook execution for a specific account';

-- ============================================================================
-- STEP 5: Sample Data - Playbook Configuration
-- ============================================================================

-- Insert default playbook for health score monitoring
INSERT INTO playbooks (
    tenant_id,
    name,
    description,
    trigger_type,
    trigger_criteria,
    webhook_url,
    webhook_method,
    is_active
) 
SELECT 
    t.id,
    'Health Score Alert - Critical',
    'Notify CSM via Slack when account health drops below 40',
    'Health Score Drop',
    '{"threshold": 40, "severity": "critical"}'::jsonb,
    'http://localhost:5678/webhook/health-alert',
    'POST',
    true
FROM tenants t
WHERE t.slug = 'acme-corp'
ON CONFLICT DO NOTHING;

INSERT INTO playbooks (
    tenant_id,
    name,
    description,
    trigger_type,
    trigger_criteria,
    webhook_url,
    webhook_method,
    is_active
) 
SELECT 
    t.id,
    'At Risk Stage Alert',
    'Notify team when account enters At Risk stage',
    'Stage Transition',
    '{"to_stage": "At Risk"}'::jsonb,
    'http://localhost:5678/webhook/stage-alert',
    'POST',
    true
FROM tenants t
WHERE t.slug = 'acme-corp'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- End of Migration
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✓ SuccessPlay automation engine created successfully!';
    RAISE NOTICE '✓ Health score drop trigger configured (threshold < 40)';
    RAISE NOTICE '✓ Stage transition trigger configured (At Risk)';
    RAISE NOTICE '✓ Webhook queue system for async n8n integration';
    RAISE NOTICE '✓ Sample playbooks created for Acme Corp';
    RAISE NOTICE '';
    RAISE NOTICE 'Webhook payload includes:';
    RAISE NOTICE '  - account_id, account_name';
    RAISE NOTICE '  - csm_email for Slack notifications';
    RAISE NOTICE '  - health_score details';
    RAISE NOTICE '  - Complete event context';
    RAISE NOTICE '';
    RAISE NOTICE 'n8n webhook endpoint: http://localhost:5678/webhook/health-alert';
END $$;
