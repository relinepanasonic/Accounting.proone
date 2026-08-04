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
  payroll_id uuid REFERENCES public.payroll(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

-- Workspace Isolation Policy
CREATE POLICY "Users can manage bank_statement_lines in their workspaces"
  ON public.bank_statement_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = bank_statement_lines.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );
