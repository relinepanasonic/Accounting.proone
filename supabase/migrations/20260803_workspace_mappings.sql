CREATE TABLE IF NOT EXISTS public.workspace_ledger_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  mapping_type text NOT NULL CHECK (mapping_type IN ('AR', 'SALES', 'AP', 'EXPENSE')),
  account_code text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(workspace_id, mapping_type)
);

ALTER TABLE public.workspace_ledger_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mappings for their workspaces"
    ON public.workspace_ledger_mappings
    FOR SELECT
    USING (
      workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    );

CREATE POLICY "Users can manage mappings for their workspaces"
    ON public.workspace_ledger_mappings
    FOR ALL
    USING (
      workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      )
    );

-- Add coa_account_code to workspace_bank_accounts
ALTER TABLE public.workspace_bank_accounts ADD COLUMN IF NOT EXISTS coa_account_code text;
