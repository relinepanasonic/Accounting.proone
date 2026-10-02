-- Sales flow: Lead -> pipeline -> invoice request -> invoice -> paid -> project -> handler assignment.
-- Run in the Supabase SQL editor (safe to run twice). Requires 20260930_rbac_lockdown.sql.

BEGIN;

-- 1. New staff role: sales ------------------------------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.workspace_members'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%role%' LOOP
    EXECUTE format('ALTER TABLE public.workspace_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF to_regclass('public.workspace_invites') IS NOT NULL THEN
    FOR c IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'public.workspace_invites'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%role%' LOOP
      EXECUTE format('ALTER TABLE public.workspace_invites DROP CONSTRAINT %I', c.conname);
    END LOOP;
  END IF;
END $$;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('founder', 'superadmin', 'accounting', 'admin', 'advertiser', 'sales', 'client'));

DO $$
BEGIN
  IF to_regclass('public.workspace_invites') IS NOT NULL THEN
    ALTER TABLE public.workspace_invites
      ADD CONSTRAINT workspace_invites_role_check
      CHECK (role IN ('superadmin', 'accounting', 'admin', 'advertiser', 'sales', 'client'));
  END IF;
END $$;

-- 2. Product catalog: how long a product's project lasts ------------------------------------------------------
-- none = no project length | day / month = runs that long | deliverable = a number of videos / photos / ...
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS duration_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS duration_value INT NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deliverable_unit TEXT;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_duration_type_check;
ALTER TABLE public.products ADD CONSTRAINT products_duration_type_check CHECK (duration_type IN ('none', 'day', 'month', 'deliverable'));

-- 3. Clients entered by sales stay hidden from Accounting until an invoice is requested -------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_prospect BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by UUID;

-- 4. Deals: who owns them and the milestones shown on the card ------------------------------------------------
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS salesman_id UUID;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS invoice_requested_at TIMESTAMPTZ;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS acc_approved_at TIMESTAMPTZ;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 5. Invoice requests (salesman -> Accounting) ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    requested_by UUID,
    requested_by_name TEXT,
    -- [{ product_id, name, quantity, unit_price, scale, duration_type, duration_value, deliverable_unit }]
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'generated', 'cancelled')),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_at TIMESTAMPTZ,
    generated_by UUID
);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_open ON public.invoice_requests (workspace_id, status);

-- 6. Notifications (a task list: an item stays until the work is done) ----------------------------------------
-- audience: 'finance' = accounting / admin / superadmin, 'owners' = superadmin / founder, 'user' = one person (user_id)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    audience TEXT NOT NULL CHECK (audience IN ('finance', 'owners', 'user')),
    user_id UUID,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    ref_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_open ON public.notifications (workspace_id, audience) WHERE resolved_at IS NULL;

-- 7. Projects (a paid deal becomes a project) -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,                                -- null when no product has a time length
    deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ name, unit, total }]
    status TEXT NOT NULL DEFAULT 'pre_start' CHECK (status IN ('pre_start', 'active', 'done')),
    handler_assigned_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deal_id)
);

-- 8. Share links: a client opens the invoice from WhatsApp without logging in ---------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_shares (
    token TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- 9. Row rules --------------------------------------------------------------------------------------------------
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_shares ENABLE ROW LEVEL SECURITY; -- no policy: only the server (service role) reads it

DROP POLICY IF EXISTS invoice_requests_read ON public.invoice_requests;
CREATE POLICY invoice_requests_read ON public.invoice_requests FOR SELECT
  USING (public.is_finance_member(workspace_id) OR requested_by = auth.uid());

DROP POLICY IF EXISTS notifications_read ON public.notifications;
CREATE POLICY notifications_read ON public.notifications FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS projects_read ON public.projects;
CREATE POLICY projects_read ON public.projects FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- Sales staff work with clients and deals of their workspace, but never see invoices (those stay finance-only).
DROP POLICY IF EXISTS sales_clients_rw ON public.clients;
CREATE POLICY sales_clients_rw ON public.clients FOR ALL
  USING (public.has_workspace_role(workspace_id, ARRAY['sales']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['sales']));

COMMIT;
