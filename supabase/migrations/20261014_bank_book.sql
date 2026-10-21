-- Buku Bank: every uploaded bank statement line is kept (page /bank-book), per bank account. Run in the Supabase SQL editor.
-- Safe to run more than once. It creates the table when it does not exist yet, and adds the columns of the statement feed.

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) NOT NULL,
  bank_account_id uuid REFERENCES public.workspace_bank_accounts(id) NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  notes text,
  amount numeric NOT NULL,
  status text DEFAULT 'unreconciled' NOT NULL, -- 'unreconciled' | 'reconciled' | 'ignored'
  transaction_id uuid REFERENCES public.transactions(id),
  invoice_id uuid REFERENCES public.invoices(id),
  payroll_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.bank_statement_lines
  ADD COLUMN IF NOT EXISTS counterparty text,
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS rek_from text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_statement_lines_fp ON public.bank_statement_lines (bank_account_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_ws_date ON public.bank_statement_lines (workspace_id, date DESC);

-- Each company only sees its own lines.
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage bank_statement_lines in their workspaces" ON public.bank_statement_lines;
CREATE POLICY "Users can manage bank_statement_lines in their workspaces"
  ON public.bank_statement_lines
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = bank_statement_lines.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = bank_statement_lines.workspace_id AND wm.user_id = auth.uid()));
