CREATE TABLE IF NOT EXISTS public.admin_shopee_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    is_uploaded BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, report_date)
);

ALTER TABLE public.admin_shopee_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for workspace members" ON public.admin_shopee_reports FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Enable insert for workspace members" ON public.admin_shopee_reports FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Enable update for workspace members" ON public.admin_shopee_reports FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
