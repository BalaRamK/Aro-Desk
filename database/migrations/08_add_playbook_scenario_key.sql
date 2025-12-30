-- Ensure playbooks table has all required columns
-- Handles schema mismatches between different migration versions

DO $$ 
BEGIN
    -- 1. Add scenario_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'scenario_key'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN scenario_key TEXT;
        
        -- Backfill existing rows with generated keys
        UPDATE playbooks 
        SET scenario_key = LOWER(REPLACE(REPLACE(name, ' ', '_'), '-', '_')) || '_' || EXTRACT(EPOCH FROM created_at)::bigint
        WHERE scenario_key IS NULL;
        
        -- Now make it NOT NULL
        ALTER TABLE playbooks ALTER COLUMN scenario_key SET NOT NULL;
        
        -- Add unique constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'playbooks' AND constraint_name = 'playbooks_tenant_scenario_key'
        ) THEN
            ALTER TABLE playbooks ADD CONSTRAINT playbooks_tenant_scenario_key UNIQUE (tenant_id, scenario_key);
        END IF;
    END IF;
    
    -- 2. Add triggers column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'triggers'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN triggers JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    -- 3. Add actions column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'actions'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN actions JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
    
    -- 4. Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    
    -- 5. Add description column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'description'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN description TEXT;
    END IF;
    
    -- 6. Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- 7. Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'playbooks' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE playbooks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    RAISE NOTICE 'Playbooks table schema migration completed successfully';
END $$;

