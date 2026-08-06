-- 1. Drop existing foreign keys that reference global_chart_of_accounts(account_code)
ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_account_code_fkey;
ALTER TABLE public.workspace_bank_accounts DROP CONSTRAINT IF EXISTS workspace_bank_accounts_coa_account_code_fkey;
ALTER TABLE public.global_chart_of_accounts DROP CONSTRAINT IF EXISTS global_chart_of_accounts_parent_code_fkey;

-- 2. Drop the unique constraint on account_code
ALTER TABLE public.global_chart_of_accounts DROP CONSTRAINT IF EXISTS global_chart_of_accounts_account_code_key;

-- 3. Clone the current null-workspace_id COA to all workspaces.
INSERT INTO public.global_chart_of_accounts (
  account_code, account_name, account_type, description, is_active, parent_code, workspace_id
)
SELECT 
  c.account_code, c.account_name, c.account_type, c.description, c.is_active, c.parent_code, w.id
FROM public.global_chart_of_accounts c
CROSS JOIN public.workspaces w
WHERE c.workspace_id IS NULL;

-- 4. Delete the original global records
DELETE FROM public.global_chart_of_accounts WHERE workspace_id IS NULL;

-- 5. Add unique constraint on (workspace_id, account_code)
ALTER TABLE public.global_chart_of_accounts ADD CONSTRAINT global_chart_of_accounts_workspace_id_account_code_key UNIQUE (workspace_id, account_code);

-- 6. Add foreign keys back with (workspace_id, account_code)
ALTER TABLE public.workspace_bank_accounts 
  ADD CONSTRAINT workspace_bank_accounts_coa_fkey 
  FOREIGN KEY (workspace_id, coa_account_code) 
  REFERENCES public.global_chart_of_accounts (workspace_id, account_code) ON DELETE RESTRICT;

ALTER TABLE public.journal_entries 
  ADD CONSTRAINT journal_entries_coa_fkey 
  FOREIGN KEY (workspace_id, account_code) 
  REFERENCES public.global_chart_of_accounts (workspace_id, account_code) ON DELETE RESTRICT;

ALTER TABLE public.global_chart_of_accounts 
  ADD CONSTRAINT global_chart_of_accounts_parent_fkey 
  FOREIGN KEY (workspace_id, parent_code) 
  REFERENCES public.global_chart_of_accounts (workspace_id, account_code) ON DELETE SET NULL;

-- 7. Differentiate COGS and Expenses
UPDATE public.global_chart_of_accounts 
SET account_type = 'COGS' 
WHERE account_code LIKE '500%';

-- 8. Enable RLS for real workspace isolation
ALTER TABLE public.global_chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view COA for their workspaces" ON public.global_chart_of_accounts;
CREATE POLICY "Users can view COA for their workspaces"
  ON public.global_chart_of_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = global_chart_of_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert COA" ON public.global_chart_of_accounts;
CREATE POLICY "Admins can insert COA"
  ON public.global_chart_of_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = global_chart_of_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('founder', 'superadmin', 'accounting')
    )
  );

DROP POLICY IF EXISTS "Admins can update COA" ON public.global_chart_of_accounts;
CREATE POLICY "Admins can update COA"
  ON public.global_chart_of_accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = global_chart_of_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('founder', 'superadmin', 'accounting')
    )
  );

DROP POLICY IF EXISTS "Admins can delete COA" ON public.global_chart_of_accounts;
CREATE POLICY "Admins can delete COA"
  ON public.global_chart_of_accounts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = global_chart_of_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('founder', 'superadmin', 'accounting')
    )
  );
