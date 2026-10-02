-- Ledger Check: the team's manual verdict per invoice ("checked OK" / "problem" + a note).
-- Run in the Supabase SQL editor. The Ledger Check page works without it, but cannot save marks.

CREATE TABLE IF NOT EXISTS public.ledger_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('ok', 'problem')),
    note TEXT,
    checked_by UUID,
    checked_by_name TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (invoice_id)
);

ALTER TABLE public.ledger_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledger_checks_finance ON public.ledger_checks;
CREATE POLICY ledger_checks_finance ON public.ledger_checks FOR ALL
  USING (public.is_finance_member(workspace_id)) WITH CHECK (public.is_finance_member(workspace_id));
