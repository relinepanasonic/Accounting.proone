-- Productivity planner: tasks (own + assigned), lead visits ("Picture with Leads") and quick notes.
-- Run in the Supabase SQL editor (safe to run twice).

BEGIN;

-- 1. Tasks: a person's own to-dos, and tasks a superadmin gives to someone ----------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    note TEXT,
    assigned_to UUID NOT NULL,
    assigned_by UUID,
    due_date DATE,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    starred BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    done_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_person ON public.staff_tasks (workspace_id, assigned_to, status);

-- 2. Lead visits: agenda + time stamp + a photo with the client + a photo of the receipt --------------------------
-- Photos are stored as compressed JPEG data (a few hundred KB each) and served through the app, never public.
CREATE TABLE IF NOT EXISTS public.lead_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    salesman_id UUID NOT NULL,
    salesman_name TEXT,
    agenda TEXT NOT NULL,
    visit_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    client_photo TEXT,
    receipt_photo TEXT,
    has_client_photo BOOLEAN NOT NULL DEFAULT false,
    has_receipt_photo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_visits_when ON public.lead_visits (workspace_id, visit_at DESC);

-- 3. Quick notes ------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quick_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quick_notes_user ON public.quick_notes (workspace_id, user_id, created_at DESC);

-- 4. Row rules: everything is written through the app (service role); people can read what is theirs ------------
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_tasks_read ON public.staff_tasks;
CREATE POLICY staff_tasks_read ON public.staff_tasks FOR SELECT
  USING (assigned_to = auth.uid() OR assigned_by = auth.uid() OR public.is_workspace_owner_role(workspace_id));

DROP POLICY IF EXISTS lead_visits_read ON public.lead_visits;
CREATE POLICY lead_visits_read ON public.lead_visits FOR SELECT
  USING (salesman_id = auth.uid() OR public.is_finance_member(workspace_id));

DROP POLICY IF EXISTS quick_notes_read ON public.quick_notes;
CREATE POLICY quick_notes_read ON public.quick_notes FOR SELECT USING (user_id = auth.uid());

COMMIT;
