ALTER TABLE "agentConfig"
  ADD COLUMN IF NOT EXISTS "e2bSandboxId" varchar,
  ADD COLUMN IF NOT EXISTS "e2bSandboxStatus" varchar(20) NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS "e2b_last_active_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "e2b_paused_at" timestamp with time zone;

-- Preserve sandbox IDs created by the earlier vmSandboxId implementation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'agentConfig' AND column_name = 'vmSandboxId'
  ) THEN
    EXECUTE 'UPDATE "agentConfig" SET "e2bSandboxId" = COALESCE("e2bSandboxId", "vmSandboxId")';
  END IF;
END $$;
