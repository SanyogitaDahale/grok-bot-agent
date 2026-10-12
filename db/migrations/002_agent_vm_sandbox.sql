ALTER TABLE "agentConfig"
  ADD COLUMN IF NOT EXISTS "e2bSandboxId" varchar,
  ADD COLUMN IF NOT EXISTS "e2bSandboxStatus" varchar(20) NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS "e2b_last_active_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "e2b_paused_at" timestamp with time zone;
