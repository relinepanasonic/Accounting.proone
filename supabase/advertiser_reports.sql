CREATE TABLE IF NOT EXISTS public.advertiser_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    session INT NOT NULL,
    data_inkubasi JSONB DEFAULT '[]'::jsonb,
    data_group JSONB DEFAULT '[]'::jsonb,
    data_mandiri JSONB DEFAULT '[]'::jsonb,
    screenshot_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, report_date, session)
);

ALTER TABLE public.advertiser_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for workspace members" ON public.advertiser_reports FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Enable insert for workspace members" ON public.advertiser_reports FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY "Enable update for workspace members" ON public.advertiser_reports FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
