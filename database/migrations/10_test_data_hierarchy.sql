-- Test Data for Account Hierarchy and Health Metrics
-- This creates sample accounts with parent-child relationships and multi-dimensional health scores

-- Function to insert test accounts and health data (idempotent)
CREATE OR REPLACE FUNCTION create_test_hierarchy_data()
RETURNS void AS $$
DECLARE
  v_tenant_id UUID;
  v_parent_account_id UUID;
  v_child_account_1_id UUID;
  v_child_account_2_id UUID;
  v_standalone_account_id UUID;
  v_stage_id UUID;
BEGIN
  -- Get the first tenant (or create a test tenant)
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No tenants found. Please create a tenant first.';
    RETURN;
  END IF;

  -- Get a journey stage (use first available)
  SELECT id INTO v_stage_id FROM journey_stages WHERE tenant_id = v_tenant_id LIMIT 1;
  
  IF v_stage_id IS NULL THEN
    RAISE NOTICE 'No journey stages found. Please create journey stages first.';
    RETURN;
  END IF;

  -- Check if test data already exists
  IF EXISTS (SELECT 1 FROM accounts WHERE name = 'Enterprise Corp (Parent)' AND tenant_id = v_tenant_id) THEN
    RAISE NOTICE 'Test hierarchy data already exists. Skipping.';
    RETURN;
  END IF;

  RAISE NOTICE 'Creating test hierarchy data for tenant: %', v_tenant_id;

  -- Create Parent Account
  INSERT INTO accounts (id, name, arr, status, parent_id, tenant_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Enterprise Corp (Parent)',
    500000, -- $500k ARR
    'Active',
    NULL, -- This is the root parent
    v_tenant_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_parent_account_id;

  -- Create Child Account 1
  INSERT INTO accounts (id, name, arr, status, parent_id, tenant_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Enterprise Corp - North Region',
    200000, -- $200k ARR
    'Active',
    v_parent_account_id,
    v_tenant_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_child_account_1_id;

  -- Create Child Account 2
  INSERT INTO accounts (id, name, arr, status, parent_id, tenant_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Enterprise Corp - South Region',
    150000, -- $150k ARR
    'Active',
    v_parent_account_id,
    v_tenant_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_child_account_2_id;

  -- Create Standalone Account (no parent)
  INSERT INTO accounts (id, name, arr, status, parent_id, tenant_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Startup Inc',
    50000, -- $50k ARR
    'Active',
    NULL,
    v_tenant_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_standalone_account_id;

  -- Create another standalone account at risk
  INSERT INTO accounts (id, name, arr, status, parent_id, tenant_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'TechCo Solutions',
    120000, -- $120k ARR
    'AtRisk',
    NULL,
    v_tenant_id,
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Created 5 test accounts with hierarchy';

  -- Insert Multi-dimensional Health Scores for Parent Account
  INSERT INTO health_scores (
    account_id,
    tenant_id,
    overall_score,
    usage_score,
    engagement_score,
    support_health,
    sentiment_score,
    component_scores,
    calculated_at,
    created_at
  )
  VALUES (
    v_parent_account_id,
    v_tenant_id,
    85, -- High health
    88, -- Strong usage
    82, -- Good engagement
    90, -- Excellent support
    85, -- Positive sentiment
    jsonb_build_object(
      'product_usage', 88,
      'engagement', 82,
      'support_health', 90,
      'adoption', 85,
      'relationship', 87
    ),
    NOW(),
    NOW()
  );

  -- Insert Health Scores for Child Account 1 (Good health)
  INSERT INTO health_scores (
    account_id,
    tenant_id,
    overall_score,
    usage_score,
    engagement_score,
    support_health,
    sentiment_score,
    component_scores,
    calculated_at,
    created_at
  )
  VALUES (
    v_child_account_1_id,
    v_tenant_id,
    75, -- Good health
    78,
    72,
    80,
    75,
    jsonb_build_object(
      'product_usage', 78,
      'engagement', 72,
      'support_health', 80,
      'adoption', 73,
      'relationship', 72
    ),
    NOW(),
    NOW()
  );

  -- Insert Health Scores for Child Account 2 (At Risk)
  INSERT INTO health_scores (
    account_id,
    tenant_id,
    overall_score,
    usage_score,
    engagement_score,
    support_health,
    sentiment_score,
    component_scores,
    calculated_at,
    created_at
  )
  VALUES (
    v_child_account_2_id,
    v_tenant_id,
    45, -- At Risk
    50,
    42,
    48,
    40,
    jsonb_build_object(
      'product_usage', 50,
      'engagement', 42,
      'support_health', 48,
      'adoption', 43,
      'relationship', 42
    ),
    NOW(),
    NOW()
  );

  -- Insert Health Scores for Standalone Account (Excellent)
  INSERT INTO health_scores (
    account_id,
    tenant_id,
    overall_score,
    usage_score,
    engagement_score,
    support_health,
    sentiment_score,
    component_scores,
    calculated_at,
    created_at
  )
  VALUES (
    v_standalone_account_id,
    v_tenant_id,
    92, -- Excellent
    95,
    90,
    93,
    91,
    jsonb_build_object(
      'product_usage', 95,
      'engagement', 90,
      'support_health', 93,
      'adoption', 92,
      'relationship', 90
    ),
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Created health scores for all accounts';

  -- Insert some journey history for context
  INSERT INTO journey_history (account_id, stage_id, tenant_id, entered_at, notes)
  VALUES
    (v_parent_account_id, v_stage_id, v_tenant_id, NOW() - INTERVAL '90 days', 'Parent account onboarded'),
    (v_child_account_1_id, v_stage_id, v_tenant_id, NOW() - INTERVAL '60 days', 'North region division started'),
    (v_child_account_2_id, v_stage_id, v_tenant_id, NOW() - INTERVAL '60 days', 'South region division started'),
    (v_standalone_account_id, v_stage_id, v_tenant_id, NOW() - INTERVAL '30 days', 'New startup customer');

  RAISE NOTICE 'Created journey history entries';

  RAISE NOTICE '=== Test Data Summary ===';
  RAISE NOTICE 'Parent Account: Enterprise Corp (Parent) - $500k ARR, Health: 85';
  RAISE NOTICE '├─ Child 1: Enterprise Corp - North Region - $200k ARR, Health: 75';
  RAISE NOTICE '├─ Child 2: Enterprise Corp - South Region - $150k ARR, Health: 45 (At Risk)';
  RAISE NOTICE 'Standalone Accounts:';
  RAISE NOTICE '├─ Startup Inc - $50k ARR, Health: 92';
  RAISE NOTICE '└─ TechCo Solutions - $120k ARR, Status: At Risk';
  RAISE NOTICE '';
  RAISE NOTICE 'Total Hierarchy ARR: $850k (Parent + Children)';
  RAISE NOTICE 'Test data created successfully!';

END;
$$ LANGUAGE plpgsql;

-- Execute the function to create test data
SELECT create_test_hierarchy_data();

-- Drop the function after use to keep schema clean
DROP FUNCTION IF EXISTS create_test_hierarchy_data();
