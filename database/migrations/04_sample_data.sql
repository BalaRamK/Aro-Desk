-- ============================================================================
-- Sample Data for Customer Success Platform
-- Demonstrates complete workflow: Accounts → Journey → Metrics → Health → Automation
-- ============================================================================

-- Set session context for Acme Corporation admin
SET app.current_user_id = '11111111-1111-1111-1111-111111111111';

-- ============================================================================
-- STEP 1: Create Sample Accounts
-- ============================================================================

-- Get Acme Corp tenant ID
DO $$
DECLARE
    v_tenant_id UUID;
    v_csm_id UUID;
    v_account1_id UUID;
    v_account2_id UUID;
    v_account3_id UUID;
BEGIN
    -- Get tenant and CSM
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'acme-corp';
    SELECT id INTO v_csm_id FROM profiles WHERE tenant_id = v_tenant_id AND role = 'Tenant Admin' LIMIT 1;
    
    -- Parent Account (Enterprise customer)
    INSERT INTO accounts (
        id, tenant_id, name, external_id, status, csm_id,
        arr, contract_start_date, contract_end_date, renewal_date,
        crm_attributes, hierarchy_level, hierarchy_path
    ) VALUES (
        '10000000-0000-0000-0000-000000000001',
        v_tenant_id,
        'GlobalTech Corporation',
        'SF-12345',
        'Active',
        v_csm_id,
        150000.00,
        '2024-01-01',
        '2025-12-31',
        '2025-10-01',
        jsonb_build_object(
            'industry', 'Technology',
            'employees', 500,
            'segment', 'Enterprise',
            'region', 'North America',
            'account_owner', 'John Smith'
        ),
        0,
        '/globaltech/'
    ) ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_account1_id;
    
    -- Subsidiary Account
    INSERT INTO accounts (
        id, tenant_id, parent_id, name, external_id, status, csm_id,
        arr, contract_start_date, contract_end_date,
        crm_attributes, hierarchy_level, hierarchy_path
    ) VALUES (
        '10000000-0000-0000-0000-000000000002',
        v_tenant_id,
        v_account1_id,
        'GlobalTech Europe',
        'SF-12345-EU',
        'Active',
        v_csm_id,
        45000.00,
        '2024-03-01',
        '2025-12-31',
        jsonb_build_object(
            'industry', 'Technology',
            'employees', 150,
            'segment', 'Mid-Market',
            'region', 'Europe'
        ),
        1,
        '/globaltech/europe/'
    ) ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_account2_id;
    
    -- At-Risk Account
    INSERT INTO accounts (
        id, tenant_id, name, external_id, status, csm_id,
        arr, contract_start_date, contract_end_date, renewal_date,
        crm_attributes, hierarchy_level, hierarchy_path
    ) VALUES (
        '10000000-0000-0000-0000-000000000003',
        v_tenant_id,
        'TechStart Solutions',
        'SF-67890',
        'At Risk',
        v_csm_id,
        85000.00,
        '2023-06-01',
        '2025-05-31',
        '2025-03-01',
        jsonb_build_object(
            'industry', 'SaaS',
            'employees', 75,
            'segment', 'Mid-Market',
            'region', 'North America',
            'churn_risk', 'High'
        ),
        0,
        '/techstart/'
    ) ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_account3_id;
    
    RAISE NOTICE '✓ Created 3 sample accounts';
    
    -- ============================================================================
    -- STEP 2: Initialize Journey Stages
    -- ============================================================================
    
    -- Insert default journey stages
    INSERT INTO journey_stages (tenant_id, stage, display_name, display_order, description, target_duration_days, color_hex) VALUES
        (v_tenant_id, 'Onboarding', 'Onboarding', 1, 'Initial setup and configuration', 30, '#8B5CF6'),
        (v_tenant_id, 'Adoption', 'Adoption', 2, 'Learning and feature discovery', 60, '#3B82F6'),
        (v_tenant_id, 'Value Realization', 'Value Realization', 3, 'Achieving business outcomes', 90, '#10B981'),
        (v_tenant_id, 'Expansion', 'Expansion', 4, 'Growing usage and upsell', null, '#F59E0B'),
        (v_tenant_id, 'Renewal', 'Renewal', 5, 'Contract renewal period', 90, '#06B6D4'),
        (v_tenant_id, 'At Risk', 'At Risk', 6, 'Requires immediate attention', null, '#EF4444'),
        (v_tenant_id, 'Churn', 'Churned', 7, 'Lost customer', null, '#6B7280')
    ON CONFLICT (tenant_id, stage) DO NOTHING;
    
    RAISE NOTICE '✓ Created journey stages';
    
    -- Add journey history
    INSERT INTO journey_history (account_id, tenant_id, from_stage, to_stage, entered_at, reason) VALUES
        (v_account1_id, v_tenant_id, NULL, 'Onboarding', NOW() - INTERVAL '120 days', 'New customer onboarding'),
        (v_account1_id, v_tenant_id, 'Onboarding', 'Adoption', NOW() - INTERVAL '90 days', 'Completed setup'),
        (v_account1_id, v_tenant_id, 'Adoption', 'Value Realization', NOW() - INTERVAL '30 days', 'Active feature usage'),
        (v_account2_id, v_tenant_id, NULL, 'Onboarding', NOW() - INTERVAL '90 days', 'New subsidiary'),
        (v_account2_id, v_tenant_id, 'Onboarding', 'Adoption', NOW() - INTERVAL '60 days', 'Training completed'),
        (v_account3_id, v_tenant_id, NULL, 'Onboarding', NOW() - INTERVAL '180 days', 'New customer'),
        (v_account3_id, v_tenant_id, 'Onboarding', 'Adoption', NOW() - INTERVAL '150 days', 'Initial adoption'),
        (v_account3_id, v_tenant_id, 'Adoption', 'At Risk', NOW() - INTERVAL '7 days', 'Declining usage')
    ON CONFLICT DO NOTHING;
    
    -- Close old stages
    UPDATE journey_history 
    SET exited_at = entered_at + INTERVAL '30 days',
        duration_days = 30
    WHERE account_id = v_account1_id AND to_stage IN ('Onboarding', 'Adoption');
    
    RAISE NOTICE '✓ Created journey history';
    
    -- ============================================================================
    -- STEP 3: Add Usage Metrics
    -- ============================================================================
    
    -- GlobalTech - Healthy usage
    INSERT INTO usage_metrics (account_id, tenant_id, metric_type, metric_name, metric_value, recorded_at) VALUES
        (v_account1_id, v_tenant_id, 'Active Users', 'Daily Active Users', 45, NOW() - INTERVAL '1 day'),
        (v_account1_id, v_tenant_id, 'Login', 'Login Count', 120, NOW() - INTERVAL '1 day'),
        (v_account1_id, v_tenant_id, 'Feature Usage', 'Reports Generated', 78, NOW() - INTERVAL '1 day'),
        (v_account1_id, v_tenant_id, 'API Call', 'API Requests', 1500, NOW() - INTERVAL '1 day'),
        (v_account1_id, v_tenant_id, 'Session Duration', 'Avg Session Minutes', 35, NOW() - INTERVAL '1 day');
    
    -- TechStart - Declining usage (at risk)
    INSERT INTO usage_metrics (account_id, tenant_id, metric_type, metric_name, metric_value, recorded_at) VALUES
        (v_account3_id, v_tenant_id, 'Active Users', 'Daily Active Users', 5, NOW() - INTERVAL '1 day'),
        (v_account3_id, v_tenant_id, 'Login', 'Login Count', 12, NOW() - INTERVAL '1 day'),
        (v_account3_id, v_tenant_id, 'Feature Usage', 'Reports Generated', 3, NOW() - INTERVAL '1 day'),
        (v_account3_id, v_tenant_id, 'API Call', 'API Requests', 50, NOW() - INTERVAL '1 day'),
        (v_account3_id, v_tenant_id, 'Session Duration', 'Avg Session Minutes', 8, NOW() - INTERVAL '1 day');
    
    RAISE NOTICE '✓ Created usage metrics';
    
    -- ============================================================================
    -- STEP 4: Calculate Health Scores
    -- ============================================================================
    
    -- GlobalTech - Healthy score (85)
    INSERT INTO health_scores (
        account_id, tenant_id, overall_score,
        usage_score, engagement_score, support_sentiment_score, adoption_score,
        previous_score, calculated_at
    ) VALUES (
        v_account1_id, v_tenant_id, 85,
        90, 85, 80, 85,
        82, NOW()
    ) ON CONFLICT DO NOTHING;
    
    -- GlobalTech Europe - Good score (72)
    INSERT INTO health_scores (
        account_id, tenant_id, overall_score,
        usage_score, engagement_score, support_sentiment_score, adoption_score,
        previous_score, calculated_at
    ) VALUES (
        v_account2_id, v_tenant_id, 72,
        70, 75, 70, 72,
        70, NOW()
    ) ON CONFLICT DO NOTHING;
    
    -- TechStart - Critical score (35) - WILL TRIGGER PLAYBOOK!
    INSERT INTO health_scores (
        account_id, tenant_id, overall_score,
        usage_score, engagement_score, support_sentiment_score, adoption_score,
        previous_score, calculated_at
    ) VALUES (
        v_account3_id, v_tenant_id, 35,
        25, 30, 45, 40,
        65, NOW()
    ) ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '✓ Created health scores';
    RAISE NOTICE '✓ TechStart health score (35) should trigger playbook webhook!';
    
END $$;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- View all accounts with health scores
SELECT 
    a.name,
    a.status,
    a.arr,
    hs.overall_score,
    hs.risk_level,
    p.full_name as csm_name
FROM accounts a
LEFT JOIN health_scores hs ON a.id = hs.account_id
LEFT JOIN profiles p ON a.csm_id = p.id
ORDER BY hs.overall_score ASC NULLS LAST;

-- View webhook queue (should have entries from health score trigger)
SELECT 
    wq.id,
    pb.name as playbook_name,
    a.name as account_name,
    wq.status,
    wq.payload->>'event_type' as event_type,
    wq.created_at
FROM webhook_queue wq
JOIN playbooks pb ON wq.playbook_id = pb.id
JOIN accounts a ON wq.account_id = a.id
ORDER BY wq.created_at DESC;

-- View playbook execution log
SELECT 
    pe.id,
    pb.name as playbook_name,
    a.name as account_name,
    pe.triggered_by,
    pe.success,
    pe.executed_at
FROM playbook_executions pe
JOIN playbooks pb ON pe.playbook_id = pb.id
JOIN accounts a ON pe.account_id = a.id
ORDER BY pe.executed_at DESC;
