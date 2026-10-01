-- A client can be assigned to a person FOR A JOB (advertising, admin, ...), so the same client can have an
-- advertiser and an admin, and one person can hold several jobs. Run in the Supabase SQL editor.

ALTER TABLE public.client_assignments ADD COLUMN IF NOT EXISTS job TEXT NOT NULL DEFAULT 'advertising';

-- The old rule allowed one row per (client, person). It becomes one row per (client, person, job).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.client_assignments'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.client_assignments DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.client_assignments
  ADD CONSTRAINT client_assignments_client_user_job_key UNIQUE (client_id, user_id, job);

-- Has the signed-in user been given this client for this job?
CREATE OR REPLACE FUNCTION public.is_assigned_client_job(target_client_id UUID, target_job TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_assignments ca
    WHERE ca.client_id = target_client_id AND ca.user_id = auth.uid() AND ca.job = target_job
  );
$$;

-- An advertiser may only write reports for clients where they hold the "advertising" job.
DROP POLICY IF EXISTS reports_insert ON public.advertiser_reports;
CREATE POLICY reports_insert ON public.advertiser_reports FOR INSERT WITH CHECK (
  public.is_finance_member(workspace_id)
  OR (public.has_workspace_role(workspace_id, ARRAY['advertiser']) AND public.is_assigned_client_job(client_id, 'advertising'))
);
DROP POLICY IF EXISTS reports_update ON public.advertiser_reports;
CREATE POLICY reports_update ON public.advertiser_reports FOR UPDATE USING (
  public.is_finance_member(workspace_id)
  OR (public.has_workspace_role(workspace_id, ARRAY['advertiser']) AND public.is_assigned_client_job(client_id, 'advertising'))
);
