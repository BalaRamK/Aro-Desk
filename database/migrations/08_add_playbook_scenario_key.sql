-- Add scenario_key column to playbooks if it doesn't exist
-- This ensures compatibility with different production schema versions

DO $$ 
BEGIN
    -- Add scenario_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'scenario_key'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN scenario_key TEXT;
        
        -- Backfill existing rows with generated keys
        UPDATE playbooks 
        SET scenario_key = LOWER(REPLACE(REPLACE(name, ' ', '_'), '-', '_')) || '_' || EXTRACT(EPOCH FROM created_at)::bigint
        WHERE scenario_key IS NULL;
        
        -- Now make it NOT NULL and add unique constraint
        ALTER TABLE playbooks ALTER COLUMN scenario_key SET NOT NULL;
        ALTER TABLE playbooks ADD CONSTRAINT playbooks_tenant_scenario_key UNIQUE (tenant_id, scenario_key);
    END IF;
END $$;
