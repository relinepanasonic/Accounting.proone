-- AI Office teams + skill library. Run after 20260930_ai_office.sql (and 20260930_rbac_lockdown.sql).
-- A team is a group of agents with one mission. team_id NULL = the original "General Office".
-- Access: founder / superadmin only.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    mission TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, slug)
);

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.ai_teams(id) ON DELETE CASCADE;
ALTER TABLE public.ai_tasks  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.ai_teams(id) ON DELETE CASCADE;

-- Agents can now also be researchers and skill installers.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.ai_agents'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%planner%'
  LOOP
    EXECUTE format('ALTER TABLE public.ai_agents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.ai_agents
  ADD CONSTRAINT ai_agents_kind_check CHECK (kind IN ('planner', 'qc', 'worker', 'researcher', 'installer'));

-- Skill library: reusable instruction packs that get installed into agents.
CREATE TABLE IF NOT EXISTS public.ai_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    suited_for TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.ai_agent_skills (
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.ai_skills(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_id, skill_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_teams', 'ai_skills', 'ai_agent_skills'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ai_office_owner_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY ai_office_owner_all ON public.%I FOR ALL USING (public.is_workspace_owner_role(workspace_id)) WITH CHECK (public.is_workspace_owner_role(workspace_id))',
      t);
  END LOOP;
END $$;

COMMIT;
