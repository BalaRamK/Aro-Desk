-- Relax journey_stage enum to text-based stage names
BEGIN;

-- Convert journey_stages.stage from enum to text
ALTER TABLE journey_stages
  ALTER COLUMN stage TYPE TEXT USING stage::text;

-- Convert journey_history stage columns from enum to text
ALTER TABLE journey_history
  ALTER COLUMN from_stage TYPE TEXT USING from_stage::text,
  ALTER COLUMN to_stage TYPE TEXT USING to_stage::text;

-- Re-assert uniqueness per tenant
ALTER TABLE journey_stages
  DROP CONSTRAINT IF EXISTS journey_stages_unique_stage_per_tenant,
  ADD CONSTRAINT journey_stages_unique_stage_per_tenant UNIQUE(tenant_id, stage);

-- Optional: drop the enum type if no longer referenced
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'journey_stage'
  ) THEN
    -- Ensure no remaining dependencies before dropping
    DROP TYPE journey_stage;
  END IF;
END$$;

COMMIT;
