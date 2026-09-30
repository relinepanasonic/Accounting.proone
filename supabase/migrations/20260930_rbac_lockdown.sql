-- RBAC lockdown: finance data only for superadmin / accounting / admin (founder), `client` role added.
-- REVIEW BEFORE RUNNING. Run in the Supabase SQL editor. Do it BEFORE creating any `client` user.
-- Does not touch ads_* tables. The service role (server actions / API routes) bypasses RLS.
--
-- Fixes:
--  * is_workspace_member() no longer treats a user with NO membership row as a member of EVERY workspace.
--  * invoices had a "USING (true)" SELECT policy: anyone, even logged out, could read all invoices.
--  * workspace_members could be altered by ANY authenticated user (privilege escalation).
--  * Finance tables were readable by every workspace member (advertiser/client would see everything).
--  * exec_sql RPC (if present) is no longer callable by anon/authenticated.

BEGIN;

-- 1. Role constraint: founder, superadmin, accounting, admin, advertiser, client -----------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.workspace_members'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.workspace_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('founder', 'superadmin', 'accounting', 'admin', 'advertiser', 'client'));

-- 2. Helper functions ----------------------------------------------------------------------------------------
-- KEEP IN SYNC with public.ads_founder_emails() and src/lib/auth/workspace-context.ts.
CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN ('nicojapar@gmail.com');
$$;

-- Membership rows may be linked by user_id, or by email for pending invitations.
CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT public.is_founder() OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND (wm.user_id = auth.uid()
           OR (wm.email IS NOT NULL AND lower(wm.email) = lower(auth.jwt() ->> 'email')))
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(target_workspace_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT (public.is_founder() AND 'founder' = ANY(allowed_roles)) OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND (wm.user_id = auth.uid()
           OR (wm.email IS NOT NULL AND lower(wm.email) = lower(auth.jwt() ->> 'email')))
      AND wm.role = ANY(allowed_roles)
  );
$$;

-- Finance access: founder, superadmin, accounting, admin.
CREATE OR REPLACE FUNCTION public.is_finance_member(target_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT public.is_founder() OR public.has_workspace_role(target_workspace_id, ARRAY['superadmin', 'accounting', 'admin']);
$$;

-- Owner-level access: founder, superadmin.
CREATE OR REPLACE FUNCTION public.is_workspace_owner_role(target_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT public.is_founder() OR public.has_workspace_role(target_workspace_id, ARRAY['superadmin']);
$$;

-- Is the current user assigned to this client?
CREATE OR REPLACE FUNCTION public.is_assigned_client(target_client_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_assignments ca
    WHERE ca.client_id = target_client_id AND ca.user_id = auth.uid()
  );
$$;

-- 3. Finance tables: drop EVERY existing policy, allow finance roles only ------------------------------------
DO $$
DECLARE
  t text;
  p record;
  finance_tables text[] := ARRAY[
    'invoices', 'invoice_line_items', 'quotations', 'quotation_line_items', 'transactions',
    'journal_entries', 'journal_entry_lines', 'payroll', 'fixed_assets', 'workspace_bank_accounts',
    'bank_statement_lines', 'products', 'crm_deals', 'global_chart_of_accounts',
    'workspace_ledger_mappings', 'admin_shopee_reports'
  ];
BEGIN
  FOREACH t IN ARRAY finance_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY finance_roles_all ON public.%I FOR ALL USING (public.is_finance_member(workspace_id)) WITH CHECK (public.is_finance_member(workspace_id))',
      t);
  END LOOP;
END $$;

-- 4. clients: finance roles full access; advertiser/client read ONLY assigned clients ------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' LOOP
    EXECUTE format('DROP POLICY %I ON public.clients', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_roles_all ON public.clients FOR ALL
  USING (public.is_finance_member(workspace_id)) WITH CHECK (public.is_finance_member(workspace_id));
CREATE POLICY assigned_clients_read ON public.clients FOR SELECT
  USING (public.is_workspace_member(workspace_id) AND public.is_assigned_client(id));

-- 5. client_assignments: users see their own; only superadmin/founder manage ------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_assignments' LOOP
    EXECUTE format('DROP POLICY %I ON public.client_assignments', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_read ON public.client_assignments FOR SELECT
  USING (user_id = auth.uid() OR public.is_finance_member(workspace_id));
CREATE POLICY assignments_manage ON public.client_assignments FOR ALL
  USING (public.is_workspace_owner_role(workspace_id)) WITH CHECK (public.is_workspace_owner_role(workspace_id));

-- 6. advertiser_reports (Digital Ads data): finance read; advertiser writes for assigned clients; client read-only --
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'advertiser_reports' LOOP
    EXECUTE format('DROP POLICY %I ON public.advertiser_reports', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.advertiser_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_read ON public.advertiser_reports FOR SELECT USING (
  public.is_finance_member(workspace_id)
  OR (public.is_workspace_member(workspace_id) AND public.is_assigned_client(client_id))
);
CREATE POLICY reports_insert ON public.advertiser_reports FOR INSERT WITH CHECK (
  public.is_finance_member(workspace_id)
  OR (public.has_workspace_role(workspace_id, ARRAY['advertiser']) AND public.is_assigned_client(client_id))
);
CREATE POLICY reports_update ON public.advertiser_reports FOR UPDATE USING (
  public.is_finance_member(workspace_id)
  OR (public.has_workspace_role(workspace_id, ARRAY['advertiser']) AND public.is_assigned_client(client_id))
);
CREATE POLICY reports_delete ON public.advertiser_reports FOR DELETE USING (public.is_workspace_owner_role(workspace_id));

-- 7. workspaces / workspace_members ---------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces' LOOP
    EXECUTE format('DROP POLICY %I ON public.workspaces', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_members' LOOP
    EXECUTE format('DROP POLICY %I ON public.workspace_members', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_read ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id) OR owner_id = auth.uid());
CREATE POLICY workspaces_create ON public.workspaces FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE
  USING (public.is_workspace_owner_role(id)) WITH CHECK (public.is_workspace_owner_role(id));
CREATE POLICY workspaces_delete ON public.workspaces FOR DELETE USING (public.is_workspace_owner_role(id));

-- A member sees their own row; finance roles see the team; only superadmin/founder (or the workspace creator) change it.
CREATE POLICY members_read ON public.workspace_members FOR SELECT USING (
  user_id = auth.uid()
  OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
  OR public.is_finance_member(workspace_id)
);
CREATE POLICY members_manage ON public.workspace_members FOR ALL
  USING (public.is_workspace_owner_role(workspace_id))
  WITH CHECK (public.is_workspace_owner_role(workspace_id));
CREATE POLICY members_bootstrap_creator ON public.workspace_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
);

-- 7b. profiles (emails / names): own row, plus teammates for finance roles ------------------------------------
DO $$
DECLARE p record;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN RETURN; END IF;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', p.policyname);
  END LOOP;
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY profiles_read ON public.profiles FOR SELECT USING (
    id = auth.uid()
    OR public.is_founder()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = profiles.id AND public.is_finance_member(wm.workspace_id)
    )
  );
  CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
END $$;

-- 8. Raw-SQL RPC must never be callable from the API --------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.exec_sql(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

COMMIT;

-- AUDIT QUERIES (run separately, read-only) ------------------------------------------------------------------
-- Tables still without RLS:
--   SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY 1;
-- Policies that are open to everyone:
--   SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND (qual = 'true' OR qual IS NULL);
-- Storage buckets and their policies:
--   SELECT id, name, public FROM storage.buckets;
--   SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'storage';
-- SECURITY DEFINER functions callable by API roles:
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef;
