-- AI Office Mission Control: memory notes, recurring jobs (calendar) and a monthly budget.
-- Run in the Supabase SQL editor AFTER 20260930_ai_office.sql and 20260930_ai_teams.sql.
-- Access: founder / superadmin only (same rule as the rest of the AI Office).

BEGIN;

-- Memory / Knowledge: notes the agents read before they work. A note belongs to one team
-- (team_id NULL = the General Office) and may be pinned to one agent of that team.
CREATE TABLE IF NOT EXISTS public.ai_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.ai_teams(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_memories_team ON public.ai_memories (workspace_id, team_id);

-- Calendar: recurring (or one-off) briefs. Times are Jakarta time.
CREATE TABLE IF NOT EXISTS public.ai_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.ai_teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    brief TEXT NOT NULL,
    cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'once')),
    weekday INT CHECK (weekday BETWEEN 0 AND 6),      -- weekly: 0 = Sunday
    monthday INT CHECK (monthday BETWEEN 1 AND 31),   -- monthly (short months run on their last day)
    run_date DATE,                                    -- once
    run_time TEXT NOT NULL DEFAULT '07:00' CHECK (run_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    last_goal_id UUID REFERENCES public.ai_tasks(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_tasks ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.ai_schedules(id) ON DELETE SET NULL;

-- Budget: the office stops starting new work once this month's estimated spend reaches the limit.
CREATE TABLE IF NOT EXISTS public.ai_office_settings (
    workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 10 CHECK (monthly_budget_usd >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_memories', 'ai_schedules', 'ai_office_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ai_office_owner_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY ai_office_owner_all ON public.%I FOR ALL USING (public.is_workspace_owner_role(workspace_id)) WITH CHECK (public.is_workspace_owner_role(workspace_id))',
      t);
  END LOOP;
END $$;

COMMIT;
