CREATE TABLE IF NOT EXISTS public.client_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID, -- References auth.users(id)
    assigned_by UUID, -- References auth.users(id)
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, user_id)
);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for workspace members" ON public.client_assignments FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Enable insert/update/delete for superadmin and founder" ON public.client_assignments USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('superadmin', 'founder'))
);
