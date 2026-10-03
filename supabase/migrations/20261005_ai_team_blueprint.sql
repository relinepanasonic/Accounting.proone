-- AI Office: teams built from a Scout Team recommendation get a job desk per agent and a starter task list.
-- Run in the Supabase SQL editor AFTER 20260930_ai_teams.sql.

BEGIN;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS job_desk TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_teams  ADD COLUMN IF NOT EXISTS workflow TEXT NOT NULL DEFAULT '';
ALTER TABLE public.ai_teams  ADD COLUMN IF NOT EXISTS starter_tasks JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
