-- KPI dashboards (admin / advertiser / sales). Run in the Supabase SQL editor, after 20260930_assignment_jobs.sql.

-- 1. When does the client's service run out? 30 days before = warning, the day after = churn.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_end_date DATE;

-- 2. Admin: the monthly report sent to each client.
CREATE TABLE IF NOT EXISTS public.client_monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID,
  UNIQUE (client_id, month)
);

ALTER TABLE public.client_monthly_reports ENABLE ROW LEVEL SECURITY;

-- Readable by workspace members. Writes go through the app (server actions check who may tick a client).
DROP POLICY IF EXISTS monthly_reports_read ON public.client_monthly_reports;
CREATE POLICY monthly_reports_read ON public.client_monthly_reports FOR SELECT
  USING (public.is_workspace_member(workspace_id));
