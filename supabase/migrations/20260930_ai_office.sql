-- AI Office: agents (robots), tasks (the queue) and an activity log.
-- Run in the Supabase SQL editor. Requires 20260930_rbac_lockdown.sql (uses public.is_workspace_owner_role).
-- Access: founder / superadmin only. Does not touch finance or ads_* tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    -- 1 = doers (many, cheap), 2 = specialists, 3 = boss office (thinker + QC)
    floor INT NOT NULL CHECK (floor BETWEEN 1 AND 3),
    kind TEXT NOT NULL CHECK (kind IN ('planner', 'qc', 'worker')),
    provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'groq', 'gemini')),
    model TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.ai_tasks(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('goal', 'subtask')),
    seq INT NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL,
    floor INT,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    -- goal:    queued -> planning -> running -> reviewing -> done | failed
    -- subtask: queued -> running -> review -> done | failed (or back to queued for one redo)
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'planning', 'running', 'review', 'reviewing', 'done', 'failed')),
    deep_think BOOLEAN NOT NULL DEFAULT false,
    result TEXT,
    qc_feedback TEXT,
    error TEXT,
    attempts INT NOT NULL DEFAULT 0,
    model_used TEXT,
    tokens_in INT NOT NULL DEFAULT 0,
    tokens_out INT NOT NULL DEFAULT 0,
    created_by UUID,
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_queue ON public.ai_tasks (workspace_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_parent ON public.ai_tasks (parent_id);

CREATE TABLE IF NOT EXISTS public.ai_task_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES public.ai_tasks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_task_events_recent ON public.ai_task_events (workspace_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_agents', 'ai_tasks', 'ai_task_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ai_office_owner_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY ai_office_owner_all ON public.%I FOR ALL USING (public.is_workspace_owner_role(workspace_id)) WITH CHECK (public.is_workspace_owner_role(workspace_id))',
      t);
  END LOOP;
END $$;

COMMIT;
