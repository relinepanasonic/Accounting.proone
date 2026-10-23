-- Schedule Expense of the fixed assets: one row per monthly payment of an asset (the cost spread over the months until it is 0).
-- The first payment is posted to the ledger at once; the others on their day (daily job, the Sync button, or when the Assets pages open).
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.asset_schedule (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asset_id     UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,            -- 1, 2, 3 ... (payment number)
  due_date     DATE NOT NULL,
  amount       NUMERIC(20,2) NOT NULL,
  posted_at    TIMESTAMPTZ,                 -- set when the expense is in the ledger
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, seq)
);

CREATE INDEX IF NOT EXISTS asset_schedule_workspace_due ON public.asset_schedule (workspace_id, due_date);

ALTER TABLE public.asset_schedule ENABLE ROW LEVEL SECURITY;

-- Same rule as the other accounting tables: the finance people of the company (and the owners).
DROP POLICY IF EXISTS asset_schedule_select ON public.asset_schedule;
CREATE POLICY asset_schedule_select ON public.asset_schedule FOR SELECT USING (public.is_finance_member(workspace_id));

DROP POLICY IF EXISTS asset_schedule_write ON public.asset_schedule;
CREATE POLICY asset_schedule_write ON public.asset_schedule FOR ALL
  USING (public.is_finance_member(workspace_id)) WITH CHECK (public.is_finance_member(workspace_id));
