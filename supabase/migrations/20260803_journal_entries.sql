
-- Create journal_entries table for double-entry accounting
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    account_code TEXT REFERENCES public.global_chart_of_accounts(account_code) ON DELETE RESTRICT,
    transaction_date DATE NOT NULL,
    debit_amount NUMERIC(15,2) DEFAULT 0,
    credit_amount NUMERIC(15,2) DEFAULT 0,
    description TEXT,
    reference_id UUID,
    reference_type TEXT, -- e.g. 'invoice', 'expense', 'payroll', 'journal'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Create policy for workspace members to view and insert journal entries
CREATE POLICY "Workspace members can view journal entries" ON public.journal_entries
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can insert journal entries" ON public.journal_entries
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can update journal entries" ON public.journal_entries
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
    );
